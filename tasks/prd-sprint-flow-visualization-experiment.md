# PRD: Sprint Flow Timelapse Visualization Experiment

## 1. Introduction/Overview

This PRD defines an experiment focused only on the visualization layer of sprint flow replay.

The feature is an animated board timelapse that reconstructs state across sprint time and lets users replay or scrub through changes. The goal is to make flow behavior obvious at a glance, especially where work accumulates or movement surges.

This document intentionally excludes data ingestion and persistence concerns for MVP.

## 2. Goals

- Deliver a visualization-first MVP that replays sprint board flow clearly.
- Render individual cards with minimal labels (readable, low-clutter).
- Provide responsive timeline controls (play, pause, speed, scrub, prev/next event).
- Prioritize smooth animation quality while preserving deterministic state reconstruction.
- Support up to ~100–150 cards without noticeable UI degradation.

### MVP Scope Boundary (Explicit)

- Include: single-board visualization, card movement animation, timeline controls, stable layout behavior.
- Exclude: Jira fetch/storage, multi-team layout strategy finalization, export/sharing, advanced analytics overlays.

## 3. User Stories

### US-001: View board state at any time
**Description:** As a user, I want to see the exact board state at timestamp `t` so that I can inspect flow at specific points in the sprint.

**Acceptance Criteria:**
- [ ] The board can render deterministic state for any timeline position.
- [ ] Columns are clearly separated and consistently ordered.
- [ ] Individual cards are visible with minimal identifiers.
- [ ] Scrubbing to the same timestamp always produces the same state.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Replay card movement
**Description:** As a user, I want to play sprint history as an animation so I can observe movement patterns.

**Acceptance Criteria:**
- [ ] Play advances through timeline states in chronological order.
- [ ] Pause freezes on the current state.
- [ ] Next/previous controls jump by movement step.
- [ ] Multiple card transitions can be animated concurrently.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Control playback speed
**Description:** As a user, I want to adjust playback speed so I can inspect both macro and micro movement.

**Acceptance Criteria:**
- [ ] At least three speed options are available.
- [ ] Speed changes take effect immediately during playback.
- [ ] Faster playback remains legible and stable.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Keep scrubbing instant and stable
**Description:** As a user, I want near-instant scrubbing so I can quickly inspect any point in the sprint without delay.

**Acceptance Criteria:**
- [ ] Scrubbing updates board state near-instantly.
- [ ] Scrubbing does not cause flicker or layout jumps.
- [ ] State transitions remain deterministic after repeated scrubs.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Highlight flow patterns visually
**Description:** As a user, I want visual behavior that makes bottleneck signals obvious so I can reason about sprint flow.

**Acceptance Criteria:**
- [ ] Column accumulation is visually apparent over time.
- [ ] Long-staying cards are discernible by persistent presence.
- [ ] Heavy movement periods are noticeable in playback.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 4. Functional Requirements

- FR-1: The visualization must reconstruct full board state at time `t`.
- FR-2: The system must support play/pause timeline replay.
- FR-3: The system must support adjustable playback speed.
- FR-4: The system must support timeline scrubbing with immediate state updates.
- FR-5: The system must support previous/next movement navigation.
- FR-6: Card-to-column transitions must animate smoothly during playback.
- FR-7: Multiple simultaneous card transitions must render correctly.
- FR-8: The UI must remain stable while scrubbing (no flicker, no column reflow instability).
- FR-9: Card rendering must be minimal and readable (identifier-focused).
- FR-10: MVP must handle ~100–150 cards in a typical modern desktop browser.

## 5. Non-Goals (Out of Scope)

- Jira integration or backend pipeline design.
- Persistence architecture decisions (file vs DB vs service).
- Multi-team strategy decision (swimlanes vs color coding).
- Export to video/shareable assets.
- Advanced bottleneck overlays (heatmaps, dwell-time shading, analytics panel).

## 6. Design Considerations

- Keep columns visually stable across all timeline states.
- Prioritize motion clarity over decorative effects.
- Use animation timing that feels smooth without obscuring card identity.
- Preserve readability under high movement density.
- Keep UI controls simple and obvious.

## 7. Technical Considerations

- Deterministic state engine is mandatory for trustworthy scrubbing and replay.
- Animation should be optimized for 100–150 visible cards.
- Layout updates should avoid full-board reflow whenever possible.
- Motion implementation should tolerate concurrent transitions without jitter.
- Instrument lightweight runtime metrics during experiment (frame drops, scrub latency) where feasible.

## 8. Success Metrics

- Users can replay and scrub the board without confusion.
- Playback appears smooth and visually coherent at target card volume.
- Users can quickly identify at least one accumulation or slowdown period from the visual replay.
- No major rendering instability appears during stress passes.

## 9. Open Questions

None for MVP at this time.

### Resolved Decisions

- Long-staying cards: use a visual aging cue by shifting card color toward red as dwell time increases.
- Card ordering within columns: adaptive ordering (deterministic slotting is not required for MVP).
- Smoothness threshold: target 60 FPS during playback; minimum acceptable threshold is 45 FPS on a typical modern desktop browser.

## 10. MVP Definition of Done

- A standalone visualization page renders individual minimal cards in workflow columns.
- Users can play, pause, scrub, and step next/previous through timeline states.
- Playback animation remains smooth and legible during simultaneous card moves.
- Scrubbing is near-instant and deterministic.
- UI remains readable and stable with ~100–150 cards.
- Experiment results are reviewable in browser and ready for next-phase product decisions.

## 11. Addendum: Motion + Sticky Notes

### Summary of Agreed Changes

- Make card movement the primary visual signal of flow (not only state replacement).
- Keep scrubbing instant (no movement animation while dragging the timeline).
- Style cards as sticky notes to better match scrum-board mental models.
- Keep card content minimal and readable (short IDs only, no metadata clutter).

### Motion Specification

- Use position-based card movement animation for cards that change columns between two timeline steps.
- Playback and step actions (`Play`, `Next`, `Previous`) should animate movement.
- Scrubbing should update state instantly with no movement animation.
- Animation timing:
  - Default movement duration: `200-300ms`
  - Easing: `ease-in-out`
  - Adapt duration down when many cards move in the same step to reduce visual congestion.
- Preserve deterministic layout behavior: cards should not jump unpredictably between frames unrelated to actual movement.

### Sticky Note Visual Specification

- Render cards with a sticky-note look (paper tone, subtle shadow, clear edge contrast).
- Maintain high text contrast and readable short identifiers (for example `A6`, `BUG-123`).
- Keep `Done` cards visually positive (green family).
- Keep `To Do` cards neutral.
- Apply aging/red pressure cues only in active flow columns (`In Progress`, `In Review`, `QA`, `UAT`).

### Scope Notes for This Addendum

- This addendum does not add new data requirements.
- This addendum does not change multi-team scope.
- Highlight/pulse effects are optional and should be selective only; avoid highlighting every moved card by default.
