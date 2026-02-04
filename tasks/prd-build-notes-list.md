# PRD: Build Notes List View

## Introduction/Overview

Build notes currently appear as a grid of cards, which makes them look similar to PRDs. This change keeps PRDs as-is while switching build notes to a simple list view to create clearer visual distinction and improve scan-ability. Each list item should be clickable and open the build note.

## Goals

- Distinguish PRDs from build notes at a glance
- Improve scan-ability of build notes
- Preserve existing PRD presentation

## User Stories

### US-001: Render build notes as a list
**Description:** As a reader, I want build notes in a list so I can scan them quickly and distinguish them from PRDs.

**Acceptance Criteria:**
- [ ] Build notes section renders as a vertical list instead of a card grid
- [ ] PRD presentation remains unchanged
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Click list item to open build note
**Description:** As a reader, I want each build note list item to open the full build note.

**Acceptance Criteria:**
- [ ] Clicking a list item navigates to the build note page
- [ ] List item has a visible hover/active affordance (e.g., underline or background)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: List item content is title-only
**Description:** As a reader, I want concise list items so I can scan titles fast.

**Acceptance Criteria:**
- [ ] Each list item shows the build note title only (no date/excerpt)
- [ ] Titles are readable and consistent with existing typography
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

1. FR-1: Build notes must render as a vertical list in the existing build notes section
2. FR-2: Each list item must navigate to the corresponding build note page on click
3. FR-3: PRD layout and styling must remain unchanged
4. FR-4: Each list item must display the build note title only
5. FR-5: Provide a visual hover/active state for list items

## Non-Goals (Out of Scope)

- Changing PRD cards or PRD page layout
- Adding dates, excerpts, or metadata to build note items
- Changing routing or data models
- Introducing new sorting or filtering

## Design Considerations (Optional)

- Keep list styling intentionally minimal to contrast with PRD cards
- Ensure spacing and typography match the blog’s existing visual system
- Consider a small label or subheading if the section needs additional clarity
- Use a clear list treatment (e.g., bullets or subtle dividers) to improve scan-ability

## Technical Considerations (Optional)

- UI-only change; reuse existing build note data sources
- Use existing link/navigation components for routing
- Ensure list is accessible (focus states, semantic list markup)

## Success Metrics

- Readers can visually distinguish PRDs from build notes in under 3 seconds
- Build notes list is scannable without vertical clutter
- No regressions in navigation to build notes

## Open Questions

- Confirm list order stays newest-first (current behavior)
- Choose the final list treatment (bullets vs subtle dividers) during implementation
