import React from 'react';
import Layout from '@theme/Layout';
import SudokuGameV4 from '@site/src/components/SudokuGameV4/SudokuGameV4';

export default function Sudoku4Page(): React.ReactNode {
    return (
        <Layout title="Sudoku 4×4" description="Play a 4x4 Sudoku puzzle with pencil mode, keyboard navigation and dual theme support">
            <main style={{ padding: '2rem', minHeight: 'calc(100vh - var(--ifm-navbar-height))' }}>
                <SudokuGameV4 />
            </main>
        </Layout>
    );
}
