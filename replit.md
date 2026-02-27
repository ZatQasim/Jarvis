# JARVIS — AI Assistant

## Overview
A JARVIS AI assistant mobile app inspired by Iron Man's J.A.R.V.I.S., built with Expo/React Native. Features a dark HUD-style interface with animated arc reactor rings, streaming AI responses with British voice synthesis, and conversation history.

## Architecture
- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express.js (Node.js), TypeScript
- **AI Text**: OpenAI gpt-5.2 via Replit AI Integrations — JARVIS personality
- **AI Voice**: OpenAI gpt-audio "onyx" voice — deep British TTS synthesis
- **State**: AsyncStorage (local persistence), React Query (server state)
- **Fonts**: Exo2 (body/headers), ShareTechMono (HUD labels)
- **Audio**: expo-av for playback, expo-file-system for temp audio caching

## Key Files
- `app/index.tsx` — Main JARVIS chat screen with boot animation + voice playback
- `app/history.tsx` — Conversation archive screen
- `app/_layout.tsx` — Root layout with font loading
- `components/JarvisRings.tsx` — Animated arc reactor visualization
- `components/MessageBubble.tsx` — JARVIS/user message bubbles with typing indicator
- `components/ChatInput.tsx` — Text input with send button
- `server/routes.ts` — `/api/chat` (SSE streaming) + `/api/tts` (voice synthesis)
- `constants/colors.ts` — JARVIS dark HUD color palette

## Features
- JARVIS boot sequence animation on launch
- Animated arc reactor rings (rotate/pulse)
- Scanning line animation on idle screen
- Streaming AI text responses (SSE) with typing indicator
- Automatic voice synthesis after each JARVIS response (onyx voice, deep British)
- Speaking wave animation in header while JARVIS is speaking
- Mute button to stop audio playback
- Conversation history saved to AsyncStorage
- Quick-start prompt chips on idle screen
- HUD-style dark theme (black/cyan/blue)

## API Endpoints
- `POST /api/chat` — SSE streaming chat with JARVIS personality (gpt-5.2)
- `POST /api/tts` — Text-to-speech synthesis (gpt-audio, onyx voice, MP3)

## Running
- Backend: `npm run server:dev` (port 5000)
- Frontend: `npm run expo:dev` (port 8081)

## Android APK
To generate an Android APK, use EAS Build:
```bash
npx eas build -p android --profile preview
```
Requires an Expo account at expo.dev.
