import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { posts } from "../posts";
import PostNav from "./post-nav";

export const dynamicParams = false;

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = posts.find((entry) => entry.slug === slug);

  if (!post) {
    notFound();
  }

  const sortedPosts = posts
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aTime = Date.parse(a.entry.date);
      const bTime = Date.parse(b.entry.date);
      if (aTime !== bTime) return bTime - aTime;
      return b.index - a.index;
    })
    .map(({ entry }) => entry);

  const currentIndex = sortedPosts.findIndex((entry) => entry.slug === slug);
  const previousPost =
    currentIndex > 0 ? sortedPosts[currentIndex - 1] : null;
  const nextPost =
    currentIndex < sortedPosts.length - 1
      ? sortedPosts[currentIndex + 1]
      : null;

  return (
    <PostLayout
      post={post}
      previousPost={previousPost}
      nextPost={nextPost}
    />
  );
}

type PostLayoutProps = {
  post: typeof posts[number];
  previousPost: typeof posts[number] | null;
  nextPost: typeof posts[number] | null;
};

function PostLayout({ post, previousPost, nextPost }: PostLayoutProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/blog">
          back to blog
        </Link>
        <p className={styles.meta}>
          <span>story</span>
          <span>{post.author}</span>
          <span>{post.date}</span>
          {post.prdSlug ? (
            <Link className={styles.prdLink} href={`/prds/${post.prdSlug}`}>
              PRD
            </Link>
          ) : null}
        </p>
        <h1>{post.title}</h1>
      </header>

      <section className={styles.body}>
        {post.prdSlug && post.prdTitle ? (
          <Link className={styles.relatedPrd} href={`/prds/${post.prdSlug}`}>
            <span className={styles.relatedPrdLabel}>Related PRD</span>
            <span className={styles.relatedPrdTitle}>{post.prdTitle}</span>
          </Link>
        ) : null}
        <h2>What shipped</h2>
        <p>{post.whatShipped}</p>

        <h3>Files touched</h3>
        <ul>
          {post.files.map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>

        <h3>Learnings</h3>
        <ul>
          {post.learnings.map((learning) => (
            <li key={learning}>{learning}</li>
          ))}
        </ul>

        <PostNav previousPost={previousPost} nextPost={nextPost} />
      </section>
    </div>
  );
}
