# PRD: PRD-First Blog (v1)

## 1. Introduction/Overview
The blog should highlight PRDs as the primary artifact that drives each set of build notes. This feature makes PRDs the first thing readers see on the blog index, adds related stories immediately under PRD titles on PRD detail pages, and surfaces a clear PRD reference on build note pages.

## 2. Goals
- Make PRDs the primary focus on the blog index.
- Show related stories near the top of each PRD detail page.
- Provide a clear PRD reference on each build note page.

## 3. User Stories

### US-001: PRD-First Blog Index
**Description:** As a reader, I want to see PRDs first on the blog index so I understand the planning before the notes.

**Acceptance Criteria:**
- [ ] The blog index (`/blog`) shows a PRD section above build notes.
- [ ] PRD section uses the existing PRD card style and includes story counts.
- [ ] Build notes remain visible below the PRD section.
- [ ] The “Explore” CTA on the home page links to the PRD section first.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

### US-002: Related Stories at Top of PRD Page
**Description:** As a reader, I want related stories to appear right after the PRD header so I can see what shipped at a glance.

**Acceptance Criteria:**
- [ ] PRD detail pages show “Related stories” directly under the PRD header.
- [ ] Each related story includes title and date with a link to the build note.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

### US-003: PRD Card on Build Notes
**Description:** As a reader, I want build notes to show their PRD so I can jump back to the plan.

**Acceptance Criteria:**
- [ ] Build note pages show a “Related PRD” card near the top of the page.
- [ ] The card includes PRD title and link.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

## 4. Functional Requirements
1. Blog index renders a PRD section ahead of build notes.
2. PRD detail pages render related stories directly after the header.
3. Build note pages render a related PRD card when mapped.
4. Home “Explore” CTA points to the PRD-first blog section.

## 5. Non-Goals (Out of Scope)
- Removing build notes from the blog index.
- Automated inference of PRD/story relationships.
- New filtering or search controls.

## 6. Design Considerations
- Reuse existing PRD card and build note styles.
- Keep PRD-first flow calm and readable.

## 7. Technical Considerations
- Use existing PRD mapping data in `web/src/app/blog/posts.ts`.
- Avoid duplicating PRD card components; reuse existing layout helpers.

## 8. Success Metrics
- Readers see PRDs before build notes on the blog index.
- Readers can jump quickly between PRDs and related stories.

## 9. Open Questions
- Should build note pages also keep the small PRD meta link, or is the card enough?
