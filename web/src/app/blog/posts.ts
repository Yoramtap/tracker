export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  excerpt: string;
  date: string;
  category: string;
  author: string;
  image: string;
  prdSlug?: string;
  prdTitle?: string;
  whatShipped: string;
  implemented: string;
  files: string[];
  learnings: string[];
};

export const posts: BlogPost[] = [
  {
    slug: "us-001-home-page",
    title: "Home page",
    prdSlug: "modern-food-blog",
    prdTitle: "Modern Food Blog",
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
    prdSlug: "modern-food-blog",
    prdTitle: "Modern Food Blog",
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
    prdSlug: "modern-food-blog",
    prdTitle: "Modern Food Blog",
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
    prdSlug: "build-notes-restructure",
    prdTitle: "Build Notes Restructure",
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
    prdSlug: "build-notes-restructure",
    prdTitle: "Build Notes Restructure",
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
    prdSlug: "build-notes-restructure",
    prdTitle: "Build Notes Restructure",
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
    prdSlug: "build-notes-restructure",
    prdTitle: "Build Notes Restructure",
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
    prdSlug: "build-notes-restructure",
    prdTitle: "Build Notes Restructure",
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
    prdSlug: "mobile-usability-polish",
    prdTitle: "Mobile Usability Polish",
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
    prdSlug: "ralph-loop-solid",
    prdTitle: "Ralph Loop Solidification",
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
    prdSlug: "ralph-loop-solid",
    prdTitle: "Ralph Loop Solidification",
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
    prdSlug: "ralph-loop-solid",
    prdTitle: "Ralph Loop Solidification",
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
    prdSlug: "ralph-loop-solid",
    prdTitle: "Ralph Loop Solidification",
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
    prdSlug: "night-vision-mode",
    prdTitle: "Night Vision Mode",
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
    prdSlug: "night-vision-mode",
    prdTitle: "Night Vision Mode",
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
    prdSlug: "night-vision-mode",
    prdTitle: "Night Vision Mode",
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
  {
    slug: "quiet-navigation-keyboard",
    title: "Quiet navigation: keyboard focus",
    prdSlug: "quiet-nav",
    prdTitle: "Quiet Navigation",
    summary:
      "Added keyboard navigation for build notes cards on the landing page and blog index.",
    excerpt:
      "Added keyboard navigation for build notes cards on the landing page and blog index.",
    date: "Feb 2, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-6.svg",
    whatShipped:
      "Implemented j/k and arrow key navigation with a subtle focus state across build-note card grids.",
    implemented:
      "Introduced a reusable card grid that tracks focused index, wraps at ends, and ignores keypresses in inputs.",
    files: [
      "web/src/app/components/keyboard-card-grid.tsx",
      "web/src/app/page.tsx",
      "web/src/app/blog/page.tsx",
      "web/src/app/page.module.css",
      "web/src/app/blog/page.module.css",
      "prd.json",
    ],
    learnings: [
      "Shared components keep keyboard behavior consistent across pages.",
      "Focus styles should be subtle but unmistakable in low-contrast themes.",
      "Card grids should own focus state so clicks and keys stay in sync.",
    ],
  },
  {
    slug: "quiet-navigation-post-links",
    title: "Quiet navigation: post links",
    prdSlug: "quiet-nav",
    prdTitle: "Quiet Navigation",
    summary:
      "Added previous/next links on post pages with matching keyboard navigation.",
    excerpt:
      "Added previous/next links on post pages with matching keyboard navigation.",
    date: "Feb 2, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-4.svg",
    whatShipped:
      "Implemented previous/next post links plus j/k, arrow, and backspace shortcuts on post pages.",
    implemented:
      "Sorted posts by date and wired a client-side navigator that routes smoothly without odd focus highlights.",
    files: [
      "web/src/app/blog/[slug]/page.tsx",
      "web/src/app/blog/[slug]/post-nav.tsx",
      "web/src/app/blog/[slug]/page.module.css",
      "web/src/app/components/keyboard-card-grid.tsx",
      "web/src/app/blog/page.tsx",
      "prd.json",
    ],
    learnings: [
      "Keyboard navigation should share the same key vocabulary across views.",
      "Client-side routing avoids the odd highlight flashes on fast navigation.",
      "Backspace is a natural “go back” action when inputs aren’t active.",
    ],
  },
  {
    slug: "prd-library-index",
    title: "PRD library: index page",
    prdSlug: "prd-library",
    prdTitle: "PRD Library",
    summary:
      "Added a /prds index that lists PRDs as cards with keyboard navigation.",
    excerpt:
      "Added a /prds index that lists PRDs as cards with keyboard navigation.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-2.svg",
    whatShipped:
      "Introduced a PRD index page that reads task PRDs, shows title/date/summary cards, and supports keyboard navigation.",
    implemented:
      "Parsed tasks/prd-*.md on the server to build card metadata and reused the existing card grid for navigation.",
    files: [
      "web/src/app/prds/page.tsx",
      "web/src/app/prds/page.module.css",
      "web/src/app/prds/data.ts",
      "prd.json",
    ],
    learnings: [
      "PRD metadata can be derived from markdown headings and intro sections.",
      "Reusing the card grid keeps navigation consistent across sections.",
      "Server-side parsing keeps PRD content in sync with tasks/.",
    ],
  },
  {
    slug: "prd-library-detail",
    title: "PRD library: detail pages",
    prdSlug: "prd-library",
    prdTitle: "PRD Library",
    summary:
      "Added PRD detail pages that render the markdown specs in a blog-style layout.",
    excerpt:
      "Added PRD detail pages that render the markdown specs in a blog-style layout.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-3.svg",
    whatShipped:
      "Introduced /prds/[slug] pages with markdown rendering, meta header, and back link to the PRD index.",
    implemented:
      "Loaded PRD markdown from tasks/, parsed headings/lists/code, and styled it to match the blog post cadence.",
    files: [
      "web/src/app/prds/[slug]/page.tsx",
      "web/src/app/prds/[slug]/page.module.css",
      "web/src/app/prds/markdown.tsx",
      "web/src/app/prds/data.ts",
      "prd.json",
    ],
    learnings: [
      "A minimal markdown parser is enough for internal PRDs.",
      "Keeping PRDs in tasks/ makes the library auto-updating.",
      "Reusing post styling preserves the editorial feel.",
    ],
  },
  {
    slug: "prd-library-home",
    title: "PRD library: home teaser",
    prdSlug: "prd-library",
    prdTitle: "PRD Library",
    summary:
      "Added a PRD teaser section on the home page with three recent specs.",
    excerpt:
      "Added a PRD teaser section on the home page with three recent specs.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-4.svg",
    whatShipped:
      "Introduced a PRD section on the landing page that links to /prds and mirrors the build-note card layout.",
    implemented:
      "Reused the keyboard card grid for PRDs and pulled the three latest PRDs into the home layout.",
    files: [
      "web/src/app/page.tsx",
      "web/src/app/prds/data.ts",
      "prd.json",
    ],
    learnings: [
      "Shared card components make new sections quick to add.",
      "Keeping PRD data server-side prevents content drift.",
      "Teaser sections work best when they mirror existing grid patterns.",
    ],
  },
  {
    slug: "prd-story-links-related",
    title: "PRD story links: related list",
    prdSlug: "prd-story-links",
    prdTitle: "PRD–Story Links",
    summary:
      "Linked PRDs to their build notes with a related stories section on PRD pages.",
    excerpt:
      "Linked PRDs to their build notes with a related stories section on PRD pages.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-5.svg",
    whatShipped:
      "Added a related stories block to PRD detail pages, populated from explicit PRD → story mappings.",
    implemented:
      "Extended blog post metadata with PRD slugs, then rendered related story links on PRD detail pages.",
    files: [
      "web/src/app/blog/posts.ts",
      "web/src/app/prds/data.ts",
      "web/src/app/prds/[slug]/page.tsx",
      "web/src/app/prds/[slug]/page.module.css",
      "prd.json",
    ],
    learnings: [
      "Manual PRD mappings prevent accidental cross-linking.",
      "Related lists are easiest to scan when titles and dates are aligned.",
      "PRD pages benefit from a clear path back to shipped stories.",
    ],
  },
  {
    slug: "prd-story-links-mapping",
    title: "PRD story links: full mapping",
    prdSlug: "prd-story-links",
    prdTitle: "PRD–Story Links",
    summary:
      "Mapped every existing build note to its originating PRD for complete linkage.",
    excerpt:
      "Mapped every existing build note to its originating PRD for complete linkage.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-6.svg",
    whatShipped:
      "Completed the manual PRD mapping so every build note now links back to its PRD.",
    implemented:
      "Applied PRD slugs across all existing build notes to guarantee accurate related-story lists.",
    files: ["web/src/app/blog/posts.ts", "prd.json"],
    learnings: [
      "Full PRD coverage makes the library more trustworthy.",
      "Explicit mappings prevent accidental grouping by similar titles.",
      "Keeping mappings near the stories makes review straightforward.",
    ],
  },
  {
    slug: "prd-story-links-counts",
    title: "PRD story links: story counts",
    prdSlug: "prd-story-links",
    prdTitle: "PRD–Story Links",
    summary:
      "Added a story count to each PRD card to show scope at a glance.",
    excerpt:
      "Added a story count to each PRD card to show scope at a glance.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-1.svg",
    whatShipped:
      "Displayed the number of related stories on each PRD card in the PRD index.",
    implemented:
      "Computed story counts from PRD mappings and surfaced them in the PRD card meta line.",
    files: [
      "web/src/app/prds/data.ts",
      "web/src/app/prds/page.tsx",
      "web/src/app/prds/page.module.css",
      "web/src/app/components/keyboard-card-grid.tsx",
      "prd.json",
    ],
    learnings: [
      "Small metadata cues help readers judge scope quickly.",
      "Counts are most readable when aligned to the right of the meta row.",
      "Shared card components make PRD enhancements easy to propagate.",
    ],
  },
  {
    slug: "prd-story-links-backlink",
    title: "PRD story links: backlink",
    prdSlug: "prd-story-links",
    prdTitle: "PRD–Story Links",
    summary:
      "Added a PRD backlink on build note pages to jump back to the spec.",
    excerpt:
      "Added a PRD backlink on build note pages to jump back to the spec.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-2.svg",
    whatShipped:
      "Surfaced a PRD link in the build note meta line to enable story → PRD navigation.",
    implemented:
      "Rendered a PRD link for mapped stories in the blog header metadata area.",
    files: [
      "web/src/app/blog/[slug]/page.tsx",
      "web/src/app/blog/[slug]/page.module.css",
      "prd.json",
    ],
    learnings: [
      "Meta-line links keep navigation discoverable without adding UI clutter.",
      "Backlinks close the loop between plan and execution.",
      "Reusing existing meta styling keeps the layout calm.",
    ],
  },
  {
    slug: "prd-first-blog-index",
    title: "PRD-first blog index",
    prdSlug: "prd-first-blog",
    prdTitle: "PRD-First Blog",
    summary:
      "Reordered the blog index to feature PRDs first, with notes following below.",
    excerpt:
      "Reordered the blog index to feature PRDs first, with notes following below.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-1.svg",
    whatShipped:
      "Added a PRD section above build notes on the blog index and routed the main CTA to the PRD section.",
    implemented:
      "Introduced PRD-first sections on /blog with shared card grids and updated the hero CTA to anchor the PRD section.",
    files: [
      "web/src/app/blog/page.tsx",
      "web/src/app/blog/page.module.css",
      "web/src/app/page.tsx",
      "prd.json",
    ],
    learnings: [
      "Section headers help orient readers when two grids share a page.",
      "Anchoring the CTA makes PRDs feel like the primary narrative.",
      "Reusing card grids keeps the layout consistent across sections.",
    ],
  },
  {
    slug: "prd-first-related-top",
    title: "PRD-first related stories",
    prdSlug: "prd-first-blog",
    prdTitle: "PRD-First Blog",
    summary:
      "Moved related stories to the top of PRD pages for immediate context.",
    excerpt:
      "Moved related stories to the top of PRD pages for immediate context.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-3.svg",
    whatShipped:
      "Repositioned related stories directly under the PRD header so readers see the shipped work first.",
    implemented:
      "Reordered the PRD detail layout and tightened spacing to keep the story list above the spec content.",
    files: [
      "web/src/app/prds/[slug]/page.tsx",
      "web/src/app/prds/[slug]/page.module.css",
      "prd.json",
    ],
    learnings: [
      "Story context is most useful when it appears before the longform spec.",
      "Small spacing tweaks keep the PRD header and story list cohesive.",
      "Reordering sections can improve scan-ability without new UI.",
    ],
  },
  {
    slug: "prd-first-build-note-card",
    title: "PRD-first build note card",
    prdSlug: "prd-first-blog",
    prdTitle: "PRD-First Blog",
    summary:
      "Added a related PRD card to build notes so readers can jump back to the plan.",
    excerpt:
      "Added a related PRD card to build notes so readers can jump back to the plan.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-4.svg",
    whatShipped:
      "Introduced a Related PRD card near the top of build notes to link back to the spec.",
    implemented:
      "Rendered a PRD card using the mapped PRD title and slug and styled it to match the blog’s calm UI.",
    files: [
      "web/src/app/blog/[slug]/page.tsx",
      "web/src/app/blog/[slug]/page.module.css",
      "web/src/app/blog/posts.ts",
      "prd.json",
    ],
    learnings: [
      "A single PRD card is clearer than a small meta tag when context matters.",
      "Explicit PRD titles keep the card readable without parsing markdown.",
      "Lightweight cards fit the blog rhythm without visual clutter.",
    ],
  },
  {
    slug: "manifesto-page",
    title: "Manifesto page foundation",
    prdSlug: "manifesto-page",
    prdTitle: "Manifesto Page",
    summary: "Added the manifesto page with vision, process, and principles.",
    excerpt: "Added the manifesto page with vision, process, and principles.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-1.svg",
    whatShipped:
      "Introduced the /manifesto page with builder + agent framing, a “How We Build” section, and guiding principles.",
    implemented:
      "Created the manifesto route and styles using existing typography patterns to keep the page calm and readable.",
    files: [
      "web/src/app/manifesto/page.tsx",
      "web/src/app/manifesto/page.module.css",
      "prd.json",
    ],
    learnings: [
      "Manifesto content reads best when it mirrors the blog’s existing layout rhythm.",
      "Short, focused sections make the narrative easier to scan.",
      "Keeping typography consistent preserves the workshop tone.",
    ],
  },
  {
    slug: "manifesto-build-loop",
    title: "Manifesto build loop placement",
    prdSlug: "manifesto-page",
    prdTitle: "Manifesto Page",
    summary: "Placed the build loop inside the manifesto narrative.",
    excerpt: "Placed the build loop inside the manifesto narrative.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-2.svg",
    whatShipped:
      "Embedded the build loop component between the process and principles sections.",
    implemented:
      "Inserted the existing BuildLoop component on the manifesto page and tuned spacing to match the page width.",
    files: [
      "web/src/app/manifesto/page.tsx",
      "web/src/app/manifesto/page.module.css",
      "web/src/app/components/build-loop.module.css",
      "prd.json",
    ],
    learnings: [
      "The build loop feels more intentional when it sits inside the narrative flow.",
      "Consistent section width keeps the page visually anchored.",
      "Minor spacing tweaks can fix layout drift without redesign.",
    ],
  },
  {
    slug: "manifesto-primary-nav",
    title: "Manifesto in primary navigation",
    prdSlug: "manifesto-page",
    prdTitle: "Manifesto Page",
    summary: "Added a global nav with a Manifesto link.",
    excerpt: "Added a global nav with a Manifesto link.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Ralph",
    image: "/images/tile-3.svg",
    whatShipped:
      "Added a site-wide primary navigation bar with a Manifesto link.",
    implemented:
      "Created a PrimaryNav component and mounted it in the root layout to expose Manifesto, PRDs, and Build notes.",
    files: [
      "web/src/app/components/primary-nav.tsx",
      "web/src/app/components/primary-nav.module.css",
      "web/src/app/layout.tsx",
      "prd.json",
    ],
    learnings: [
      "Global nav clarifies the site’s top-level paths without adding clutter.",
      "Keeping nav typography understated preserves the calm tone.",
      "Mounting nav in layout avoids per-page duplication.",
    ],
  },
  {
    slug: "relay-route",
    title: "Relay: new page route",
    prdSlug: "relay-introduction",
    prdTitle: "Relay Introduction",
    summary: "Added the /relay page route and wired it into the primary nav.",
    excerpt: "Added the /relay page route and wired it into the primary nav.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Relay",
    image: "/images/tile-1.svg",
    whatShipped:
      "Introduced a dedicated Relay page and added a nav link so readers can find it quickly.",
    implemented:
      "Created the /relay route with a starter layout and mounted a Relay link in the primary navigation.",
    files: [
      "web/src/app/relay/page.tsx",
      "web/src/app/relay/page.module.css",
      "web/src/app/components/primary-nav.tsx",
      "prd.json",
    ],
    learnings: [
      "New top-level pages should be added to primary nav for discoverability.",
      "Relay pages should keep the same layout width as other editorial pages.",
      "Static routes are pre-rendered, so build should be run after new pages.",
    ],
  },
  {
    slug: "relay-hero",
    title: "Relay: hero block",
    prdSlug: "relay-introduction",
    prdTitle: "Relay Introduction",
    summary: "Added a hero block with a clear Relay intro at the top of the page.",
    excerpt:
      "Added a hero block with a clear Relay intro at the top of the page.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Relay",
    image: "/images/tile-2.svg",
    whatShipped:
      "Placed a hero section on /relay with a kicker, title, and subtitle to introduce Relay at a glance.",
    implemented:
      "Refined the top layout of the Relay page and styled it to be the first visual anchor on the page.",
    files: [
      "web/src/app/relay/page.tsx",
      "web/src/app/relay/page.module.css",
      "prd.json",
    ],
    learnings: [
      "Relay sections read best when the hero spacing is generous but calm.",
      "Use existing layout widths to keep new pages consistent.",
      "Short subtitles scan better than long narrative blocks.",
    ],
  },
  {
    slug: "relay-bio-mission-help",
    title: "Relay: bio, mission, and help list",
    prdSlug: "relay-introduction",
    prdTitle: "Relay Introduction",
    summary:
      "Added a Relay bio, a concise mission, and a help list to clarify the role.",
    excerpt:
      "Added a Relay bio, a concise mission, and a help list to clarify the role.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Relay",
    image: "/images/tile-3.svg",
    whatShipped:
      "Added a short bio, a one-line mission, and a five-item help list so readers understand Relay’s role.",
    implemented:
      "Expanded the Relay page with clear sections that mirror the editorial tone and spacing of other pages.",
    files: [
      "web/src/app/relay/page.tsx",
      "web/src/app/relay/page.module.css",
      "prd.json",
    ],
    learnings: [
      "Mission statements should stay single-sentence for quick scanning.",
      "Help lists feel best when their text tone matches bio copy.",
      "Section blocks should reuse shared surface tokens for night mode.",
    ],
  },
  {
    slug: "relay-qa",
    title: "Relay: Q&A",
    prdSlug: "relay-introduction",
    prdTitle: "Relay Introduction",
    summary:
      "Added a short Q&A, including boundaries, to round out Relay’s voice.",
    excerpt:
      "Added a short Q&A, including boundaries, to round out Relay’s voice.",
    date: "Feb 3, 2026",
    category: "build notes",
    author: "Relay",
    image: "/images/tile-4.svg",
    whatShipped:
      "Added a four-question Q&A with a clear boundary statement to define Relay’s role.",
    implemented:
      "Introduced a Q&A section styled as calm cards that match the Relay page surfaces.",
    files: [
      "web/src/app/relay/page.tsx",
      "web/src/app/relay/page.module.css",
      "prd.json",
    ],
    learnings: [
      "Short Q&As keep personality without dominating the page.",
      "Boundary statements work best when they are direct and concise.",
      "Card styling should match the parent section background.",
    ],
  },
];
