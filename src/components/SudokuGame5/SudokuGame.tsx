import React, { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { useColorMode } from '@docusaurus/theme-common';
import styles from './SudokuBoard.module.css';

// ===== Sudoku Utilities =====

const EMPTY = 0;

function isValid(board: number[][], r: number, c: number, n: number): boolean {
    for (let x = 0; x < 9; x++) if (board[r][x] === n && x !== c) return false;
    for (let y = 0; y < 9; y++) if (board[y][c] === n && y !== r) return false;
    const sr = Math.floor(r / 3) * 3, sc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            if (board[sr + i][sc + j] === n && (sr + i !== r || sc + j !== c)) return false;
    return true;
}

function solveSudoku(b: number[][]): boolean {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (b[r][c] === EMPTY) {
                const ns = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                for (let i = ns.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [ns[i], ns[j]] = [ns[j], ns[i]];
                }
                for (const n of ns) { b[r][c] = n; if (solveSudoku(b)) return true; b[r][c] = EMPTY; }
                return false;
            }
        }
    }
    return true;
}

function fillBox(b: number[][], r0: number, c0: number) {
    const ns = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
            let n: number; do { n = ns[Math.floor(Math.random() * ns.length)]; } while (!boxHas(b, r0, c0, n));
            b[r0 + i][c0 + j] = n;
        }
}

function boxHas(b: number[][], r0: number, c0: number, n: number): boolean {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (b[r0 + i][c0 + j] === n) return false;
    return true;
}

function generateSudoku(diff: 'easy' | 'medium' | 'hard') {
    const b = Array.from({ length: 9 }, () => Array(9).fill(EMPTY));
    for (let i = 0; i < 9; i += 3) fillBox(b, i, i);
    solveSudoku(b);
    const sol = b.map(r => [...r]);
    const removed = diff === 'easy' ? 30 : diff === 'medium' ? 45 : 52;
    const init = b.map(r => [...r]); let cnt = 0;
    while (cnt < removed) {
        const r = Math.floor(Math.random() * 9), c = Math.floor(Math.random() * 9);
        if (init[r][c] !== EMPTY) { init[r][c] = EMPTY; cnt++; }
    }
    return { initial: init, solution: sol };
}

function hasConflict(board: number[][], r: number, c: number, n: number): boolean {
    for (let x = 0; x < 9; x++) if (x !== c && board[r][x] === n) return true;
    for (let y = 0; y < 9; y++) if (y !== r && board[y][c] === n) return true;
    const sr = Math.floor(r / 3) * 3, sc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            if ((sr + i !== r || sc + j !== c) && board[sr + i][sc + j] === n) return true;
    return false;
}

// ===== Component =====

const SudokuGame: React.FC = () => {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

    // ── State ──────────────────────────────────────────────
    const [initial, setInitial] = useState<number[][]>([]);
    const [board, setBoard] = useState<number[][]>([]);
    const [solution, setSolution] = useState<number[][]>([]);
    const [marks, setMarks] = useState<number[][][]>(() =>
        Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[]))
    );
    const [selected, setSelected] = useState<[number, number] | null>(null);
    const [focusedCell, setFocusedCell] = useState<[number, number] | null>(null);
    const [pencilMode, setPencilMode] = useState(false);
    const [mistakes, setMistakes] = useState(0);
    const [won, setWon] = useState(false);
    const [conflictCell, setConflictCell] = useState<[number, number] | null>(null);
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

    // ── Init ───────────────────────────────────────────────
    useEffect(() => { startNew(difficulty); }, []);

    // ── Actions ────────────────────────────────────────────
    const startNew = useCallback((diff: 'easy' | 'medium' | 'hard') => {
        const { initial: init, solution: sol } = generateSudoku(diff);
        setInitial(init.map(r => [...r]));
        setBoard(init.map(r => [...r]));
        setSolution(sol);
        setMarks(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[])));
        setSelected(null); setFocusedCell(null);
        setMistakes(0); setWon(false); setConflictCell(null);
    }, []);

    const handleNewGame = useCallback((diff?: 'easy' | 'medium' | 'hard') => {
        if (diff) setDifficulty(diff);
        startNew(diff ?? difficulty);
    }, [difficulty, startNew]);

    const handleClick = useCallback((r: number, c: number) => {
        if (won) return;
        setSelected([r, c]); setFocusedCell([r, c]);
    }, [won]);

    const handleFocus = useCallback((r: number, c: number) => {
        setSelected([r, c]); setFocusedCell([r, c]);
    }, []);

    // Input a digit (1-9), or 0 to clear
    const handleInput = useCallback((num: number) => {
        if (won || !focusedCell) return;
        const [r, c] = focusedCell;
        if (initial[r][c] !== EMPTY) return;

        if (pencilMode && num >= 1 && num <= 9) {
            // Toggle pencil mark
            setMarks(prev => {
                const nm = prev.map(row => row.map(col => [...col]));
                const m = nm[r][c]; const idx = m.indexOf(num);
                if (idx === -1) { m.push(num); m.sort(); } else m.splice(idx, 1);
                return nm;
            });
        } else if (num >= 1 && num <= 9) {
            // Place digit — check conflicts first via side-effect pattern
            setBoard(prev => {
                const nb = prev.map(row => [...row]);
                nb[r][c] = num;

                if (hasConflict(nb, r, c, num)) {
                    setConflictCell([r, c]); setTimeout(() => setConflictCell(null), 1500);
                    setMistakes(p => p + 1);
                    return prev; // revert
                }

                // Correct vs solution? Count as mistake if wrong
                const isCorrect = num === solution[r][c];
                if (!isCorrect) {
                    setMistakes(p => p + 1);
                    // Still place it so user can see it (they'll figure out it's wrong)
                }

                if (isCorrect) {
                    // Clear pencil marks in row/col/box for this number
                    setMarks(prev2 => {
                        const nm = prev2.map(row => row.map(col => [...col]));
                        nm[r][c] = [];
                        for (let i = 0; i < 9; i++) {
                            nm[r][i] = nm[r][i].filter(n => n !== num);
                            nm[i][c] = nm[i][c].filter(n => n !== num);
                        }
                        const sR = Math.floor(r / 3) * 3, sC = Math.floor(c / 3) * 3;
                        for (let i = 0; i < 3; i++)
                            for (let j = 0; j < 3; j++)
                                nm[sR + i][sC + j] = nm[sR + i][sC + j].filter(n => n !== num);
                        return nm;
                    });
                }

                // Win check
                let isWin = true;
                for (let x = 0; x < 9 && isWin; x++)
                    for (let y = 0; y < 9 && isWin; y++)
                        if (nb[x][y] !== solution[x][y]) isWin = false;
                if (isWin) setWon(true);

                return nb;
            });
        } else {
            // Clear cell (num === 0)
            setBoard(prev => {
                const nb = prev.map(row => [...row]);
                if (nb[r][c] !== EMPTY && initial[r][c] !== EMPTY) return prev;
                nb[r][c] = EMPTY;
                return nb;
            });
        }
    }, [focusedCell, initial, pencilMode, solution, won]);

    const handleDelete = useCallback(() => {
        if (won || !focusedCell) return;
        handleInput(0);
    }, [focusedCell, won, handleInput]);

    // ── Keyboard handler ───────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (won && e.key !== 'n' && e.key !== 'N') return;
            if (e.key >= '1' && e.key <= '9') { e.preventDefault(); handleInput(parseInt(e.key)); return; }

            const t = focusedCell ?? selected;
            if (!t) {
                if (/^Arrow[UDLR]$/.test(e.key)) { e.preventDefault(); moveFocus(0, 0); }
                return;
            }
            const [r, c] = t; let nr = r, nc = c, moved = false;
            switch (e.key) {
                case 'ArrowUp':    nr = Math.max(0, r - 1); moved = true; break;
                case 'ArrowDown':  nr = Math.min(8, r + 1); moved = true; break;
                case 'ArrowLeft':  nc = Math.max(0, c - 1); moved = true; break;
                case 'ArrowRight': nc = Math.min(8, c + 1); moved = true; break;
                case 'Backspace': case 'Delete': handleDelete(); return;
                case 'p': case 'P': setPencilMode(p => !p); return;
            }
            if (moved) { e.preventDefault(); moveFocus(nr, nc); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [focusedCell, selected, won, handleInput, handleDelete]);

    const moveFocus = useCallback((r: number, c: number) => {
        setFocusedCell([r, c]); setSelected([r, c]);
        setTimeout(() => (document.querySelector(`[data-cell="${r}-${c}"]`) as HTMLElement)?.focus(), 0);
    }, []);

    // ── Highlighting ───────────────────────────────────────
    const highlighted = (() => {
        if (!selected) return new Set<string>();
        const [r, c] = selected;
        const set = new Set<string>();
        for (let i = 0; i < 9; i++) { set.add(`${r},${i}`); set.add(`${i},${c}`); }
        const sR = Math.floor(r / 3) * 3, sC = Math.floor(c / 3) * 3;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) set.add(`${sR + i},${sC + j}`);
        const num = board[r]?.[c];
        if (num) for (let x = 0; x < 9; x++) for (let y = 0; y < 9; y++) if (board[x][y] === num && !(x === r && y === c)) set.add(`${x},${y}`);
        return set;
    })();

    // ── Render helper: pencil marks inside a cell ──────────
    const renderPencil = (r: number, c: number) => {
        const m = marks[r]?.[c] ?? [];
        if (m.length === 0) return null;
        return (
            <div className={styles.pencilGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <span key={n} className={styles.pencilCell}>{m.includes(n) ? n : ''}</span>
                ))}
            </div>
        );
    };

    // ── Render Board Cell ──────────────────────────────────
    const renderBoard = () => {
        if (board.length === 0) return null;
        return board.map((row, ri) => row.map((cell, ci) => {
            const isSel = selected?.[0] === ri && selected?.[1] === ci;
            const fixed = initial[ri][ci] !== EMPTY;
            const hl = highlighted.has(`${ri},${ci}`);
            const sameNum = !isSel && cell !== EMPTY &&
                board?.[selected?.[0] ?? -1]?.[selected?.[1] ?? -1] === cell;

            return (
                <div
                    key={`${ri}-${ci}`}
                    data-cell={`${ri}-${ci}`}
                    className={clsx(
                        styles.cell,
                        isSel && styles.selCell,
                        hl && !isSel && styles.hlCell,
                        sameNum && styles.sameNum,
                        fixed && styles.fixedCell,
                        cell !== EMPTY && !fixed && styles.userCell,
                        conflictCell?.[0] === ri && conflictCell?.[1] === ci && styles.conflict,
                    )}
                    tabIndex={0}
                    role="gridcell"
                    aria-label={`Row ${ri + 1}, Col ${ci + 1}${cell ? `, value ${cell}` : ', empty'}`}
                    onClick={() => handleClick(ri, ci)}
                    onFocus={() => handleFocus(ri, ci)}
                >
                    {cell !== EMPTY && !fixed ? (
                        <span className={styles.userDigit}>{cell}</span>
                    ) : cell !== EMPTY ? (
                        <span className={styles.givenDigit}>{cell}</span>
                    ) : renderPencil(ri, ci)}
                </div>
            );
        }));
    };

    // ── Main Return ────────────────────────────────────────
    return (
        <div className={styles.gameContainer}>
            {/* Title */}
            <h2 style={{ textAlign: 'center', color: isDark ? '#e0e0e0' : '#333' }}>Sudoku</h2>

            {/* Difficulty selector */}
            <div className={styles.diffBar}>
                {(['easy', 'medium', 'hard'] as const).map(d => (
                    <button key={d} className={clsx(styles.diffBtn, d === difficulty && styles.diffActive)}
                            onClick={() => handleNewGame(d)}>
                        {d[0].toUpperCase() + d.slice(1)}
                    </button>
                ))}
            </div>

            {/* Pencil mode indicator */}
            {pencilMode && (
                <div className={styles.pencilInd}>✏️ Pencil Mode — click cells to toggle candidates</div>
            )}

            {/* Win / error messages */}
            {won && (
                <div className={styles.winMsg}>🎉 Solved! Mistakes: {mistakes}</div>
            )}
            {conflictCell && !won && (
                <div className={styles.errToast}>⚠️ Conflict in row, column &amp; box!</div>
            )}

            {/* How to play */}
            <div className={styles.howToPlay}>
                <h3 style={{ margin: '0 0 0.5rem', color: isDark ? '#e0e0e0' : '#333' }}>How to Play</h3>
                <p style={{ fontSize: '0.9rem', color: isDark ? '#ccc' : '#666', margin: 0 }}>
                    Every row, column &amp; 3×3 box must contain digits 1–9 with no repeats.
                </p>
                <div className={styles.kbdRow}>
                    <span><kbd>Tab</kbd> focus cell</span>
                    <span><kbd>↑↓←→</kbd> navigate</span>
                    <span><kbd>1-9</kbd> enter digit</span>
                    <span><kbd>P</kbd> pencil mode</span>
                    <span><kbd>BkSp</kbd> clear cell</span>
                </div>
            </div>

            {/* Board */}
            <div className={styles.boardWrap}>
                <div className={styles.board} role="grid" aria-label="Sudoku board">
                    {renderBoard()}
                </div>
            </div>

            {/* Controls row */}
            <div className={styles.ctrlRow}>
                <button className={clsx(styles.btn, pencilMode && styles.active)}
                        onClick={() => setPencilMode(p => !p)} aria-pressed={pencilMode}>
                    {pencilMode ? '✏️ ON' : '✏️ Pencil'}
                </button>
                <button className={styles.btn} onClick={() => handleNewGame()}>🔄 New Game</button>
            </div>

            {/* Numpad */}
            <div className={styles.numpad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <button key={n} className={styles.numBtn} onClick={() => handleInput(n)}
                            aria-label={`Number ${n}`}>{n}</button>
                ))}
                <button className={styles.numBtn} onClick={handleDelete} aria-label="Clear cell">⌫</button>
            </div>

            {/* Status */}
            <div className={styles.status}>Mistakes: {mistakes}</div>
        </div>
    );
};

export default SudokuGame;
