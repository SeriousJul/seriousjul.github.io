import React from 'react';
import styles from './SnakeGame.module.css';

interface SnakeControlsProps {
  status: string;
  onPause: () => void;
  onRestart: () => void;
  onSettingsToggle: () => void;
  showSettings: boolean;
}

export default function SnakeControls({
  status,
  onPause,
  onRestart,
  onSettingsToggle,
  showSettings,
}: SnakeControlsProps) {
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const disabled = status === 'idle' || status === 'gameOver';

  return (
    <div className={styles.controls}>
      <button
        className={styles.controlButton}
        onClick={onPause}
        disabled={disabled}
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>
      <button className={styles.controlButton} onClick={onRestart}>
        Restart
      </button>
      <button className={styles.controlButton} onClick={onSettingsToggle}>
        {showSettings ? 'Hide' : 'Settings'}
      </button>
    </div>
  );
}
