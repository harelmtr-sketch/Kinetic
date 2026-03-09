# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kinetic is a React Native Expo app — an interactive calisthenics skill tree where users visualize and track bodyweight exercise progressions. The skill tree is rendered with GPU-accelerated 2D graphics via Shopify Skia.

## Commands

```bash
npm install                          # Install dependencies
npx expo prebuild --clean            # Regenerate native projects (needed after native dep changes)
npx expo run:android                 # Build + run on Android emulator (requires dev client)
npx expo run:ios                     # Build + run on iOS
npx expo start --dev-client          # Start Metro with dev client (default "npm start")
npx expo start                       # Start Metro for Expo Go ("npm run start:go")
npx expo start --tunnel              # Start with tunnel for physical device testing
```

**Important:** This app uses `expo-dev-client` and `@shopify/react-native-skia`, which require native builds (`expo run:android`). Expo Go will fail with missing native module errors.

## Architecture

### Entry Flow
`index.js` → `App.js` (GestureHandlerRootView + SafeAreaProvider) → `AppShell.js` (tab router) → Screens

### Key Files
- **`src/screens/TreeScreen.js`** — Main screen (~52KB). Owns all tree state, gesture handling (pan/pinch/drag/long-press), node CRUD, undo/redo, import/export. This is where most business logic lives.
- **`src/components/tree/SkiaTreeCanvas.js`** — Skia rendering engine (~16KB). Draws nodes, edges, dust sprites. Implements multi-tier LOD system.
- **`src/utils/treeUtils.js`** — Tree manipulation: branch resolution, normalization, stats computation.
- **`src/utils/skiaTreeUtils.js`** — Skia helpers: edge path generation, mulberry32 PRNG for dust.
- **`src/constants/tree.js`** — Constants: NODE_R=46, zoom bounds, AsyncStorage keys, LOD flags.
- **`src/theme/colors.js`** — Color palette with branch-specific color schemes.
- **`src/data/initialTree.js`** — Default tree (10 starter nodes across push/pull/core branches).

### Data Model

```js
tree = {
  nodes: [{ id, name, x, y, unlocked, isStart, branch }],
  edges: [{ from, to }],           // prerequisite links
  info:  { [nodeId]: { desc, str, bal, tec } }  // skill metadata, difficulty 0-9
}
```

**Node statuses:** `start` (origin) → `mastered` (unlocked) → `ready` (prerequisites met) → `locked`

**Branches:** `push` (green), `pull` (yellow), `core` (blue), `neutral` (blue). Auto-resolved via explicit field → name keywords → neighbor inference → default 'core'.

### Rendering & Performance
- **LOD system**: Far/near modes, interaction-aware quality (disables blur, glow during drag)
- **Atlas rendering**: 900 dust sprites via single Skia Atlas draw call
- **Path caching**: Edge paths cached in useRef, invalidated on node movement
- **Visibility culling**: Only nodes/edges in viewport are rendered
- **Reanimated worklets**: Gesture callbacks run on UI thread via shared values (txV, tyV, scV)

### State Management
- All state is local (useState/useRef) — no Redux or Context
- Persistence via AsyncStorage (keys in `src/constants/tree.js`)
- No backend; fully client-side

## Git Workflow

- No direct commits to `main` — use feature branches with squash merge
- PRs required for all changes
