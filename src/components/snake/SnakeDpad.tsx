import { useCallback, useRef } from 'react';
import styles from './SnakeGame.module.css';

export default function SnakeDpad({
  onDirection,
}: {
  onDirection: (dir: 'up' | 'down' | 'left' | 'right') => void;
}) {
  const dragging = useRef(false);

  const handlePointerDown = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      dragging.current = true;
      onDirection(dir);
    },
    [onDirection],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handlePointerMove = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (dragging.current) {
        onDirection(dir);
      }
    },
    [onDirection],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div
      className={styles.dpad}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handleTouchStart}
    >
      {/* Row 1: empty, up, empty */}
      <div className={styles.dpadCell} />
      <button
        className={styles.dpadButton}
        onPointerDown={handlePointerDown('up')}
        onPointerMove={handlePointerMove('up')}
      >
        ▲
      </button>
      <div className={styles.dpadCell} />

      {/* Row 2: left, center, right */}
      <button
        className={styles.dpadButton}
        onPointerDown={handlePointerDown('left')}
        onPointerMove={handlePointerMove('left')}
      >
        ◀
      </button>
      <div className={styles.dpadCenter} />
      <button
        className={styles.dpadButton}
        onPointerDown={handlePointerDown('right')}
        onPointerMove={handlePointerMove('right')}
      >
        ▶
      </button>

      {/* Row 3: empty, down, empty */}
      <div className={styles.dpadCell} />
      <button
        className={styles.dpadButton}
        onPointerDown={handlePointerDown('down')}
        onPointerMove={handlePointerMove('down')}
      >
        ▼
      </button>
      <div className={styles.dpadCell} />
    </div>
  );
}
