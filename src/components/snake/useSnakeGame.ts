import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_CONFIG,
  Direction,
  DIRECTION_DELTA,
  GameConfig,
  GameStatus,
  OPPOSITE,
  Point,
  THEMES,
  ThemeName,
} from './types';
import { saveConfig, loadConfig, loadHighScore } from './storage';

function initialSnake(gridSize: number): Point[] {
  const cx = Math.floor(gridSize / 2);
  const cy = Math.floor(gridSize / 2);
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
}

function spawnFood(gridSize: number, snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const empty: Point[] = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!occupied.has(`${x},${y}`)) {
        empty.push({ x, y });
      }
    }
  }
  if (empty.length === 0) return { x: -1, y: -1 };
  return empty[Math.floor(Math.random() * empty.length)];
}

// Sound helpers using Web Audio API
function playTone(
  ctx: AudioContext,
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 0.1
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playEatSound(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getAudioCtx();
  if (ctx) playTone(ctx, 400, 800, 0.15, 'square', 0.1);
}

function playGameOverSound(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getAudioCtx();
  if (ctx) playTone(ctx, 300, 100, 0.4, 'sawtooth', 0.08);
}

function playDirectionSound(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getAudioCtx();
  if (ctx) playTone(ctx, 600, 500, 0.05, 'sine', 0.04);
}

export function useSnakeGame() {
  const [config, setConfig] = useState<GameConfig>(loadConfig);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(loadHighScore);
  const [status, setStatus] = useState<GameStatus>('idle');

  const snakeRef = useRef<Point[]>(initialSnake(config.gridSize));
  const foodRef = useRef<Point>(spawnFood(config.gridSize, snakeRef.current));
  const directionRef = useRef<Direction>('right');
  const queuedDirRef = useRef<Direction | null>(null);
  const statusRef = useRef<GameStatus>('idle');
  const scoreRef = useRef<number>(0);
  const configRef = useRef<GameConfig>(config);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState(20);

  const animFrameRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  // Keep config ref synced
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Keep status ref synced
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Compute cell size on resize
  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const maxW = containerRef.current.clientWidth - 32;
      const maxH = window.innerHeight * 0.55;
      const cs = Math.floor(Math.min(maxW, maxH) / config.gridSize);
      setCellSize(Math.max(cs, 5));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [config.gridSize]);

  // Core game tick
  const tick = useCallback((): boolean => {
    const cfg = configRef.current;
    const snake = snakeRef.current;
    const head = snake[0];

    // Apply queued direction
    if (queuedDirRef.current) {
      directionRef.current = queuedDirRef.current;
      queuedDirRef.current = null;
    }

    const dir = directionRef.current;
    const delta = DIRECTION_DELTA[dir];
    let nx = head.x + delta.dx;
    let ny = head.y + delta.dy;

    const gs = cfg.gridSize;

    if (cfg.wallMode === 'wrap') {
      nx = (nx + gs) % gs;
      ny = (ny + gs) % gs;
    } else {
      if (nx < 0 || nx >= gs || ny < 0 || ny >= gs) {
        return true; // game over
      }
    }

    const newHead: Point = { x: nx, y: ny };
    const food = foodRef.current;
    const ate = newHead.x === food.x && newHead.y === food.y;

    // Self collision (if not eating, tail moves so exclude it)
    const check = ate ? snake : snake.slice(0, -1);
    for (const seg of check) {
      if (seg.x === newHead.x && seg.y === newHead.y) {
        return true; // game over
      }
    }

    const newSnake = [newHead, ...snake];
    if (!ate) {
      newSnake.pop();
    } else {
      const newScore = scoreRef.current + cfg.pointsPerFood;
      scoreRef.current = newScore;
      setScore(newScore);

      foodRef.current = spawnFood(gs, newSnake);
      playEatSound(cfg.soundEnabled);

      setHighScore((prev) => {
        if (newScore > prev) {
          saveHighScore(newScore);
          return newScore;
        }
        return prev;
      });
    }

    snakeRef.current = newSnake;
    return false; // not game over
  }, []);

  // Draw the current game state onto the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cs = cellSize;
    const cfg = configRef.current;
    const gs = cfg.gridSize;
    const dpr = window.devicePixelRatio || 1;
    const pxSize = gs * cs;

    canvas.width = pxSize * dpr;
    canvas.height = pxSize * dpr;
    canvas.style.width = `${pxSize}px`;
    canvas.style.height = `${pxSize}px`;
    ctx.scale(dpr, dpr);

    const colors = THEMES[cfg.theme];

    // Background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, pxSize, pxSize);

    // Grid lines
    if (cfg.showGrid) {
      ctx.strokeStyle = colors.gridLines;
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= gs; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cs, 0);
        ctx.lineTo(i * cs, pxSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cs);
        ctx.lineTo(pxSize, i * cs);
        ctx.stroke();
      }
    }

    // Food
    ctx.fillStyle = colors.food;
    ctx.beginPath();
    ctx.arc(
      foodRef.current.x * cs + cs / 2,
      foodRef.current.y * cs + cs / 2,
      cs * 0.4,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Snake
    const snake = snakeRef.current;
    const pad = 1;
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      ctx.fillStyle = i === 0 ? colors.snakeHead : colors.snakeBody;
      ctx.fillRect(
        seg.x * cs + pad,
        seg.y * cs + pad,
        cs - pad * 2,
        cs - pad * 2
      );
    }
  }, [cellSize]);

  // Redraw whenever cell size, config, or status changes (initial render + settings updates)
  useEffect(() => {
    draw();
  }, [cellSize, config, score, status, draw]);

  // Game loop via rAF — tick + render
  useEffect(() => {
    if (status !== 'playing') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    lastTickRef.current = 0;

    const loop = (ts: number) => {
      if (statusRef.current !== 'playing') {
        draw(); // final frame before pausing/stopping
        return;
      }
      if (!lastTickRef.current) lastTickRef.current = ts;

      const cfg = configRef.current;
      let interval = cfg.tickInterval;
      if (cfg.speedScaling) {
        const reduction = Math.min(snakeRef.current.length * 2, cfg.tickInterval * 0.6);
        interval = Math.max(cfg.tickInterval - reduction, 30);
      }

      if (ts - lastTickRef.current >= interval) {
        const gameOver = tick();
        lastTickRef.current = ts;
        if (gameOver) {
          setStatus('gameOver');
          statusRef.current = 'gameOver';
          playGameOverSound(cfg.soundEnabled);
          draw();
          return;
        }
      }

      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, tick, draw]);

  // Direction input
  const onDirection = useCallback((dir: Direction) => {
    // Start game from idle
    if (statusRef.current === 'idle') {
      statusRef.current = 'playing';
      setStatus('playing');
    }
    if (statusRef.current !== 'playing') return;

    const effective = queuedDirRef.current ?? directionRef.current;
    if (dir === OPPOSITE[effective] || dir === effective) return;
    queuedDirRef.current = dir;
    playDirectionSound(configRef.current.soundEnabled);
  }, []);

  // Pause / Resume
  const onTogglePause = useCallback(() => {
    if (statusRef.current === 'playing') {
      statusRef.current = 'paused';
      setStatus('paused');
    } else if (statusRef.current === 'paused') {
      statusRef.current = 'playing';
      setStatus('playing');
    }
  }, []);

  // Restart
  const onRestart = useCallback(() => {
    const cfg = configRef.current;
    const cs2 = initialSnake(cfg.gridSize);
    snakeRef.current = cs2;
    foodRef.current = spawnFood(cfg.gridSize, cs2);
    directionRef.current = 'right';
    queuedDirRef.current = null;
    scoreRef.current = 0;
    setScore(0);
    statusRef.current = 'playing';
    setStatus('playing');
    lastTickRef.current = 0;
  }, []);

  // Config change handler — reset if grid size changes
  const onSetConfig = useCallback((next: GameConfig) => {
    const resetGrid = next.gridSize !== configRef.current.gridSize;
    setConfig((prev) => {
      const updated = { ...prev, ...next };
      saveConfig(updated);
      return updated;
    });
    if (resetGrid) {
      const cfg = { ...config, ...next };
      const cs2 = initialSnake(cfg.gridSize);
      snakeRef.current = cs2;
      foodRef.current = spawnFood(cfg.gridSize, cs2);
      directionRef.current = 'right';
      queuedDirRef.current = null;
      scoreRef.current = 0;
      setScore(0);
      setStatus('idle');
      statusRef.current = 'idle';
    }
  }, []);

  return {
    snake: snakeRef.current,
    food: foodRef.current,
    direction: directionRef.current,
    score,
    highScore,
    status,
    config,
    setConfig: onSetConfig,
    canvasRef,
    containerRef,
    cellSize,
    onDirection,
    onTogglePause,
    onRestart,
  };
}

function saveHighScore(score: number): void {
  try {
    localStorage.setItem('snake-high-score', String(score));
  } catch {
    // ignore
  }
}
