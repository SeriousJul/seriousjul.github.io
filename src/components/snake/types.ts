export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'gameOver';

export type ThemeName = 'classic' | 'retro' | 'pastel' | 'ocean';

export interface Point {
  x: number;
  y: number;
}

export interface GameConfig {
  gridSize: number;
  tickInterval: number;
  speedScaling: boolean;
  wallMode: 'wrap' | 'die';
  pointsPerFood: number;
  showGrid: boolean;
  theme: ThemeName;
  soundEnabled: boolean;
}

export interface ThemeColors {
  background: string;
  snakeHead: string;
  snakeBody: string;
  food: string;
  gridLines: string;
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  classic: {
    background: '#1a1a2e',
    snakeHead: '#00ff88',
    snakeBody: '#00cc6a',
    food: '#ff4757',
    gridLines: '#2a2a4a',
  },
  retro: {
    background: '#000000',
    snakeHead: '#33ff33',
    snakeBody: '#00cc00',
    food: '#ff0000',
    gridLines: '#1a1a1a',
  },
  pastel: {
    background: '#fdf6e3',
    snakeHead: '#b58900',
    snakeBody: '#cb4b16',
    food: '#dc322f',
    gridLines: '#eee8d5',
  },
  ocean: {
    background: '#0a1628',
    snakeHead: '#00d2ff',
    snakeBody: '#0099cc',
    food: '#ff6b6b',
    gridLines: '#162a4a',
  },
};

export const DEFAULT_CONFIG: GameConfig = {
  gridSize: 20,
  tickInterval: 150,
  speedScaling: false,
  wallMode: 'wrap',
  pointsPerFood: 10,
  showGrid: true,
  theme: 'classic',
  soundEnabled: true,
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
