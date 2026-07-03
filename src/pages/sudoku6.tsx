import React from 'react';
import Layout from '@theme/Layout';
import SudokuGame from '@site/src/components/SudokuGame6/SudokuGame';

export default function Sudoku6Page(): React.ReactNode {
    return (
        <Layout title="Sudoku 6" description="Play a new game of Sudoku with pencil mode, keyboard &amp; mouse support.">
            <main style={{ padding: '2rem', minHeight: 'calc(100vh - var(--ifm-navbar-height))' }}>
                <SudokuGame />
            </main>
        </Layout>
    );
}
