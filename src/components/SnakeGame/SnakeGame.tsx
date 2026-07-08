import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SnakeGame.module.css';

// ── Types ──────────────────────────────────────────────────────────────────

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'idle' | 'playing' | 'paused' | 'gameOver';
type Speed = 'slow' | 'normal' | 'fast' | 'insane';

interface Coord {
  x: number;
  y: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const GRID_SIZE = 20;
const SPEED_MAP: Record<Speed, number> = {
  slow: 200,
  normal: 120,
  fast: 70,
  insane: 40,
};

const DIRECTION_VECTORS: Record<Direction, Coord> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  w: 'UP',
  W: 'UP',
  s: 'DOWN',
  S: 'DOWN',
  a: 'LEFT',
  A: 'LEFT',
  d: 'RIGHT',
  D: 'RIGHT',
};

// ── Pure helpers (extracted for testability) ───────────────────────────────

function randomFood(snake: Coord[]): Coord {
  const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
  const free: Coord[] = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!occupied.has(`${x},${y}`)) {
        free.push({ x, y });
      }
    }
  }
  return free[Math.floor(Math.random() * free.length)];
}

function moveHead(head: Coord, direction: Direction): Coord {
  const v = DIRECTION_VECTORS[direction];
  return { x: head.x + v.x, y: head.y + v.y };
}

function checkCollision(head: Coord, snake: Coord[]): boolean {
  // Wall collision
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    return true;
  }
  // Self collision (skip tail — it will move away this tick)
  for (let i = 0; i < snake.length - 1; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      return true;
    }
  }
  return false;
}

function tick(
  snake: Coord[],
  food: Coord,
  direction: Direction
): {
  newSnake: Coord[];
  newFood: Coord;
  ate: boolean;
} {
  const head = snake[0];
  const newHead = moveHead(head, direction);

  if (checkCollision(newHead, snake)) {
    return { newSnake: snake, newFood: food, ate: false };
  }

  const ate = newHead.x === food.x && newHead.y === food.y;
  const newSnake = [newHead, ...snake];
  if (!ate) {
    newSnake.pop();
  }
  const newFood = ate ? randomFood(newSnake) : food;

  return { newSnake, newFood, ate };
}

// ── Music helpers ──────────────────────────────────────────────────────────

const NOTE_FREQS: Record<string, number> = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
};

// Simple 8-note loop melody
const MELODY = ['C4', 'E4', 'G4', 'E4', 'C4', 'G4', 'E4', 'C4'];
const BPM = 120;
const NOTE_DUR_SEC = 60 / BPM;

function playNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  muted: boolean
): void {
  if (muted) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.08, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function scheduleLoop(
  ctx: AudioContext,
  startTime: number,
  muted: boolean
): void {
  const dur = NOTE_DUR_SEC;
  MELODY.forEach((note, i) => {
    playNote(ctx, NOTE_FREQS[note], startTime + i * dur, dur, muted);
  });
}

// ── Component ──────────────────────────────────────────────────────────────

const SnakeGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game state
  const [snake, setSnake] = useState<Coord[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const [food, setFood] = useState<Coord>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => loadHighScore());
  const [speed, setSpeed] = useState<Speed>('normal');
  const [musicMuted, setMusicMuted] = useState(true);
  const [audioSupported, setAudioSupported] = useState(true);
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  // Refs for values accessed inside event listeners / intervals
  const directionRef = useRef(direction);
  const gameStateRef = useRef(gameState);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const scoreRef = useRef(score);
  const speedRef = useRef(speed);
  const musicMutedRef = useRef(musicMuted);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const scheduleAheadRef = useRef(0.1); // seconds to look ahead
  const isPlayingRef = useRef(false);

  // Sync refs
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);
  useEffect(() => {
    foodRef.current = food;
  }, [food]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    musicMutedRef.current = musicMuted;
  }, [musicMuted]);

  // Check Web Audio API support
  useEffect(() => {
    if (typeof AudioContext === 'undefined') {
      setAudioUnavailable(true);
      setAudioSupported(false);
    }
  }, []);

  // ── Canvas rendering ───────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Background
    ctx.fillStyle =
      getComputedStyle(canvas).getPropertyValue('--snake-bg').trim() ||
      '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines (subtle)
    ctx.strokeStyle =
      getComputedStyle(canvas).getPropertyValue('--snake-grid').trim() ||
      'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    // Snake body
    const snakeColor =
      getComputedStyle(canvas).getPropertyValue('--snake-color').trim() ||
      '#4caf50';
    const snakeHeadColor =
      getComputedStyle(canvas).getPropertyValue('--snake-head-color').trim() ||
      '#66bb6a';

    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? snakeHeadColor : snakeColor;
      const pad = 1;
      ctx.fillRect(
        seg.x * cellSize + pad,
        seg.y * cellSize + pad,
        cellSize - pad * 2,
        cellSize - pad * 2
      );
    });

    // Food
    ctx.fillStyle =
      getComputedStyle(canvas).getPropertyValue('--snake-food-color').trim() ||
      '#ef5350';
    const foodPad = 2;
    ctx.beginPath();
    ctx.arc(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      cellSize / 2 - foodPad,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }, [food]);

  // Draw on every render
  useEffect(() => {
    draw();
  }, [draw, snake, gameState]);

  // ── Game loop ──────────────────────────────────────────────────────────

  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    const currentDir = directionRef.current;
    const currentSnake = snakeRef.current;
    const currentFood = foodRef.current;

    const result = tick(currentSnake, currentFood, currentDir);

    if (result.ate) {
      setScore(prev => {
        const newScore = prev + 10;
        setHighScore(prevHS => {
          if (newScore > prevHS) {
            saveHighScore(newScore);
            return newScore;
          }
          return prevHS;
        });
        return newScore;
      });
    }

    if (checkCollision(result.newSnake[0], result.newSnake)) {
      setGameState('gameOver');
      return;
    }

    setSnake(result.newSnake);
    setFood(result.newFood);
  }, []);

  // Interval-based game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = SPEED_MAP[speedRef.current];
    const id = setInterval(gameLoop, interval);
    return () => clearInterval(id);
  }, [gameState, gameLoop]);

  // ── Keyboard handling ──────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Prevent page scroll on arrow keys / space
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)
      ) {
        e.preventDefault();
      }

      // Initialize audio context on first interaction
      if (!audioCtxRef.current && audioSupported) {
        try {
          audioCtxRef.current = new AudioContext();
          nextNoteTimeRef.current = audioCtxRef.current.currentTime;
          isPlayingRef.current = true;
        } catch {
          setAudioUnavailable(true);
          setAudioSupported(false);
        }
      }

      // Resume audio context if suspended (browser policy)
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      const newDir = KEY_MAP[e.key];
      if (newDir) {
        // Prevent 180° reversal
        if (OPPOSITE[newDir] !== directionRef.current) {
          setDirection(newDir);
        }
        return;
      }

      if (e.key === ' ') {
        if (gameStateRef.current === 'playing') {
          setGameState('paused');
        } else if (gameStateRef.current === 'paused') {
          setGameState('playing');
        } else if (gameStateRef.current === 'idle') {
          setGameState('playing');
        }
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        resetGame();
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        toggleMusic();
        return;
      }
    },
    [audioSupported]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Visibility change (auto-pause) ─────────────────────────────────────

  useEffect(() => {
    const handleVisChange = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    document.addEventListener('visibilitychange', handleVisChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisChange);
  }, []);

  // ── Music scheduling ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlayingRef.current || !audioCtxRef.current) return;

    const ctx = audioCtxRef.current;
    const lookAhead = 0.1;
    const scheduleInterval = 25; // ms

    const scheduler = setInterval(() => {
      if (!isPlayingRef.current || !audioCtxRef.current) return;
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') return;

      while (nextNoteTimeRef.current < audioCtx.currentTime + lookAhead) {
        const noteIdx =
          Math.floor(
            (nextNoteTimeRef.current -
              (audioCtxRef.current!.currentTime - lookAhead)) /
              NOTE_DUR_SEC
          ) % MELODY.length;
        const note = MELODY[noteIdx];
        playNote(
          audioCtx,
          NOTE_FREQS[note],
          nextNoteTimeRef.current,
          NOTE_DUR_SEC,
          musicMutedRef.current
        );
        nextNoteTimeRef.current += NOTE_DUR_SEC;
      }
    }, scheduleInterval);

    return () => clearInterval(scheduler);
  }, [audioSupported]);

  // ── Music toggle ───────────────────────────────────────────────────────

  const toggleMusic = useCallback(() => {
    setMusicMuted(prev => !prev);
    // If unmuting, ensure audio context is active
    if (!musicMuted && audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    }
  }, [musicMuted]);

  // ── Reset ──────────────────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    const initialSnake: Coord[] = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    setSnake(initialSnake);
    setFood(randomFood(initialSnake));
    setDirection('RIGHT');
    setScore(0);
    setGameState('playing');
  }, []);

  // ── localStorage helpers ───────────────────────────────────────────────

  function loadHighScore(): number {
    try {
      const val = localStorage.getItem('snake-high-score');
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore(val: number): void {
    try {
      localStorage.setItem('snake-high-score', String(val));
    } catch {
      // localStorage unavailable (private browsing)
    }
  }

  // ── Canvas size ────────────────────────────────────────────────────────

  const [canvasSize, setCanvasSize] = useState(() => {
    if (typeof window === 'undefined') return 500;
    const vw = window.innerWidth;
    const size = Math.min(vw * 0.9, 500);
    return Math.max(size, 200); // minimum 200px
  });

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className={styles.gameContainer}>
      <div className={styles.scoreBar}>
        <span>Score: {score}</span>
        <span>High Score: {highScore}</span>
      </div>

      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={canvasSize}
        height={canvasSize}
      />

      {/* Overlay for idle / game-over */}
      {(gameState === 'idle' || gameState === 'gameOver') && (
        <div className={styles.overlay}>
          <div className={styles.overlayContent}>
            {gameState === 'gameOver' && (
              <>
                <h2>Game Over</h2>
                <p>Score: {score}</p>
              </>
            )}
            <button className={styles.controlBtn} onClick={resetGame}>
              {gameState === 'idle' ? 'Start Game' : 'Play Again'}
            </button>
            <p className={styles.hint}>
              Arrow keys / WASD to move · Space to pause · R to restart · M to
              toggle music
            </p>
          </div>
        </div>
      )}

      {gameState === 'paused' && (
        <div className={styles.overlay}>
          <div className={styles.overlayContent}>
            <h2>Paused</h2>
            <button
              className={styles.controlBtn}
              onClick={() => setGameState('playing')}
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.speedGroup}>
          <label htmlFor="speed-select" className={styles.speedLabel}>
            Speed
          </label>
          <select
            id="speed-select"
            className={styles.speedSelect}
            value={speed}
            onChange={e => setSpeed(e.target.value as Speed)}
            disabled={gameState === 'playing'}
          >
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
            <option value="insane">Insane</option>
          </select>
        </div>

        <button
          className={styles.controlBtn}
          onClick={toggleMusic}
          disabled={
            !audioSupported || gameState === 'gameOver' || gameState === 'idle'
          }
          title={musicMuted ? 'Unmute' : 'Mute'}
        >
          {musicMuted ? '🔇' : '🔊'} {musicMuted ? 'Muted' : 'Music'}
        </button>

        <button
          className={styles.controlBtn}
          onClick={resetGame}
          title="Restart (R)"
        >
          Restart
        </button>
      </div>

      {/* Warnings */}
      {audioUnavailable && !musicMuted && (
        <p className={styles.warning}>Audio not supported in this browser.</p>
      )}
      {canvasSize < 300 && (
        <p className={styles.warning}>
          Viewport is very small — the game may be hard to play.
        </p>
      )}
      {canvasSize < 400 && (
        <p className={styles.warning}>Best played on desktop with keyboard.</p>
      )}
    </div>
  );
};

export default SnakeGame;
