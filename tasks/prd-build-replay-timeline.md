# PRD: Build Replay Timeline

## 1. Introduction/Overview

Add a new `/replay` page that visualizes how work ships over time. The page should reconstruct feature history from existing artifacts (PRDs, story posts, and optional git dates) and present a clear timeline from planning to shipping. This helps readers and maintainers understand not just what exists, but how it was built.

## 2. Goals

- Provide a single visual timeline for PRD-to-shipped-work history.
- Make it easy to trace each story back to its PRD.
- Improve discoverability of older work without forcing users to scan long lists.
- Keep implementation read-only and based on existing data sources.

## 3. User Stories

### US-001: Add timeline route shell
**Description:** As a reader, I want a dedicated replay page so that I can browse build history in one place.

**Acceptance Criteria:**
- [ ] Create `/replay` route with page header, intro copy, and timeline container
- [ ] Add Replay link to primary navigation
- [ ] Route builds in static export mode without runtime errors
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Build unified replay data model
**Description:** As a developer, I want a normalized replay event model so that timeline rendering is deterministic.

**Acceptance Criteria:**
- [ ] Create a server-side data utility that maps PRD + story metadata into replay events
- [ ] Event type includes at minimum: `prd_created`, `story_shipped`
- [ ] Events include stable id, title, date, related PRD slug, and href
- [ ] Events are sorted newest-first by parsed date with stable fallback ordering
- [ ] Typecheck passes

### US-003: Render grouped timeline cards
**Description:** As a reader, I want events grouped by date so that I can scan activity quickly.

**Acceptance Criteria:**
- [ ] Timeline renders date groups with one or more event cards per day
- [ ] Each card shows type label, title, and contextual link
- [ ] Story cards link to `/prds/story/[slug]`; PRD cards link to `/prds/[slug]`
- [ ] Empty-state message appears if no events exist
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Add replay filters
**Description:** As a reader, I want to filter replay events so that I can focus on PRD activity or shipped stories.

**Acceptance Criteria:**
- [ ] Add filter controls: `All`, `PRDs`, `Stories`
- [ ] Filter state updates the rendered list without full page reload
- [ ] Filter selection is reflected in URL query param for shareable state
- [ ] Invalid or missing filter param falls back to `All`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Add timeline detail panel
**Description:** As a reader, I want a focused detail panel for a selected event so that I can inspect context without leaving the page.

**Acceptance Criteria:**
- [ ] Clicking an event highlights it and opens a detail panel on desktop
- [ ] Detail panel includes title, date, type, summary/excerpt, and primary link
- [ ] On small screens, detail content appears inline under the selected card
- [ ] Keyboard focus moves predictably to selected content
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Add visual completion states
**Description:** As a maintainer, I want visual status cues so that readers can quickly distinguish planning work from shipped work.

**Acceptance Criteria:**
- [ ] Event cards include visual status treatment (for example: planned vs shipped)
- [ ] Status styles work in both default and night vision modes
- [ ] Labels and contrast meet accessible readability standards
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## 4. Functional Requirements

- FR-1: System must expose a replay data mapper that consumes existing PRD/story sources.
- FR-2: System must render replay events on `/replay` grouped by date.
- FR-3: System must support filter modes (`all`, `prds`, `stories`) via URL search params.
- FR-4: System must link each event to its canonical detail page.
- FR-5: System must render a selected-event detail view for richer context.
- FR-6: System must provide clear visual states for event type/status.
- FR-7: System must include replay in primary navigation.

## 5. Non-Goals (Out of Scope)

- No user authentication or personalized timelines.
- No event editing/authoring UI.
- No real-time streaming updates.
- No external analytics/reporting integration.
- No cross-repo aggregation.

## 6. Design Considerations

- Match existing editorial style and spacing tokens used across `/prds`, `/manifesto`, and `/relay`.
- Keep the timeline visually expressive but calm; avoid dashboard-style density.
- Reuse existing typography and night-vision token system.
- Preserve keyboard accessibility for filters and event selection.

## 7. Technical Considerations

- Prefer server-side data preparation to keep rendering simple.
- Reuse helpers from PRD/story data modules where practical, but avoid coupling UI to raw source formats.
- Date parsing must tolerate inconsistent historical formats in post data.
- Keep static-export compatibility (`next build` with `output: "export"`).

## 8. Success Metrics

- A user can move from replay overview to a specific PRD/story in 2 clicks or less.
- Replay page loads with no runtime console errors in local verification.
- At least 90% of existing story posts appear with correct PRD linkage in replay.
- Team can explain any shipped feature’s path (PRD → story) from one screen.

## 9. Open Questions

- Should PRD creation date always come from git history or file metadata fallback?
- Should we add more event types later (for example, “refactor”, “hotfix”, “rollback”)?
- Do we want default sort newest-first forever, or user-selectable order?
