import { useCallback, useEffect, useRef, useState } from 'react';
import { GameConfig } from './types';
import { useSnakeGame } from './useSnakeGame';
import SnakeScoreboard from './SnakeScoreboard';
import SnakeOverlay from './SnakeOverlay';
import SnakeControls from './SnakeControls';
import SnakeSettings from './SnakeSettings';
import SnakeDpad from './SnakeDpad';
import styles from './SnakeGame.module.css';

export default function SnakeGame() {
  const {
    score,
    highScore,
    status,
    config,
    canvasRef,
    containerRef,
    onDirection,
    onTogglePause,
    onRestart,
    setConfig,
  } = useSnakeGame();

  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Touch handlers for canvas swipe
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!touchStartRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      const threshold = 30;

      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
        touchStartRef.current = null;
        return;
      }

      let dir: 'up' | 'down' | 'left' | 'right';
      if (Math.abs(dx) > Math.abs(dy)) {
        dir = dx > 0 ? 'right' : 'left';
      } else {
        dir = dy > 0 ? 'down' : 'up';
      }
      onDirection(dir);
      touchStartRef.current = null;
    },
    [onDirection]
  );

  // Keyboard input — uses e.code for layout-agnostic key detection
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        KeyW: 'up',
        KeyS: 'down',
        KeyA: 'left',
        KeyD: 'right',
      };

      if (e.code === 'Space' || e.code === 'KeyP') {
        e.preventDefault();
        onTogglePause();
        return;
      }

      if (e.code === 'Enter' || e.code === 'KeyR') {
        e.preventDefault();
        onRestart();
        return;
      }

      const dir = dirMap[e.code];
      if (dir) {
        e.preventDefault();
        onDirection(dir);
      }
    },
    [onDirection, onTogglePause, onRestart]
  );

  // Register keyboard listener on window
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleConfigChange = useCallback(
    (partial: Partial<GameConfig>) => {
      setConfig({ ...config, ...partial });
    },
    [config, setConfig]
  );

  return (
    <div className={styles['snake-page']}>
      <SnakeScoreboard score={score} highScore={highScore} />

      <div ref={containerRef} className={styles['canvas-container']}>
        <div className={styles['canvas-wrapper']}>
          <canvas
            ref={canvasRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
          <SnakeOverlay
            status={status}
            score={score}
            onPlayAgain={onRestart}
            onResume={onTogglePause}
          />
        </div>
      </div>

      <SnakeControls
        status={status}
        onPause={onTogglePause}
        onRestart={onRestart}
        onSettingsToggle={() => setShowSettings((s) => !s)}
        showSettings={showSettings}
      />

      {showSettings && (
        <SnakeSettings config={config} onConfigChange={handleConfigChange} />
      )}

      <SnakeDpad onDirection={onDirection} />

      <button
        className={styles.controlButton}
        style={{ marginTop: '12px' }}
        onClick={() => setShowInstructions((s) => !s)}
      >
        {showInstructions ? 'Hide' : 'Instructions'}
      </button>

      {showInstructions && (
        <div className={styles.instructions}>
          <h3 className={styles.instructionsTitle}>How to Play</h3>
          <table className={styles.instructionsTable}>
            <tbody>
              <tr>
                <td><code>↑ ↓ ← →</code> / <code>W</code> <code>A</code> <code>S</code> <code>D</code></td>
                <td>Change direction</td>
              </tr>
              <tr>
                <td><code>Space</code> / <code>P</code></td>
                <td>Pause / Resume</td>
              </tr>
              <tr>
                <td><code>Enter</code> / <code>R</code></td>
                <td>Restart</td>
              </tr>
              <tr>
                <td>Swipe on canvas</td>
                <td>Change direction (mobile)</td>
              </tr>
            </tbody>
          </table>
          <p className={styles.instructionsText}>
            Eat the food to grow and score points. Avoid colliding with yourself.
            In wall mode "die" walls are fatal; in "wrap" the snake passes through.
          </p>
        </div>
      )}
    </div>
  );
}
