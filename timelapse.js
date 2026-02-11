"use strict";

const DATASET = {
  sprint: "Sprint 42 (Experiment, 10 working days)",
  columns: ["To Do", "In Progress", "In Review", "QA", "UAT", "Done"],
  snapshots: [
    {
      ts: "2026-01-26T09:00:00Z",
      cards: {
        A1: "To Do",
        A2: "To Do",
        A3: "To Do",
        A4: "To Do",
        A5: "To Do",
        A6: "To Do",
        A7: "To Do",
        A8: "In Progress",
        A9: "In Progress",
        A10: "In Review"
      }
    },
    {
      ts: "2026-01-27T09:00:00Z",
      cards: {
        A1: "In Progress",
        A2: "To Do",
        A3: "To Do",
        A4: "To Do",
        A5: "To Do",
        A6: "QA",
        A7: "QA",
        A8: "In Review",
        A9: "In Review",
        A10: "In Review"
      }
    },
    {
      ts: "2026-01-28T09:00:00Z",
      cards: {
        A1: "In Review",
        A2: "In Progress",
        A3: "To Do",
        A4: "To Do",
        A5: "To Do",
        A6: "QA",
        A7: "QA",
        A8: "UAT",
        A9: "In Review",
        A10: "QA"
      }
    },
    {
      ts: "2026-01-29T09:00:00Z",
      cards: {
        A1: "QA",
        A2: "In Review",
        A3: "In Progress",
        A4: "To Do",
        A5: "To Do",
        A6: "QA",
        A7: "QA",
        A8: "Done",
        A9: "UAT",
        A10: "QA"
      }
    },
    {
      ts: "2026-01-30T09:00:00Z",
      cards: {
        A1: "UAT",
        A2: "QA",
        A3: "In Review",
        A4: "In Progress",
        A5: "To Do",
        A6: "QA",
        A7: "QA",
        A8: "Done",
        A9: "Done",
        A10: "UAT"
      }
    },
    {
      ts: "2026-02-02T09:00:00Z",
      cards: {
        A1: "Done",
        A2: "UAT",
        A3: "QA",
        A4: "In Review",
        A5: "In Progress",
        A6: "QA",
        A7: "QA",
        A8: "Done",
        A9: "Done",
        A10: "Done"
      }
    },
    {
      ts: "2026-02-03T09:00:00Z",
      cards: {
        A1: "Done",
        A2: "Done",
        A3: "UAT",
        A4: "QA",
        A5: "In Review",
        A6: "QA",
        A7: "QA",
        A8: "Done",
        A9: "Done",
        A10: "Done"
      }
    },
    {
      ts: "2026-02-04T09:00:00Z",
      cards: {
        A1: "Done",
        A2: "Done",
        A3: "Done",
        A4: "UAT",
        A5: "QA",
        A6: "QA",
        A7: "QA",
        A8: "Done",
        A9: "Done",
        A10: "Done"
      }
    },
    {
      ts: "2026-02-05T09:00:00Z",
      cards: {
        A1: "Done",
        A2: "Done",
        A3: "Done",
        A4: "Done",
        A5: "UAT",
        A6: "QA",
        A7: "QA",
        A8: "Done",
        A9: "Done",
        A10: "Done"
      }
    },
    {
      ts: "2026-02-06T09:00:00Z",
      cards: {
        A1: "Done",
        A2: "Done",
        A3: "Done",
        A4: "Done",
        A5: "Done",
        A6: "QA",
        A7: "QA",
        A8: "Done",
        A9: "Done",
        A10: "Done"
      }
    }
  ]
};

const state = {
  columns: [],
  snapshots: [],
  cardIds: [],
  views: [],
  columnLists: {},
  columnCounts: {},
  cardNodes: {},
  currentIndex: 0,
  intervalId: null,
  speed: 1,
  reducedMotion: false
};

const el = {
  sprintLabel: document.getElementById("sprint-label"),
  timestampLabel: document.getElementById("timestamp-label"),
  board: document.getElementById("board"),
  prevBtn: document.getElementById("prev-btn"),
  playBtn: document.getElementById("play-btn"),
  nextBtn: document.getElementById("next-btn"),
  speedSelect: document.getElementById("speed-select"),
  slider: document.getElementById("timeline-slider"),
  indexLabel: document.getElementById("index-label")
};

function getMoveDurationMs(movedCount) {
  if (movedCount <= 3) return 280;
  if (movedCount <= 6) return 250;
  if (movedCount <= 10) return 220;
  return 200;
}

function normalize(raw) {
  const columns = Array.isArray(raw?.columns) ? raw.columns : [];
  const snapshots = Array.isArray(raw?.snapshots) ? raw.snapshots : [];
  if (!columns.length || !snapshots.length) throw new Error("Invalid dataset");

  const firstCards = Object.keys(snapshots[0].cards || {});
  if (!firstCards.length) throw new Error("No cards in dataset");

  snapshots.forEach((snap) => {
    const ids = Object.keys(snap.cards || {});
    if (ids.length !== firstCards.length) throw new Error("Card set must remain constant in MVP");
    firstCards.forEach((id) => {
      if (!columns.includes(snap.cards[id])) throw new Error(`Unknown column for ${id}`);
    });
  });

  return {
    sprint: String(raw.sprint || "Sprint"),
    columns,
    snapshots,
    cardIds: firstCards.sort()
  };
}

function formatTs(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function cardHeaderColor(column, dwell) {
  if (column === "Done") return "rgb(170, 221, 185)";
  if (column === "To Do") return "transparent";

  const ratio = Math.max(0, Math.min(1, (dwell - 1) / 6));
  const r = Math.round(238 - ratio * 18);
  const g = Math.round(216 - ratio * 100);
  const b = Math.round(186 - ratio * 95);
  return `rgb(${r}, ${g}, ${b})`;
}

function setPlaybackLabel(isPlaying) {
  el.playBtn.textContent = isPlaying ? "Pause" : "Play";
}

function showFatalError(message) {
  el.sprintLabel.textContent = "Failed to load timelapse";
  el.timestampLabel.textContent = "";
  el.indexLabel.textContent = message;
  el.board.innerHTML = "";

  const error = document.createElement("p");
  error.className = "panel-error";
  error.textContent = message;
  el.board.appendChild(error);

  el.playBtn.disabled = true;
  el.prevBtn.disabled = true;
  el.nextBtn.disabled = true;
  el.slider.disabled = true;
  el.speedSelect.disabled = true;
}

function buildDerivedViews() {
  const lastMovedIndex = {};
  const dwell = {};
  state.cardIds.forEach((id) => {
    lastMovedIndex[id] = 0;
    dwell[id] = 1;
  });

  const views = [];
  state.snapshots.forEach((snapshot, index) => {
    if (index > 0) {
      const prevCards = state.snapshots[index - 1].cards;
      state.cardIds.forEach((id) => {
        const moved = snapshot.cards[id] !== prevCards[id];
        if (moved) {
          lastMovedIndex[id] = index;
          dwell[id] = 1;
        } else {
          dwell[id] += 1;
        }
      });
    }

    const grouped = {};
    const meta = {};
    state.columns.forEach((column) => {
      grouped[column] = [];
    });

    state.cardIds.forEach((id) => {
      const column = snapshot.cards[id];
      grouped[column].push(id);
      meta[id] = {
        dwell: dwell[id],
        lastMovedAt: lastMovedIndex[id]
      };
    });

    state.columns.forEach((column) => {
      grouped[column].sort((a, b) => {
        const movedDelta = meta[b].lastMovedAt - meta[a].lastMovedAt;
        if (movedDelta !== 0) return movedDelta;
        return a.localeCompare(b);
      });
    });

    views.push({
      ts: snapshot.ts,
      cards: snapshot.cards,
      grouped,
      meta
    });
  });

  state.views = views;
}

function buildBoard() {
  el.board.innerHTML = "";
  state.columnLists = {};
  state.columnCounts = {};

  state.columns.forEach((column) => {
    const section = document.createElement("section");
    section.className = "column";

    const head = document.createElement("div");
    head.className = "column-head";

    const title = document.createElement("h3");
    title.textContent = column;

    const count = document.createElement("p");
    count.className = "column-count";
    count.textContent = "0 cards";

    const list = document.createElement("div");
    list.className = "card-list";

    head.appendChild(title);
    head.appendChild(count);
    section.appendChild(head);
    section.appendChild(list);
    el.board.appendChild(section);

    state.columnCounts[column] = count;
    state.columnLists[column] = list;
  });
}

function buildCardPool() {
  state.cardNodes = {};
  state.cardIds.forEach((id) => {
    const root = document.createElement("article");
    root.className = "card";
    root.dataset.cardId = id;

    const header = document.createElement("div");
    header.className = "card-header";
    header.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "card-body";

    const idLabel = document.createElement("span");
    idLabel.className = "card-id";
    idLabel.textContent = id;

    body.appendChild(idLabel);
    root.appendChild(header);
    root.appendChild(body);

    state.cardNodes[id] = { root, header, body, idLabel };
  });
}

function collectRects() {
  const rects = {};
  state.cardIds.forEach((id) => {
    const card = state.cardNodes[id];
    const node = card?.root;
    if (!node || !node.isConnected) return;
    rects[id] = node.getBoundingClientRect();
  });
  return rects;
}

function runMoveAnimations(fromRects, toRects, movedIds, durationMs) {
  movedIds.forEach((id) => {
    const from = fromRects[id];
    const to = toRects[id];
    if (!from || !to) return;

    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    const sourceNode = state.cardNodes[id]?.root;
    if (!sourceNode || !sourceNode.isConnected) return;

    const ghost = sourceNode.cloneNode(true);
    ghost.classList.add("floating-card");
    ghost.style.left = `${from.left}px`;
    ghost.style.top = `${from.top}px`;
    ghost.style.width = `${from.width}px`;
    ghost.style.height = `${from.height}px`;
    document.body.appendChild(ghost);

    sourceNode.classList.add("card--moving");
    sourceNode.style.visibility = "hidden";

    requestAnimationFrame(() => {
      ghost.style.transition = `transform ${durationMs}ms ease-in-out, opacity ${durationMs}ms ease-in-out`;
      ghost.style.transform = `translate(${-dx}px, ${-dy}px)`;
      ghost.style.opacity = "0.9";
    });

    window.setTimeout(() => {
      sourceNode.classList.remove("card--moving");
      sourceNode.style.visibility = "";
      ghost.remove();
    }, durationMs + 30);
  });
}

function render(index, animateMoves) {
  const previousIndex = state.currentIndex;
  const shouldAnimate = animateMoves && !state.reducedMotion;
  const prevRects = shouldAnimate ? collectRects() : null;

  state.currentIndex = index;
  const view = state.views[index];

  state.columns.forEach((column) => {
    const ids = view.grouped[column];
    const list = state.columnLists[column];
    const count = state.columnCounts[column];
    if (!list || !count) return;

    count.textContent = `${ids.length} cards`;

    const frag = document.createDocumentFragment();
    ids.forEach((id) => {
      const card = state.cardNodes[id];
      const dwell = view.meta[id].dwell;
      card.body.style.backgroundColor = "rgb(255, 255, 255)";
      card.header.style.backgroundColor = cardHeaderColor(column, dwell);
      card.root.title = `${id} · ${column} · ${dwell} day(s) in column`;
      frag.appendChild(card.root);
    });

    list.replaceChildren(frag);
  });

  el.slider.value = String(index);
  el.timestampLabel.textContent = formatTs(view.ts);
  el.indexLabel.textContent = `Step ${index + 1} of ${state.views.length} (working days) · Total cards: ${state.cardIds.length}`;

  if (shouldAnimate && prevRects && previousIndex !== index) {
    const prevCards = state.views[previousIndex].cards;
    const movedIds = state.cardIds.filter((id) => prevCards[id] !== view.cards[id]);
    if (movedIds.length > 0) {
      const nextRects = collectRects();
      const durationMs = getMoveDurationMs(movedIds.length);
      runMoveAnimations(prevRects, nextRects, movedIds, durationMs);
    }
  }
}

function stopPlayback() {
  if (state.intervalId) {
    window.clearInterval(state.intervalId);
    state.intervalId = null;
  }
  setPlaybackLabel(false);
}

function stepNext(animate) {
  if (state.currentIndex >= state.views.length - 1) {
    stopPlayback();
    return;
  }
  render(state.currentIndex + 1, animate);
}

function stepPrev() {
  if (state.currentIndex <= 0) return;
  render(state.currentIndex - 1, true);
}

function play() {
  if (state.intervalId) {
    stopPlayback();
    return;
  }

  if (state.currentIndex >= state.views.length - 1) {
    render(0, false);
  }

  setPlaybackLabel(true);
  const base = 1000;
  const intervalMs = Math.max(120, Math.round(base / state.speed));
  state.intervalId = window.setInterval(() => stepNext(true), intervalMs);
}

function bind() {
  el.playBtn.addEventListener("click", play);

  el.prevBtn.addEventListener("click", () => {
    stopPlayback();
    stepPrev();
  });

  el.nextBtn.addEventListener("click", () => {
    stopPlayback();
    stepNext(true);
  });

  el.slider.addEventListener("input", (event) => {
    stopPlayback();
    const nextIndex = Number(event.target.value);
    if (!Number.isFinite(nextIndex)) return;
    render(Math.max(0, Math.min(state.views.length - 1, Math.round(nextIndex))), false);
  });

  el.speedSelect.addEventListener("change", (event) => {
    const value = Number(event.target.value);
    state.speed = Number.isFinite(value) && value > 0 ? value : 1;
    if (state.intervalId) {
      stopPlayback();
      play();
    }
  });
}

function init() {
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  state.reducedMotion = motionQuery.matches;
  motionQuery.addEventListener("change", (event) => {
    state.reducedMotion = event.matches;
  });

  const normalized = normalize(DATASET);
  state.columns = normalized.columns;
  state.snapshots = normalized.snapshots;
  state.cardIds = normalized.cardIds;
  state.speed = Number(el.speedSelect.value || 1);

  buildDerivedViews();
  buildBoard();
  buildCardPool();
  bind();

  el.sprintLabel.textContent = `${normalized.sprint} · Individual-card replay`;
  el.slider.max = String(state.views.length - 1);

  render(0, false);
}

try {
  init();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown initialization error";
  showFatalError(`Unable to initialize visualization: ${message}`);
}
