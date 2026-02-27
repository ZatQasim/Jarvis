# JARVIS — AI Assistant

## Overview
A JARVIS AI assistant mobile app inspired by Iron Man's J.A.R.V.I.S., built with Expo/React Native. Features a dark HUD-style interface with animated arc reactor rings, streaming AI responses, and conversation history.

## Architecture
- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express.js (Node.js), TypeScript
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2) with JARVIS personality
- **State**: AsyncStorage (local persistence), React Query (server state)
- **Fonts**: Exo2 (body/headers), ShareTechMono (HUD labels)

## Key Files
- `app/index.tsx` — Main JARVIS chat screen with boot animation
- `app/history.tsx` — Conversation archive screen
- `app/_layout.tsx` — Root layout with font loading
- `components/JarvisRings.tsx` — Animated arc reactor visualization
- `components/MessageBubble.tsx` — JARVIS/user message bubbles with typing indicator
- `components/ChatInput.tsx` — Text input with send button
- `server/routes.ts` — `/api/chat` streaming endpoint with JARVIS system prompt
- `constants/colors.ts` — JARVIS dark HUD color palette

## Features
- JARVIS boot sequence animation on launch
- Animated arc reactor rings (rotate/pulse)
- Scanning line animation on idle screen
- Streaming AI responses (SSE) with typing indicator
- JARVIS personality system prompt (gpt-5.2)
- Conversation history saved to AsyncStorage
- Quick-start prompt chips on idle screen
- HUD-style dark theme (black/cyan/blue)

## Running
- Backend: `npm run server:dev` (port 5000)
- Frontend: `npm run expo:dev` (port 8081)

## Android APK
To generate an Android APK, use EAS Build:
```bash
npx eas build -p android --profile preview
```
Requires an Expo account at expo.dev.
