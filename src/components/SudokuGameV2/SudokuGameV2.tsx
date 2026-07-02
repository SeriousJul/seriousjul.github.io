import React, { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { useColorMode } from '@docusaurus/theme-common';
import styles from './SudokuBoard.module.css';

// ---------------------------------------------------------------------------
// Sudoku generator & solver — identical logic to the v1 game.
// ---------------------------------------------------------------------------

const EMPTY = 0;

function isValid(board: number[][], row: number, col: number, num: number): boolean {
    for (let x = 0; x < 9; x++) {
        if (board[row][x] === num && x !== col) return false;
    }
    for (let x = 0; x < 9; x++) {
        if (board[x][col] === num && x !== row) return false;
    }
    const r0 = Math.floor(row / 3) * 3;
    const c0 = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[r0 + i][c0 + j] === num && (r0 + i !== row || c0 + j !== col)) return false;
        }
    }
    return true;
}

function solve(board: number[][]): boolean {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === EMPTY) {
                const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                // Fisher-Yates shuffle for randomness.
                for (let i = nums.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [nums[i], nums[j]] = [nums[j], nums[i]];
                }
                for (const n of nums) {
                    if (isValid(board, r, c, n)) {
                        board[r][c] = n;
                        if (solve(board)) return true;
                        board[r][c] = EMPTY;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function fillBox(board: number[][], r0: number, c0: number) {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            let n: number;
            do {
                n = nums[Math.floor(Math.random() * nums.length)];
            } while (!isBoxFree(board, r0, c0, n));
            board[r0 + i][c0 + j] = n;
        }
    }
}

function isBoxFree(board: number[][], r0: number, c0: number, num: number): boolean {
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[r0 + i][c0 + j] === num) return false;
        }
    }
    return true;
}

function generatePuzzle(difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
    const board = Array.from({ length: 9 }, () => Array(9).fill(EMPTY));
    for (let i = 0; i < 9; i += 3) fillBox(board, i, i);
    solve(board);

    const solution = board.map(row => [...row]);

    let removed: number;
    switch (difficulty) {
        case 'easy':   removed = 30; break;
        case 'medium': removed = 42; break;
        case 'hard':   removed = 52; break;
        default:       removed = 42;
    }

    const initial = board.map(row => [...row]);
    let count = 0;
    while (count < removed) {
        const r = Math.floor(Math.random() * 9);
        const c = Math.floor(Math.random() * 9);
        if (initial[r][c] !== EMPTY) { initial[r][c] = EMPTY; count++; }
    }

    return { initial, solution };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SudokuGameV2: React.FC = () => {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

    const [initialBoard, setInitialBoard]   = useState<number[][]>([]);
    const [board,       setBoard]           = useState<number[][]>([]);
    const [solution,    setSolution]        = useState<number[][]>([]);
    const [pencil,      setPencil]          = useState<number[][][]>(
        Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[]))
    );
    const [selected, setSelected]           = useState<[number, number] | null>(null);
    const [pencilMode, setPencilMode]       = useState(false);
    const [mistakes,  setMistakes]          = useState(0);
    const [won,       setWon]               = useState(false);
    const [conflict,  setConflict]          = useState<[number, number] | null>(null);

    // --- helpers ----------------------------------------------------------

    const startNewGame = useCallback(() => {
        const { initial, solution: sol } = generatePuzzle('medium');
        setInitialBoard(initial.map(r => [...r]));
        setBoard(initial.map(r => [...r]));
        setSolution(sol);
        setPencil(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[])));
        setSelected(null);
        setMistakes(0);
        setWon(false);
        setConflict(null);
    }, []);

    // Generate one puzzle on mount.
    useEffect(() => { startNewGame(); }, [startNewGame]);

    const conflicts = useCallback((b: number[][], r: number, c: number): boolean => {
        const n = b[r][c];
        if (n === EMPTY) return false;
        // Row
        for (let cc = 0; cc < 9; cc++) if (cc !== c && b[r][cc] === n) return true;
        // Column
        for (let rr = 0; rr < 9; rr++) if (rr !== r && b[rr][c] === n) return true;
        // Box
        const r0 = Math.floor(r / 3) * 3, c0 = Math.floor(c / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if ((r0 + i !== r || c0 + j !== c) && b[r0 + i][c0 + j] === n) return true;
            }
        }
        return false;
    }, []);

    // --- actions ----------------------------------------------------------

    const placeNumber = useCallback((num: number) => {
        if (won) return;

        let sr = selected?.[0], sc = selected?.[1];
        if (sr === undefined || sc === undefined) {
            // Auto-select first empty cell.
            outer: for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (initialBoard[r][c] === EMPTY) { sr = r; sc = c; break outer; }
                }
            }
            if (sr === undefined) return; // board full
        }

        const row = sr!, col = sc!;
        if (initialBoard[row][col] !== EMPTY) return; // can't edit clues

        setPencil(prev => {
            const next = prev.map(r => r.map(c => [...c]));
            if (pencilMode) {
                // Toggle the mark.
                const idx = next[row][col].indexOf(num);
                if (idx === -1) { next[row][col].push(num).sort((a, b) => a - b); }
                else next[row][col].splice(idx, 1);
            } else {
                // Place value.
                setBoard(bd => {
                    const nb = bd.map(r => [...r]);
                    nb[row][col] = num;

                    if (conflicts(nb, row, col)) {
                        setConflict([row, col]);
                        setTimeout(() => setConflict(null), 1500);
                        setMistakes(m => m + 1);
                    } else {
                        setConflict(null);
                        // If the number matches solution, clear related pencil marks.
                        if (num === solution[row][col]) {
                            const nr = nb.map(r => r.map(c => [...c]));
                            nr[row][col] = [];
                            for (let i = 0; i < 9; i++) {
                                nr[row][i] = nr[row][i].filter(x => x !== num);
                                nr[i][col] = nr[i][col].filter(x => x !== num);
                            }
                            const r0 = Math.floor(row / 3) * 3, c0 = Math.floor(col / 3) * 3;
                            for (let i = 0; i < 3; i++) {
                                for (let j = 0; j < 3; j++) {
                                    nr[r0 + i][c0 + j] = nr[r0 + i][c0 + j].filter(x => x !== num);
                                }
                            }
                            setPencil(nr);

                            // Win check.
                            let full = true;
                            for (let rr = 0; rr < 9 && full; rr++) {
                                for (let cc = 0; cc < 9 && full; cc++) {
                                    if (nb[rr][cc] !== solution[rr][cc]) full = false;
                                }
                            }
                            if (full) setWon(true);
                        } else {
                            setMistakes(m => m + 1); // wrong number.
                        }
                    }
                    return nb;
                });
            }
            return next;
        });

        if (!pencilMode && sr !== selected?.[0] || sc !== selected?.[1]) {
            setSelected([sr, sc]);
        }
    }, [selected, pencilMode, initialBoard, solution, won, conflicts]);

    const clearCell = useCallback(() => {
        if (!selected || won) return;
        const [r, c] = selected;
        if (initialBoard[r][c] !== EMPTY) return;
        setBoard(bd => { const nb = bd.map(r => [...r]); nb[r][c] = EMPTY; return nb; });
    }, [selected, initialBoard, won]);

    // --- keyboard ---------------------------------------------------------

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (won) return;

            if (e.key >= '1' && e.key <= '9') { placeNumber(+e.key); return; }

            if (!selected) {
                if (/^Arrow(Av|Le|Ri|Do)$/.test(e.key)) setSelected([0, 0]);
                return;
            }

            const [r, c] = selected;
            let nr = r, nc = c;
            switch (e.key) {
                case 'ArrowUp':    nr--; break;
                case 'ArrowDown':  nr++; break;
                case 'ArrowLeft':  nc--; break;
                case 'ArrowRight': nc++; break;
                case 'Backspace':
                case 'Delete':     clearCell(); return;
                case 'p': case 'P': setPencilMode(p => !p); return;
            }

            nr = Math.max(0, Math.min(8, nr));
            nc = Math.max(0, Math.min(8, nc));
            if (nr !== r || nc !== c) { setSelected([nr, nc]); e.preventDefault(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selected, placeNumber, clearCell]);

    // --- render helpers ---------------------------------------------------

    const highlighted = selected ? (() => {
        const s = new Set<string>();
        const [r, c] = selected;
        for (let i = 0; i < 9; i++) { s.add(`${r},${i}`); s.add(`${i},${c}`); }
        const r0 = Math.floor(r / 3) * 3, c0 = Math.floor(c / 3) * 3;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s.add(`${r0 + i},${c0 + j}`);
        const v = board[r][c];
        if (v !== EMPTY) {
            for (let rr = 0; rr < 9; rr++) for (let cc = 0; cc < 9; cc++) {
                if (board[rr][cc] === v) s.add(`${rr},${cc}`);
            }
        }
        return s;
    })() : new Set<string>();

    const renderPencilMarks = (r: number, c: number) => {
        const marks = pencil[r][c];
        if (!marks.length) return null;
        return (
            <div className={styles.pencilGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <span key={n} className={styles.pencilDigit}>{marks.includes(n) ? n : ''}</span>
                ))}
            </div>
        );
    };

    // ------------------------------------------------------------------
    return (
        <div className={styles.container}>
            {/* Title */}
            <h2 className={styles.title}>Sudoku 2</h2>

            {/* Instructions card */}
            <div className={styles.infoCard}>
                <p className={styles.instructions}>
                    Fill the grid so every row, column and 3×3 box contains digits 1–9.
                </p>
                <div className={styles.shortcuts}>
                    <span><kbd>↑↓←→</kbd> Navigate</span>
                    <span><kbd>1-9</kbd> Place number</span>
                    <span><kbd>P</kbd> Pencil mode</span>
                    <span><kbd>BkSp</kbd> Clear cell</span>
                </div>
            </div>

            {won && (
                <div className={styles.winBanner}>
                    <h3>Congratulations! You solved it!</h3>
                    <p>Mistakes: {mistakes}</p>
                </div>
            )}

            {/* Grid */}
            <div className={styles.board} role="grid" aria-label="Sudoku grid">
                {board.map((row, ri) =>
                    row.map((cell, ci) => {
                        const sel     = selected?.[0] === ri && selected?.[1] === ci;
                        const fixed   = initialBoard[ri][ci] !== EMPTY;
                        const userVal = !fixed && cell !== EMPTY;
                        const hl      = highlighted.has(`${ri},${ci}`);
                        const same    = sel === false && cell !== EMPTY && selected && board[selected[0]][selected[1]] === cell;
                        const con     = conflict?.[0] === ri && conflict?.[1] === ci;

                        return (
                            <div
                                key={`${ri}-${ci}`}
                                role="gridcell"
                                tabIndex={0}
                                aria-selected={sel || undefined}
                                className={clsx(
                                    styles.cell,
                                    sel   && styles.selectedCell,
                                    hl    && !sel && styles.highlighted,
                                    same  && styles.sameValue,
                                    fixed && styles.fixed,
                                    userVal && styles.userInput,
                                    con   && styles.conflict,
                                )}
                                onClick={() => setSelected([ri, ci])}
                            >
                                {cell !== EMPTY ? (
                                    <span className={fixed ? styles.fixedDigit : styles.userDigit}>{cell}</span>
                                ) : renderPencilMarks(ri, ci)}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Controls */}
            <div className={styles.controls}>
                <button
                    className={clsx(styles.ctrlBtn, pencilMode && styles.active)}
                    onClick={() => setPencilMode(p => !p)}
                    aria-pressed={pencilMode}
                >
                    Pencil {pencilMode ? 'ON' : 'OFF'}
                </button>
                <button className={styles.ctrlBtn} onClick={startNewGame}>
                    New Game
                </button>
            </div>

            {/* Numpad */}
            <div className={styles.numpad} role="group" aria-label="Number pad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <button key={n} className={styles.numBtn} onClick={() => placeNumber(n)} aria-label={`Place ${n}`}>
                        {n}
                    </button>
                ))}
            </div>

            <p className={styles.footer}>Mistakes: {mistakes}</p>
        </div>
    );
};

export default SudokuGameV2;
