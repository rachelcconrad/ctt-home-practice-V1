# CTT Home Practice App

A browser-based home-practice tool for Conversation Training Therapy (CTT), a voice therapy approach. Patients use it between clinic visits to practice shifting between a "target" voice and an "inefficient" voice during natural, conversational speech.

This is both a clinical tool and a research data-collection instrument. All data stays on the patient's device — there is no backend, no account system, and no cloud storage.

## What it does

- **Clinician setup** — enter the patient's two personalized voice labels once.
- **Practice session** — a 2.5-minute structured session (1 min target / 30s inefficient / 1 min target) with a live timer, a conversational prompt, two always-on-screen voice buttons the patient taps to self-report which voice they're producing, and full-session audio recording.
- **Session review** — synced "Target" and "Felt" timelines with an audio scrubber, the two key timing metrics (time to reach target voice, time to return after the inefficient interval), a post-hoc acoustic voice-clarity score (Cepstral Peak Prominence Smoothed, reimplemented from Praat's own algorithm), and skippable journal prompts.
- **Clinician export** — downloads a single zip with full session data (JSON), a spreadsheet-ready CSV summary, and the audio recordings, for review during appointments.

## Running it locally

You'll need [Node.js](https://nodejs.org/) installed (v20+ recommended).

```bash
npm install
npm run dev
```

Then open the URL it prints (typically `http://localhost:5173`) in your browser. The practice session needs microphone access, which browsers only grant on `localhost` or over HTTPS — running it locally via `npm run dev` satisfies that.

## Tech stack

React + TypeScript + Vite, with all data stored locally in the browser via IndexedDB (no backend). See `src/` for the app itself; `src/analysis/cpps.ts` has notes on the voice-clarity analysis implementation.

## Status

Early beta — built and manually tested, not yet clinically validated at scale.
