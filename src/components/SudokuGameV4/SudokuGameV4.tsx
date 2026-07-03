import React, { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import styles from './SudokuBoard.module.css';

// ---------------------------------------------------------------------------
// 4×4 Sudoku generator & solver (2×2 boxes, numbers 1–4)
// ---------------------------------------------------------------------------
const EMPTY = 0;
const SIZE = 4;
const BOX_SIZE = 2;

function isValid(board: number[][], row: number, col: number, num: number): boolean {
    for (let x = 0; x < SIZE; x++) if (board[row][x] === num && x !== col) return false;
    for (let x = 0; x < SIZE; x++) if (board[x][col] === num && x !== row) return false;
    const r0 = Math.floor(row / BOX_SIZE) * BOX_SIZE, c0 = Math.floor(col / BOX_SIZE) * BOX_SIZE;
    for (let i = 0; i < BOX_SIZE; i++) {
        for (let j = 0; j < BOX_SIZE; j++) {
            if (board[r0 + i][c0 + j] === num && (r0 + i !== row || c0 + j !== col)) return false;
        }
    }
    return true;
}

function solve(board: number[][]): boolean {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === EMPTY) {
                const nums = [1, 2, 3, 4];
                for (let i = nums.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [nums[i], nums[j]] = [nums[j], nums[i]];
                }
                for (const n of nums) {
                    if (isValid(board, r, c, n)) { board[r][c] = n; if (solve(board)) return true; board[r][c] = EMPTY; }
                }
                return false;
            }
        }
    }
    return true;
}

function fillBox(board: number[][], r0: number, c0: number) {
    const nums = [1, 2, 3, 4];
    for (let i = 0; i < BOX_SIZE; i++) {
        for (let j = 0; j < BOX_SIZE; j++) {
            let n: number;
            do { n = nums[Math.floor(Math.random() * nums.length)]; } while (!isBoxFree(board, r0, c0, n));
            board[r0 + i][c0 + j] = n;
        }
    }
}

function isBoxFree(board: number[][], r0: number, c0: number, num: number): boolean {
    for (let i = 0; i < BOX_SIZE; i++) for (let j = 0; j < BOX_SIZE; j++) if (board[r0 + i][c0 + j] === num) return false;
    return true;
}

function generatePuzzle(): { initial: number[][]; solution: number[][] } {
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    for (let i = 0; i < SIZE; i += BOX_SIZE) fillBox(board, i, i);
    solve(board);

    const solution = board.map(row => [...row]);
    // Remove ~8 cells from a 4×4 grid (leaves ~8 clues — easy difficulty by default)
    let removed = 0;
    const target = 8;
    const initial = board.map(row => [...row]);
    while (removed < target) {
        const r = Math.floor(Math.random() * SIZE);
        const c = Math.floor(Math.random() * SIZE);
        if (initial[r][c] !== EMPTY) { initial[r][c] = EMPTY; removed++; }
    }

    return { initial, solution };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const SudokuGameV4: React.FC = () => {
    // Game state
    const [initialBoard, setInitialBoard] = useState<number[][]>([]);
    const [board,       setBoard]        = useState<number[][]>([]);
    const [solution,    setSolution]     = useState<number[][]>([]);
    const [pencil,      setPencil]       = useState<number[][][]>(
        Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => [] as number[]))
    );

    // Selection & mode
    const [selected, setSelected]   = useState<[number, number] | null>(null);
    const [pencilMode, setPencilMode] = useState(false);

    // Progress tracking
    const [mistakes, setMistakes]  = useState(0);
    const [won,      setWon]       = useState(false);
    const [conflict, setConflict]  = useState<[number, number] | null>(null);
    const [timer,    setTimer]     = useState(0);
    const [playing,  setPlaying]   = useState(false);

    // --- Timer ---------------------------------------------------------
    useEffect(() => {
        if (!playing || won) return;
        const id = setInterval(() => setTimer(t => t + 1), 1000);
        return () => clearInterval(id);
    }, [playing, won]);

    const formatTime = (s: number): string => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    // --- Helpers -------------------------------------------------------
    const conflicts = useCallback((b: number[][], r: number, c: number): boolean => {
        const n = b[r][c];
        if (n === EMPTY) return false;
        for (let cc = 0; cc < SIZE; cc++) if (cc !== c && b[r][cc] === n) return true;
        for (let rr = 0; rr < SIZE; rr++) if (rr !== r && b[rr][c] === n) return true;
        const r0 = Math.floor(r / BOX_SIZE) * BOX_SIZE, c0 = Math.floor(c / BOX_SIZE) * BOX_SIZE;
        for (let i = 0; i < BOX_SIZE; i++) for (let j = 0; j < BOX_SIZE; j++) if ((r0 + i !== r || c0 + j !== c) && b[r0 + i][c0 + j] === n) return true;
        return false;
    }, []);

    // --- Actions -------------------------------------------------------
    const startNewGame = useCallback(() => {
        const { initial, solution: sol } = generatePuzzle();
        setInitialBoard(initial.map(r => [...r]));
        setBoard(initial.map(r => [...r]));
        setSolution(sol);
        setPencil(Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => [] as number[])));
        setSelected(null);
        setPencilMode(false);
        setMistakes(0);
        setWon(false);
        setConflict(null);
        setTimer(0);
        setPlaying(true);
    }, []);

    // Generate one puzzle on mount.
    useEffect(() => { startNewGame(); }, [startNewGame]);

    const placeNumber = useCallback((num: number) => {
        if (won || !playing) return;

        let sr: number | undefined = selected?.[0], sc: number | undefined = selected?.[1];
        if (sr === undefined || sc === undefined) {
            outer: for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
                if (initialBoard[r][c] === EMPTY) { sr = r; sc = c; break outer; }
            }
            if (sr === undefined || sc === undefined) return;
        }

        const row = sr!, col = sc!;
        if (initialBoard[row][col] !== EMPTY) return;

        let newPencil: number[][][] | undefined;
        let wonFlag = false;

        if (pencilMode) {
            const mp = pencil.map(r => r.map(c => [...c]));
            const idx = mp[row][col].indexOf(num);
            if (idx === -1) { mp[row][col].push(num); mp[row][col].sort((a, b) => a - b); }
            else mp[row][col].splice(idx, 1);
            newPencil = mp;
        } else {
            const nb = board.map(r => [...r]);
            nb[row][col] = num;

            if (conflicts(nb, row, col)) {
                setConflict([row, col]);
                setTimeout(() => setConflict(null), 1500);
                setMistakes(m => m + 1);
            } else {
                setConflict(null);
                if (num === solution[row][col]) {
                    const mp = pencil.map(r => r.map(c => [...c]));
                    mp[row][col] = [];
                    for (let i = 0; i < SIZE; i++) { mp[row][i] = mp[row][i].filter(x => x !== num); mp[i][col] = mp[i][col].filter(x => x !== num); }
                    const r0 = Math.floor(row / BOX_SIZE) * BOX_SIZE, c0 = Math.floor(col / BOX_SIZE) * BOX_SIZE;
                    for (let i = 0; i < BOX_SIZE; i++) for (let j = 0; j < BOX_SIZE; j++) mp[r0 + i][c0 + j] = mp[r0 + i][c0 + j].filter(x => x !== num);
                    newPencil = mp;

                    // Win check
                    let full = true;
                    for (let rr = 0; rr < SIZE && full; rr++) for (let cc = 0; cc < SIZE && full; cc++) if (nb[rr][cc] !== solution[rr][cc]) full = false;
                    if (full) wonFlag = true;
                } else {
                    setMistakes(m => m + 1);
                }
            }
            setBoard(nb);
        }

        if (wonFlag) { setWon(true); setPlaying(false); }
        if (newPencil !== undefined) setPencil(newPencil);
    }, [selected, pencilMode, initialBoard, solution, won, playing, conflicts]);

    const clearCell = useCallback(() => {
        if (!selected || won) return;
        const [r, c] = selected;
        if (initialBoard[r][c] !== EMPTY) return;
        setBoard(bd => { const nb = bd.map(r => [...r]); nb[r][c] = EMPTY; return nb; });
    }, [selected, initialBoard, won]);

    // --- Keyboard ------------------------------------------------------
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (won) return;

            if (/^[1-4]$/.test(e.key)) { placeNumber(+e.key); return; }

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

            nr = Math.max(0, Math.min(SIZE - 1, nr));
            nc = Math.max(0, Math.min(SIZE - 1, nc));
            if (nr !== r || nc !== c) { setSelected([nr, nc]); e.preventDefault(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selected, placeNumber, clearCell]);

    // --- Render helpers ------------------------------------------------
    const highlighted = selected ? (() => {
        const s = new Set<string>();
        const [r, c] = selected;
        for (let i = 0; i < SIZE; i++) { s.add(`${r},${i}`); s.add(`${i},${c}`); }
        const r0 = Math.floor(r / BOX_SIZE) * BOX_SIZE, c0 = Math.floor(c / BOX_SIZE) * BOX_SIZE;
        for (let i = 0; i < BOX_SIZE; i++) for (let j = 0; j < BOX_SIZE; j++) s.add(`${r0 + i},${c0 + j}`);
        const v = board[r][c];
        if (v !== EMPTY) for (let rr = 0; rr < SIZE; rr++) for (let cc = 0; cc < SIZE; cc++) { if (board[rr][cc] === v) s.add(`${rr},${cc}`); }
        return s;
    })() : new Set<string>();

    const renderPencilMarks = (r: number, c: number) => {
        const marks = pencil[r][c];
        if (!marks.length) return null;
        return (
            <div className={styles.pencilGrid}>
                {[1, 2, 3, 4].map(n => (
                    <span key={n} className={styles.pencilDigit}>{marks.includes(n) ? n : ''}</span>
                ))}
            </div>
        );
    };

    // ------------------------------------------------------------------
    return (
        <div className={styles.container}>
            {/* Title */}
            <h2 className={styles.title}>Sudoku 4×4</h2>

            {/* Timer + New Game */}
            <div className={styles.topBar}>
                <div className={styles.timerDisplay}>
                    <svg className={styles.clockIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                    </svg>
                    <span className={styles.timerValue}>{formatTime(timer)}</span>
                </div>

                <button className={styles.ctrlBtn} onClick={() => startNewGame()}>
                    New Game
                </button>
            </div>

            {/* Instructions card */}
            <div className={styles.infoCard}>
                <p className={styles.instructions}>
                    Fill the grid so every row, column and 2×2 box contains digits 1–4.
                </p>
                <div className={styles.shortcuts}>
                    <span><kbd>↑↓←→</kbd> Navigate</span>
                    <span><kbd>1-4</kbd> Place number</span>
                    <span><kbd>P</kbd> Pencil mode</span>
                    <span><kbd>BkSp</kbd> Clear cell</span>
                </div>
            </div>

            {won && (
                <div className={styles.winBanner}>
                    <h3>Congratulations! You solved it!</h3>
                    <p>Mistakes: {mistakes} &nbsp;|&nbsp; Time: {formatTime(timer)}</p>
                </div>
            )}

            {/* Grid */}
            <div className={styles.board} role="grid" aria-label="Sudoku 4x4 grid">
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
            </div>

            {/* Numpad */}
            <div className={styles.numpad} role="group" aria-label="Number pad">
                {[1, 2, 3, 4].map(n => (
                    <button key={n} className={styles.numBtn} onClick={() => placeNumber(n)} aria-label={`Place ${n}`}>
                        {n}
                    </button>
                ))}
            </div>

            <p className={styles.footer}>Mistakes: {mistakes}</p>
        </div>
    );
};

export default SudokuGameV4;
