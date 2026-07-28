# Snake Game — Specification

## Overview

A Snake game implemented as a `/snake` route within the existing personal website. Built with React 19, TypeScript, and Canvas rendering. Deployed via the existing GitHub Pages workflow.

## Tech Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Rendering**: HTML5 Canvas
- **Styling**: CSS (consistent with existing site)
- **Build / Deployment**: Docusaurus 3, GitHub Pages (existing pipeline)

---

## Route & Navigation

- Accessible at `/snake`.
- Added to the site navigation (header or sidebar) alongside existing pages.
- A "Play Snake" link in the main nav bar or a dedicated games section.

---

## Core Gameplay

### Grid

- Default: **20 × 20** cells.
- Cell size scales to fit the canvas within the viewport.
- Grid lines are optionally visible (configurable).

### Snake

- Starts at the grid center, length 3, moving right.
- Moves one cell per tick.
- Direction changes are buffered: only the next queued turn is applied at each tick, preventing self-collision from rapid key presses.

### Food

- One food item on the grid at a time.
- Spawned at a random cell not occupied by the snake.
- Eating food increases snake length by 1 and score by the configured point value.
- A new food item spawns immediately after eating.

### Collision

- **Walls**: Wrap-around (snake exits one side, enters the opposite). Configurable to also support hard-wall (game over on wall hit).
- **Self**: Game over when the snake's head collides with any body segment.

### Speed

- Default: constant speed (e.g., 150 ms per tick).
- Configurable to also increase speed as the snake grows.

---

## Controls

| Input         | Action              |
|---------------|---------------------|
| Arrow keys    | Change direction    |
| WASD keys     | Change direction    |
| Space / P     | Pause / Resume      |
| Enter / R     | Restart (after game over or anytime) |
| Swipe (mobile) | Change direction   |

- Opposite-direction input is ignored (cannot reverse into yourself).
- Touch swipe threshold: ~30 px to register.

---

## Scoring

- **Score**: Incremented by a configurable amount per food eaten (default: 10 points).
- **High Score**: Persisted in `localStorage` (key: `snake-high-score`).
- Both current score and high score are displayed above the canvas.

---

## Configuration

All gameplay parameters are exposed as configurable options, accessible via a settings panel (toggle button) or query parameters for deep-linking.

| Setting           | Type       | Default     | Description                              |
|-------------------|------------|-------------|------------------------------------------|
| `gridSize`        | `number`   | `20`        | Grid dimensions (square, N × N)          |
| `tickInterval`    | `number`  | `150`       | Milliseconds per tick                    |
| `speedScaling`    | `boolean` | `false`     | Increase speed as snake grows            |
| `wallMode`        | `"wrap" \| "die"` | `"wrap"` | Wall collision behavior              |
| `pointsPerFood`   | `number`  | `10`        | Points awarded per food eaten            |
| `showGrid`        | `boolean` | `true`      | Display grid lines                       |
| `theme`           | `string`  | `"classic"` | Visual theme (see Themes section)        |

Query parameter example: `/snake?gridSize=30&tickInterval=100&wallMode=die`

Settings changes apply immediately without resetting the game (except `gridSize`, which resets).

---

## Themes

Visual themes control colors for background, snake head/body, food, grid lines, and UI chrome.

| Theme      | Background  | Snake Head  | Snake Body   | Food       | Grid Lines   |
|------------|-------------|-------------|--------------|------------|--------------|
| `classic`  | `#1a1a2e`   | `#00ff88`   | `#00cc6a`    | `#ff4757`  | `#2a2a4a`    |
| `retro`    | `#000000`   | `#33ff33`   | `#00cc00`    | `#ff0000`  | `#1a1a1a`    |
| `pastel`   | `#fdf6e3`   | `#b58900`   | `#cb4b16`    | `#dc322f`  | `#eee8d5`    |
| `ocean`    | `#0a1628`   | `#00d2ff`   | `#0099cc`    | `#ff6b6b`  | `#162a4a`    |

A theme selector dropdown is available in the settings panel.

---

## UI Layout

```
┌──────────────────────────────────┐
│  Score: 120    High Score: 350   │
├──────────────────────────────────┤
│                                  │
│      ┌────────────────────┐      │
│      │                    │      │
│      │                    │      │
│      │     CANVAS         │      │
│      │                    │      │
│      │                    │      │
│      └────────────────────┘      │
│                                  │
├──────────────────────────────────┤
│  [Pause] [Restart] [⚙ Settings] │
└──────────────────────────────────┘
```

- Canvas is centered and responsive (maintains square aspect ratio).
- On game over: a semi-transparent overlay appears on the canvas with "Game Over", final score, and a "Play Again" button.
- On pause: a "Paused" overlay with a "Resume" button.

---

## Sound Effects

- Optional, toggled in settings (default: on).
- Implemented via the Web Audio API (no external audio files).
- Sounds:
  - **Eat**: short ascending chirp (~150 ms).
  - **Game Over**: descending tone (~400 ms).
  - **Direction change**: subtle click (~50 ms).

---

## Component Structure

```
src/
└── pages/
    └── snake.tsx                     # Page component (route: /snake)
└── components/
    └── snake/
        ├── SnakeGame.tsx             # Main game orchestrator
        ├── SnakeCanvas.tsx           # Canvas rendering + game loop
        ├── SnakeControls.tsx         # Buttons (pause, restart, settings)
        ├── SnakeScoreboard.tsx       # Score + high score display
        ├── SnakeOverlay.tsx          # Game over / pause overlays
        ├── SnakeSettings.tsx         # Settings panel
        ├── useSnakeGame.ts           # Game logic hook (state, updates)
        ├── useSnakeInput.ts          # Keyboard + touch input handling
        ├── useSnakeSound.ts          # Web Audio API sound effects
        └── types.ts                  # Shared TypeScript types
```

---

## Key Implementation Details

### Game Loop

- Uses `requestAnimationFrame` with a time accumulator to maintain consistent tick intervals regardless of frame rate.
- Game loop is managed inside `useSnakeGame` via `useEffect` and a `ref` to avoid stale closures.

### Canvas Rendering

- Canvas size is calculated based on container width, maintaining a 1:1 aspect ratio.
- Rendered at device pixel ratio (`window.devicePixelRatio`) for crisp visuals on HiDPI displays.
- Each cell's pixel dimensions are recalculated on resize.

### Input Handling

- `useSnakeInput` listens for `keydown` (arrow keys, WASD, Space, P, Enter, R) at the `window` level.
- Touch events (`touchstart`, `touchend`) on the canvas for swipe detection.
- Input is debounced: only one direction change is queued per tick.

### State Management

- All game state lives in `useSnakeGame` (React `useState` / `useRef`).
- State shape:

```ts
interface GameState {
  snake: Point[];          // Ordered from head to tail
  food: Point;
  direction: Direction;    // 'up' | 'down' | 'left' | 'right'
  score: number;
  highScore: number;
  status: 'idle' | 'playing' | 'paused' | 'gameOver';
  config: GameConfig;
}
```

### Persistence

- High score saved to `localStorage` on change.
- Settings (theme, sound toggle, etc.) saved to `localStorage` and restored on load.

---

## Docusaurus Integration

- Register `/snake` as a custom page by placing `snake.tsx` in `src/pages/`.
- Add a nav link in `docusaurus.config.ts` under `themeConfig.nav.items`:
  ```ts
  { to: '/snake', label: 'Snake', position: 'right' }
  ```
- Custom CSS placed in `src/css/snake.css`, imported by the page component.
- Existing CI/CD pipeline (`.github/workflows/ci-cd.yml`) handles build and deploy — no changes needed.

---

## Use Cases

Each use case describes a scenario, the steps to execute it, and the expected result. These serve as validation criteria for the implementation.

### UC-1: Navigate to the Snake game

- **Steps**: Visit `/snake` (or click "Snake" in the navigation bar).
- **Expected**: The page renders the game UI: scoreboard at the top, a centered canvas, and control buttons (Pause, Restart, Settings) below. The game is in `idle` status and awaiting user input to start.

### UC-2: Start the game

- **Steps**: While in `idle` status, press an arrow key (e.g., `↑`).
- **Expected**: The game transitions to `playing`. The snake (length 3, centered on the grid) begins moving in the pressed direction. One food item is visible on the grid.

### UC-3: Change direction with arrow keys

- **Steps**: While playing, press `→`.
- **Expected**: The snake changes direction to right on the next tick. Score and food position are unchanged.

### UC-4: Change direction with WASD keys

- **Steps**: While playing, press `s`.
- **Expected**: The snake changes direction to down on the next tick.

### UC-5: Opposite direction is rejected

- **Steps**: While the snake is moving right, press `←`.
- **Expected**: The snake continues moving right; the input is ignored.

### UC-6: Eat food — grow and score

- **Steps**: Steer the snake so the head lands on the food cell.
- **Expected**: Score increases by the configured `pointsPerFood` (default 10). Snake length increases by 1. A new food item appears at a different, non-snake cell. The "eat" sound plays if sound is enabled.

### UC-7: Wrap around walls

- **Steps**: With `wallMode` set to `"wrap"`, steer the snake off the right edge of the grid.
- **Expected**: The snake reappears on the left edge at the same row, continuing rightward movement.

### UC-8: Die on wall collision

- **Steps**: Set `wallMode` to `"die"` in settings. Steer the snake into any wall.
- **Expected**: The game transitions to `gameOver`. The game-over overlay appears with the final score and a "Play Again" button. The "game over" sound plays if sound is enabled.

### UC-9: Self-collision — game over

- **Steps**: Grow the snake long enough, then steer it into its own body.
- **Expected**: The game transitions to `gameOver`. The overlay appears. High score is updated if the current score exceeds it.

### UC-10: Pause and resume with keyboard

- **Steps**: While playing, press `Space` or `P`. Then press it again.
- **Expected**: First press: game transitions to `paused`, a "Paused" overlay appears, snake stops moving. Second press: game resumes (`playing`), overlay disappears, snake continues moving.

### UC-11: Pause and resume with button

- **Steps**: While playing, click the "Pause" button. Then click "Resume" on the overlay.
- **Expected**: Same behavior as UC-10.

### UC-12: Restart the game

- **Steps**: Press `Enter` or `R`, or click the "Restart" button.
- **Expected**: Game resets: snake at center, length 3, score 0, moving right. Status is `playing` (or `idle` if not yet started). Food respawns.

### UC-13: Play Again after game over

- **Steps**: After game over, click "Play Again" on the overlay.
- **Expected**: Same as UC-12 — full reset, game starts playing.

### UC-14: High score persistence

- **Steps**: Achieve a score of 100. Restart. Achieve a score of 150. Reload the page.
- **Expected**: The scoreboard displays "High Score: 150" before playing. The value persists across page reloads (stored in `localStorage` key `snake-high-score`).

### UC-15: Change grid size

- **Steps**: Open settings, change `gridSize` from 20 to 30.
- **Expected**: The game resets. Canvas reflects a 30×30 grid. Cell sizes adjust accordingly.

### UC-16: Change tick speed

- **Steps**: Open settings, change `tickInterval` from 150 to 80.
- **Expected**: The snake moves noticeably faster. No game reset is triggered.

### UC-17: Toggle grid lines

- **Steps**: Open settings, set `showGrid` to `false`.
- **Expected**: Grid lines disappear from the canvas. Snake and food remain visible.

### UC-18: Switch theme

- **Steps**: Open settings, select the "ocean" theme.
- **Expected**: Canvas colors immediately update to match the ocean theme palette (background `#0a1628`, snake head `#00d2ff`, etc.). The theme is saved to `localStorage` and persists on reload.

### UC-19: Enable speed scaling

- **Steps**: In settings, enable `speedScaling`. Play and eat food multiple times.
- **Expected**: The tick interval decreases as the snake grows, making the snake move progressively faster.

### UC-20: Change points per food

- **Steps**: In settings, set `pointsPerFood` to 25. Eat one food.
- **Expected**: Score increases by 25.

### UC-21: Toggle sound off

- **Steps**: In settings, toggle sound to off. Eat food.
- **Expected**: No sound plays when eating food or on game over.

### UC-22: Query parameter configuration

- **Steps**: Navigate to `/snake?gridSize=25&tickInterval=100&wallMode=die&theme=retro`.
- **Expected**: Settings panel reflects: grid size 25, tick interval 100 ms, wall mode "die", theme "retro". Game uses these values.

### UC-23: Swipe control on mobile

- **Steps**: On a touch device, while playing, swipe upward on the canvas (>30 px).
- **Expected**: The snake changes direction to up on the next tick.

### UC-24: Rapid key presses do not cause self-collision

- **Steps**: While the snake is moving right, quickly press `↑` then `←` within a single tick.
- **Expected**: Only the first direction change (`↑`) is queued. The second (`←`) is applied on the following tick. The snake does not reverse into itself.

### UC-25: Canvas scales on window resize

- **Steps**: Resize the browser window while the game is running.
- **Expected**: The canvas resizes to fit the new viewport width while maintaining a 1:1 aspect ratio. The game continues without interruption. Cell dimensions are recalculated. Snake and food render at correct positions.

### UC-26: Food never spawns on the snake

- **Steps**: Grow the snake to cover a large portion of the grid. Eat food repeatedly.
- **Expected**: New food items always appear on empty cells, never overlapping any segment of the snake.

### UC-27: Settings persist across sessions

- **Steps**: Change theme to "pastel", disable grid lines, disable sound. Reload the page.
- **Expected**: All three settings are restored to their last values.

---

## Non-Goals (Out of Scope)

- Multiplayer
- Online leaderboard
- Power-ups or obstacles
- Skin customization beyond preset themes
- Browser extension or native app packaging

---

## Open Questions

(All answered during requirements gathering. This section is kept for future reference.)

- ~~Grid size?~~ → 20×20, configurable
- ~~Speed behavior?~~ → Constant by default, scaling optional
- ~~Wall behavior?~~ → Wrap-around by default, death optional
- ~~Mobile support?~~ → Swipe gestures included
- ~~Sound?~~ → Web Audio API, toggleable
