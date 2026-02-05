import { Suspense } from "react";
import styles from "./page.module.css";
import { getReplayEvents } from "./data";
import { ReplayTimeline } from "./replay-timeline";

export default function ReplayPage() {
  const replayEvents = getReplayEvents();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>replay</p>
        <h1>Build Replay Timeline</h1>
        <p className={styles.subtitle}>
          Follow each build arc from PRD kickoff to shipped stories in one
          chronological view.
        </p>
      </header>

      <section
        className={styles.timeline}
        aria-label="Replay timeline events"
        aria-live="polite"
      >
        <Suspense fallback={<p className={styles.timelineMeta}>Loading replay timeline...</p>}>
          <ReplayTimeline replayEvents={replayEvents} />
        </Suspense>
      </section>
    </div>
  );
}
