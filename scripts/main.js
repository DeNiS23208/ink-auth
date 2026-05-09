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
const API_BASE = "/api";

if (burgerMenu) burgerMenu.style.display = "none";
if (sidePanel) sidePanel.style.display = "none";

if (realm?.querySelector("h1")) wrapLetters(realm.querySelector("h1"));
if (realm?.querySelectorAll("h1")[1]) wrapLetters(realm.querySelectorAll("h1")[1]);

function canEditBoard() {
  return activeSession?.role === "master";
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

async function renderMasterBoards() {
  if (!activeSession || activeSession.role !== "master") return;
  masterBoardsGrid.replaceChildren();
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
  const addItem = document.createElement("div");
  addItem.className = "master-template-item";
  boards.forEach((board) => {
    const item = document.createElement("div");
    item.className = "master-template-item";
    const cube = document.createElement("button");
    cube.type = "button";
    cube.className = "master-template-cube master-board-cube";
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
    cube.addEventListener("click", () => {
      currentMasterBoardId = board.id;
      openBoard(activeSession.bb, board.id, board.name);
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
    actions.appendChild(deleteBtn);
    cube.appendChild(actions);
    const title = document.createElement("div");
    title.className = "master-template-title";
    title.textContent = board.name;
    item.appendChild(cube);
    item.appendChild(title);
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

function buildBrigadesGrid() {
  brigadesGrid.replaceChildren();
  if (!activeSession || activeSession.role !== "supervisor") return;
  for (let i = 1; i <= 30; i += 1) {
    const cube = document.createElement("button");
    cube.type = "button";
    cube.className = "brigade-cube";
    cube.textContent = `ББ${i}`;
    cube.addEventListener("click", () => openBoard(i));
    brigadesGrid.appendChild(cube);
  }
}

function applyRoleToBrigadesPage() {
  if (!brigadesPageTitle) return;
  brigadesPageTitle.textContent =
    activeSession?.role === "supervisor"
      ? "Выберите буровую бригаду"
      : "Список бригад доступен начальнику";
}

function setBoardEditable(editable) {
  const readOnly = !editable;
  boardPage.classList.toggle("board-readonly", readOnly);
  if (wbReadOnlyBanner) wbReadOnlyBanner.hidden = editable;
}

function openBoard(bb, boardId = "board-1", boardName = "Шаблон 1") {
  currentOpenBb = bb;
  currentOpenBoardId = boardId;
  currentOpenBoardName = boardName;
  updateBoardBackButton();
  setBoardEditable(canEditBoard());
  const viewOnly = activeSession?.role === "supervisor";
  boardTitle.textContent = viewOnly
    ? `Оперативная доска — ББ ${bb} • ${boardName} (просмотр)`
    : `Оперативная доска — ББ ${bb} • ${boardName}`;
  const params = new URLSearchParams({
    bb: String(bb),
    board: boardId,
    readonly: canEditBoard() ? "0" : "1",
    v: "20260509-3",
  });
  fabricBoardFrame.src = `test.html?${params.toString()}`;
  setBoardUiMode(true);
  brigadesPage.classList.remove("open");
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

function applyAuthenticatedSession(session) {
  if (!session) return;
  activeSession = session;
  if (burgerMenu) burgerMenu.style.display = "";
  if (sidePanel) sidePanel.style.display = "";
  updateWelcomeHeading();
  updateNavBoardsLabel();
  buildBrigadesGrid();
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
    buildBrigadesGrid();
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
      masterBoardsPage.classList.remove("open");
      return;
    }
    if (nav === "boards") {
      if (!activeSession) return;
      boardPage.classList.remove("open");
      brigadesPage.classList.remove("open");
      masterBoardsPage.classList.remove("open");
      if (activeSession.role === "master") {
        setBoardUiMode(true);
        void renderMasterBoards();
        masterBoardsPage.classList.add("open");
      } else {
        setBoardUiMode(false);
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

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === "fabric-exit-request") {
    requestFabricSave({ chooseArea: true }, () => {
      boardPage.classList.remove("open");
      fabricBoardFrame.src = "about:blank";
      if (activeSession?.role === "supervisor") {
        setBoardUiMode(false);
        brigadesPage.classList.add("open");
      } else {
        setBoardUiMode(true);
        void renderMasterBoards();
        masterBoardsPage.classList.add("open");
      }
    });
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

