import FFT from 'fft.js';
import type { SessionInterval, VoiceAnalysis } from '../db/types';

// Cepstral Peak Prominence (Smoothed) pipeline, reimplemented in JS by reading
// Praat's own source (github.com/praat/praat, GPL) rather than reverse-
// engineering from papers — specifically LPC/Sound_to_PowerCepstrogram.cpp,
// LPC/PowerCepstrogram.cpp, and the default parameters in
// LPC/praat_LPC_init.cpp for "Sound: To PowerCepstrogram..." /
// "PowerCepstrogram: Get CPPS...". Matches Praat's default settings:
// analysis at 10 kHz (2x a 5000 Hz max frequency), 50 Hz pre-emphasis,
// Gaussian analysis window, peak search 60-330 Hz, trend line fit over
// 1-50 ms quefrency, 20 ms time / 0.5 ms quefrency smoothing.
//
// This is a from-scratch reimplementation, not a line-for-line port —
// validate output against Praat itself on real recordings before trusting
// exact threshold cutoffs clinically.

const MAX_FREQUENCY_HZ = 5000;
const ANALYSIS_SAMPLE_RATE = 2 * MAX_FREQUENCY_HZ; // 10000 Hz
const PRE_EMPHASIS_FROM_HZ = 50;
const PITCH_FLOOR_HZ = 60; // drives the analysis window duration
const HOP_SECONDS = 0.005; // 5 ms (Praat default is 2 ms; coarsened for speed)

const TIME_SMOOTHING_SECONDS = 0.02; // 20 ms
const QUEFRENCY_SMOOTHING_SECONDS = 0.0005; // 0.5 ms
const EPS = 1e-30;

// Peak search range (Hz) — standard "Get CPPS..." default.
const PEAK_F0_MIN_HZ = 60;
const PEAK_F0_MAX_HZ = 330;

// Trend-line quefrency fit range (seconds) — standard default (1-50 ms).
const TREND_QUEFRENCY_MIN_S = 0.001;
const TREND_QUEFRENCY_MAX_S = 0.05;

// Frames quieter than (loudest frame - this many dB) are treated as pauses
// and excluded from both metrics, so natural conversational pauses don't
// get counted as "not clear voice." Not part of Praat's CPPS algorithm —
// an addition for scoring continuous conversational speech.
const SILENCE_RELATIVE_DB = 35;

const MIN_ANALYZABLE_SECONDS = 3;

export const CLEAR_VOICE_THRESHOLD_DB = 9.33; // connected-speech CPPS cutoff

async function decodeToMono(blob: Blob, sampleRate: number): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, sampleRate);
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }
  const mono = new Float32Array(audioBuffer.length);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / audioBuffer.numberOfChannels;
  }
  return mono;
}

// First-order high-pass pre-emphasis, matching Praat's Sound_preEmphasize_inplace.
function preEmphasize(samples: Float32Array, sampleRate: number, cutoffHz: number): Float32Array {
  const factor = Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  const out = new Float32Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) out[i] = samples[i] - factor * samples[i - 1];
  return out;
}

// Praat's GAUSSIAN_2 analysis window (edge-corrected Gaussian).
function gaussianWindow2(size: number): Float64Array {
  const w = new Float64Array(size);
  const edge = Math.exp(-12.0);
  const oneByEdge = 1.0 / (1.0 - edge);
  const imid = 0.5 * (size + 1);
  for (let i = 1; i <= size; i++) {
    const phase = (i - imid) / size;
    w[i - 1] = (Math.exp(-48.0 * phase * phase) - edge) * oneByEdge;
  }
  return w;
}

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumXX += xs[i] * xs[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function movingAverage1D(values: Float64Array, radius: number): Float64Array {
  if (radius <= 0) return values;
  const n = values.length;
  const out = new Float64Array(n);
  // Prefix sums for O(n) windowed averaging.
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + values[i];
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - radius);
    const hi = Math.min(n - 1, i + radius);
    out[i] = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
  }
  return out;
}

interface FrameSeries {
  cppDb: number[];
  energyDb: number[];
  frameTimesMs: number[];
}

export function computeCppsSeries(samples: Float32Array, sampleRate: number): FrameSeries {
  const effectiveAnalysisWidth = 3.0 / PITCH_FLOOR_HZ;
  const physicalAnalysisWidth = 2.0 * effectiveAnalysisWidth; // Gaussian windows double the width
  const windowSamples = Math.round(physicalAnalysisWidth * sampleRate);
  const fftSize = Math.max(2, Math.pow(2, Math.ceil(Math.log2(windowSamples))));
  const half = fftSize / 2;

  const hopSize = Math.max(1, Math.round(HOP_SECONDS * sampleRate));
  const dq = 1 / sampleRate; // quefrency resolution

  const window = gaussianWindow2(windowSamples);
  const fft = new FFT(fftSize);

  const hzToBin = (hz: number) => Math.round(sampleRate / hz);
  const peakBinMin = Math.max(1, hzToBin(PEAK_F0_MAX_HZ));
  const peakBinMax = Math.min(half, hzToBin(PEAK_F0_MIN_HZ));
  const regBinMin = Math.max(1, Math.round(TREND_QUEFRENCY_MIN_S / dq));
  const regBinMax = Math.min(half, Math.round(TREND_QUEFRENCY_MAX_S / dq));

  const frameCount = Math.max(0, Math.floor((samples.length - windowSamples) / hopSize) + 1);
  if (frameCount <= 0) return { cppDb: [], energyDb: [], frameTimesMs: [] };

  // Pass 1: per-frame power cepstrum (in dB) and energy, no smoothing yet.
  const cepstra: Float64Array[] = new Array(frameCount);
  const energyDb: number[] = new Array(frameCount);
  const windowed = new Array<number>(fftSize).fill(0);
  const spectrum = fft.createComplexArray();
  const cepIn = fft.createComplexArray();
  const cepOut = fft.createComplexArray();

  for (let f = 0; f < frameCount; f++) {
    const start = f * hopSize;
    let sumSq = 0;
    for (let i = 0; i < windowSamples; i++) {
      const s = samples[start + i] ?? 0;
      sumSq += s * s;
      windowed[i] = s * window[i];
    }
    for (let i = windowSamples; i < fftSize; i++) windowed[i] = 0;
    energyDb[f] = 10 * Math.log10(sumSq / windowSamples + EPS);

    fft.realTransform(spectrum, windowed);
    fft.completeSpectrum(spectrum);

    // Natural-log power spectrum -> cepstrum via inverse FFT -> power cepstrum (squared).
    for (let k = 0; k <= half; k++) {
      const re = spectrum[2 * k];
      const im = spectrum[2 * k + 1];
      const power = re * re + im * im;
      cepIn[2 * k] = Math.log(power + EPS);
      cepIn[2 * k + 1] = 0;
      if (k > 0 && k < half) {
        cepIn[2 * (fftSize - k)] = cepIn[2 * k];
        cepIn[2 * (fftSize - k) + 1] = 0;
      }
    }
    fft.inverseTransform(cepOut, cepIn);

    const powerCepstrum = new Float64Array(half + 1);
    for (let q = 0; q <= half; q++) {
      const re = cepOut[2 * q];
      powerCepstrum[q] = re * re;
    }
    cepstra[f] = powerCepstrum;
  }

  // Pass 2: smooth the cepstrogram across BOTH time and quefrency (the "S" in CPPS).
  const timeRadius = Math.max(0, Math.round(TIME_SMOOTHING_SECONDS / HOP_SECONDS / 2));
  const quefRadius = Math.max(0, Math.round(QUEFRENCY_SMOOTHING_SECONDS / dq / 2));

  const timeSmoothed: Float64Array[] = new Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    const lo = Math.max(0, f - timeRadius);
    const hi = Math.min(frameCount - 1, f + timeRadius);
    const n = hi - lo + 1;
    const acc = new Float64Array(half + 1);
    for (let g = lo; g <= hi; g++) {
      const c = cepstra[g];
      for (let q = 0; q <= half; q++) acc[q] += c[q];
    }
    for (let q = 0; q <= half; q++) acc[q] /= n;
    timeSmoothed[f] = acc;
  }

  const cppDb: number[] = new Array(frameCount);
  const regX: number[] = [];
  const regY: number[] = [];

  for (let f = 0; f < frameCount; f++) {
    const smoothed = movingAverage1D(timeSmoothed[f], quefRadius);

    regX.length = 0;
    regY.length = 0;
    for (let q = regBinMin; q <= regBinMax; q++) {
      regX.push(q);
      regY.push(10 * Math.log10(smoothed[q] + EPS));
    }
    const { slope, intercept } = linearRegression(regX, regY);

    let peakVal = -Infinity;
    let peakBin = peakBinMin;
    for (let q = peakBinMin; q <= peakBinMax; q++) {
      const db = 10 * Math.log10(smoothed[q] + EPS);
      if (db > peakVal) {
        peakVal = db;
        peakBin = q;
      }
    }

    const predicted = slope * peakBin + intercept;
    cppDb[f] = peakVal - predicted;
  }

  const frameTimesMs: number[] = new Array(frameCount);
  for (let f = 0; f < frameCount; f++) frameTimesMs[f] = ((f * hopSize) / sampleRate) * 1000;

  return { cppDb, energyDb, frameTimesMs };
}

// Only the structured "target voice" intervals count toward the score — the
// inefficient interval is intentional negative practice, not a lapse, so it
// should never pull the score down.
function isDuringTargetInterval(tMs: number, intervals: SessionInterval[]): boolean {
  return intervals.some((iv) => iv.voice === 'target' && tMs >= iv.startMs && tMs < iv.endMs);
}

function summarize(series: FrameSeries, intervals: SessionInterval[], thresholdDb: number): VoiceAnalysis | null {
  const { cppDb, energyDb, frameTimesMs } = series;
  if (cppDb.length === 0) return null;

  const targetIndices: number[] = [];
  for (let i = 0; i < cppDb.length; i++) {
    if (isDuringTargetInterval(frameTimesMs[i], intervals)) targetIndices.push(i);
  }
  if (targetIndices.length === 0) return null;

  const maxEnergy = Math.max(...targetIndices.map((i) => energyDb[i]));
  const voiced: number[] = [];
  for (const i of targetIndices) {
    if (energyDb[i] >= maxEnergy - SILENCE_RELATIVE_DB) voiced.push(cppDb[i]);
  }
  if (voiced.length === 0) return null;

  const bestCppsDb = Math.round(Math.max(...voiced));
  const clearCount = voiced.filter((v) => v >= thresholdDb).length;
  const percentTimeClear = Math.round((100 * clearCount) / voiced.length);

  return { bestCppsDb, percentTimeClear, thresholdDb };
}

export async function analyzeSessionAudio(blob: Blob, intervals: SessionInterval[]): Promise<VoiceAnalysis | null> {
  const decoded = await decodeToMono(blob, ANALYSIS_SAMPLE_RATE);
  if (decoded.length / ANALYSIS_SAMPLE_RATE < MIN_ANALYZABLE_SECONDS) return null;
  const samples = preEmphasize(decoded, ANALYSIS_SAMPLE_RATE, PRE_EMPHASIS_FROM_HZ);

  const series = computeCppsSeries(samples, ANALYSIS_SAMPLE_RATE);
  return summarize(series, intervals, CLEAR_VOICE_THRESHOLD_DB);
}
