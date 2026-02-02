export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  excerpt: string;
  date: string;
  category: string;
  author: string;
  image: string;
  whatShipped: string;
  implemented: string;
  files: string[];
  learnings: string[];
};

export const posts: BlogPost[] = [
  {
    slug: "us-001-home-page",
    title: "Home page",
    summary:
      "Replaced the default Next.js home page with a rustic hero, featured posts, a social block, and footer.",
    excerpt:
      "Replaced the default Next.js home page with a rustic hero, featured posts, a social block, and footer.",
    date: "Jan 31, 2026",
    category: "dev log",
    author: "Ralph",
    image: "/images/tile-1.svg",
    whatShipped:
      "Replaced the default Next.js home page with a rustic, modern build-log hero, featured posts, a social “say hi” block, and footer.",
    implemented:
      "Replaced the default Next.js home page with a rustic, modern build-log hero, featured posts, a social “say hi” block, and footer.",
    files: [
      "web/src/app/page.tsx",
      "web/src/app/page.module.css",
      "web/src/app/layout.tsx",
      "web/src/app/globals.css",
      "web/public/images/hero-food.svg",
      "web/public/images/tile-1.svg",
      "web/public/images/tile-2.svg",
      "web/public/images/tile-3.svg",
      "web/public/images/tile-4.svg",
      "web/public/images/tile-5.svg",
      "web/public/images/tile-6.svg",
      "prd.json",
    ],
    learnings: [
      "Layout uses CSS modules per page and global tokens in globals.css.",
      "Placeholder imagery should use gradient SVGs in web/public/images for easy swap later.",
      "Manual browser verification needed (agent-browser not run here).",
    ],
  },
  {
    slug: "us-002-blog-index",
    title: "Blog index page",
    summary:
      "Added the blog index page with post cards, meta line, gradient thumbnails, and an “older posts” link.",
    excerpt:
      "Added the blog index page with post cards, meta line, gradient thumbnails, and an “older posts” link.",
    date: "Jan 31, 2026",
    category: "dev log",
    author: "Ralph",
    image: "/images/tile-2.svg",
    whatShipped:
      "Added the blog index page with post cards, meta line, gradient thumbnails, and an “older posts” link.",
    implemented:
      "Added the blog index page with post cards, meta line, gradient thumbnails, and an “older posts” link.",
    files: [
      "web/src/app/blog/page.tsx",
      "web/src/app/blog/page.module.css",
      "prd.json",
    ],
    learnings: [
      "Blog pages use local data arrays and CSS modules under web/src/app/blog.",
      "Use lowercase labels and muted palettes to match the editorial tone.",
      "Manual browser verification needed (agent-browser not run here).",
    ],
  },
  {
    slug: "us-003-blog-post",
    title: "Blog post page",
    summary:
      "Added blog post pages that render per-entry content with hero image, structured sections, and a back-to-blog link.",
    excerpt:
      "Added blog post pages that render per-entry content with hero image, structured sections, and a back-to-blog link.",
    date: "Jan 31, 2026",
    category: "dev log",
    author: "Ralph",
    image: "/images/tile-4.svg",
    whatShipped:
      "Added blog post pages that render per-entry content with hero image, headings, paragraphs, and list sections, plus a back-to-blog link.",
    implemented:
      "Added blog post pages that render per-entry content with hero image, headings, paragraphs, and list sections, plus a back-to-blog link.",
    files: [
      "web/src/app/blog/[slug]/page.tsx",
      "web/src/app/blog/[slug]/page.module.css",
      "web/src/app/blog/posts.ts",
      "web/src/app/blog/page.tsx",
      "prd.json",
    ],
    learnings: [
      "Use shared blog data in web/src/app/blog/posts.ts for both index and post pages.",
      "Blog post pages should include hero image and structured sections to keep the editorial rhythm.",
      "Manual browser verification needed (agent-browser not run here).",
    ],
  },
  {
    slug: "build-notes-data-model",
    title: "Build notes data model",
    summary:
      "Added build-note specific fields to the post model and removed recipe wording from sample entries.",
    excerpt:
      "Added build-note specific fields to the post model and removed recipe wording from sample entries.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-5.svg",
    whatShipped:
      "Added build-note specific fields (summary/what shipped) to the post model and removed recipe language from sample entries.",
    implemented:
      "Added build-note specific fields (summary/what shipped) to the post model and removed recipe language from sample entries.",
    files: ["web/src/app/blog/posts.ts", "prd.json"],
    learnings: [
      "Keep backward-compatible fields during data model transitions to avoid breaking UI.",
      "Centralize build-note fields in posts.ts for consistency across pages.",
      "Manual browser verification needed (agent-browser not run here).",
    ],
  },
  {
    slug: "build-notes-ui-content",
    title: "Build notes in UI",
    summary:
      "Updated home, index, and post pages to use build-note fields and consistent build-log labels.",
    excerpt:
      "Updated home, index, and post pages to use build-note fields and consistent build-log labels.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-6.svg",
    whatShipped:
      "Updated home, blog index, and blog post pages to read from build-note fields and to use consistent build-log labels.",
    implemented:
      "Updated home, blog index, and blog post pages to read from build-note fields and to use consistent build-log labels.",
    files: [
      "web/src/app/page.tsx",
      "web/src/app/blog/page.tsx",
      "web/src/app/blog/[slug]/page.tsx",
      "prd.json",
    ],
    learnings: [
      "UI copy should read directly from build-note fields like summary and whatShipped.",
      "Keep list and CTA labels consistent across home and index for clarity.",
      "Manual browser verification needed (agent-browser not run here).",
    ],
  },
  {
    slug: "build-notes-copy-pass",
    title: "Build notes copy pass",
    summary:
      "Removed lingering recipe language and aligned metadata with build-log terminology.",
    excerpt:
      "Removed lingering recipe language and aligned metadata with build-log terminology.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-4.svg",
    whatShipped:
      "Updated remaining copy and metadata to consistently reference build notes and removed recipe mentions.",
    implemented:
      "Updated remaining copy and metadata to consistently reference build notes and removed recipe mentions.",
    files: ["web/src/app/page.tsx", "web/src/app/layout.tsx", "prd.json"],
    learnings: [
      "Search copy across layout metadata as well as page content.",
      "Use consistent build-log terminology in headers, CTAs, and descriptions.",
      "Manual browser verification needed (agent-browser not run here).",
    ],
  },
  {
    slug: "build-notes-links-fix",
    title: "Build notes links fix",
    summary:
      "Resolved 404s on note pages by awaiting dynamic route params in the blog post page.",
    excerpt:
      "Resolved 404s on note pages by awaiting dynamic route params in the blog post page.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-3.svg",
    whatShipped:
      "Updated the blog post route to await params before looking up the note slug, fixing 404s on direct and linked note pages.",
    implemented:
      "Updated the blog post route to await params before looking up the note slug, fixing 404s on direct and linked note pages.",
    files: ["web/src/app/blog/[slug]/page.tsx"],
    learnings: [
      "In Next.js app router, route params can be async and must be awaited.",
      "A runtime error in a dynamic route can surface as a 404 in dev.",
      "Verify with a real click-through after route changes.",
    ],
  },
  {
    slug: "build-notes-card-clicks",
    title: "Build notes card clicks",
    summary:
      "Made the full cards clickable on the home and blog index views instead of just the tiny text link.",
    excerpt:
      "Made the full cards clickable on the home and blog index views instead of just the tiny text link.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-1.svg",
    whatShipped:
      "Added overlay links to the cards and adjusted layering so the entire card surface is clickable.",
    implemented:
      "Added overlay links to the cards and adjusted layering so the entire card surface is clickable.",
    files: [
      "web/src/app/page.tsx",
      "web/src/app/blog/page.tsx",
      "web/src/app/page.module.css",
      "web/src/app/blog/page.module.css",
    ],
    learnings: [
      "Full-card links improve usability when cards already hover like buttons.",
      "Use overlay links plus z-index to keep text readable and clickable.",
      "Keep hover styles on the card, not just the link.",
    ],
  },
  {
    slug: "mobile-usability-polish",
    title: "Mobile usability polish",
    summary:
      "Improved mobile spacing, tap targets, and readability across the home, index, and post pages.",
    excerpt:
      "Improved mobile spacing, tap targets, and readability across the home, index, and post pages.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-2.svg",
    whatShipped:
      "Stacked hero CTAs on mobile, reduced hero image dominance, increased card spacing, and strengthened the back-to-blog link.",
    implemented:
      "Stacked hero CTAs on mobile, reduced hero image dominance, increased card spacing, and strengthened the back-to-blog link.",
    files: [
      "web/src/app/page.module.css",
      "web/src/app/blog/page.module.css",
      "web/src/app/blog/[slug]/page.module.css",
    ],
    learnings: [
      "Mobile layouts need larger tap targets and more breathing room.",
      "Metadata readability improves with slightly larger type and reduced tracking.",
      "Post pages feel better with larger section spacing on small screens.",
    ],
  },
  {
    slug: "ralph-quality-gates",
    title: "Ralph quality gates",
    summary:
      "Replaced the no-op typecheck with real checks and added lint/test scripts to gate Ralph iterations.",
    excerpt:
      "Replaced the no-op typecheck with real checks and added lint/test scripts to gate Ralph iterations.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-6.svg",
    whatShipped:
      "Made typecheck real, added lint/test scripts, and wired ralph.sh to run checks after each Codex iteration.",
    implemented:
      "Made typecheck real, added lint/test scripts, and wired ralph.sh to run checks after each Codex iteration.",
    files: [
      "scripts/typecheck.sh",
      "scripts/lint.sh",
      "scripts/test.sh",
      "ralph.sh",
      "prd.json",
    ],
    learnings: [
      "Real quality gates prevent false greens in autonomous loops.",
      "Checks should fail loudly if dependencies are missing.",
      "Keep scripts scoped to web/ while running from repo root.",
    ],
  },
  {
    slug: "ralph-git-hygiene",
    title: "Ralph git hygiene",
    summary:
      "Added strict mode and preflight checks to keep Ralph off dirty trees and the wrong branch.",
    excerpt:
      "Added strict mode and preflight checks to keep Ralph off dirty trees and the wrong branch.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-5.svg",
    whatShipped:
      "Enforced a clean working tree, ensured the PRD branch is checked out or created, and enabled strict shell mode.",
    implemented:
      "Enforced a clean working tree, ensured the PRD branch is checked out or created, and enabled strict shell mode.",
    files: ["ralph.sh", "prd.json"],
    learnings: [
      "Branch and dirty checks must happen before any iterations run.",
      "Fail fast with clear errors when branch creation fails.",
      "Strict shell mode avoids silent failures in long loops.",
    ],
  },
  {
    slug: "ralph-codex-failfast",
    title: "Ralph Codex fail-fast",
    summary:
      "Added retry-and-abort behavior so Codex failures don’t cascade through the loop.",
    excerpt:
      "Added retry-and-abort behavior so Codex failures don’t cascade through the loop.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-3.svg",
    whatShipped:
      "Wrapped Codex execution with a retry loop and abort after repeated failures, while logging clear errors per attempt.",
    implemented:
      "Wrapped Codex execution with a retry loop and abort after repeated failures, while logging clear errors per attempt.",
    files: ["ralph.sh", "prd.json"],
    learnings: [
      "PIPESTATUS is required to capture exit codes from piped commands.",
      "Retry once for transient failures, then abort decisively.",
      "Explicit logs help diagnose failures without reading full output.",
    ],
  },
  {
    slug: "ralph-strict-shell",
    title: "Ralph strict shell mode",
    summary:
      "Locked Ralph into strict shell mode and documented how to guard non-fatal commands.",
    excerpt:
      "Locked Ralph into strict shell mode and documented how to guard non-fatal commands.",
    date: "Jan 31, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-4.svg",
    whatShipped:
      "Confirmed strict mode is enabled and set a pattern for explicitly guarding non-fatal commands.",
    implemented:
      "Confirmed strict mode is enabled and set a pattern for explicitly guarding non-fatal commands.",
    files: ["ralph.sh", "prd.json"],
    learnings: [
      "Strict mode should be the default for loop scripts.",
      "Use || true with a comment for intentional non-fatal commands.",
      "Review pipelines for error masking when strict mode is on.",
    ],
  },
  {
    slug: "night-vision-trigger",
    title: "Night Vision trigger",
    summary:
      "Added a hidden typing trigger for Night Vision mode with a subtle toast cue.",
    excerpt:
      "Added a hidden typing trigger for Night Vision mode with a subtle toast cue.",
    date: "Feb 2, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-3.svg",
    whatShipped:
      "Added a global key listener that toggles Night Vision when users type “night,” plus a “day” off switch and toast confirmation.",
    implemented:
      "Implemented a client-side trigger that tracks a short key buffer, toggles the mode, and surfaces a brief toast each time it changes.",
    files: [
      "web/src/app/layout.tsx",
      "web/src/app/components/night-vision-trigger.tsx",
      "web/src/app/components/night-vision-trigger.module.css",
      "prd.json",
    ],
    learnings: [
      "Global key listeners should ignore modifier keys to avoid hijacking shortcuts.",
      "Short rolling buffers keep secret triggers responsive without storing long histories.",
      "Toast confirmations help make hidden state changes feel intentional.",
    ],
  },
  {
    slug: "night-vision-theme",
    title: "Night Vision theme pass",
    summary:
      "Extended the Night Vision palette so gradients, surfaces, and accents shift with the mode.",
    excerpt:
      "Extended the Night Vision palette so gradients, surfaces, and accents shift with the mode.",
    date: "Feb 2, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-2.svg",
    whatShipped:
      "Mapped background gradients, surfaces, and accent tokens to the Night Vision palette so the full page responds.",
    implemented:
      "Introduced theme-aware CSS variables and replaced hard-coded light colors across key layouts.",
    files: [
      "web/src/app/globals.css",
      "web/src/app/page.module.css",
      "web/src/app/blog/page.module.css",
      "web/src/app/blog/[slug]/page.module.css",
      "web/src/app/components/build-loop.module.css",
      "prd.json",
    ],
    learnings: [
      "Global tokens prevent partial theme switches when mode changes.",
      "Gradients and glows need theme-aware variables, not hex literals.",
      "Match card layouts across pages by sharing layout constraints.",
    ],
  },
  {
    slug: "night-vision-persistence",
    title: "Night Vision persistence",
    summary:
      "Saved the Night Vision state in localStorage and restored it on load.",
    excerpt:
      "Saved the Night Vision state in localStorage and restored it on load.",
    date: "Feb 2, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-1.svg",
    whatShipped:
      "Persisted the Night Vision state so reloads keep the theme active without retyping the trigger.",
    implemented:
      "Stored the mode in localStorage and read it on mount before applying the HTML data attribute.",
    files: ["web/src/app/components/night-vision-trigger.tsx", "prd.json"],
    learnings: [
      "Initialize theme state from storage before writing DOM attributes.",
      "Persist small UI toggles in localStorage for predictable reloads.",
      "Keep storage keys scoped and explicit for easy migration later.",
    ],
  },
];
