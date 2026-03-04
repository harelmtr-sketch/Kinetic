# Kinetic
Kinetic is a React Native (Expo) app that turns calisthenics training into an interactive skill tree. Users progress by filming their exercises, and the app uses AI-based form recognition and progression systems to track and unlock skills. The goal is to gamify strength development and make progression structured, visual, and measurable.

## Tech Stack
- React Native (Expo)
- JavaScript
- Node.js
- AI form recognition system (in development / integrated modules)

## Setup
- npm install
- npx expo prebuild --clean (after native dependency changes)
- npx expo run:android (build/install the Android dev client)
- npm run start (starts Metro for the dev client; Skia will not run in Expo Go)

## Project Structure
- components/ – UI components
- data/ – Skill tree and progression data
- utils/ – Helper functions and logic
- assets/ – Images and static files

## Workflow
- Do not commit directly to main
- Create a feature branch for each change
- Open a Pull Request into main
- Squash merge after review
- Do NOT touch the skill tree data/logic unless explicitly stated otherwise.

## Runtime notes
- `@shopify/react-native-skia` requires a development build (Expo Dev Client / EAS build).
- Use `npm run start` (dev-client mode) for local Android testing; `npm run start:go` is kept only for non-Skia screens.
