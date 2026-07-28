import React from 'react';
import { GameConfig, ThemeName, THEMES } from './types';
import styles from './SnakeGame.module.css';

interface SnakeSettingsProps {
  config: GameConfig;
  onConfigChange: (config: Partial<GameConfig>) => void;
}

export default function SnakeSettings({ config, onConfigChange }: SnakeSettingsProps) {
  return (
    <div className={styles.settings}>
      <h3 className={styles.settingsTitle}>Settings</h3>

      <div className={styles.settingRow}>
        <label htmlFor="gridSize" className={styles.settingLabel}>Grid Size</label>
        <input
          id="gridSize"
          type="number"
          min={5}
          max={50}
          value={config.gridSize}
          onChange={(e) => onConfigChange({ gridSize: Math.max(5, Math.min(50, parseInt(e.target.value) || 20)) })}
          className={styles.settingInput}
        />
      </div>

      <div className={styles.settingRow}>
        <label htmlFor="tickInterval" className={styles.settingLabel}>Speed (ms/tick)</label>
        <input
          id="tickInterval"
          type="number"
          min={20}
          max={500}
          value={config.tickInterval}
          onChange={(e) => onConfigChange({ tickInterval: Math.max(20, parseInt(e.target.value) || 150) })}
          className={styles.settingInput}
        />
      </div>

      <div className={styles.settingRow}>
        <label htmlFor="pointsPerFood" className={styles.settingLabel}>Points per Food</label>
        <input
          id="pointsPerFood"
          type="number"
          min={1}
          max={100}
          value={config.pointsPerFood}
          onChange={(e) => onConfigChange({ pointsPerFood: Math.max(1, parseInt(e.target.value) || 10) })}
          className={styles.settingInput}
        />
      </div>

      <div className={styles.settingRow}>
        <label className={styles.settingLabel}>Wall Mode</label>
        <div className={styles.toggleGroup}>
          <button
            className={config.wallMode === 'wrap' ? styles.toggleActive : styles.toggleInactive}
            onClick={() => onConfigChange({ wallMode: 'wrap' })}
          >
            Wrap
          </button>
          <button
            className={config.wallMode === 'die' ? styles.toggleActive : styles.toggleInactive}
            onClick={() => onConfigChange({ wallMode: 'die' })}
          >
            Die
          </button>
        </div>
      </div>

      <div className={styles.settingRow}>
        <label className={styles.settingLabel}>Speed Scaling</label>
        <button
          className={config.speedScaling ? styles.toggleActive : styles.toggleInactive}
          onClick={() => onConfigChange({ speedScaling: !config.speedScaling })}
        >
          {config.speedScaling ? 'On' : 'Off'}
        </button>
      </div>

      <div className={styles.settingRow}>
        <label className={styles.settingLabel}>Show Grid</label>
        <button
          className={config.showGrid ? styles.toggleActive : styles.toggleInactive}
          onClick={() => onConfigChange({ showGrid: !config.showGrid })}
        >
          {config.showGrid ? 'On' : 'Off'}
        </button>
      </div>

      <div className={styles.settingRow}>
        <label className={styles.settingLabel}>Sound</label>
        <button
          className={config.soundEnabled ? styles.toggleActive : styles.toggleInactive}
          onClick={() => onConfigChange({ soundEnabled: !config.soundEnabled })}
        >
          {config.soundEnabled ? 'On' : 'Off'}
        </button>
      </div>

      <div className={styles.settingRow}>
        <label className={styles.settingLabel}>Theme</label>
        <select
          value={config.theme}
          onChange={(e) => onConfigChange({ theme: e.target.value as ThemeName })}
          className={styles.settingSelect}
        >
          {Object.keys(THEMES).map((theme) => (
            <option key={theme} value={theme}>
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
