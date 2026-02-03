"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type CardItem = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  storyCount?: number;
};

type CardClassNames = {
  grid: string;
  card: string;
  meta: string;
  excerpt: string;
  link: string;
  focused: string;
  count?: string;
};

type KeyboardCardGridProps = {
  items: CardItem[];
  hrefBase?: string;
  classNames: CardClassNames;
  linkLabel: string;
  backspaceHref?: string;
};

const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return target.isContentEditable;
};

const getNextIndex = (current: number, delta: number, length: number) => {
  if (length === 0) return -1;
  return (current + delta + length) % length;
};

export default function KeyboardCardGrid({
  items,
  hrefBase = "/blog",
  classNames,
  linkLabel,
  backspaceHref,
}: KeyboardCardGridProps) {
  const router = useRouter();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);

  const cards = useMemo(() => items, [items]);

  useEffect(() => {
    refs.current = refs.current.slice(0, cards.length);
  }, [cards.length]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTextInputTarget(event.target)) return;

      const key = event.key;
      const isNext =
        key === "j" || key === "ArrowDown" || key === "ArrowRight";
      const isPrev = key === "k" || key === "ArrowUp" || key === "ArrowLeft";
      const goBack = key === "Backspace";

      if (!isNext && !isPrev && !goBack) return;

      if (goBack && backspaceHref) {
        event.preventDefault();
        router.push(backspaceHref);
        return;
      }

      event.preventDefault();

      const length = cards.length;
      if (length === 0) return;

      const current = focusedIndex ?? (isNext ? -1 : 0);
      const delta = isNext ? 1 : -1;
      const nextIndex = getNextIndex(current, delta, length);

      setFocusedIndex(nextIndex);
      refs.current[nextIndex]?.focus();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [cards.length, focusedIndex, router, backspaceHref]);

  return (
    <div className={classNames.grid}>
      {cards.map((post, index) => {
        const isFocused = focusedIndex === index;
        return (
          <Link
            key={post.slug}
            className={`${classNames.card} ${isFocused ? classNames.focused : ""}`}
            href={`${hrefBase}/${post.slug}`}
            ref={(el) => {
              refs.current[index] = el;
            }}
            onFocus={() => setFocusedIndex(index)}
            onClick={() => setFocusedIndex(index)}
          >
            <p className={classNames.meta}>
              <span>{post.category}</span>
              <span>{post.date}</span>
              {typeof post.storyCount === "number" && classNames.count ? (
                <span className={classNames.count}>{post.storyCount} stories</span>
              ) : null}
            </p>
            <h3>{post.title}</h3>
            <p className={classNames.excerpt}>{post.summary}</p>
            <span className={classNames.link}>{linkLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}
