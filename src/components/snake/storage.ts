import { DEFAULT_CONFIG, GameConfig, ThemeName } from './types';

export function loadHighScore(): number {
  try {
    return parseInt(localStorage.getItem('snake-high-score') ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveConfig(cfg: GameConfig): void {
  try {
    localStorage.setItem('snake-config', JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export function loadConfig(): GameConfig {
  try {
    const saved = localStorage.getItem('snake-config');
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }

  // Check URL query params
  try {
    const params = new URLSearchParams(window.location.search);
    const q: Partial<GameConfig> = {};
    if (params.has('gridSize')) q.gridSize = parseInt(params.get('gridSize')!, 10);
    if (params.has('tickInterval')) q.tickInterval = parseInt(params.get('tickInterval')!, 10);
    if (params.has('wallMode') && ['wrap', 'die'].includes(params.get('wallMode')!)) {
      q.wallMode = params.get('wallMode')! as 'wrap' | 'die';
    }
    if (params.has('speedScaling')) q.speedScaling = params.get('speedScaling') === 'true';
    if (params.has('pointsPerFood')) q.pointsPerFood = parseInt(params.get('pointsPerFood')!, 10);
    if (params.has('showGrid')) q.showGrid = params.get('showGrid') === 'true';
    if (params.has('theme')) q.theme = params.get('theme')! as ThemeName;
    if (Object.keys(q).length > 0) {
      return { ...DEFAULT_CONFIG, ...q };
    }
  } catch {
    // ignore
  }

  return DEFAULT_CONFIG;
}
