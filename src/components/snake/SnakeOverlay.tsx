import React from 'react';
import { GameStatus } from './types';
import styles from './SnakeGame.module.css';

interface SnakeOverlayProps {
  status: GameStatus;
  score: number;
  onPlayAgain?: () => void;
  onResume?: () => void;
}

export default function SnakeOverlay({ status, score, onPlayAgain, onResume }: SnakeOverlayProps) {
  if (status === 'gameOver') {
    return (
      <div className={styles.overlay}>
        <div className={styles.overlayContent}>
          <h2 className={styles.overlayTitle}>Game Over</h2>
          <p className={styles.overlayScore}>Score: {score}</p>
          <button className={styles.overlayButton} onClick={onPlayAgain}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  if (status === 'paused') {
    return (
      <div className={styles.overlay}>
        <div className={styles.overlayContent}>
          <h2 className={styles.overlayTitle}>Paused</h2>
          <button className={styles.overlayButton} onClick={onResume}>
            Resume
          </button>
        </div>
      </div>
    );
  }

  return null;
}
