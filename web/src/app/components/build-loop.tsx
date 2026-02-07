"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./build-loop.module.css";

const steps = [
  { title: "Plan", detail: "capture intent + split stories" },
  { title: "Build", detail: "code the change" },
  { title: "Verify", detail: "prove it" },
  { title: "Note", detail: "log the build" },
  { title: "Ship", detail: "share the work" },
];

export default function BuildLoop() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <section
      ref={sectionRef}
      className={`${styles.section} ${isVisible ? styles.visible : ""}`}
    >
      <div className={styles.header}>
        <p className={styles.kicker}>build loop</p>
        <h2>Plan. Build. Verify. Note. Ship.</h2>
      </div>
      <div className={styles.loop} aria-label="Build loop steps">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={styles.step}
            style={{
              animationDelay: `${index * 0.15}s`,
              ["--pulse-delay" as string]: `${index * 0.15 + 0.2}s`,
            }}
          >
            <div className={styles.icon} aria-hidden="true">
              <span />
            </div>
            <div>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
