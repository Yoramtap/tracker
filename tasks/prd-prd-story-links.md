# PRD: PRD–Story Links (v1)

## 1. Introduction/Overview
We currently ship build notes for every story and now have a PRD library. Readers should be able to see how the build notes (stories) relate back to the PRD they came from. This feature adds explicit PRD → story links in the UI, so a PRD page can list its related build notes and each build note can link back to its PRD.

## 2. Goals
- Show which build notes belong to each PRD.
- Make PRD cards show a story count at a glance.
- Provide bidirectional navigation between a PRD and its related stories.

## 3. User Stories

### US-001: PRD Detail Related Stories
**Description:** As a reader, I want to see the stories related to a PRD so I can understand what shipped from the plan.

**Acceptance Criteria:**
- [ ] PRD detail pages include a “Related stories” section.
- [ ] The section lists build notes associated with that PRD.
- [ ] Each related story links to its build note page.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: PRD Card Story Count
**Description:** As a reader, I want to see how many stories are linked to a PRD so I can gauge its scope quickly.

**Acceptance Criteria:**
- [ ] PRD index cards show a story count.
- [ ] Count is derived from the PRD → story mapping.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Build Note Link Back to PRD
**Description:** As a reader, I want to navigate from a build note to its PRD so I can see the original plan.

**Acceptance Criteria:**
- [ ] Each build note can link back to its PRD.
- [ ] Link appears in the build note header metadata area.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## 4. Functional Requirements
1. Maintain a manual mapping between PRDs and build notes in `web/src/app/blog/posts.ts`.
2. PRD detail pages must render related story links.
3. PRD cards must show story counts.
4. Build notes must link back to their PRD when mapped.

## 5. Non-Goals (Out of Scope)
- Automatic inference of relationships.
- Tagging, filtering, or search based on PRD.
- A visual graph view of PRD/story relationships.

## 6. Design Considerations
- Related stories list should match existing blog post typography.
- Story counts should be subtle, not a dominant UI element.

## 7. Technical Considerations
- Mapping should be explicit to avoid wrong associations.
- Reuse existing card and list styles where possible.

## 8. Success Metrics
- Readers can see all stories associated with a PRD.
- Readers can move from story → PRD and PRD → story.
- PRD index conveys story count at a glance.

## 9. Open Questions
- Should we display story titles only, or include dates as well?
