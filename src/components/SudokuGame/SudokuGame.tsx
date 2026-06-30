import React, { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useColorMode } from '@docusaurus/theme-common';
import styles from './SudokuBoard.module.css';

// Sudoku generator and solver utilities
const EMPTY = 0;

function isValid(board: number[][], row: number, col: number, num: number): boolean {
    // Check row
    for (let x = 0; x < 9; x++) {
        if (board[row][x] === num && x !== col) return false;
    }
    // Check column
    for (let x = 0; x < 9; x++) {
        if (board[x][col] === num && x !== row) return false;
    }
    // Check 3x3 box
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[startRow + i][startCol + j] === num && (startRow + i !== row || startCol + j !== col)) return false;
        }
    }
    return true;
}

function solveSudoku(board: number[][]): boolean {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col] === EMPTY) {
                const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                // Shuffle for randomness
                for (let i = numbers.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
                }
                for (const num of numbers) {
                    if (isValid(board, row, col, num)) {
                        board[row][col] = num;
                        if (solveSudoku(board)) return true;
                        board[row][col] = EMPTY;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function generateSudoku(difficulty: 'easy' | 'medium' | 'hard' = 'medium'): { initial: number[][], solution: number[][] } {
    // Create empty board
    const board = Array.from({ length: 9 }, () => Array(9).fill(EMPTY));

    // Fill diagonal boxes first (independent)
    for (let i = 0; i < 9; i += 3) {
        fillBox(board, i, i);
    }

    // Solve the rest
    solveSudoku(board);
    const solution = board.map(row => [...row]);

    // Remove digits based on difficulty
    let removedCount: number;
    switch (difficulty) {
        case 'easy': removedCount = 30; break;
        case 'medium': removedCount = 40; break;
        case 'hard': removedCount = 50; break;
        default: removedCount = 40;
    }

    const initial = board.map(row => [...row]);
    let removed = 0;
    while (removed < removedCount) {
        const row = Math.floor(Math.random() * 9);
        const col = Math.floor(Math.random() * 9);
        if (initial[row][col] !== EMPTY) {
            initial[row][col] = EMPTY;
            removed++;
        }
    }

    return { initial, solution };
}

function fillBox(board: number[][], rowStart: number, colStart: number) {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            let num;
            do {
                num = numbers[Math.floor(Math.random() * numbers.length)];
            } while (!isBoxValid(board, rowStart, colStart, num));
            board[rowStart + i][colStart + j] = num;
        }
    }
}

function isBoxValid(board: number[][], rowStart: number, colStart: number, num: number): boolean {
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[rowStart + i][colStart + j] === num) return false;
        }
    }
    return true;
}

const SudokuGame: React.FC = () => {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';
    const [initialBoard, setInitialBoard] = useState<number[][]>([]);
    const [currentBoard, setCurrentBoard] = useState<number[][]>([]);
    const [solution, setSolution] = useState<number[][]>([]);
    const [pencilMarks, setPencilMarks] = useState<number[][][]>(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[])));
    const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
    const [pencilMode, setPencilMode] = useState(false);
    const [mistakes, setMistakes] = useState(0);
    const [gameWon, setGameWon] = useState(false);
    const [conflictCell, setConflictCell] = useState<[number, number] | null>(null);

    // Generate new game on mount
    useEffect(() => {
        startNewGame();
    }, []);

    const startNewGame = () => {
        const { initial, solution } = generateSudoku('medium');
        setInitialBoard(initial.map(row => [...row]));
        setCurrentBoard(initial.map(row => [...row]));
        setSolution(solution);
        setPencilMarks(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[])));
        setSelectedCell(null);
        setMistakes(0);
        setGameWon(false);
    };

    const handleCellClick = useCallback((row: number, col: number) => {
        if (gameWon) return;
        setSelectedCell([row, col]);
    }, [gameWon]);

    // Check if placing num at (row, col) conflicts with existing numbers
    const checkConflict = useCallback((board: number[][], row: number, col: number, num: number): boolean => {
        // Check row
        for (let c = 0; c < 9; c++) {
            if (c !== col && board[row][c] === num) return true;
        }
        // Check column
        for (let r = 0; r < 9; r++) {
            if (r !== row && board[r][col] === num) return true;
        }
        // Check 3x3 box
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let r = startRow; r < startRow + 3; r++) {
            for (let c = startCol; c < startCol + 3; c++) {
                if ((r !== row || c !== col) && board[r][c] === num) return true;
            }
        }
        return false;
    }, []);

    const handleNumberInput = useCallback((num: number) => {
        if (gameWon) return;

        // Auto-select first empty cell if none selected
        if (!selectedCell) {
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (initialBoard[r]?.[c] === EMPTY) {
                        setSelectedCell([r, c]);
                        break;
                    }
                }
                if (selectedCell) break;
            }
            if (!selectedCell) return; // No empty cells
        }

        const [row, col] = selectedCell;

        // Can't edit fixed cells
        if (initialBoard[row][col] !== EMPTY) return;

        if (pencilMode) {
            // Toggle pencil mark
            setPencilMarks(prev => {
                const newMarks = prev.map(r => r.map(c => [...c]));
                const marks = newMarks[row][col];
                const index = marks.indexOf(num);
                if (index === -1) {
                    marks.push(num);
                    marks.sort();
                } else {
                    marks.splice(index, 1);
                }
                return newMarks;
            });
        } else {
            const newBoard = currentBoard.map(row => [...row]);
            newBoard[row][col] = num;

            // Check for Sudoku rule conflicts (with revealed/fixed numbers)
            if (checkConflict(newBoard, row, col, num)) {
                setConflictCell([row, col]);
                setTimeout(() => setConflictCell(null), 1500);
                setMistakes(prev => prev + 1);
            } else {
                setConflictCell(null);
                setCurrentBoard(newBoard);

                if (num !== solution[row][col]) {
                    setMistakes(prev => prev + 1);
                } else {
                    // Clear pencil marks in related rows/cols/box
                    setPencilMarks(prev => {
                        const newMarks = prev.map(r => r.map(c => [...c]));
                        newMarks[row][col] = [];
                        for (let i = 0; i < 9; i++) {
                            newMarks[row][i] = newMarks[row][i].filter(n => n !== num);
                            newMarks[i][col] = newMarks[i][col].filter(n => n !== num);
                        }
                        const startRow = Math.floor(row / 3) * 3;
                        const startCol = Math.floor(col / 3) * 3;
                        for (let i = 0; i < 3; i++) {
                            for (let j = 0; j < 3; j++) {
                                newMarks[startRow + i][startCol + j] = newMarks[startRow + i][startCol + j].filter(n => n !== num);
                            }
                        }
                        return newMarks;
                    });

                    checkWin(newBoard);
                }
            }
        }
    }, [selectedCell, pencilMode, initialBoard, solution, currentBoard, gameWon, checkConflict]);

    const handleDelete = useCallback(() => {
        if (!selectedCell || gameWon) return;
        const [row, col] = selectedCell;

        if (initialBoard[row][col] !== EMPTY) return;

        setCurrentBoard(prev => {
            const newBoard = prev.map(r => [...r]);
            newBoard[row][col] = EMPTY;
            return newBoard;
        });
    }, [selectedCell, initialBoard, gameWon]);

    const checkWin = useCallback((board: number[][]) => {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === EMPTY || board[row][col] !== solution[row][col]) {
                    return;
                }
            }
        }
        setGameWon(true);
    }, [solution]);

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameWon) return;

            // Numbers
            if (e.key >= '1' && e.key <= '9') {
                handleNumberInput(parseInt(e.key));
                return;
            }

            // Navigation
            if (!selectedCell) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    setSelectedCell([0, 0]);
                }
                return;
            }

            const [row, col] = selectedCell;
            let newRow = row;
            let newCol = col;

            if (e.key === 'ArrowUp') newRow = Math.max(0, row - 1);
            else if (e.key === 'ArrowDown') newRow = Math.min(8, row + 1);
            else if (e.key === 'ArrowLeft') newCol = Math.max(0, col - 1);
            else if (e.key === 'ArrowRight') newCol = Math.min(8, col + 1);
            else if (e.key === 'Backspace' || e.key === 'Delete') {
                handleDelete();
                return;
            } else if (e.key === 'p' || e.key === 'P') {
                setPencilMode(prev => !prev);
                return;
            }

            if (newRow !== row || newCol !== col) {
                setSelectedCell([newRow, newCol]);
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedCell, gameWon, handleNumberInput, handleDelete]);

    const getHighlightedCells = useCallback(() => {
        if (!selectedCell) return new Set<string>();
        const [row, col] = selectedCell;
        const highlighted = new Set<string>();

        // Highlight row, column, and box
        for (let i = 0; i < 9; i++) {
            highlighted.add(`${row},${i}`);
            highlighted.add(`${i},${col}`);
        }
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                highlighted.add(`${startRow + i},${startCol + j}`);
            }
        }

        // Highlight same numbers
        const num = currentBoard[row][col];
        if (num !== EMPTY) {
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (currentBoard[r][c] === num) {
                        highlighted.add(`${r},${c}`);
                    }
                }
            }
        }

        return highlighted;
    }, [selectedCell, currentBoard]);

    const renderPencilMarks = (row: number, col: number) => {
        const marks = pencilMarks[row][col];
        if (marks.length === 0) return null;
        return (
            <div className={styles.pencilMarks}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <span key={n} className={styles.pencilMark}>{marks.includes(n) ? n : ''}</span>
                ))}
            </div>
        );
    };

    return (
        <div className={styles.gameContainer}>
            <h2 style={{ textAlign: 'center', color: isDark ? '#e0e0e0' : '#333' }}>Sudoku</h2>

            {/* Intro Section */}
            <div style={{
                textAlign: 'center',
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                borderRadius: 'var(--ifm-button-border-radius)',
                maxWidth: '600px',
                margin: '0 auto 1.5rem'
            }}>
                <h3 style={{ margin: '0 0 0.75rem', color: isDark ? '#e0e0e0' : '#333' }}>How to Play</h3>
                <p style={{
                    margin: '0.25rem 0',
                    fontSize: '0.95rem',
                    color: isDark ? '#ccc' : '#666'
                }}>
                    Fill the grid so that every row, column, and 3x3 box contains the digits 1-9.
                </p>
                <div style={{
                    marginTop: '0.75rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '1rem',
                    fontSize: '0.85rem',
                    color: isDark ? '#aaa' : '#666'
                }}>
                    <span><strong>Arrow keys</strong> - Navigate</span>
                    <span><strong>1-9</strong> - Enter number</span>
                    <span><strong>P</strong> - Toggle pencil mode</span>
                    <span><strong>Backspace</strong> - Clear cell</span>
                </div>
            </div>

            {gameWon && (
                <div style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(46, 133, 85, 0.2)',
                    color: isDark ? '#d4edda' : '#155724',
                    borderRadius: 'var(--ifm-button-border-radius)',
                    textAlign: 'center',
                    marginBottom: '1rem'
                }}>
                    <h3>Congratulations! You solved it!</h3>
                    <p>Mistakes: {mistakes}</p>
                </div>
            )}

            <div className={styles.board}>
                {currentBoard.map((row, rowIndex) => (
                    row.map((cell, colIndex) => {
                        const isSelected = selectedCell?.[0] === rowIndex && selectedCell?.[1] === colIndex;
                        const isFixed = initialBoard[rowIndex][colIndex] !== EMPTY;
                        const highlightedCells = getHighlightedCells();
                        const isHighlighted = highlightedCells.has(`${rowIndex},${colIndex}`);
                        const selectedNum = selectedCell ? currentBoard[selectedCell[0]][selectedCell[1]] : EMPTY;
                        const sameNumber = selectedCell && cell !== EMPTY && cell === selectedNum && !isSelected;
                        const isConflicting = conflictCell?.[0] === rowIndex && conflictCell?.[1] === colIndex;

                        return (
                            <div
                                key={`${rowIndex}-${colIndex}`}
                                className={clsx(
                                    styles.cell,
                                    isSelected && styles.selected,
                                    isHighlighted && !isSelected && styles.highlighted,
                                    sameNumber && styles.sameNumber,
                                    isFixed && styles.fixed,
                                    cell !== EMPTY && !isFixed && styles.userEntered,
                                    isConflicting && styles.conflicting,
                                )}
                                onClick={() => handleCellClick(rowIndex, colIndex)}
                            >
                                {cell !== EMPTY ? (
                                    <span>{cell}</span>
                                ) : (
                                    renderPencilMarks(rowIndex, colIndex)
                                )}
                            </div>
                        );
                    })
                ))}
            </div>

            <div className={styles.controls}>
                <button
                    className={clsx(styles.controlBtn, pencilMode && styles.active)}
                    onClick={() => setPencilMode(!pencilMode)}
                >
                    {pencilMode ? 'Pencil: ON' : 'Pencil: OFF'}
                </button>
                <button className={styles.controlBtn} onClick={startNewGame}>
                    New Game
                </button>
            </div>

            <div className={styles.numpad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                        key={num}
                        className={styles.numpadBtn}
                        onClick={() => handleNumberInput(num)}
                    >
                        {num}
                    </button>
                ))}
                <button
                    className={styles.numpadBtn}
                    onClick={handleDelete}
                >
                    Backspace
                </button>
            </div>

            <div style={{
                textAlign: 'center',
                marginTop: '1rem',
                color: isDark ? '#aaa' : '#666',
                fontSize: '0.9rem'
            }}>
                Mistakes: {mistakes} | Use arrow keys to navigate, numbers to fill, 'P' for pencil mode
            </div>
        </div>
    );
};

export default SudokuGame;
