import React from 'react';
import Layout from '@theme/Layout';
import SudokuGameV2 from '@site/src/components/SudokuGameV2/SudokuGameV2';

export default function Sudoku2Page(): React.ReactNode {
    return (
        <Layout title="Sudoku 2" description="Play Sudoku with pencil mode and dual theme support">
            <main style={{ padding: '2rem', minHeight: 'calc(100vh - var(--ifm-navbar-height))' }}>
                <SudokuGameV2 />
            </main>
        </Layout>
    );
}
