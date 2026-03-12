# Kinetic

Kinetic is a React Native (Expo) app that turns calisthenics training into an interactive skill tree. Visualize your bodyweight exercise progressions on a GPU-accelerated canvas, unlock skills by meeting prerequisites, and track your journey from basics to advanced moves.

## Features
- Interactive skill tree rendered with Shopify Skia (GPU-accelerated 2D graphics)
- Three progression branches: Push, Pull, and Core
- Node status system: Origin → Mastered → Ready → Locked
- ELO-style rating that grows as you unlock skills
- Edit mode for customizing your tree (add/remove/link nodes)
- Import/export trees as JSON
- Starfield galaxy background with dynamic node glow effects

## Tech Stack
- React Native (Expo) with expo-dev-client
- @shopify/react-native-skia for canvas rendering
- react-native-gesture-handler + react-native-reanimated for gestures
- AsyncStorage for local persistence
- No backend — fully client-side

## Setup
```bash
npm install
npx expo prebuild --clean   # after native dependency changes
npx expo run:android        # build + run Android dev client
npx expo run:ios            # build + run iOS
npm start                   # start Metro (dev client mode)
```

> **Note:** This app requires a development build. Expo Go will fail due to native Skia modules.

## Project Structure
```
src/
  screens/       – TreeScreen, ProfileScreen, SettingsScreen
  components/    – tree/ (SkiaTreeCanvas, SkillCard, NamePrompt), common/
  navigation/    – AppShell (tab router)
  data/          – Initial tree definition
  utils/         – Tree logic, Skia helpers
  constants/     – Node radius, zoom bounds, storage keys
  theme/         – Color palette, branch colors
```

## Workflow
- Do not commit directly to main
- Create a feature branch for each change
- Open a Pull Request into main
- Squash merge after review
