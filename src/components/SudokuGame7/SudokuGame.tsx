import React, { useState, useEffect, useCallback, useRef } from 'react';
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

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function fillBoard(b: number[][]): boolean {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (b[r][c] === EMPTY) {
                for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
                    if (isValid(b, r, c, n)) {
                        b[r][c] = n;
                        if (fillBoard(b)) return true;
                        b[r][c] = EMPTY;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function generateSudoku(diff: 'easy' | 'medium' | 'hard') {
    const b = Array.from({ length: 9 }, () => Array(9).fill(EMPTY));
    fillBoard(b);
    const sol = b.map(r => [...r]);
    const removed = diff === 'easy' ? 28 : diff === 'medium' ? 42 : 52;
    const init = b.map(r => [...r]);
    const positions = shuffle(init.flatMap((row, r) => row.map((_, c) => [r, c] as [number, number])));
    let cnt = 0;
    for (const [r, c] of positions) {
        if (cnt >= removed) break;
        init[r][c] = EMPTY;
        cnt++;
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

function getNotesForCell(initial: number[][], board: number[][], r: number, c: number): number[] {
    const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => {
        // Check row
        for (let x = 0; x < 9; x++) {
            if (x !== c && board[r][x] === n) return false;
        }
        // Check col
        for (let y = 0; y < 9; y++) {
            if (y !== r && board[y][c] === n) return false;
        }
        // Check box
        const sR = Math.floor(r / 3) * 3, sC = Math.floor(c / 3) * 3;
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++)
                if ((sR + i !== r || sC + j !== c) && board[sR + i][sC + j] === n) return false;
        return true;
    });
    return candidates;
}

// ===== Component =====

const SudokuGame: React.FC = () => {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';
    const gameRef = useRef<HTMLDivElement>(null);

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
    const [timer, setTimer] = useState(0);
    const [timerRunning, setTimerRunning] = useState(false);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [undoStack, setUndoStack] = useState<{ board: number[][]; marks: number[][][] }[]>([]);
    const [showHintCell, setShowHintCell] = useState<[number, number] | null>(null);
    const [hintTimer, setHintTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    // ── Timer ──────────────────────────────────────────────
    useEffect(() => {
        if (!timerRunning) return;
        const id = setInterval(() => setTimer(t => t + 1), 1000);
        return () => clearInterval(id);
    }, [timerRunning]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

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
        setUndoStack([]);
        setTimer(0); setTimerRunning(true);
        setHintsUsed(0); setShowHintCell(null);
    }, []);

    const handleNewGame = useCallback((diff?: 'easy' | 'medium' | 'hard') => {
        if (diff) setDifficulty(diff);
        startNew(diff ?? difficulty);
    }, [difficulty, startNew]);

    const pushUndo = useCallback(() => {
        setUndoStack(prev => [...prev.slice(-30), { board: board.map(r => [...r]), marks: marks.map(row => row.map(col => [...col])) }]);
    }, [board, marks]);

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const last = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        setBoard(last.board.map(r => [...r]));
        setMarks(last.marks.map(row => row.map(col => [...col])));
    }, [undoStack]);

    const handleHint = useCallback(() => {
        if (won) return;
        // Find an empty cell
        const emptyCells: [number, number][] = [];
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (board[r][c] === EMPTY) emptyCells.push([r, c]);
        if (emptyCells.length === 0) return;

        const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const correctVal = solution[r][c];

        pushUndo();
        setBoard(prev => {
            const nb = prev.map(row => [...row]);
            nb[r][c] = correctVal;
            return nb;
        });
        setMarks(prev => {
            const nm = prev.map(row => row.map(col => [...col]));
            nm[r][c] = [];
            return nm;
        });
        setHintsUsed(h => h + 1);
        setShowHintCell([r, c]);
        setTimerRunning(true);

        if (hintTimer) clearTimeout(hintTimer);
        const t = setTimeout(() => setShowHintCell(null), 2000);
        setHintTimer(t);
    }, [won, board, solution, pushUndo, hintTimer]);

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

        if (num >= 1 && num <= 9) {
            // Save undo state
            pushUndo();

            if (pencilMode) {
                // Toggle pencil mark
                setMarks(prev => {
                    const nm = prev.map(row => row.map(col => [...col]));
                    const m = nm[r][c]; const idx = m.indexOf(num);
                    if (idx === -1) { m.push(num); m.sort(); } else m.splice(idx, 1);
                    return nm;
                });
            } else {
                // Place digit
                setBoard(prev => {
                    const nb = prev.map(row => [...row]);
                    nb[r][c] = num;

                    if (hasConflict(nb, r, c, num)) {
                        setConflictCell([r, c]); setTimeout(() => setConflictCell(null), 1500);
                        setMistakes(p => p + 1);
                        return prev; // revert
                    }

                    const isCorrect = num === solution[r][c];
                    if (!isCorrect) {
                        setMistakes(p => p + 1);
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
                    if (isWin) { setWon(true); setTimerRunning(false); }

                    return nb;
                });
            }
        } else {
            // Clear cell (num === 0)
            pushUndo();
            setBoard(prev => {
                const nb = prev.map(row => [...row]);
                if (nb[r][c] !== EMPTY && initial[r][c] !== EMPTY) return prev;
                nb[r][c] = EMPTY;
                return nb;
            });
        }
    }, [focusedCell, initial, pencilMode, solution, won, pushUndo]);

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
                case 'Escape': setFocusedCell(null); setSelected(null); return;
                case 'p': case 'P': setPencilMode(p => !p); return;
                case 'z': case 'Z':
                    if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleUndo(); return; }
                    break;
                case 'h': case 'H':
                    if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleHint(); return; }
                    break;
                case 's': case 'S':
                    if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleUndo(); return; }
                    break;
            }
            if (moved) { e.preventDefault(); moveFocus(nr, nc); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [focusedCell, selected, won, handleInput, handleDelete, handleUndo, handleHint]);

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

    // ── Pencil mark candidates (auto-suggest) ──────────────
    const candidatesForSelected = (() => {
        if (!selected) return [];
        const [r, c] = selected;
        if (board[r][c] !== EMPTY) return [];
        if (initial[r][c] !== EMPTY) return [];
        return getNotesForCell(initial, board, r, c);
    })();

    // ── Render helper: pencil marks inside a cell ──────────
    const renderPencil = (r: number, c: number) => {
        const m = marks[r]?.[c] ?? [];
        if (m.length === 0) return null;
        return (
            <div className={styles.pencilGrid} aria-hidden="true">
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
            const isHint = showHintCell?.[0] === ri && showHintCell?.[1] === ci;

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
                        isHint && styles.hintCell,
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

    // ── Progress ───────────────────────────────────────────
    const filledCells = board.flat().filter(v => v !== EMPTY).length;
    const totalCells = 81;
    const initialCells = initial.flat().filter(v => v !== EMPTY).length;
    const progress = Math.round((filledCells / (totalCells - initialCells)) * 100);

    // ── Main Return ────────────────────────────────────────
    return (
        <div className={styles.gameContainer} ref={gameRef}>
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

            {/* Status bar */}
            <div className={styles.statusBar}>
                <span className={styles.statusItem}>⏱ {formatTime(timer)}</span>
                <span className={styles.statusItem}>✏️ {pencilMode ? 'ON' : 'OFF'}</span>
                <span className={styles.statusItem}>❌ {mistakes}</span>
                <span className={styles.statusItem}>💡 {hintsUsed}</span>
            </div>

            {/* Pencil mode indicator */}
            {pencilMode && (
                <div className={styles.pencilInd}>✏️ Pencil Mode — click cells to toggle candidates</div>
            )}

            {/* Win / error messages */}
            {won && (
                <div className={styles.winMsg}>🎉 Solved! Time: {formatTime(timer)} | Mistakes: {mistakes} | Hints: {hintsUsed}</div>
            )}
            {conflictCell && !won && (
                <div className={styles.errToast}>⚠️ Conflict in row, column &amp; box!</div>
            )}

            {/* Progress bar */}
            <div className={styles.progressWrap}>
                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                <span className={styles.progressText}>{progress}%</span>
            </div>

            {/* Candidates display for selected cell */}
            {selected && !won && candidatesForSelected.length > 0 && (
                <div className={styles.candidatesBar}>
                    <span className={styles.candidatesLabel}>Candidates:</span>
                    <div className={styles.candidatesNums}>
                        {candidatesForSelected.map(n => (
                            <button key={n} className={styles.candidateBtn} onClick={() => handleInput(n)}
                                    aria-label={`Place ${n}`}>{n}</button>
                        ))}
                    </div>
                </div>
            )}

            {/* How to play */}
            <div className={styles.howToPlay}>
                <h3 style={{ margin: '0 0 0.5rem', color: isDark ? '#e0e0e0' : '#333' }}>How to Play</h3>
                <p style={{ fontSize: '0.9rem', color: isDark ? '#ccc' : '#666', margin: 0 }}>
                    Every row, column &amp; 3×3 box must contain digits 1–9 with no repeats.
                </p>
                <div className={styles.kbdRow}>
                    <span><kbd>↑↓←→</kbd> navigate</span>
                    <span><kbd>1-9</kbd> enter digit</span>
                    <span><kbd>P</kbd> pencil mode</span>
                    <span><kbd>⌫ Del</kbd> clear</span>
                    <span><kbd>Ctrl+Z</kbd> undo</span>
                    <span><kbd>Ctrl+H</kbd> hint</span>
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
                <button className={styles.btn} onClick={handleUndo} disabled={undoStack.length === 0}
                        aria-label="Undo">↩️ Undo</button>
                <button className={styles.btn} onClick={handleHint} aria-label="Hint">💡 Hint</button>
                <button className={styles.btn} onClick={() => handleNewGame()} aria-label="New game">🔄 New</button>
            </div>

            {/* Numpad */}
            <div className={styles.numpad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <button key={n} className={styles.numBtn} onClick={() => handleInput(n)}
                            aria-label={`Number ${n}`}>{n}</button>
                ))}
                <button className={clsx(styles.numBtn, styles.delBtn)} onClick={handleDelete} aria-label="Clear cell">⌫</button>
            </div>
        </div>
    );
};

export default SudokuGame;
