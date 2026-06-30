import React from 'react';
import Layout from '@theme/Layout';
import SudokuGame from '@site/src/components/SudokuGame/SudokuGame';

export default function SudokuPage(): React.ReactNode {
    return (
        <Layout title="Sudoku" description="Play Sudoku with pencil mode support">
            <main style={{ padding: '2rem', minHeight: 'calc(100vh - var(--ifm-navbar-height))' }}>
                <SudokuGame />
            </main>
        </Layout>
    );
}
