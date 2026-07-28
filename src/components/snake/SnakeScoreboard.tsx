import React from 'react';
import styles from './SnakeGame.module.css';

interface SnakeScoreboardProps {
  score: number;
  highScore: number;
}

export default function SnakeScoreboard({ score, highScore }: SnakeScoreboardProps) {
  return (
    <div className={styles.scoreboard}>
      <span className={styles.scoreItem}>
        <span className={styles.scoreLabel}>Score:</span>
        <span className={styles.scoreValue}>{score}</span>
      </span>
      <span className={styles.scoreItem}>
        <span className={styles.scoreLabel}>High Score:</span>
        <span className={styles.scoreValue}>{highScore}</span>
      </span>
    </div>
  );
}
