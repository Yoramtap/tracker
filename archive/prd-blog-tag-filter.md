# PRD: Blog Tag Filter

## Introduction/Overview

Readers currently browse the blog sequentially or by scrolling, which makes it harder to discover relevant posts quickly. This feature adds lightweight topic tags and a tag filter on the blog index page so readers can find content by interest with minimal UI changes.

## Goals

- Allow readers to discover posts by topic without leaving the blog index page.
- Provide a simple, fast filter interaction with a clear selected state.
- Keep implementation minimal and UI-only (no new backend or external integrations).

## User Stories

### US-001: Display tag chips on blog index cards
**Description:** As a reader, I want to see each post’s topic tags on the blog index so I can scan for relevant content.

**Acceptance Criteria:**
- [ ] Each blog index card shows up to 3 tag chips for that post.
- [ ] Tag chips are visible without hovering.
- [ ] Tag list is pulled from existing post metadata or a static config.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using agent-browser skill.

### US-002: Add a tag filter bar on the blog index
**Description:** As a reader, I want to filter the blog index by a topic tag so I can quickly find posts I care about.

**Acceptance Criteria:**
- [ ] A tag filter bar appears above the blog index list.
- [ ] Selecting a tag filters the visible posts to those with that tag.
- [ ] A visible “All” option clears the filter.
- [ ] The currently selected tag is visually distinct.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using agent-browser skill.

### US-003: Empty state for filtered results
**Description:** As a reader, I want to see a helpful message when a tag filter returns no posts so I understand there are no matches.

**Acceptance Criteria:**
- [ ] When no posts match the selected tag, show an empty state message.
- [ ] Empty state includes a control to clear the filter.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using agent-browser skill.

## Functional Requirements

1. FR-1: The system must render topic tags on each blog index card.
2. FR-2: The system must provide a tag filter bar with an “All” option.
3. FR-3: Selecting a tag must filter the index list to posts containing that tag.
4. FR-4: The selected tag must be visually highlighted.
5. FR-5: When no posts match, the system must show an empty state with a clear-filter control.

## Non-Goals (Out of Scope)

- No search input or full-text search.
- No backend changes or database migrations.
- No tag management UI for authors.
- No changes to individual post content or layout beyond showing tags where appropriate.

## Design Considerations (Optional)

- Reuse any existing chip/badge styles used elsewhere in the site.
- Tag filter bar should be compact and horizontally scrollable on mobile.
- Limit displayed tags per post to keep cards tidy (e.g., 3 with an optional “+N”).

## Technical Considerations (Optional)

- Tags may be sourced from existing frontmatter/metadata; if absent, use a static mapping in code.
- Filtering can be client-side by tag matching in the in-memory list.
- If the blog index is statically generated, filtering can be done in the client UI without changing build output.

## Success Metrics

- Readers can filter to a topic in 2 clicks or fewer.
- Reduced time to find a relevant post (qualitative feedback).

## Open Questions

- Where should tag metadata live if it’s not already in post frontmatter?
- Should tags be displayed on individual post pages as well?
