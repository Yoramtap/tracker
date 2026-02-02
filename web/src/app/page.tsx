import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import { posts } from "./blog/posts";
import BuildLoop from "./components/build-loop";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>the build notes kitchen</p>
            <h1>Ship, note, repeat.</h1>
            <p className={styles.tagline}>
              We&apos;re writing about the craft behind this space — the small decisions,
              the quiet iterations, and the gentle rhythm of building the blog in
              public.
            </p>
            <div className={styles.heroCtas}>
              <Link className={styles.primaryCta} href="/blog">
                Explore the blog
              </Link>
            </div>
            <div className={styles.heroMeta}>
              <span>new posts every build</span>
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
          <div className={styles.cards}>
            {posts.slice(-3).reverse().map((post) => (
              <Link key={post.title} className={styles.card} href={`/blog/${post.slug}`}>
                <p className={styles.cardMeta}>
                  <span>{post.category}</span>
                  <span>{post.date}</span>
                </p>
                <h3>{post.title}</h3>
                <p className={styles.cardExcerpt}>{post.summary}</p>
                <span className={styles.cardLink}>Read the note</span>
              </Link>
            ))}
          </div>
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
