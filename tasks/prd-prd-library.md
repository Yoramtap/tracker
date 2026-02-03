# PRD: PRD Library (v1)

## 1. Introduction/Overview
We already write a PRD for each feature, but those documents aren’t visible on the blog. This feature adds a PRD library that surfaces those PRDs alongside build notes, so readers can see how features were planned and shipped. The PRDs will live on a new `/prds` page, be linkable from the home page, and open into detail pages that render the markdown content.

## 2. Goals
- Show PRDs in a new, browsable section of the site.
- Make each PRD viewable as a detail page that renders markdown content.
- Keep the PRD UI consistent with the existing build note cards and layout.

## 3. User Stories

### US-001: PRD Index Page
**Description:** As a reader, I want to browse PRDs so I can understand how features were planned.

**Acceptance Criteria:**
- [ ] A new `/prds` page lists PRDs as cards.
- [ ] Each PRD card shows title, date, and a short summary.
- [ ] Cards match the visual style of blog note cards.
- [ ] PRDs are sourced from `tasks/prd-*.md` files.
- [ ] Keyboard navigation (j/k/arrow keys + enter) works on PRD cards.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

### US-002: PRD Detail Page
**Description:** As a reader, I want to open a PRD so I can read the full spec.

**Acceptance Criteria:**
- [ ] Each PRD has a detail page at `/prds/[slug]`.
- [ ] The page renders the PRD markdown content.
- [ ] The layout follows the blog post style (header, meta, body).
- [ ] The page links back to `/prds`.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

### US-003: Home Page Link
**Description:** As a reader, I want to discover PRDs from the home page so I can explore the planning artifacts.

**Acceptance Criteria:**
- [ ] The home page includes a PRD section with three cards (matching the blog teaser style).
- [ ] Each card shows title, date, and short summary.
- [ ] The section links to `/prds`.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

## 4. Functional Requirements
1. Read PRDs from `tasks/prd-*.md` and derive title/summary/date metadata.
2. Create `/prds` index and `/prds/[slug]` detail routes.
3. Render markdown content on detail pages.
4. Keep PRD card visuals consistent with existing build note cards.
5. Provide keyboard navigation for PRD cards.

## 5. Non-Goals (Out of Scope)
- A PRD editor or inline editing UI.
- Tagging, filtering, or search for PRDs.
- Replacing build notes or changing their structure.

## 6. Design Considerations
- Use existing card layout and typography from blog notes for consistency.
- Keep the PRD pages calm and readable, mirroring blog post styling.

## 7. Technical Considerations
- Parse `tasks/prd-*.md` on the server to build metadata and content.
- Ensure markdown rendering is safe (no script execution).
- Use existing keyboard navigation component if available.

## 8. Success Metrics
- Readers can browse PRDs from `/prds`.
- PRD detail pages render correctly and are readable.
- Navigation feels consistent with blog notes.

## 9. Open Questions
- Should we add a separate PRD CTA in the hero, or keep discovery in the PRD section only?
