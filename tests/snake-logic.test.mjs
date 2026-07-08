/* Unit tests for Snake game pure logic functions.
 * No test runner required — run with: node tests/snake-logic.test.mjs
 */

const GRID_SIZE = 20;

// ── Helpers copied from SnakeGame.tsx (pure functions, no React deps) ──────

function randomFood(snake) {
  const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
  const free = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!occupied.has(`${x},${y}`)) {
        free.push({ x, y });
      }
    }
  }
  return free[Math.floor(Math.random() * free.length)];
}

function moveHead(head, direction) {
  const vectors = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };
  const v = vectors[direction];
  return { x: head.x + v.x, y: head.y + v.y };
}

function checkCollision(head, snake) {
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    return true;
  }
  for (let i = 0; i < snake.length - 1; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      return true;
    }
  }
  return false;
}

function tick(snake, food, direction) {
  const head = snake[0];
  const newHead = moveHead(head, direction);

  if (checkCollision(newHead, snake)) {
    return { newSnake: snake, newFood: food, ate: false };
  }

  const ate = newHead.x === food.x && newHead.y === food.y;
  const newSnake = [newHead, ...snake];
  if (!ate) {
    newSnake.pop();
  }
  const newFood = ate ? randomFood(newSnake) : food;

  return { newSnake, newFood, ate };
}

// ── Test runner ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function testGroup(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ── Tests ──────────────────────────────────────────────────────────────────

testGroup('moveHead', () => {
  const head = { x: 10, y: 10 };
  assert(moveHead(head, 'UP').y === 9, 'UP decreases y');
  assert(moveHead(head, 'DOWN').y === 11, 'DOWN increases y');
  assert(moveHead(head, 'LEFT').x === 9, 'LEFT decreases x');
  assert(moveHead(head, 'RIGHT').x === 11, 'RIGHT increases x');
  assert(moveHead(head, 'UP').x === 10, 'UP does not change x');
  assert(moveHead(head, 'DOWN').x === 10, 'DOWN does not change x');
});

testGroup('checkCollision — walls', () => {
  const snake = [{ x: 10, y: 10 }];
  assert(checkCollision({ x: -1, y: 10 }, snake), 'left wall collision');
  assert(checkCollision({ x: 20, y: 10 }, snake), 'right wall collision');
  assert(checkCollision({ x: 10, y: -1 }, snake), 'top wall collision');
  assert(checkCollision({ x: 10, y: 20 }, snake), 'bottom wall collision');
  assert(!checkCollision({ x: 0, y: 0 }, snake), 'corner (0,0) is valid');
  assert(!checkCollision({ x: 19, y: 19 }, snake), 'corner (19,19) is valid');
});

testGroup('checkCollision — self', () => {
  const snake = [
    { x: 5, y: 5 },
    { x: 5, y: 6 },
    { x: 5, y: 7 },
  ];
  assert(checkCollision({ x: 5, y: 6 }, snake), 'head into body segment');
  assert(!checkCollision({ x: 6, y: 5 }, snake), 'adjacent empty cell is safe');
  // Tail is skipped (index snake.length - 1), so moving into tail position is safe
  assert(
    !checkCollision({ x: 5, y: 7 }, snake),
    'head into tail position is safe (tail moves away)'
  );
});

testGroup('tick — normal movement', () => {
  const snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  const food = { x: 15, y: 10 };
  const result = tick(snake, food, 'RIGHT');

  assert(result.newSnake[0].x === 11, 'head moves right');
  assert(result.newSnake[0].y === 10, 'head y unchanged');
  assert(
    result.newSnake.length === snake.length,
    'snake length unchanged when not eating'
  );
  assert(!result.ate, 'did not eat');
});

testGroup('tick — eating food', () => {
  const snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
  ];
  const food = { x: 11, y: 10 };
  const result = tick(snake, food, 'RIGHT');

  assert(result.ate, 'ate food');
  assert(result.newSnake.length === snake.length + 1, 'snake grew by 1');
  assert(
    result.newFood.x !== food.x || result.newFood.y !== food.y,
    'food respawned'
  );
});

testGroup('tick — wall collision', () => {
  const snake = [{ x: 0, y: 0 }];
  const food = { x: 5, y: 5 };
  const result = tick(snake, food, 'LEFT');

  assert(!result.ate, 'did not eat on wall hit');
  assert(result.newSnake === snake, 'snake unchanged on collision');
});

testGroup('tick — self collision', () => {
  // U-shaped snake with 5 segments: head at (5,5), body spirals right→down→left→left
  // Moving DOWN from (5,5) hits non-tail body at (5,6)
  const snake = [
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 6, y: 6 },
    { x: 5, y: 6 },
    { x: 4, y: 6 },
  ];
  const food = { x: 10, y: 10 };
  const result = tick(snake, food, 'DOWN');

  assert(!result.ate, 'did not eat on self collision');
  assert(result.newSnake === snake, 'snake unchanged on self collision');
});

testGroup('randomFood — does not overlap snake', () => {
  const snake = [
    { x: 5, y: 5 },
    { x: 5, y: 6 },
    { x: 5, y: 7 },
  ];
  // Run multiple times to verify randomness doesn't produce overlap
  for (let i = 0; i < 100; i++) {
    const food = randomFood(snake);
    const occupied = snake.some(s => s.x === food.x && s.y === food.y);
    assert(!occupied, `food does not overlap snake (iteration ${i})`);
  }
});

testGroup('randomFood — returns valid coordinates', () => {
  const snake = [{ x: 10, y: 10 }];
  for (let i = 0; i < 50; i++) {
    const food = randomFood(snake);
    assert(food.x >= 0 && food.x < GRID_SIZE, 'food x in range');
    assert(food.y >= 0 && food.y < GRID_SIZE, 'food y in range');
  }
});

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log('All tests passed.');
