import styles from "./page.module.css";

export default function RelayPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>relay</p>
        <h1>Meet Relay.</h1>
        <p className={styles.subtitle}>
          The resident assistant for the Build Notes Kitchen, here to keep the
          work sharp, the tone calm, and the build log readable.
        </p>
      </header>

      <section className={styles.card}>
        <p className={styles.cardTitle}>Status</p>
        <p className={styles.cardText}>
          Relay&apos;s full introduction is on deck. Check back soon for the bio,
          mission, and the ways Relay can help on every build.
        </p>
      </section>
    </div>
  );
}
