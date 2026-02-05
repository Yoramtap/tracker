"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  createInitialState,
  queueDirection,
  stepGame,
  togglePause,
  type Direction,
  type GameConfig,
} from "./game";

const config: GameConfig = { rows: 20, cols: 20 };
const TICK_MS = 140;

const keyToDirection: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

export default function SnakePage() {
  const [state, setState] = useState(() => createInitialState(config));

  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setInterval(() => {
      setState((prev) => stepGame(prev));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.status]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const direction = keyToDirection[event.key];
      if (direction) {
        event.preventDefault();
        setState((prev) => queueDirection(prev, direction));
        return;
      }
      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        setState((prev) => togglePause(prev));
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setState(createInitialState(config));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const snakeSet = useMemo(
    () => new Set(state.snake.map((segment) => `${segment.x},${segment.y}`)),
    [state.snake]
  );
  const foodKey = state.food ? `${state.food.x},${state.food.y}` : null;

  const cells = useMemo(() => {
    const items: Array<{ key: string; className: string }> = [];
    for (let y = 0; y < state.config.rows; y += 1) {
      for (let x = 0; x < state.config.cols; x += 1) {
        const cellKey = `${x},${y}`;
        let className = styles.cell;
        if (snakeSet.has(cellKey)) className = `${styles.cell} ${styles.snake}`;
        if (foodKey === cellKey) className = `${styles.cell} ${styles.food}`;
        items.push({ key: cellKey, className });
      }
    }
    return items;
  }, [foodKey, snakeSet, state.config.cols, state.config.rows]);

  const statusLabel =
    state.status === "gameover"
      ? "Game over"
      : state.status === "won"
        ? "You filled the grid"
        : state.status === "paused"
          ? "Paused"
          : "";

  const handleDirection = (direction: Direction) => {
    setState((prev) => queueDirection(prev, direction));
  };

  const handleRestart = () => {
    setState(createInitialState(config));
  };

  const handlePause = () => {
    setState((prev) => togglePause(prev));
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>classic snake</p>
          <h1>Snake</h1>
          <p className={styles.subtitle}>
            Use arrow keys or WASD. Space toggles pause. Press R to restart.
          </p>
        </div>
        <div className={styles.scoreCard}>
          <span className={styles.scoreLabel}>Score</span>
          <span className={styles.scoreValue}>{state.score}</span>
        </div>
      </header>

      <section className={styles.boardSection}>
        <div
          className={styles.board}
          style={{ gridTemplateColumns: `repeat(${state.config.cols}, 1fr)` }}
          role="grid"
          aria-label="Snake board"
        >
          {cells.map((cell) => (
            <div key={cell.key} className={cell.className} role="gridcell" />
          ))}
        </div>
        <div className={styles.statusRow} aria-live="polite">
          {statusLabel ? <span>{statusLabel}</span> : <span>&nbsp;</span>}
          <div className={styles.actions}>
            <button className={styles.secondaryButton} onClick={handlePause}>
              {state.status === "paused" ? "Resume" : "Pause"}
            </button>
            <button className={styles.primaryButton} onClick={handleRestart}>
              Restart
            </button>
          </div>
        </div>
      </section>

      <section className={styles.controlsSection} aria-label="Touch controls">
        <div className={styles.controlRow}>
          <button
            className={styles.controlButton}
            onClick={() => handleDirection("up")}
            aria-label="Move up"
          >
            Up
          </button>
        </div>
        <div className={styles.controlRow}>
          <button
            className={styles.controlButton}
            onClick={() => handleDirection("left")}
            aria-label="Move left"
          >
            Left
          </button>
          <button
            className={styles.controlButton}
            onClick={() => handleDirection("down")}
            aria-label="Move down"
          >
            Down
          </button>
          <button
            className={styles.controlButton}
            onClick={() => handleDirection("right")}
            aria-label="Move right"
          >
            Right
          </button>
        </div>
      </section>
    </div>
  );
}
