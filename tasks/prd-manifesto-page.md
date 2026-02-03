# PRD: Manifesto Page

## Introduction/Overview

We want a dedicated manifesto page that explains the builder + agent identity and the PRD → stories → build notes workflow. The page should feel like a calm, welcoming home and make the build loop element feel placed intentionally within that narrative. The manifesto should be accessible from the primary navigation.

## Goals

- Clearly explain the “builder + agent” identity and why the site exists.
- Make the PRD → stories → build notes workflow easy to understand.
- Place the build loop element on the manifesto page in a more intentional spot (minimal changes).
- Provide a primary navigation link to the manifesto page.

## User Stories

### US-001: Add a manifesto page
**Description:** As a reader, I want a manifesto page that explains the builder + agent home so I understand the purpose and tone of the blog.

**Acceptance Criteria:**
- [ ] A new page exists at `/manifesto` with clear “builder + agent” framing.
- [ ] The page includes a short vision paragraph and a concise “How we build” section (PRD → stories → build notes).
- [ ] Content is readable on desktop and mobile with existing site typography.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using agent-browser skill.

### US-002: Place the build loop element on the manifesto page
**Description:** As a reader, I want the build loop element presented within the manifesto page so the workflow feels grounded in the narrative.

**Acceptance Criteria:**
- [ ] The existing build loop element appears on the manifesto page without a full redesign.
- [ ] Placement supports the manifesto narrative (e.g., near “How we build”).
- [ ] The build loop element’s visual style remains consistent with the rest of the site.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using agent-browser skill.

### US-003: Add a primary navigation link to the manifesto
**Description:** As a reader, I want to access the manifesto from the main navigation so I can find it easily.

**Acceptance Criteria:**
- [ ] A “Manifesto” link appears in the primary navigation.
- [ ] The link routes to `/manifesto`.
- [ ] Navigation styling remains consistent with existing patterns.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using agent-browser skill.

## Functional Requirements

1. FR-1: The site must expose a `/manifesto` page with manifesto copy and a “How we build” section.
2. FR-2: The build loop element must render on the manifesto page with minimal changes.
3. FR-3: The primary navigation must include a Manifesto link pointing to `/manifesto`.

## Non-Goals (Out of Scope)

- No new CMS or content management system.
- No major redesign of the build loop element.
- No new animations or heavy interactions beyond existing styles.
- No localization or multi-language support.

## Design Considerations (Optional)

- Keep the manifesto tone warm, candid, and grounded.
- Use existing typography and spacing patterns to avoid visual drift.
- The build loop element should feel like part of the story, not a detached widget.

## Technical Considerations (Optional)

- Use a static route under `web/src/app/manifesto/`.
- Reuse the existing build loop component without large refactors.
- Navigation should be updated in the existing layout component.

## Success Metrics

- Readers can understand the site’s purpose and process within 60 seconds.
- Manifesto page gets navigation clicks (qualitative signal).

## Open Questions

- Should the manifesto also link to a “current PRD” highlight?
- Should the manifesto appear in the footer as well as primary navigation?
