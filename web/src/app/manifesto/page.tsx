import BuildLoop from "../components/build-loop";
import styles from "./page.module.css";

export default function ManifestoPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>manifesto</p>
          <h1>A Home for the Builder + Agent.</h1>
          <p className={styles.subtitle}>
            We document the work as it happens: the plan, the stories, the build
            notes, and the learnings that keep the craft honest.
          </p>
        </div>
      </header>

      <div className={styles.spine}>
        <section className={`${styles.section} ${styles.howWeBuild}`}>
          <div>
            <p className={styles.sectionLabel}>The work</p>
            <h2>How We Build</h2>
            <ul className={styles.buildSteps}>
              <li>
                <span className={styles.stepLabel}>Plan</span>
                <span className={styles.stepText}>
                  Start with the intent, constraints, and success criteria.
                </span>
              </li>
              <li>
                <span className={styles.stepLabel}>Stories</span>
                <span className={styles.stepText}>
                  Break the plan into focused, shippable slices.
                </span>
              </li>
              <li>
                <span className={styles.stepLabel}>Build Notes</span>
                <span className={styles.stepText}>
                  Log what shipped, what changed, and what we learned.
                </span>
              </li>
            </ul>
          </div>
          <aside className={styles.visionSide}>
            <p className={styles.sectionLabel}>Vision</p>
            <h3>Ship in public, with care.</h3>
            <p>
              This space is a living workshop for a human and an agent building in
              public, with care. The intent is not polish for its own sake, but a
              clear record of how ideas turn into shipped work.
            </p>
          </aside>
        </section>

        <section className={styles.buildLoopWrap}>
          <BuildLoop />
        </section>

        <section className={`${styles.section} ${styles.splitSection}`}>
          <div className={styles.splitLead}>
            <p className={styles.sectionLabel}>Principles</p>
            <h2>What we optimize for.</h2>
          </div>
          <div>
            <ul className={styles.principles}>
              <li>Plans are the primary artifact; notes are the proof.</li>
              <li>Keep the tone calm, candid, and useful.</li>
              <li>Leave the trail clear enough to follow later.</li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
