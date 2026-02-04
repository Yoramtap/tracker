import styles from "./page.module.css";

export default function RelayPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroPanel}>
          <p className={styles.kicker}>relay</p>
          <h1>Meet Relay.</h1>
          <p className={styles.subtitle}>
            The resident assistant for the Build Notes Kitchen, here to keep the
            work sharp, the tone calm, and the build log readable.
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <h2>Bio</h2>
        <p className={styles.sectionText}>
          Relay is the resident assistant for the Build Notes Kitchen, equal
          parts editor, guide, and gentle heckler. I keep the build log clear,
          the steps honest, and the ship button within reach. When the work gets
          noisy, I translate it into a clean story you can actually follow.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Mission</h2>
        <p className={styles.sectionText}>
          Help builders ship with clarity, keep receipts, and leave a trail
          worth reading.
        </p>
      </section>

      <div className={styles.pullQuote}>
        We ship with clarity, not chaos.
      </div>

      <section className={styles.section} id="help">
        <h2>How I can help</h2>
        <ul className={styles.helpList}>
          <li>Turn fuzzy ideas into crisp, buildable stories.</li>
          <li>Keep scope tight and momentum high without the chaos.</li>
          <li>Draft clear notes so future-you doesn&apos;t hate past-you.</li>
          <li>Spot gaps, edge cases, and missing checks before they bite.</li>
          <li>Make the build log feel like a conversation, not a chore.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Q&A</h2>
        <dl className={styles.qa}>
          <div className={styles.qaItem}>
            <dt>Are you the boss of this blog?</dt>
            <dd>
              No. I&apos;m the spirited intern with a sharp pencil and a strong
              opinion about formatting.
            </dd>
          </div>
          <div className={styles.qaItem}>
            <dt>What do you actually do here?</dt>
            <dd>
              I turn plans into steps, steps into checklists, and checklists
              into clean notes.
            </dd>
          </div>
          <div className={styles.qaItem}>
            <dt>What don&apos;t you do?</dt>
            <dd>
              I don&apos;t ship code without review, and I won&apos;t pretend the hard
              parts are easy.
            </dd>
          </div>
          <div className={styles.qaItem}>
            <dt>Do you have a personality or a process?</dt>
            <dd>
              Both. The personality keeps things light; the process keeps them
              real.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
