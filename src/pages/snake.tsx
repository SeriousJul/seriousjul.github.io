import type { ReactNode } from 'react';
import Layout from '@theme/Layout';
import SnakeGame from '@site/src/components/snake/SnakeGame';

export default function SnakePage(): ReactNode {
  return (
    <Layout title="Snake Game" description="Play the classic Snake game">
      <SnakeGame />
    </Layout>
  );
}
