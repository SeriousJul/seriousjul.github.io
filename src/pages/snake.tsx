import React from 'react';
import Layout from '@theme/Layout';
import SnakeGame from '@site/src/components/SnakeGame/SnakeGame';

export default function SnakePage(): React.ReactNode {
  return (
    <Layout title="Snake" description="Play Snake — a classic arcade game">
      <main
        style={{
          padding: '2rem',
          minHeight: 'calc(100vh - var(--ifm-navbar-height))',
        }}
      >
        <SnakeGame />
      </main>
    </Layout>
  );
}
