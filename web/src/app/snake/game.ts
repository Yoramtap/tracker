export type Direction = "up" | "down" | "left" | "right";

export type Point = {
  x: number;
  y: number;
};

export type GameStatus = "playing" | "paused" | "gameover" | "won";

export type GameConfig = {
  rows: number;
  cols: number;
};

export type GameState = {
  config: GameConfig;
  snake: Point[];
  direction: Direction;
  queuedDirection: Direction | null;
  food: Point | null;
  score: number;
  status: GameStatus;
};

export type StepInput = {
  rng?: () => number;
};

const directionVectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const opposites: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export const createInitialState = (
  config: GameConfig,
  rng: () => number = Math.random
): GameState => {
  const centerX = Math.floor(config.cols / 2);
  const centerY = Math.floor(config.rows / 2);
  const snake: Point[] = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ];
  const food = placeFood(config, snake, rng);
  return {
    config,
    snake,
    direction: "right",
    queuedDirection: null,
    food,
    score: 0,
    status: "playing",
  };
};

export const queueDirection = (
  state: GameState,
  next: Direction
): GameState => {
  if (opposites[state.direction] === next) return state;
  return { ...state, queuedDirection: next };
};

export const togglePause = (state: GameState): GameState => {
  if (state.status === "gameover" || state.status === "won") return state;
  return {
    ...state,
    status: state.status === "paused" ? "playing" : "paused",
  };
};

export const stepGame = (state: GameState, input: StepInput = {}): GameState => {
  if (state.status !== "playing") return state;

  const nextDirection =
    state.queuedDirection && opposites[state.direction] !== state.queuedDirection
      ? state.queuedDirection
      : state.direction;

  const vector = directionVectors[nextDirection];
  const head = state.snake[0];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y };

  if (
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= state.config.cols ||
    nextHead.y >= state.config.rows
  ) {
    return { ...state, status: "gameover" };
  }

  const willGrow = state.food && pointsEqual(nextHead, state.food);
  const bodyToCheck = willGrow ? state.snake : state.snake.slice(0, -1);
  if (bodyToCheck.some((segment) => pointsEqual(segment, nextHead))) {
    return { ...state, status: "gameover" };
  }

  const nextSnake = [nextHead, ...state.snake];
  if (!willGrow) nextSnake.pop();

  let nextFood = state.food;
  let nextScore = state.score;
  let nextStatus: GameStatus = state.status;

  if (willGrow) {
    nextScore += 1;
    nextFood = placeFood(state.config, nextSnake, input.rng ?? Math.random);
    if (!nextFood) {
      nextStatus = "won";
    }
  }

  return {
    ...state,
    snake: nextSnake,
    direction: nextDirection,
    queuedDirection: null,
    food: nextFood,
    score: nextScore,
    status: nextStatus,
  };
};

export const placeFood = (
  config: GameConfig,
  snake: Point[],
  rng: () => number
): Point | null => {
  const emptyCells: Point[] = [];
  for (let y = 0; y < config.rows; y += 1) {
    for (let x = 0; x < config.cols; x += 1) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) return null;
  const index = Math.floor(rng() * emptyCells.length);
  return emptyCells[index];
};

const pointsEqual = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
