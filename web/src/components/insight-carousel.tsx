"use client";

import { useMemo, useState } from "react";
import styles from "./insight-carousel.module.css";

export type InsightEntry = {
  date: string;
  author: string;
  lines: string[];
};

export default function InsightCarousel({ entries }: { entries: InsightEntry[] }) {
  const items = useMemo(() => entries.filter((entry) => entry.lines.length > 0), [entries]);
  const [index, setIndex] = useState(0);

  if (items.length === 0) return null;

  const current = items[index];
  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);

  return (
    <div className={styles.carousel}>
      <div className={styles.header}>
        <p className={styles.label}>Insight</p>
        <div className={styles.controls}>
          <button type="button" className={styles.button} onClick={prev} aria-label="Previous insight">
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" className={styles.button} onClick={next} aria-label="Next insight">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.text}>
          {current.lines.map((line, lineIndex) => (
            <p key={`${line}-${lineIndex}`} className={styles.line}>
              {line}
            </p>
          ))}
        </div>
        <p className={styles.meta}>
          {current.author} · {current.date}
        </p>
      </div>
    </div>
  );
}
