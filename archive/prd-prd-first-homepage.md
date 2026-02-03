# PRD: PRD-First Home Page Ordering

## Introduction/Overview

The home page currently emphasizes build notes first, with PRDs below. Readers should be able to browse by PRD first, then see recent build notes after. This change reorders the existing homepage sections so the PRD section (“Specs we shipped”) appears above the build log section (“Fresh from the build log”), without changing the underlying content or layout styles.

## Goals

- Make PRDs the first content section readers see on the home page.
- Preserve existing PRD and build log cards and interactions.
- Implement as a minimal UI-only change.

## User Stories

### US-001: Move PRD section above build notes on the home page
**Description:** As a reader, I want to see PRDs before build notes so I can browse by specs first.

**Acceptance Criteria:**
- [ ] The PRD section appears above the build notes section on the home page.
- [ ] PRD cards remain unchanged in content and styling.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using agent-browser skill.

### US-002: Keep build notes below PRDs with no content changes
**Description:** As a reader, I want to still see recent build notes after PRDs so I can scan the latest updates.

**Acceptance Criteria:**
- [ ] The build notes section appears below the PRD section on the home page.
- [ ] Build note cards remain unchanged in content and styling.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using agent-browser skill.

## Functional Requirements

1. FR-1: The home page must render the PRD section before the build notes section.
2. FR-2: The PRD section title, cards, and links must remain unchanged.
3. FR-3: The build notes section title, cards, and links must remain unchanged.

## Non-Goals (Out of Scope)

- No changes to card content, copy, or styles.
- No changes to PRD or build note data sources.
- No new filtering, sorting, or navigation changes.
- No layout changes beyond section order.

## Design Considerations (Optional)

- Preserve current spacing and separators between sections.
- Ensure the page still reads naturally on mobile after reordering.

## Technical Considerations (Optional)

- This should be a simple section-order change in the home page component.

## Success Metrics

- Readers see the PRD section before build notes on the home page.
- No visual regressions in either section.

## Open Questions

- Should the navigation or anchor links reflect the new order?
