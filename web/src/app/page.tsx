import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import { posts } from "./blog/posts";
import BuildLoop from "./components/build-loop";
import KeyboardCardGrid from "./components/keyboard-card-grid";
import { getPrdCards } from "./prds/data";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function Home() {
  const prds = getPrdCards().slice(0, 3);
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>the build notes kitchen</p>
            <h1>Ship, note, repeat.</h1>
            <p className={styles.tagline}>
              We document each feature end-to-end: PRD, stories, build, checks,
              notes, and the final ship.
            </p>
            <div className={styles.heroCtas}>
              <Link className={styles.primaryCta} href="/blog#prds">
                Explore the blog
              </Link>
            </div>
          </div>
          <div className={styles.heroImageWrap}>
            <Image
              src={`${basePath}/images/hero-day.png`}
              alt=""
              width={640}
              height={426}
              priority
              className={styles.heroImageDay}
            />
            <Image
              src={`${basePath}/images/hero-night.png`}
              alt=""
              width={640}
              height={426}
              priority
              className={styles.heroImageNight}
            />
          </div>
        </section>

        <BuildLoop />
        <section className={styles.featured} id="featured">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>build notes</p>
              <h2>Fresh from the build log</h2>
            </div>
            <Link className={styles.sectionLink} href="/blog">
              View all notes
            </Link>
          </div>
          <KeyboardCardGrid
            items={posts.slice(-3).reverse().map((post) => ({
              ...post,
              category: "story",
            }))}
            classNames={{
              grid: styles.cards,
              card: styles.card,
              meta: styles.cardMeta,
              excerpt: styles.cardExcerpt,
              link: styles.cardLink,
              focused: styles.cardFocused,
            }}
            linkLabel="Read the note"
          />
        </section>

        <section className={styles.featured} id="prds">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>prds</p>
              <h2>Specs we shipped</h2>
            </div>
            <Link className={styles.sectionLink} href="/prds">
              View all PRDs
            </Link>
          </div>
          <KeyboardCardGrid
            items={prds}
            hrefBase="/prds"
            classNames={{
              grid: styles.cards,
              card: styles.card,
              meta: styles.cardMeta,
              excerpt: styles.cardExcerpt,
              link: styles.cardLink,
              focused: styles.cardFocused,
              count: styles.cardCount,
            }}
            linkLabel="Read the PRD"
          />
        </section>

        {/* say-hi block intentionally hidden for now */}
      </main>
      <footer className={styles.footer}>
        <div>
          <p className={styles.footerTitle}>The Build Notes Kitchen</p>
        </div>
      </footer>
    </div>
  );
}
