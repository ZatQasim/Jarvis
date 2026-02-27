# JARVIS — AI Assistant

## Overview
A voice-first JARVIS AI assistant mobile app inspired by Iron Man's J.A.R.V.I.S., built with Expo/React Native. Features a dark HUD-style interface with animated arc reactor rings, voice-only responses using a sophisticated British voice, and an optional text transcript panel.

## Architecture
- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express.js (Node.js), TypeScript
- **AI Voice**: OpenAI gpt-audio "onyx" voice via Replit AI Integrations — JARVIS personality, British educated speech
- **AI Text**: OpenAI gpt-5.2 (text-only fallback endpoint `/api/chat`)
- **STT**: gpt-4o-mini-transcribe (parallel with voice generation for user transcript)
- **State**: AsyncStorage (conversation persistence), React Query (server state)
- **Fonts**: Exo2 (body/headers), ShareTechMono (HUD labels)
- **Audio**: expo-audio (replaces deprecated expo-av) for recording and playback

## Key Files
- `app/index.tsx` — Main JARVIS screen: voice mode + text mode + transcript panel
- `app/history.tsx` — Conversation archive screen
- `app/_layout.tsx` — Root layout with font loading
- `components/JarvisRings.tsx` — Animated arc reactor visualization
- `components/MessageBubble.tsx` — Message bubbles for text mode
- `components/ChatInput.tsx` — Text input for text mode
- `server/routes.ts` — `/api/voice-chat` (voice+text→audio) + `/api/chat` (streaming text)
- `constants/colors.ts` — JARVIS dark HUD color palette

## Modes
- **Voice mode** (mobile default): Full-screen arc reactor + mic button. Tap to speak, tap to stop. JARVIS responds with audio only.
- **Text mode** (web default, mobile optional): Chat interface. User types, JARVIS responds with voice (audio plays on mobile) and text (shown as bubbles).
- Toggle between modes via the mic/message icon in the header (mobile only).
- **Transcript panel**: Toggleable bottom sheet showing full conversation in text form (both modes).

## API Endpoints
- `POST /api/voice-chat` — Accepts `{audio: base64}` or `{text: string}` + `{history}`. Returns `{userTranscript, jarvisText, audio (base64 MP3)}`. Uses gpt-4o-mini-transcribe for STT + gpt-audio for voice generation (parallel).
- `POST /api/chat` — SSE streaming text chat with gpt-5.2 (kept for potential future use).

## Voice Characteristics
- Voice: OpenAI "onyx" — deepest, most authoritative voice
- System prompt: Calm, measured, sophisticated, witty British AI. 2-4 sentences. No markdown. Addresses user as "sir/ma'am" occasionally.
- STT and audio generation run in parallel for lowest latency.

## Running
- Backend: `npm run server:dev` (port 5000)
- Frontend: `npm run expo:dev` (port 8081)

## Notes
- Audio playback is silently skipped on web (Platform.OS guard)
- Voice recording requires microphone permission on mobile
- iOS silent mode bypassed: audio plays even with mute switch on
- Conversation history persisted to AsyncStorage (50 conversations max)
