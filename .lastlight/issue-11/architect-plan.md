# Architect Plan — Issue #11: Snake Game

## Problem Statement

The site (`seriousjul.github.io`, a Docusaurus 3.10.1 static blog) currently hosts several embedded SPA-style games under `/sudoku*` routes. Issue #11 requests a **Snake game** as a new dedicated page, accessible from the site menu, with keyboard controls, game options (speed), and optional background music. The project follows a consistent pattern: a page file (`src/pages/<name>.tsx`) wrapping a React component (`src/components/<Name>/<Name>.tsx`) scoped with a CSS module (`<Name>.module.css`), plus a navbar entry in `docusaurus.config.ts`. This plan creates the snake game following that exact pattern, with no changes to existing game files.

## Summary of Changes

- **Add** a new Snake game component (`SnakeGame.tsx` + CSS module) in `src/components/SnakeGame/`
- **Add** a new page route (`src/pages/snake.tsx`) wrapping the component in `<Layout>`
- **Modify** `docusaurus.config.ts` to add a "Snake" entry to the navbar (in the existing "Sudoku" dropdown or as a standalone item)
- **No** new dependencies — the game uses only React, the Web Audio API (for optional background music), and Canvas2D (for rendering)

## Files to Modify — Exhaustive Manifest

### 1. `src/components/SnakeGame/SnakeGame.tsx` — **NEW FILE**

Full Snake game React component. Implements:
- Canvas-based rendering (20×20 grid, responsive sizing)
- Keyboard controls: Arrow keys / WASD for direction, Space for pause/resume, R for restart
- Game loop via `useEffect` + `setInterval` (tick interval controlled by speed setting)
- Speed selector: Slow / Normal / Fast / Insane (dropdown or radio buttons)
- Score display and high score (localStorage)
- Game states: idle (start screen), playing, paused, game-over
- Optional background music: Web Audio API oscillator generating a simple looping chiptune melody. Muted by default (respecting user interaction policy); toggle button in the UI. Music is generated programmatically (no external audio files needed).
- Dark/light theme support using CSS custom properties from Infima
- All game logic is self-contained in this file (no helper modules needed for a snake game)

**Component API:** No props. Renders full-screen game area with controls overlay.

### 2. `src/components/SnakeGame/SnakeGame.module.css` — **NEW FILE**

Scoped CSS for the Snake game component. Defines:
- `.gameContainer` — outer wrapper, flex column, full viewport height minus navbar
- `.canvas` — the game canvas, responsive width/height, max constrained
- `.scoreBar` — score + high score display above the canvas
- `.controls` — speed selector, mute toggle, restart button
- `.overlay` — start screen / game-over screen overlay (positioned over canvas)
- Theme variables for light and dark modes via `[data-theme='light']` and `[data-theme='dark']` selectors
- Consistent styling language with existing Sudoku components (same button styles, same color palette using `--ifm-color-primary` etc.)

### 3. `src/pages/snake.tsx` — **NEW FILE**

Docusaurus page wrapping the SnakeGame component:

```tsx
import React from 'react';
import Layout from '@theme/Layout';
import SnakeGame from '@site/src/components/SnakeGame/SnakeGame';

export default function SnakePage(): React.ReactNode {
    return (
        <Layout title="Snake" description="Play Snake — a classic arcade game">
            <main style={{ padding: '2rem', minHeight: 'calc(100vh - var(--ifm-navbar-height))' }}>
                <SnakeGame />
            </main>
        </Layout>
    );
}
```

Identical pattern to `src/pages/sudoku.tsx`, `src/pages/sudoku2.tsx`, etc.

### 4. `docusaurus.config.ts` — **MODIFY**

**Location:** Lines 56–76, the `navbar.items` array.

**Change:** Add a "Snake" menu item. Following the existing pattern where the Sudoku dropdown is at position 'left', add Snake as a standalone item between the Sudoku dropdown and the Blog item:

```typescript
{to: '/snake', label: 'Snake', position: 'left'},
```

**Exact insertion point:** After the closing `]` of the Sudoku dropdown's `items` array (line ~73, the `}` closing the dropdown object) and before `{to: '/blog', label: 'Blog', position: 'left'}` (line ~74).

The resulting navbar order will be: Tutorial | Blog | Sudoku (dropdown) | **Snake** | Resume | LinkedIn | GitHub

**No other changes** to `docusaurus.config.ts`.

## Commands (from guardrails-report.md)

```pwsh
npm run typecheck   # tsc — TypeScript type checking (pre-existing errors in SudokuGameV2 only)
npm run format      # prettier --write src/**/* — Prettier formatting
npm run build       # docusaurus build — Build static site into build/
```

> **Note:** The project has no test runner. The guardrails report notes a Playwright smoke test file (`tests/sudoku2-verify.mjs`) exists but is not wired into any test runner. No test step is planned for this change.

## Implementation Approach

### Step 1: Create `src/components/SnakeGame/SnakeGame.tsx`

The component implements a classic Snake game on a `<canvas>` element:

1. **State management** (useState):
   - `snake`: array of `{x, y}` coordinate objects (head at index 0)
   - `food`: `{x, y}` coordinate
   - `direction`: current movement direction (`'UP' | 'DOWN' | 'LEFT' | 'RIGHT'`)
   - `gameState`: `'idle' | 'playing' | 'paused' | 'gameOver'`
   - `score`, `highScore` (from localStorage)
   - `speed`: `'slow' | 'normal' | 'fast' | 'insane'`
   - `musicMuted`: boolean

2. **Game loop** (useEffect + setInterval):
   - On each tick: compute new head position from current direction, check collisions (wall + self), check food consumption, update snake array, spawn new food if eaten
   - Tick interval maps to speed: slow=200ms, normal=120ms, fast=70ms, insane=40ms

3. **Keyboard handler** (useEffect + `window.addEventListener('keydown')`):
   - Arrow keys / WASD: change direction (prevent 180° reversal)
   - Space: toggle pause/resume
   - R: restart game
   - M: toggle music mute

4. **Canvas rendering** (useEffect with requestAnimationFrame or direct canvas drawing):
   - Draw grid (subtle), snake (green gradient), food (red), score overlay
   - Draw start screen overlay when `gameState === 'idle'`
   - Draw game-over overlay when `gameState === 'gameOver'`

5. **Music** (Web Audio API, lazy-initialized on first user interaction):
   - Create `AudioContext` on first keypress or button click
   - Generate a simple looping melody using oscillators (e.g., a 4-note pattern at ~120 BPM)
   - Mute by default; toggle via M key or UI button
   - Graceful degradation: if Web Audio API is unavailable, mute stays true silently (warn-and-surface: show a small "audio unavailable" note in the controls area)

### Step 2: Create `src/components/SnakeGame/SnakeGame.module.css`

Mirror the styling approach of `SudokuBoard.module.css`:
- Light theme: `[data-theme='light']` selectors
- Dark theme: `[data-theme='dark']` selectors
- Use Infica CSS custom properties (`--ifm-color-primary`, `--ifm-background-color`, etc.)
- Canvas sized to `min(90vw, 500px)` × `min(90vw, 500px)` for responsiveness
- Button styles matching existing `.controlBtn` from Sudoku components

### Step 3: Create `src/pages/snake.tsx`

One-liner page following the exact pattern of `sudoku.tsx`.

### Step 4: Modify `docusaurus.config.ts`

Insert one line: `{to: '/snake', label: 'Snake', position: 'left'},` in the navbar items array.

### Step 5: Run guardrails

```pwsh
npm run typecheck   # Verify no new tsc errors
npm run format      # Format all changed files
npm run build       # Verify full site builds
```

## Risks and Edge Cases

| Risk / Edge Case | Behavior |
|---|---|
| **Mobile / touch input** | The issue specifies "keyboard control." No touch/swipe support is planned. **Warn-and-surface:** if the viewport is narrow (<400px), show a small note "Best played on desktop with keyboard." No silent default. |
| **Web Audio API unavailable** (e.g., very old browsers) | Music generation is optional. If `AudioContext` constructor throws, mute stays true and a small "Audio not supported in this browser" note appears in the controls area. **Warn-and-surface**, never silently fail. |
| **localStorage unavailable** (private browsing) | High score falls back to in-memory only. **Warn-and-surface:** show a small note "High score not saved (private browsing)." No data loss — the current session score is preserved. |
| **Tab loses focus during gameplay** | Game auto-pauses when the tab loses focus (via `document.addEventListener('visibilitychange')`). Resumes when focus returns. This is standard behavior for browser games. |
| **Rapid key presses** | Direction changes are debounced per tick — only the last direction in the current tick is applied. Prevents accidental 180° reversals from fast key combos. |
| **Very fast speeds (insane)** | At 40ms tick, the game is very fast. No safety concern, but the UI clearly labels it "Insane" to set expectations. |
| **Pre-existing tsc errors in SudokuGameV2** | These are on this branch already (lines 179, 195, 228 of `SudokuGameV2.tsx`). The snake game must not introduce additional tsc errors. |
| **Canvas size on small screens** | Canvas is constrained by CSS to `min(90vw, 500px)`. On very small screens (<300px viewport), the canvas will be tiny and nearly unplayable. **Warn-and-surface:** show a note suggesting a larger viewport. |
| **Docusaurus client-side navigation** | The snake game uses `window.addEventListener` and `document.addEventListener`. On Docusaurus SPA navigation away from `/snake`, the event listeners must be cleaned up in useEffect return functions. This is handled in the component. |

## Test Strategy

1. **TypeScript type check:** `npm run typecheck` — verify zero new errors from snake game files. Pre-existing SudokuGameV2 errors are acknowledged but not in scope.
2. **Prettier format:** `npm run format` — verify all new files pass formatting.
3. **Docusaurus build:** `npm run build` — verify the full site builds successfully with the new page and component.
4. **Visual / interactive verification (manual):**
   - Open `http://localhost:3000/snake` in a browser
   - Verify: snake moves, direction changes with arrow keys/WASD, food spawns, score increments, game-over on collision, restart works, speed changes affect tick rate, music toggle works (or shows unavailable note)
   - Verify: navbar shows "Snake" link, clicking it navigates to the game
   - Verify: dark mode renders correctly
   - Verify: responsive sizing on different viewport widths

## Estimated Complexity: **medium**

The game logic is straightforward (classic Snake), but the full implementation requires:
- Canvas rendering with responsive sizing
- Keyboard input handling with proper cleanup
- Game state management (4 states)
- Speed selector UI
- Optional Web Audio API music (with graceful degradation)
- Dark/light theme support
- localStorage for high score (with graceful degradation)
- Docusaurus SPA navigation compatibility (event listener cleanup)

The pattern is well-established (follows the Sudoku component structure exactly), which reduces risk.
