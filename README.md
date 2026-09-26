# CTT Home Practice App

A browser-based home-practice tool for Conversation Training Therapy (CTT), a voice therapy approach. Patients use it between clinic visits to practice shifting between a "target" voice and an "inefficient" voice during natural, conversational speech.

This is both a clinical tool and a research data-collection instrument. All data stays on the patient's device — there is no backend, no account system, and no cloud storage.

## What it does

- **Clinician setup** — enter the patient's two personalized voice labels once.
- **Practice session** — a 2.5-minute structured session (1 min target / 30s inefficient / 1 min target) with a progress bar, a conversational prompt, one confidence slider per practice period (thumbs-down to thumbs-up, recorded 0-100), and full-session audio recording.
- **Sound and Feel Changes** (the auditory-kinesthetic awareness step) — two required yes/no questions after each session.
- **Session review** — a color key for the patient's two voice labels, the patient's self-rated confidence (%) for each practice period. Timing data (how long each rating took) is captured for the clinician export only. The session audio is recorded and saved on the device but is not played back to the patient.
- **Daily Progress Review** — a reward page unlocked after the 7th session of the day: overlapping painterly circles (sized by percentage) for average confidence in the target and negative-practice voices, and how often the patient felt and heard a difference.
- **Clinician export** — downloads a single zip with full session data (JSON), a spreadsheet-ready CSV summary, and the audio recordings, for review during appointments.

## Running it locally

You'll need [Node.js](https://nodejs.org/) installed (v20+ recommended).

```bash
npm install
npm run dev
```

Then open the URL it prints (typically `http://localhost:5173`) in your browser. The practice session needs microphone access, which browsers only grant on `localhost` or over HTTPS — running it locally via `npm run dev` satisfies that.

## Tech stack

React + TypeScript + Vite, with all data stored locally in the browser via IndexedDB (no backend). See `src/` for the app itself.

## Status

Early beta — built and manually tested, not yet clinically validated at scale.
