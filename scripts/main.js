const page = document.getElementById("page");
const form = document.getElementById("auth");
const errorEl = document.getElementById("error");
const btn = document.getElementById("submit");
const realm = document.getElementById("realm");

const burgerIcon = document.querySelector(".burger-icon");
const sidePanel = document.querySelector(".side-panel");
const brigadesPage = document.querySelector(".brigades-page");
const masterBoardsPage = document.querySelector(".master-boards-page");
const boardPage = document.getElementById("board-page");
const brigadesGrid = document.querySelector(".brigades-grid");
const masterBoardsGrid = document.getElementById("master-boards-grid");
const boardTitle = document.getElementById("board-title");
const burgerMenu = document.querySelector(".burger-menu");
const wbReadOnlyBanner = document.getElementById("wb-readonly-banner");
const navBoardsItem = document.querySelector('.side-panel li[data-nav="boards"]');
const brigadesPageTitle = document.querySelector(".brigades-page h2");
const fabricBoardFrame = document.getElementById("fabric-board-frame");
const masterBoardsBackBtn = document.querySelector(".master-boards-back-btn");
const masterPreviewModal = document.getElementById("master-preview-modal");
const masterPreviewTitle = document.getElementById("master-preview-title");
const masterPreviewImage = document.getElementById("master-preview-image");
const masterPreviewClose = document.getElementById("master-preview-close");
const brigadesPageHint = document.querySelector(".brigades-page-hint");
const supervisorShowcaseModal = document.getElementById("supervisor-showcase-modal");
const supervisorShowcaseClose = document.getElementById("supervisor-showcase-close");
const supervisorShowcaseTitle = document.getElementById("supervisor-showcase-title");
const supervisorShowcaseImage = document.getElementById("supervisor-showcase-image");
const supervisorShowcaseOpenFabric = document.getElementById("supervisor-showcase-open-fabric");
const supervisorReviewPage = document.getElementById("supervisor-review-page");
const supervisorReviewBackBtn = document.getElementById("supervisor-review-back-btn");
const supervisorReviewTitle = document.getElementById("supervisor-review-title");
const supervisorReviewImage = document.getElementById("supervisor-review-image");
const supervisorReviewImageEmpty = document.getElementById("supervisor-review-image-empty");
const supervisorCommentsList = document.getElementById("supervisor-comments-list");
const supervisorCommentsForm = document.getElementById("supervisor-comments-form");
const supervisorCommentInput = document.getElementById("supervisor-comment-input");
const supervisorCommentSubmit = document.getElementById("supervisor-comment-submit");
const supervisorCommentsStatus = document.getElementById("supervisor-comments-status");

let supervisorModalBb = null;
let supervisorModalBoardId = "board-1";
let supervisorModalBoardName = "Шаблон 1";
let supervisorReviewBb = null;
let supervisorReviewBoardId = "board-1";

const GATE_MS = 1350;
const IGNITE_BEFORE_OPEN_MS = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ? 0
  : 760;

let activeSession = null;
let currentMasterBoardId = "board-1";
let currentOpenBb = null;
let currentOpenBoardId = "board-1";
let currentOpenBoardName = "Шаблон 1";
let pendingFabricSaveAction = null;
const MASTER_BOARDS_PREFIX = "ink-auth-master-boards-";
const BOOKMARKS_KEY = "ink-auth-board-bookmarks";
const COMMENT_SEEN_PREFIX = "ink-auth-comment-seen-";
const API_BASE = "/api";
const commentSummaryMap = new Map();

if (burgerMenu) burgerMenu.style.display = "none";
if (sidePanel) sidePanel.style.display = "none";

if (realm?.querySelector("h1")) wrapLetters(realm.querySelector("h1"));
if (realm?.querySelectorAll("h1")[1]) wrapLetters(realm.querySelectorAll("h1")[1]);

function canEditBoard() {
  return activeSession?.role === "master" || activeSession?.role === "supervisor";
}

function updateNavBoardsLabel() {
  if (!navBoardsItem || !activeSession) return;
  navBoardsItem.textContent =
    activeSession.role === "master"
      ? `Моя доска (ББ ${activeSession.bb})`
      : "Буровые бригады";
}

function updateWelcomeHeading() {
  if (!activeSession) return;
  const el = realm.querySelectorAll("h1")[1];
  if (!el) return;
  el.textContent =
    activeSession.role === "master"
      ? `${activeSession.name} — мастер ББ ${activeSession.bb}`
      : `${activeSession.name} — просмотр всех досок`;
  wrapLetters(el);
}

function updateBoardBackButton() {
  return;
}

function setBoardUiMode(active) {
  if (burgerMenu) burgerMenu.style.display = active ? "none" : "";
  if (sidePanel) {
    sidePanel.classList.remove("open");
    sidePanel.style.display = active ? "none" : "";
  }
  burgerIcon.classList.remove("open");
}

function getMasterBoardsKey(bb) {
  return `${MASTER_BOARDS_PREFIX}${bb}`;
}

function getCommentBoardKey(bb, boardId) {
  return `${bb}:${boardId}`;
}

function getCommentSeenStorageKey(bb, boardId) {
  const actor = activeSession?.name || activeSession?.role || "anonymous";
  return `${COMMENT_SEEN_PREFIX}${actor}:${bb}:${boardId}`;
}

async function fetchMasterBoardsFromServer(bb) {
  const response = await fetch(`${API_BASE}/master-boards/${bb}`);
  if (!response.ok) throw new Error(`Cannot load master boards for BB ${bb}`);
  const payload = await response.json();
  return Array.isArray(payload?.boards) ? payload.boards : [];
}

async function saveMasterBoardsToServer(bb, boards) {
  const response = await fetch(`${API_BASE}/master-boards/${bb}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boards }),
  });
  if (!response.ok) throw new Error(`Cannot save master boards for BB ${bb}`);
}

async function fetchBoardStateFromServer(bb, boardId) {
  const response = await fetch(`${API_BASE}/board-state/${bb}/${boardId}?previewOnly=1`);
  if (!response.ok) throw new Error(`Cannot load board state ${bb}/${boardId}`);
  return response.json();
}

function loadBookmarks() {
  const raw = localStorage.getItem(BOOKMARKS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBookmarks(list) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
}

function getMasterBoardThumbKey(bb, boardId) {
  return `ink-auth-fabric-thumb-bb-${bb}-${boardId}`;
}

function getMasterBoardPreviewKey(bb, boardId) {
  return `ink-auth-fabric-preview-bb-${bb}-${boardId}`;
}

function getMasterBoards(bb) {
  const key = getMasterBoardsKey(bb);
  const raw = localStorage.getItem(key);
  if (!raw) {
    const initial = [{ id: "board-1", name: "Шаблон 1" }];
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}
  const fallback = [{ id: "board-1", name: "Шаблон 1" }];
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}

function saveMasterBoards(bb, boards) {
  localStorage.setItem(getMasterBoardsKey(bb), JSON.stringify(boards));
  saveMasterBoardsToServer(bb, boards).catch(() => {});
}

async function syncMasterBoardsFromServer(bb) {
  try {
    const boards = await fetchMasterBoardsFromServer(bb);
    if (boards.length) {
      localStorage.setItem(getMasterBoardsKey(bb), JSON.stringify(boards));
      return boards;
    }
  } catch {}
  return getMasterBoards(bb);
}

function deleteMasterBoard(bb, boardId) {
  const boards = getMasterBoards(bb).filter((board) => board.id !== boardId);
  const nextBoards = boards.length ? boards : [{ id: "board-1", name: "Шаблон 1" }];
  saveMasterBoards(bb, nextBoards);
  localStorage.removeItem(`ink-auth-fabric-bb-${bb}-${boardId}`);
  localStorage.removeItem(getMasterBoardThumbKey(bb, boardId));
  localStorage.removeItem(getMasterBoardPreviewKey(bb, boardId));
  const bookmarks = loadBookmarks().filter((x) => !(x.bb === bb && x.boardId === boardId));
  saveBookmarks(bookmarks);
  void (async () => {
    try {
      const r = await fetch(`${API_BASE}/showcase/${bb}`);
      if (!r.ok) return;
      const j = await r.json();
      if (j.boardId === boardId) {
        await fetch(`${API_BASE}/showcase/${bb}`, { method: "DELETE" });
      }
    } catch {}
  })();
}

function createMasterBoard(bb) {
  const boards = getMasterBoards(bb);
  const nextIndex = boards.length + 1;
  const newBoard = {
    id: `board-${Date.now()}`,
    name: `Шаблон ${nextIndex}`,
  };
  boards.push(newBoard);
  saveMasterBoards(bb, boards);
  return newBoard;
}

function renameMasterBoard(bb, boardId, newName) {
  const trimmed = newName.trim();
  if (!trimmed || trimmed.length > 200) return false;
  const boards = getMasterBoards(bb);
  const index = boards.findIndex((board) => board.id === boardId);
  if (index === -1) return false;
  if (boards[index].name === trimmed) return true;
  boards[index] = { ...boards[index], name: trimmed };
  saveMasterBoards(bb, boards);

  const bookmarks = loadBookmarks().map((entry) =>
    entry.bb === bb && entry.boardId === boardId ? { ...entry, boardName: trimmed } : entry,
  );
  saveBookmarks(bookmarks);

  if (
    currentOpenBb === bb &&
    currentOpenBoardId === boardId &&
    boardPage?.classList.contains("open")
  ) {
    currentOpenBoardName = trimmed;
    boardTitle.textContent = `Оперативная доска — ББ ${bb} • ${trimmed}`;
  }

  return true;
}

async function pickBestPreviewDataUrl(bb, boardId) {
  const prev = localStorage.getItem(getMasterBoardPreviewKey(bb, boardId));
  const thumb = localStorage.getItem(getMasterBoardThumbKey(bb, boardId));
  let srv = null;
  try {
    const r = await fetch(`${API_BASE}/board-state/${bb}/${boardId}?previewOnly=1`);
    if (r.ok) {
      const payload = await r.json();
      if (payload?.found) srv = payload.preview || payload.thumb;
    }
  } catch {}
  const parts = [prev, thumb, srv].filter((x) => typeof x === "string" && x.startsWith("data:"));
  if (!parts.length) return null;
  return parts.reduce((a, b) => (b.length > a.length ? b : a));
}

function requestThumbFromOpenFabric(bb, boardId) {
  if (currentOpenBb !== bb || currentOpenBoardId !== boardId) return Promise.resolve(false);
  const w = fabricBoardFrame?.contentWindow;
  if (!w) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timeoutMs = 4000;
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMsg);
      resolve(false);
    }, timeoutMs);
    function onMsg(event) {
      if (event.data?.type !== "fabric-thumb-for-showcase-done") return;
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      resolve(true);
    }
    window.addEventListener("message", onMsg);
    try {
      w.postMessage({ type: "fabric-thumb-for-showcase-request" }, "*");
    } catch {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      resolve(false);
    }
  });
}

async function putMasterShowcaseBoard(bb, boardId) {
  let imageDataUrl = await pickBestPreviewDataUrl(bb, boardId);
  if (!imageDataUrl) {
    await requestThumbFromOpenFabric(bb, boardId);
    imageDataUrl = await pickBestPreviewDataUrl(bb, boardId);
  }
  let res;
  try {
    res = await fetch(`${API_BASE}/showcase/${bb}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardId,
        ...(imageDataUrl ? { imageDataUrl } : {}),
      }),
    });
  } catch (err) {
    window.alert(
      `Нет связи с сервером (${String(err?.message || err)}). Проверьте, что backend запущен и страница открыта с того же адреса.`,
    );
    return;
  }
  let msg = "";
  let bodyText = "";
  try {
    bodyText = await res.text();
    if (bodyText) {
      try {
        const j = JSON.parse(bodyText);
        msg = (j && (j.error || j.message)) || "";
      } catch {
        msg = bodyText.slice(0, 220);
      }
    }
  } catch {}
  if (!res.ok) {
    const looksLikeMissingApiRoute =
      /cannot\s+(put|get|post|delete)\s+\/api\//i.test(bodyText) ||
      /<pre>\s*cannot\s+put\s+\/api\//i.test(bodyText) ||
      (bodyText.includes("<!DOCTYPE") && /cannot\s+put/i.test(bodyText));
    const wrongServerHint =
      "На порту 3000 запущен не тот процесс: нет маршрута PUT /api/showcase (часто — старый node или http-server без API).\n\n" +
      "Сделайте так:\n" +
      "1) Закройте окна, где уже что‑то слушает порт 3000.\n" +
      "2) Запустите backend ИНК одним из способов:\n" +
      "   • двойной щелчок по файлу Start-Ink.cmd в папке ink-auth\n" +
      "   • или в ink-auth: npm start\n" +
      "   • или PowerShell: .\\scripts\\start-local-backend.ps1\n" +
      "3) В консоли должны быть строки «Backend listening» и «INK API: GET/PUT/DELETE /api/showcase».\n" +
      "4) Откройте снова http://127.0.0.1:3000/";
    window.alert(
      looksLikeMissingApiRoute ? wrongServerHint : msg ||
        "Не удалось поставить на показ. Откройте эту доску (чтобы сгенерировалось превью), затем снова нажмите «Поставить на показ» или выйдите с доски с выделением области превью.",
    );
    return;
  }
  window.alert("Этот шаблон выставлен на показ для начальника.");
}

async function fetchShowcaseBoardIdForBb(bb) {
  try {
    const r = await fetch(`${API_BASE}/showcase/${bb}`);
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.boardId === "string" ? j.boardId : null;
  } catch {
    return null;
  }
}

function getSeenCommentCount(bb, boardId) {
  const raw = localStorage.getItem(getCommentSeenStorageKey(bb, boardId));
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function setSeenCommentCount(bb, boardId, count) {
  localStorage.setItem(getCommentSeenStorageKey(bb, boardId), String(Math.max(0, Number(count) || 0)));
}

function getCommentCountFromSummary(bb, boardId) {
  return commentSummaryMap.get(getCommentBoardKey(bb, boardId)) || 0;
}

function getUnreadCommentCount(bb, boardId) {
  const total = getCommentCountFromSummary(bb, boardId);
  const seen = getSeenCommentCount(bb, boardId);
  return Math.max(0, total - seen);
}

function attachCommentBadge(button, unreadCount) {
  if (!button) return;
  let badge = button.querySelector(".comment-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "comment-badge";
    button.appendChild(badge);
  }
  if (unreadCount > 0) {
    badge.hidden = false;
    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  } else {
    badge.hidden = true;
    badge.textContent = "";
  }
}

async function refreshCommentSummary() {
  commentSummaryMap.clear();
  try {
    const r = await fetch(`${API_BASE}/board-comments-summary`);
    if (!r.ok) return;
    const payload = await r.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    items.forEach((item) => {
      const bb = Number(item?.bb);
      const boardId = String(item?.boardId || "").trim();
      const count = Number(item?.count || 0);
      if (!Number.isInteger(bb) || bb <= 0 || !boardId) return;
      commentSummaryMap.set(getCommentBoardKey(bb, boardId), Math.max(0, count));
    });
  } catch {}
}

function promptRenameMasterBoard(board) {
  if (!activeSession || activeSession.role !== "master") return;
  const next = window.prompt("Новое имя шаблона", board.name);
  if (next == null) return;
  if (!renameMasterBoard(activeSession.bb, board.id, next)) {
    window.alert("Введите непустое имя (не длиннее 200 символов).");
    return;
  }
  void renderMasterBoards();
}

async function renderMasterBoards() {
  if (!activeSession || activeSession.role !== "master") return;
  masterBoardsGrid.replaceChildren();
  await refreshCommentSummary();
  const boards = await syncMasterBoardsFromServer(activeSession.bb);
  // Синхронизируем превью из БД в localStorage, чтобы карточки досок
  // отображались одинаково на любых ноутбуках/браузерах.
  await Promise.all(
    boards.map(async (board) => {
      try {
        const payload = await fetchBoardStateFromServer(activeSession.bb, board.id);
        if (!payload?.found) return;
        if (typeof payload.thumb === "string") {
          localStorage.setItem(getMasterBoardThumbKey(activeSession.bb, board.id), payload.thumb);
        }
        if (typeof payload.preview === "string") {
          localStorage.setItem(getMasterBoardPreviewKey(activeSession.bb, board.id), payload.preview);
        }
      } catch {}
    }),
  );
  const showcaseBoardId = await fetchShowcaseBoardIdForBb(activeSession.bb);
  const addItem = document.createElement("div");
  addItem.className = "master-template-item";
  boards.forEach((board) => {
    const item = document.createElement("div");
    item.className = "master-template-item";
    if (showcaseBoardId && board.id === showcaseBoardId) {
      item.classList.add("master-template-item--showcase");
    }
    const cube = document.createElement("div");
    cube.className = "master-template-cube master-board-cube";
    cube.tabIndex = 0;
    cube.setAttribute("role", "button");
    cube.setAttribute("aria-label", `Открыть шаблон «${board.name}»`);
    const thumb = localStorage.getItem(getMasterBoardThumbKey(activeSession.bb, board.id));
    if (thumb) {
      cube.style.backgroundImage = `url("${thumb}")`;
      cube.style.backgroundSize = "contain";
      cube.style.backgroundPosition = "center";
      cube.style.backgroundRepeat = "no-repeat";
      cube.textContent = "";
    } else {
      cube.textContent = "Доска";
    }
    const openThisBoard = () => {
      currentMasterBoardId = board.id;
      openBoard(activeSession.bb, board.id, board.name);
    };
    cube.addEventListener("click", (e) => {
      if (e.target !== cube) return;
      openThisBoard();
    });
    cube.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openThisBoard();
      }
    });
    const actions = document.createElement("div");
    actions.className = "master-template-actions";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "master-template-action-btn";
    openBtn.textContent = "Открыть";
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      currentMasterBoardId = board.id;
      openBoard(activeSession.bb, board.id, board.name);
    });
    const previewBtn = document.createElement("button");
    previewBtn.type = "button";
    previewBtn.className = "master-template-action-btn";
    previewBtn.textContent = "Предпросмотр";
    previewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const preview =
        localStorage.getItem(getMasterBoardPreviewKey(activeSession.bb, board.id)) ||
        localStorage.getItem(getMasterBoardThumbKey(activeSession.bb, board.id));
      if (!preview) return;
      masterPreviewTitle.textContent = `${board.name} — предпросмотр`;
      masterPreviewImage.src = preview;
      masterPreviewModal.hidden = false;
    });
    const showcaseBtn = document.createElement("button");
    showcaseBtn.type = "button";
    showcaseBtn.className = "master-template-action-btn master-template-action-btn--showcase";
    showcaseBtn.textContent = "Поставить на показ";
    showcaseBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (showcaseBtn.disabled) return;
      showcaseBtn.disabled = true;
      try {
        await putMasterShowcaseBoard(activeSession.bb, board.id);
        void renderMasterBoards();
      } finally {
        showcaseBtn.disabled = false;
      }
    });
    const commentBtn = document.createElement("button");
    commentBtn.type = "button";
    commentBtn.className = "master-template-action-btn master-template-action-btn--comment";
    commentBtn.textContent = "Комментарии";
    attachCommentBadge(commentBtn, getUnreadCommentCount(activeSession.bb, board.id));
    commentBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const imageDataUrl = await pickBestPreviewDataUrl(activeSession.bb, board.id);
      openSupervisorReviewPage(activeSession.bb, {
        boardId: board.id,
        boardName: board.name,
        image: imageDataUrl,
      });
    });
    const renameMenuBtn = document.createElement("button");
    renameMenuBtn.type = "button";
    renameMenuBtn.className = "master-template-action-btn";
    renameMenuBtn.textContent = "Переименовать";
    renameMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      promptRenameMasterBoard(board);
    });
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "master-template-action-btn";
    deleteBtn.textContent = "Удалить";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const ok = window.confirm(`Удалить "${board.name}"?`);
      if (!ok) return;
      deleteMasterBoard(activeSession.bb, board.id);
      void renderMasterBoards();
    });
    actions.appendChild(openBtn);
    actions.appendChild(previewBtn);
    actions.appendChild(commentBtn);
    actions.appendChild(showcaseBtn);
    actions.appendChild(renameMenuBtn);
    actions.appendChild(deleteBtn);
    cube.appendChild(actions);
    const titleRow = document.createElement("div");
    titleRow.className = "master-template-title-row";
    const titleText = document.createElement("span");
    titleText.className = "master-template-title";
    titleText.textContent = board.name;
    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "master-template-rename-btn";
    renameBtn.title = "Переименовать шаблон";
    renameBtn.setAttribute("aria-label", "Переименовать шаблон");
    renameBtn.textContent = "✎";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      promptRenameMasterBoard(board);
    });
    titleRow.appendChild(titleText);
    titleRow.appendChild(renameBtn);
    item.appendChild(cube);
    item.appendChild(titleRow);
    masterBoardsGrid.appendChild(item);
  });
  const addCube = document.createElement("button");
  addCube.type = "button";
  addCube.className = "master-template-cube master-add-cube";
  addCube.textContent = "+";
  addCube.title = "Создать новую доску";
  addCube.addEventListener("click", () => {
    const created = createMasterBoard(activeSession.bb);
    void renderMasterBoards();
    currentMasterBoardId = created.id;
    openBoard(activeSession.bb, created.id, created.name);
  });
  const addTitle = document.createElement("div");
  addTitle.className = "master-template-title";
  addTitle.textContent = "Добавить новую доску";
  addItem.appendChild(addCube);
  addItem.appendChild(addTitle);
  masterBoardsGrid.prepend(addItem);
}

async function buildBrigadesGrid() {
  brigadesGrid.replaceChildren();
  if (!activeSession || activeSession.role !== "supervisor") return;
  if (brigadesPageHint) brigadesPageHint.style.display = "";
  await refreshCommentSummary();
  let rows = [];
  try {
    const res = await fetch(`${API_BASE}/showcase-boards`);
    if (res.ok) rows = await res.json();
  } catch {}
  const byBb = new Map(rows.map((r) => [Number(r.bb), r]));
  for (let i = 1; i <= 30; i += 1) {
    const row = byBb.get(i) || {};
    const card = document.createElement("div");
    card.className = "supervisor-bb-card";
    card.dataset.bb = String(i);
    const label = document.createElement("div");
    label.className = "supervisor-bb-card-head";
    label.textContent = `ББ ${i}`;
    const previewWrap = document.createElement("button");
    previewWrap.type = "button";
    previewWrap.className = "supervisor-bb-card-preview";
    previewWrap.setAttribute("aria-label", `Увеличить доску ББ ${i}`);
    if (row.image) {
      const img = document.createElement("img");
      img.src = row.image;
      img.alt = row.boardName || `Доска ББ ${i}`;
      img.decoding = "async";
      img.loading = "lazy";
      img.width = 800;
      img.height = 500;
      previewWrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "supervisor-bb-card-placeholder";
      ph.textContent = "Мастер не выставил доску на показ";
      previewWrap.appendChild(ph);
    }
    previewWrap.addEventListener("click", () => {
      if (!row.image) return;
      supervisorModalBb = i;
      supervisorModalBoardId = row.boardId || "board-1";
      supervisorModalBoardName = row.boardName || "Шаблон";
      if (supervisorShowcaseTitle) {
        supervisorShowcaseTitle.textContent = `ББ ${i} — ${supervisorModalBoardName}`;
      }
      if (supervisorShowcaseImage) {
        supervisorShowcaseImage.src = row.image;
        supervisorShowcaseImage.alt = supervisorModalBoardName;
      }
      if (supervisorShowcaseModal) supervisorShowcaseModal.hidden = false;
    });
    const sub = document.createElement("div");
    sub.className = "supervisor-bb-card-sub";
    sub.textContent = row.boardName || (row.boardId ? String(row.boardId) : "—");
    const openEdit = document.createElement("button");
    openEdit.type = "button";
    openEdit.className = "supervisor-bb-card-open";
    openEdit.textContent = "Открыть в редакторе";
    openEdit.addEventListener("click", () => {
      openBoard(i, row.boardId || "board-1", row.boardName || "Шаблон 1");
    });
    const commentBtn = document.createElement("button");
    commentBtn.type = "button";
    commentBtn.className = "supervisor-bb-card-comment";
    commentBtn.textContent = "Оставить комментарий";
    attachCommentBadge(commentBtn, getUnreadCommentCount(i, row.boardId || "board-1"));
    commentBtn.addEventListener("click", () => {
      openSupervisorReviewPage(i, row);
    });
    card.appendChild(label);
    card.appendChild(previewWrap);
    card.appendChild(sub);
    card.appendChild(openEdit);
    card.appendChild(commentBtn);
    brigadesGrid.appendChild(card);
  }
}

function applyRoleToBrigadesPage() {
  if (!brigadesPageTitle) return;
  if (activeSession?.role === "supervisor") {
    brigadesPageTitle.textContent = "Доски бригад на показ";
    if (brigadesPageHint) brigadesPageHint.style.display = "";
  } else {
    brigadesPageTitle.textContent = "Список бригад доступен начальнику";
    if (brigadesPageHint) brigadesPageHint.style.display = "none";
  }
}

function setBoardEditable(editable) {
  const readOnly = !editable;
  boardPage.classList.toggle("board-readonly", readOnly);
  if (wbReadOnlyBanner) wbReadOnlyBanner.hidden = editable;
}

function formatCommentDate(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("ru-RU");
}

function renderSupervisorComments(comments = []) {
  if (!supervisorCommentsList) return;
  supervisorCommentsList.replaceChildren();
  if (!comments.length) {
    const empty = document.createElement("p");
    empty.className = "supervisor-comments-empty";
    empty.textContent = "Комментариев пока нет.";
    supervisorCommentsList.appendChild(empty);
    return;
  }
  comments.forEach((comment) => {
    const item = document.createElement("article");
    item.className = "supervisor-comment-item";
    const meta = document.createElement("div");
    meta.className = "supervisor-comment-item-meta";
    const author = document.createElement("strong");
    author.textContent = comment.authorName || "Начальник";
    const ts = document.createElement("span");
    ts.textContent = formatCommentDate(comment.createdAt);
    meta.appendChild(author);
    meta.appendChild(ts);
    const text = document.createElement("p");
    text.className = "supervisor-comment-item-text";
    text.textContent = comment.body || "";
    item.appendChild(meta);
    item.appendChild(text);
    supervisorCommentsList.appendChild(item);
  });
}

function setSupervisorCommentsStatus(text) {
  if (!supervisorCommentsStatus) return;
  supervisorCommentsStatus.textContent = text || "";
}

async function loadSupervisorComments(bb, boardId) {
  if (!supervisorReviewPage || !activeSession) return;
  setSupervisorCommentsStatus("Загрузка комментариев...");
  try {
    const r = await fetch(`${API_BASE}/board-comments/${bb}/${encodeURIComponent(boardId)}`);
    if (!r.ok) throw new Error("Cannot load comments");
    const payload = await r.json();
    const comments = Array.isArray(payload?.comments) ? payload.comments : [];
    renderSupervisorComments(comments);
    const total = comments.length;
    setSeenCommentCount(bb, boardId, total);
    commentSummaryMap.set(getCommentBoardKey(bb, boardId), total);
    setSupervisorCommentsStatus("");
    if (activeSession?.role === "supervisor") {
      void buildBrigadesGrid();
    } else if (activeSession?.role === "master") {
      void renderMasterBoards();
    }
    return comments;
  } catch {
    renderSupervisorComments([]);
    setSupervisorCommentsStatus("Не удалось загрузить комментарии.");
    return [];
  }
}

function openSupervisorReviewPage(bb, row = {}) {
  if (!supervisorReviewPage || !activeSession) return;
  supervisorReviewBb = bb;
  supervisorReviewBoardId = row.boardId || "board-1";
  if (supervisorReviewTitle) {
    const boardName = row.boardName || supervisorReviewBoardId || "Шаблон";
    supervisorReviewTitle.textContent = `ББ ${bb} — ${boardName}`;
  }
  if (supervisorReviewImage && row.image) {
    supervisorReviewImage.src = row.image;
    supervisorReviewImage.hidden = false;
    if (supervisorReviewImageEmpty) supervisorReviewImageEmpty.hidden = true;
  } else {
    if (supervisorReviewImage) {
      supervisorReviewImage.hidden = true;
      supervisorReviewImage.removeAttribute("src");
    }
    if (supervisorReviewImageEmpty) supervisorReviewImageEmpty.hidden = false;
  }
  if (supervisorCommentInput) supervisorCommentInput.value = "";
  if (supervisorCommentsForm) {
    supervisorCommentsForm.hidden = false;
  }
  renderSupervisorComments([]);
  setSupervisorCommentsStatus("");
  void loadSupervisorComments(supervisorReviewBb, supervisorReviewBoardId);
  brigadesPage.classList.remove("open");
  masterBoardsPage.classList.remove("open");
  boardPage.classList.remove("open");
  supervisorReviewPage.classList.add("open");
}

function closeSupervisorReviewPage() {
  if (!supervisorReviewPage) return;
  supervisorReviewPage.classList.remove("open");
  if (supervisorReviewImage) {
    supervisorReviewImage.hidden = true;
    supervisorReviewImage.removeAttribute("src");
  }
  if (supervisorReviewImageEmpty) supervisorReviewImageEmpty.hidden = false;
  supervisorReviewBb = null;
  supervisorReviewBoardId = "board-1";
  setSupervisorCommentsStatus("");
  renderSupervisorComments([]);
  if (activeSession?.role === "master") {
    masterBoardsPage.classList.add("open");
    setBoardUiMode(true);
  } else if (activeSession?.role === "supervisor") {
    brigadesPage.classList.add("open");
    setBoardUiMode(false);
  }
}

function openBoard(bb, boardId = "board-1", boardName = "Шаблон 1") {
  currentOpenBb = bb;
  currentOpenBoardId = boardId;
  currentOpenBoardName = boardName;
  updateBoardBackButton();
  setBoardEditable(canEditBoard());
  boardTitle.textContent = `Оперативная доска — ББ ${bb} • ${boardName}`;
  const params = new URLSearchParams({
    bb: String(bb),
    board: boardId,
    readonly: canEditBoard() ? "0" : "1",
    v: "20260511-8",
  });
  fabricBoardFrame.src = `test.html?${params.toString()}`;
  setBoardUiMode(true);
  brigadesPage.classList.remove("open");
  if (supervisorReviewPage) supervisorReviewPage.classList.remove("open");
  masterBoardsPage.classList.remove("open");
  boardPage.classList.add("open");
}

function requestFabricSave(options = {}, onDone = null) {
  const frameWindow = fabricBoardFrame?.contentWindow;
  if (!frameWindow) {
    if (onDone) onDone();
    return;
  }
  pendingFabricSaveAction = onDone;
  frameWindow.postMessage(
    {
      type: "fabric-save-request",
      chooseArea: Boolean(options.chooseArea),
    },
    "*",
  );
}

function closeBoardToPreviousScreen() {
  boardPage.classList.remove("open");
  fabricBoardFrame.src = "about:blank";
  if (activeSession?.role === "supervisor") {
    setBoardUiMode(false);
    void buildBrigadesGrid();
    brigadesPage.classList.add("open");
  } else {
    setBoardUiMode(true);
    void renderMasterBoards();
    masterBoardsPage.classList.add("open");
  }
}

function applyAuthenticatedSession(session) {
  if (!session) return;
  activeSession = session;
  if (burgerMenu) burgerMenu.style.display = "";
  if (sidePanel) sidePanel.style.display = "";
  updateWelcomeHeading();
  updateNavBoardsLabel();
  void buildBrigadesGrid();
  void renderMasterBoards();
  applyRoleToBrigadesPage();
  updateBoardBackButton();
  page.classList.add("gates-done");
  realm.classList.add("visible");
}

function performLogout() {
  sessionStorage.removeItem("ink-auth-session");
  activeSession = null;

  if (burgerMenu) burgerMenu.style.display = "none";
  if (sidePanel) {
    sidePanel.style.display = "none";
    sidePanel.classList.remove("open");
  }
  burgerIcon.classList.remove("open");

  realm.classList.remove("visible");
  page.classList.remove("gates-done");
  page.classList.remove("opening", "ignite");

  brigadesPage.classList.remove("open");
  masterBoardsPage.classList.remove("open");
  boardPage.classList.remove("open");
  if (fabricBoardFrame) {
    fabricBoardFrame.src = "about:blank";
  }
  if (masterPreviewModal) {
    masterPreviewModal.hidden = true;
    if (masterPreviewImage) masterPreviewImage.removeAttribute("src");
  }
  if (supervisorShowcaseModal) {
    supervisorShowcaseModal.hidden = true;
    if (supervisorShowcaseImage) supervisorShowcaseImage.removeAttribute("src");
  }
  if (supervisorReviewPage) {
    supervisorReviewPage.classList.remove("open");
  }

  const gateBackdrop = document.getElementById("gate-backdrop");
  const gateEntry = document.getElementById("gate-entry");
  if (gateBackdrop) {
    gateBackdrop.classList.remove("hidden", "opening");
  }
  if (gateEntry) {
    gateEntry.classList.remove("hidden", "opening");
  }

  const gateUser = document.getElementById("gate-user");
  const gatePass = document.getElementById("gate-pass");
  const gateError = document.getElementById("gate-error");
  if (gateUser) gateUser.value = "";
  if (gatePass) gatePass.value = "";
  if (gateError) gateError.textContent = "";
}

if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const username = document.getElementById("user").value.trim();
    const password = document.getElementById("pass").value;
    const session = authenticateUser(username, password);
    if (!session) {
      errorEl.textContent = "Неверный логин или пароль.";
      return;
    }
    activeSession = session;
    if (burgerMenu) burgerMenu.style.display = "";
    if (sidePanel) sidePanel.style.display = "";
    updateWelcomeHeading();
    updateNavBoardsLabel();
    void buildBrigadesGrid();
    void renderMasterBoards();
    applyRoleToBrigadesPage();
    updateBoardBackButton();
    btn.disabled = true;
    form.classList.add("hidden");
    page.classList.add("ignite");
    window.setTimeout(() => page.classList.add("opening"), IGNITE_BEFORE_OPEN_MS);
    window.setTimeout(() => {
      page.classList.add("gates-done");
      realm.classList.add("visible");
    }, IGNITE_BEFORE_OPEN_MS + GATE_MS + 120);
  });
} else {
  let restored = null;
  try {
    const raw = sessionStorage.getItem("ink-auth-session");
    if (raw) restored = JSON.parse(raw);
  } catch {}
  const gatePresent = Boolean(document.getElementById("gate-entry"));
  const validRestored =
    restored &&
    (restored.role === "supervisor" || restored.role === "master");

  if (validRestored) {
    applyAuthenticatedSession(restored);
  } else if (gatePresent) {
    activeSession = null;
  } else {
    applyAuthenticatedSession({
      role: "supervisor",
      name: "Гуляев Денис Михайлович",
    });
  }
}

window.addEventListener("ink-auth-success", (event) => {
  applyAuthenticatedSession(event.detail);
});

burgerIcon.addEventListener("click", () => {
  burgerIcon.classList.toggle("open");
  sidePanel.classList.toggle("open");
});

document.querySelectorAll(".side-panel-nav li").forEach((li) => {
  li.addEventListener("click", () => {
    sidePanel.classList.remove("open");
    burgerIcon.classList.remove("open");
    const nav = li.dataset.nav;
    if (nav === "home") {
      setBoardUiMode(false);
      boardPage.classList.remove("open");
      brigadesPage.classList.remove("open");
      if (supervisorReviewPage) supervisorReviewPage.classList.remove("open");
      masterBoardsPage.classList.remove("open");
      return;
    }
    if (nav === "boards") {
      if (!activeSession) return;
      boardPage.classList.remove("open");
      brigadesPage.classList.remove("open");
      if (supervisorReviewPage) supervisorReviewPage.classList.remove("open");
      masterBoardsPage.classList.remove("open");
      if (activeSession.role === "master") {
        setBoardUiMode(true);
        void renderMasterBoards();
        masterBoardsPage.classList.add("open");
      } else {
        setBoardUiMode(false);
        void buildBrigadesGrid();
        brigadesPage.classList.add("open");
      }
    }
  });
});

const sidePanelLogout = document.getElementById("side-panel-logout");
if (sidePanelLogout) {
  sidePanelLogout.addEventListener("click", () => {
    sidePanel.classList.remove("open");
    burgerIcon.classList.remove("open");
    performLogout();
  });
}

document.querySelector(".brigades-back-btn").addEventListener("click", () => {
  brigadesPage.classList.remove("open");
});

if (supervisorReviewBackBtn) {
  supervisorReviewBackBtn.addEventListener("click", () => {
    closeSupervisorReviewPage();
  });
}

if (masterBoardsBackBtn) {
  masterBoardsBackBtn.addEventListener("click", () => {
    setBoardUiMode(false);
    masterBoardsPage.classList.remove("open");
  });
}

if (masterPreviewClose) {
  masterPreviewClose.addEventListener("click", () => {
    masterPreviewModal.hidden = true;
    masterPreviewImage.removeAttribute("src");
  });
}
if (masterPreviewModal) {
  masterPreviewModal.addEventListener("click", (e) => {
    if (e.target !== masterPreviewModal) return;
    masterPreviewModal.hidden = true;
    masterPreviewImage.removeAttribute("src");
  });
}

function closeSupervisorShowcaseModal() {
  if (!supervisorShowcaseModal) return;
  supervisorShowcaseModal.hidden = true;
  if (supervisorShowcaseImage) supervisorShowcaseImage.removeAttribute("src");
}

if (supervisorShowcaseClose) {
  supervisorShowcaseClose.addEventListener("click", closeSupervisorShowcaseModal);
}
if (supervisorShowcaseModal) {
  supervisorShowcaseModal.addEventListener("click", (e) => {
    if (e.target !== supervisorShowcaseModal) return;
    closeSupervisorShowcaseModal();
  });
}
if (supervisorShowcaseOpenFabric) {
  supervisorShowcaseOpenFabric.addEventListener("click", () => {
    if (supervisorModalBb == null) return;
    closeSupervisorShowcaseModal();
    openBoard(supervisorModalBb, supervisorModalBoardId, supervisorModalBoardName);
  });
}

if (supervisorCommentsForm) {
  supervisorCommentsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeSession) return;
    if (!supervisorReviewBb || !supervisorReviewBoardId) return;
    const body = String(supervisorCommentInput?.value || "").trim();
    if (!body) {
      setSupervisorCommentsStatus("Введите комментарий.");
      return;
    }
    if (supervisorCommentSubmit) supervisorCommentSubmit.disabled = true;
    setSupervisorCommentsStatus("Отправка...");
    try {
      const r = await fetch(
        `${API_BASE}/board-comments/${supervisorReviewBb}/${encodeURIComponent(supervisorReviewBoardId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorName: activeSession.name || "Начальник",
            body,
          }),
        },
      );
      if (!r.ok) {
        let msg = "";
        try {
          const payload = await r.json();
          msg = payload?.error || "";
        } catch {}
        throw new Error(msg || "Не удалось отправить комментарий.");
      }
      if (supervisorCommentInput) supervisorCommentInput.value = "";
      setSupervisorCommentsStatus("Комментарий сохранен.");
      await loadSupervisorComments(supervisorReviewBb, supervisorReviewBoardId);
    } catch (err) {
      setSupervisorCommentsStatus(String(err?.message || "Ошибка сохранения комментария."));
    } finally {
      if (supervisorCommentSubmit) supervisorCommentSubmit.disabled = false;
    }
  });
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === "fabric-back-request") {
    closeBoardToPreviousScreen();
    return;
  }
  if (data.type === "fabric-exit-request") {
    // Если у роли нет прав редактирования, выходим без сохранения.
    if (!canEditBoard()) {
      closeBoardToPreviousScreen();
      return;
    }
    requestFabricSave({ chooseArea: true }, closeBoardToPreviousScreen);
    return;
  }
  if (data.type === "fabric-bookmark-request") {
    if (!currentOpenBb || !currentOpenBoardId) return;
    requestFabricSave({ chooseArea: false });
    const list = loadBookmarks();
    const id = `${currentOpenBb}:${currentOpenBoardId}`;
    const exists = list.some((x) => x.id === id);
    if (!exists) {
      list.push({
        id,
        bb: currentOpenBb,
        boardId: currentOpenBoardId,
        boardName: currentOpenBoardName,
        createdAt: Date.now(),
      });
      saveBookmarks(list);
    }
    fabricBoardFrame.contentWindow?.postMessage(
      { type: "fabric-bookmark-done", label: "★ В закладках" },
      "*",
    );
    return;
  }
  if (data.type !== "fabric-save-done") return;
  if (typeof pendingFabricSaveAction === "function") {
    const fn = pendingFabricSaveAction;
    pendingFabricSaveAction = null;
    fn();
    return;
  }
  pendingFabricSaveAction = null;
});

