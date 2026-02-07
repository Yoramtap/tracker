"use client";

import { useNightVision } from "./night-vision-trigger";
import styles from "./night-vision-toggle.module.css";

export default function NightVisionToggle() {
  const { mode, setMode } = useNightVision();
  const isNight = mode === "on";

  return (
    <button
      type="button"
      className={styles.toggle}
      data-mode={mode}
      aria-label={isNight ? "Switch to light mode" : "Switch to night mode"}
      onClick={() => setMode(isNight ? "off" : "on")}
    >
      <span className={styles.iconSun} aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2.5M12 19v2.5M4.7 4.7l1.8 1.8M17.5 17.5l1.8 1.8M2.5 12h2.5M19 12h2.5M4.7 19.3l1.8-1.8M17.5 6.5l1.8-1.8" />
        </svg>
      </span>
      <span className={styles.iconMoon} aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M21 15.5a8.5 8.5 0 0 1-10.9-10 8.7 8.7 0 1 0 10.9 10z" />
        </svg>
      </span>
    </button>
  );
}
