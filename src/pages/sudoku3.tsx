import React from 'react';
import Layout from '@theme/Layout';
import SudokuGameV3 from '@site/src/components/SudokuGameV3/SudokuGameV3';

export default function Sudoku3Page(): React.ReactNode {
    return (
        <Layout title="Sudoku 3" description="Play Sudoku with difficulty levels, timer, and pencil mode">
            <main style={{ padding: '2rem', minHeight: 'calc(100vh - var(--ifm-navbar-height))' }}>
                <SudokuGameV3 />
            </main>
        </Layout>
    );
}
