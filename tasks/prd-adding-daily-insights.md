# PRD: Adding daily insights

## Introduction/Overview
Consolidate PRDs and related stories into a single hub at `/prds`, remove the blog index as a primary destination, and add a daily insight quote to the homepage. The goal is a calmer navigation model and a clearer, story-first summary of shipped work.

## Goals
- Make `/prds` the primary hub for PRDs and related stories.
- Remove `/blog` as a primary destination while keeping story pages accessible under `/prds/story`.
- Add a lightweight daily insight quote to the homepage.
- Preserve the editorial visual language and maintain scanability.

## User Stories

### US-001: Consolidate PRDs and stories into one hub
**Description:** As a reader, I want PRDs and their related stories in one place so I can scan and understand shipped work quickly.

**Acceptance Criteria:**
- [x] `/prds` renders PRDs with nested related stories when expanded.
- [x] Stories link to `/prds/story/[slug]`.
- [x] Older PRDs are collapsed behind a “Show older PRDs” control.
- [x] PRDs with zero stories do not show empty placeholders.
- [x] Typecheck passes.

### US-002: Remove `/blog` as a destination
**Description:** As a reader, I want a single hub without a competing blog index.

**Acceptance Criteria:**
- [x] Primary nav removes the blog link.
- [x] `/blog` index and routes removed; story pages live under `/prds/story`.
- [x] Typecheck passes.

### US-003: Add daily insight quote to homepage
**Description:** As a reader, I want a short daily insight on the homepage to capture the tone of the session.

**Acceptance Criteria:**
- [x] Homepage renders a quote block labeled “Insight”.
- [x] Quote content is sourced from a markdown file.
- [x] Quote is presented in an editorial card with clear attribution.
- [x] Typecheck passes.

## Functional Requirements
1. `/prds` is the primary hub for PRDs and stories.
2. Story routes live at `/prds/story/[slug]`.
3. “Show older PRDs” control collapses older entries.
4. No empty story placeholders for zero-story PRDs.
5. Homepage insight reads from `data/daily-quote.md` and supports multiple entries.

## Non-Goals (Out of Scope)
- Reintroducing `/blog` as a nav destination.
- Migrating PRD markdown files or changing their content.
- Adding a CMS or database for insights.

## Design Considerations
- Maintain the editorial, calm typography and spacing.
- Use subtle affordances (pill controls, micro-meters) rather than heavy UI.
- Keep new elements consistent with existing palette and typography.

## Technical Considerations
- Insight parsing uses a markdown block format separated by `---`.
- `/prds` story links map to data in `web/src/app/prds/story/posts.ts`.
- PRD summaries use markdown parsing in `web/src/app/prds/data.ts`.

## Success Metrics
- Readers can find PRDs and related stories without navigating to a separate blog index.
- Homepage feels more personal with a daily insight, without added clutter.

## Open Questions
- Should we ever expose a public archive of older insights?
- Should PRD story counts map to a progression scale beyond a static meter?
