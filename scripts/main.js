// =========================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ И КОНСТАНТЫ
// =========================
const MAX_HISTORY = 50;
const PALETTE = [
  "#000000",
  "#ffffff",
  "#0d47a1",
  "#1b5e20",
  "#b71c1c",
  "#ff9800",
  "#ffd600",
  "#6a1b9a",
  "#0097a7",
  "#607d8b",
  "#8d6e63",
  "#f06292",
];

let activeSession = null;
let currentBb = null;
let activeTool = "pen";
let isDrawing = false;
let startX = 0;
let startY = 0;
let draftImageData = null;
let history = [];
let historyStep = -1;
let textEditor = null;
let shapeEditor = null;
let activeBoxEditor = null;
let smartDrag = null;
let suppressNextCanvasDown = false;
let textStyle = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
};

// =========================
// ССЫЛКИ НА ЭЛЕМЕНТЫ СТРАНИЦЫ (DOM)
// =========================
const page = document.getElementById("page");
const form = document.getElementById("auth");
const errorEl = document.getElementById("error");
const btn = document.getElementById("submit");
const realm = document.getElementById("realm");

const burgerIcon = document.querySelector(".burger-icon");
const sidePanel = document.querySelector(".side-panel");
const brigadesPage = document.querySelector(".brigades-page");
const boardPage = document.getElementById("board-page");
const brigadesGrid = document.querySelector(".brigades-grid");
const boardTitle = document.getElementById("board-title");
const boardBackBtn = document.querySelector(".board-back-btn");
const wbReadOnlyBanner = document.getElementById("wb-readonly-banner");
const navBoardsItem = document.querySelector(
  '.side-panel li[data-nav="boards"]',
);
const brigadesPageTitle = document.querySelector(".brigades-page h2");
const wbSaveHint = document.getElementById("wb-save-hint");

const paintToolbar = document.getElementById("paint-toolbar");
const paintColor = document.getElementById("paint-color");
const paintSize = document.getElementById("paint-size");
const paintFontFamily = document.getElementById("paint-font-family");
const paintFontSize = document.getElementById("paint-font-size");
const paintBoldBtn = document.getElementById("paint-bold");
const paintItalicBtn = document.getElementById("paint-italic");
const paintUnderlineBtn = document.getElementById("paint-underline");
const paintStrikeBtn = document.getElementById("paint-strike");
const paintPalette = document.getElementById("paint-palette");
const paintUndo = document.getElementById("paint-undo");
const paintClear = document.getElementById("paint-clear");
const paintSave = document.getElementById("paint-save");
const paintExport = document.getElementById("paint-export");
const canvas = document.getElementById("paint-canvas");
const ctx = canvas.getContext("2d");
const paintStage = document.querySelector(".paint-stage");

const GATE_MS = 1350;
const IGNITE_BEFORE_OPEN_MS = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches
  ? 0
  : 760;

// =========================
// ЛОГИКА РОЛЕЙ И НАВИГАЦИИ
// =========================
wrapLetters(realm.querySelector("h1"));
wrapLetters(realm.querySelectorAll("h1")[1]);

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
  if (!boardBackBtn || !activeSession) return;
  boardBackBtn.textContent =
    activeSession.role === "supervisor" ? "← К списку ББ" : "← На главную";
}

function buildBrigadesGrid() {
  brigadesGrid.replaceChildren();
  if (!activeSession || activeSession.role !== "supervisor") return;
  for (let i = 1; i <= 30; i++) {
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

function setHint(text) {
  wbSaveHint.textContent = text;
  if (!text) return;
  window.setTimeout(() => {
    if (wbSaveHint.textContent === text) wbSaveHint.textContent = "";
  }, 2200);
}



// =========================
// СОХРАНЕНИЕ ДОСКИ И ИСТОРИЯ ДЕЙСТВИЙ
// =========================
function pushHistory() {
  const data = canvas.toDataURL("image/png");
  if (history[historyStep] === data) return;
  history = history.slice(0, historyStep + 1);
  history.push(data);
  if (history.length > MAX_HISTORY) history.shift();
  historyStep = history.length - 1;
}

function restoreFromDataUrl(dataUrl) {
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = dataUrl;
}

function persistBoard() {
  if (!currentBb || !canEditBoard()) return;
  saveBoardToStorage(currentBb, canvas.toDataURL("image/png"));
  setHint("Сохранено локально в этом браузере.");
}

function removeTextEditor(commit = false) {
  if (!textEditor) return Promise.resolve();
  if (!commit) {
    textEditor.remove();
    textEditor = null;
    return Promise.resolve();
  }
  return commitTextEditor();
}

function removeShapeEditor(commit = false) {
  if (!shapeEditor) return;
  if (commit) {
    drawShapeEditorToCanvas();
    pushHistory();
    persistBoard();
  }
  shapeEditor.remove();
  shapeEditor = null;
}

function clearCanvas(push = true) {
  removeTextEditor(false);
  removeShapeEditor(false);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (push) pushHistory();
}

function loadBoardDrawing(bb) {
  removeTextEditor(false);
  removeShapeEditor(false);
  currentBb = bb;
  clearCanvas(false);
  history = [];
  historyStep = -1;
  const raw = loadBoardFromStorage(bb);
  if (raw) {
    restoreFromDataUrl(raw);
    history.push(raw);
    historyStep = 0;
  } else {
    pushHistory();
  }
}

// =========================
// БАЗОВЫЕ ИНСТРУМЕНТЫ РИСОВАНИЯ НА CANVAS
// =========================
function canvasPoint(evt) {
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width / r.width;
  const scaleY = canvas.height / r.height;
  return {
    x: (evt.clientX - r.left) * scaleX,
    y: (evt.clientY - r.top) * scaleY,
  };
}

function applyStrokeStyle() {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = paintColor.value;
  ctx.fillStyle = paintColor.value;
  ctx.lineWidth = Number(paintSize.value);
}

function hexToRgba(hex) {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
    255,
  ];
}

function floodFill(startX0, startY0) {
  const sx = Math.floor(startX0);
  const sy = Math.floor(startY0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  const idx = (sy * canvas.width + sx) * 4;
  const target = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  const fill = hexToRgba(paintColor.value);
  if (
    target[0] === fill[0] &&
    target[1] === fill[1] &&
    target[2] === fill[2] &&
    target[3] === fill[3]
  ) {
    return;
  }
  const stack = [[sx, sy]];
  const match = (i) =>
    data[i] === target[0] &&
    data[i + 1] === target[1] &&
    data[i + 2] === target[2] &&
    data[i + 3] === target[3];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
    const i = (y * canvas.width + x) * 4;
    if (!match(i)) continue;
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(img, 0, 0);
}

// =========================
// ТЕКСТОВЫЙ РЕДАКТОР: СТИЛИ, КОММИТ, РЕНДЕР В CANVAS
// =========================
function setTextStyleButtonState() {
  paintBoldBtn.classList.toggle("active", textStyle.bold);
  paintItalicBtn.classList.toggle("active", textStyle.italic);
  paintUnderlineBtn.classList.toggle("active", textStyle.underline);
  paintStrikeBtn.classList.toggle("active", textStyle.strike);
}

function syncColorControlPreview() {
  paintColor.style.setProperty("--paint-color-current", paintColor.value);
}

function updateEditorStyle() {
  if (!textEditor) return;
  const target = textEditor.querySelector(".paint-text-content") || textEditor;
  target.style.fontFamily = textEditor.dataset.fontFamily;
  target.style.fontSize = `${textEditor.dataset.fontSize}px`;
  target.style.color = textEditor.dataset.color;
  target.style.fontWeight = textEditor.dataset.bold === "1" ? "700" : "400";
  target.style.fontStyle =
    textEditor.dataset.italic === "1" ? "italic" : "normal";
  const decorations = [
    textEditor.dataset.underline === "1" ? "underline" : "",
    textEditor.dataset.strike === "1" ? "line-through" : "",
  ]
    .filter(Boolean)
    .join(" ");
  target.style.textDecoration = decorations || "none";
}

function hasSelectedTextInEditor() {
  if (!textEditor) return false;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  if (selection.isCollapsed) return false;
  return (
    textEditor.contains(selection.anchorNode) &&
    textEditor.contains(selection.focusNode)
  );
}

function applyInlineColorToSelection(color) {
  if (!textEditor) return false;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return false;
  const range = selection.getRangeAt(0);
  if (!textEditor.contains(range.commonAncestorContainer)) return false;
  const span = document.createElement("span");
  span.style.color = color;
  try {
    range.surroundContents(span);
  } catch {
    // Fallback for partially selected complex nodes.
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }
  selection.removeAllRanges();
  const after = document.createRange();
  after.selectNodeContents(span);
  selection.addRange(after);
  return true;
}

function getTextLinesForWidth(text, maxWidth, fontSpec) {
  ctx.font = fontSpec;
  const lines = [];
  const splitLongWord = (word) => {
    const parts = [];
    let part = "";
    for (const ch of Array.from(word)) {
      const test = part + ch;
      if (ctx.measureText(test).width <= maxWidth || !part) {
        part = test;
      } else {
        parts.push(part);
        part = ch;
      }
    }
    if (part) parts.push(part);
    return parts;
  };
  const rawLines = text.split("\n");
  rawLines.forEach((raw) => {
    if (!raw.trim()) {
      lines.push("");
      return;
    }
    const words = raw.split(/\s+/);
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        if (ctx.measureText(word).width <= maxWidth) {
          line = word;
        } else {
          const chunks = splitLongWord(word);
          chunks.forEach((chunk, idx) => {
            if (idx < chunks.length - 1) lines.push(chunk);
          });
          line = chunks[chunks.length - 1] || "";
        }
      }
    });
    lines.push(line);
  });
  return lines;
}

function buildSerializedEditorHtml(target, cssW, cssH) {
  const root = target.cloneNode(true);
  const all = [root, ...root.querySelectorAll("*")];
  const sourceAll = [target, ...target.querySelectorAll("*")];
  all.forEach((el, idx) => {
    const src = sourceAll[idx];
    if (!src || !(el instanceof HTMLElement) || !(src instanceof HTMLElement))
      return;
    const cs = window.getComputedStyle(src);
    el.style.fontFamily = cs.fontFamily;
    el.style.fontSize = cs.fontSize;
    el.style.fontWeight = cs.fontWeight;
    el.style.fontStyle = cs.fontStyle;
    el.style.lineHeight = cs.lineHeight;
    el.style.letterSpacing = cs.letterSpacing;
    el.style.color = cs.color;
    el.style.textDecoration = cs.textDecoration;
    el.style.whiteSpace = cs.whiteSpace;
    el.style.wordBreak = cs.wordBreak;
    el.style.overflowWrap = cs.overflowWrap;
    el.style.margin = "0";
    el.removeAttribute("size");
    el.removeAttribute("face");
    el.removeAttribute("color");
    el.removeAttribute("contenteditable");
  });
  if (root instanceof HTMLElement) {
    root.style.width = `${cssW}px`;
    root.style.height = `${cssH}px`;
    root.style.boxSizing = "border-box";
    root.style.overflow = "hidden";
    root.style.margin = "0";
  }
  return root.outerHTML;
}

function drawTextEditorToCanvas(editor) {
  if (!editor) return Promise.resolve(false);
  const canvasRect = canvas.getBoundingClientRect();
  const cssScaleX = canvasRect.width / canvas.width;
  const cssScaleY = canvasRect.height / canvas.height;
  const x = Number.parseFloat(editor.dataset.cx);
  const y = Number.parseFloat(editor.dataset.cy);
  const w = Number.parseFloat(editor.dataset.cw);
  const h = Number.parseFloat(editor.dataset.ch);
  const cssW = Math.max(1, w * cssScaleX);
  const cssH = Math.max(1, h * cssScaleY);
  const boxed = editor.dataset.boxed === "1";
  const target = editor.querySelector(".paint-text-content") || editor;
  const text = target.innerText.replace(/\r/g, "");
  if (!text.trim() && !boxed) return Promise.resolve(false);
  const cs = window.getComputedStyle(target);
  const escapeAttr = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  const fontFamily = cs.fontFamily || editor.dataset.fontFamily;
  const fontSize = cs.fontSize || `${editor.dataset.fontSize}px`;
  const fontWeight =
    cs.fontWeight || (editor.dataset.bold === "1" ? "700" : "400");
  const fontStyle =
    cs.fontStyle || (editor.dataset.italic === "1" ? "italic" : "normal");
  const lineHeight =
    cs.lineHeight && cs.lineHeight !== "normal"
      ? cs.lineHeight
      : `${Math.max(12, Number.parseInt(editor.dataset.fontSize, 10) * 1.28)}px`;
  const letterSpacing = cs.letterSpacing || "normal";
  const textDecoration = cs.textDecoration || "none";
  const paddingTop = cs.paddingTop || "0px";
  const paddingRight = cs.paddingRight || "0px";
  const paddingBottom = cs.paddingBottom || "0px";
  const paddingLeft = cs.paddingLeft || "0px";
  const serializedHtml = buildSerializedEditorHtml(target, cssW, cssH);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${cssW}" height="${cssH}" viewBox="0 0 ${cssW} ${cssH}">
  <foreignObject x="0" y="0" width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml"
      style="
        width:${cssW}px;
        height:${cssH}px;
        box-sizing:border-box;
        overflow:hidden;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
        word-break:break-word;
        font-family:${escapeAttr(fontFamily)};
        font-size:${escapeAttr(fontSize)};
        line-height:${escapeAttr(lineHeight)};
        letter-spacing:${escapeAttr(letterSpacing)};
        color:${escapeAttr(cs.color || editor.dataset.color)};
        font-weight:${escapeAttr(fontWeight)};
        font-style:${escapeAttr(fontStyle)};
        text-decoration:${escapeAttr(textDecoration)};
        padding:${escapeAttr(paddingTop)} ${escapeAttr(paddingRight)} ${escapeAttr(paddingBottom)} ${escapeAttr(paddingLeft)};
        margin:0;
      "
    >${serializedHtml}</div>
  </foreignObject>
</svg>`;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, x, y, w, h);
      if (boxed) {
        ctx.save();
        ctx.strokeStyle = editor.dataset.color;
        ctx.lineWidth = Math.max(1, Number(editor.dataset.fontSize) / 16);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
      }
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

async function commitTextEditor() {
  if (!textEditor) return;
  const editor = textEditor;
  textEditor = null;
  const drawn = await drawTextEditorToCanvas(editor);
  editor.remove();
  if (drawn) {
    pushHistory();
    persistBoard();
  }
}

// =========================
// РАМКИ И ФИГУРЫ (ПРЯМОУГОЛЬНИК, КРУГ, SMART-ХЭНДЛЫ)
// =========================
function drawShapeEditorToCanvas() {
  if (!shapeEditor) return;
  const stageRect = paintStage.getBoundingClientRect();
  const boxRect = shapeEditor.getBoundingClientRect();
  const scaleX = canvas.width / stageRect.width;
  const scaleY = canvas.height / stageRect.height;
  const x = (boxRect.left - stageRect.left) * scaleX;
  const y = (boxRect.top - stageRect.top) * scaleY;
  const w = boxRect.width * scaleX;
  const h = boxRect.height * scaleY;
  ctx.save();
  ctx.strokeStyle = shapeEditor.dataset.color || paintColor.value;
  ctx.lineWidth = Number.parseFloat(
    shapeEditor.dataset.size || paintSize.value,
  );
  if (shapeEditor.dataset.tool === "rect") {
    ctx.strokeRect(x, y, w, h);
  } else if (shapeEditor.dataset.tool === "circle") {
    ctx.beginPath();
    ctx.ellipse(
      x + w / 2,
      y + h / 2,
      Math.abs(w / 2),
      Math.abs(h / 2),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function createTextEditor(x1, y1, x2, y2, boxed = false, smart = false) {
  removeTextEditor(false);
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.max(boxed ? 120 : 40, Math.abs(x2 - x1));
  const h = Math.max(28, Math.abs(y2 - y1));
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  const editor = document.createElement("div");
  editor.className = "paint-textbox";
  if (boxed) editor.classList.add("paint-textbox-boxed");
  if (smart) editor.classList.add("paint-textbox-smart");
  if (smart) {
    editor.contentEditable = "false";
    const content = document.createElement("div");
    content.className = "paint-text-content";
    content.contentEditable = "true";
    editor.appendChild(content);
  } else {
    editor.contentEditable = "true";
  }
  editor.style.left = `${minX * scaleX}px`;
  editor.style.top = `${minY * scaleY}px`;
  editor.style.width = `${w * scaleX}px`;
  editor.style.height = `${h * scaleY}px`;
  editor.dataset.cx = String(minX);
  editor.dataset.cy = String(minY);
  editor.dataset.cw = String(w);
  editor.dataset.ch = String(h);
  editor.dataset.fontSize = paintFontSize.value;
  editor.dataset.fontFamily = paintFontFamily.value;
  editor.dataset.color = paintColor.value;
  editor.dataset.bold = textStyle.bold ? "1" : "0";
  editor.dataset.italic = textStyle.italic ? "1" : "0";
  editor.dataset.underline = textStyle.underline ? "1" : "0";
  editor.dataset.strike = textStyle.strike ? "1" : "0";
  editor.dataset.boxed = boxed ? "1" : "0";
  editor.dataset.smart = smart ? "1" : "0";
  paintStage.appendChild(editor);
  textEditor = editor;
  activeBoxEditor = editor;
  if (smart) {
    addSmartHandles(textEditor);
  }
  updateEditorStyle();
  const focusTarget = textEditor.querySelector(".paint-text-content") || editor;
  window.setTimeout(() => focusTarget.focus(), 0);
  focusTarget.addEventListener("input", autoGrowTextEditor);
}

function autoGrowTextEditor() {
  if (!textEditor) return;
  const target = textEditor.querySelector(".paint-text-content") || textEditor;
  const stageRect = paintStage.getBoundingClientRect();
  const boxRect = textEditor.getBoundingClientRect();
  const maxWidth = stageRect.right - boxRect.left;
  const maxHeight = stageRect.bottom - boxRect.top;
  const overW = target.scrollWidth > target.clientWidth + 1;
  const overH = target.scrollHeight > target.clientHeight + 1;
  let needW = boxRect.width;
  let needH = boxRect.height;
  if (overW) {
    needW = Math.min(maxWidth, target.scrollWidth + 12);
  }
  if (overH) {
    needH = Math.min(maxHeight, target.scrollHeight + 8);
  }
  if (!overW && !overH) return;
  textEditor.style.width = `${needW}px`;
  textEditor.style.height = `${needH}px`;
  const scaleX = canvas.width / stageRect.width;
  const scaleY = canvas.height / stageRect.height;
  textEditor.dataset.cw = String(needW * scaleX);
  textEditor.dataset.ch = String(needH * scaleY);
}

function addSmartHandles(editor) {
  const mk = (cls) => {
    const h = document.createElement("div");
    h.className = `paint-smart-handle ${cls}`;
    h.dataset.role = cls;
    h.contentEditable = "false";
    h.setAttribute("tabindex", "-1");
    return h;
  };
  editor.appendChild(mk("tl"));
  editor.appendChild(mk("tr"));
  editor.appendChild(mk("bl"));
  editor.appendChild(mk("br"));
  const mover = document.createElement("div");
  mover.className = "paint-smart-move";
  mover.dataset.role = "move";
  mover.contentEditable = "false";
  mover.setAttribute("tabindex", "-1");
  editor.appendChild(mover);
}

function createShapeEditor(tool, x1, y1, x2, y2) {
  removeShapeEditor(false);
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.max(24, Math.abs(x2 - x1));
  const h = Math.max(24, Math.abs(y2 - y1));
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  const box = document.createElement("div");
  box.className = "paint-shapebox";
  box.style.left = `${minX * scaleX}px`;
  box.style.top = `${minY * scaleY}px`;
  box.style.width = `${w * scaleX}px`;
  box.style.height = `${h * scaleY}px`;
  box.dataset.tool = tool;
  box.dataset.color = paintColor.value;
  box.dataset.size = paintSize.value;
  addSmartHandles(box);
  paintStage.appendChild(box);
  shapeEditor = box;
  activeBoxEditor = box;
}

// =========================
// ЖИЗНЕННЫЙ ЦИКЛ РИСОВАНИЯ (POINTER DOWN/MOVE/UP)
// =========================
function setCanvasCursor() {
  const cursorMap = {
    pen: "crosshair",
    eraser: "cell",
    line: "crosshair",
    rect: "nwse-resize",
    circle: "crosshair",
    fill: "copy",
    text: "text",
    textbox: "text",
    smartbox: "move",
  };
  canvas.style.cursor = cursorMap[activeTool] || "crosshair";
}

async function startDraw(evt) {
  if (!canEditBoard()) return;
  if (suppressNextCanvasDown) {
    suppressNextCanvasDown = false;
    return;
  }
  if (textEditor && !textEditor.contains(evt.target)) {
    await removeTextEditor(true);
    return;
  }
  if (shapeEditor && !shapeEditor.contains(evt.target)) {
    removeShapeEditor(true);
    return;
  }
  await removeTextEditor(true);
  removeShapeEditor(true);
  const p = canvasPoint(evt);
  isDrawing = true;
  startX = p.x;
  startY = p.y;
  draftImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyStrokeStyle();

  if (activeTool === "fill") {
    floodFill(startX, startY);
    pushHistory();
    persistBoard();
    isDrawing = false;
    return;
  }
  if (activeTool === "pen" || activeTool === "eraser") {
    ctx.globalCompositeOperation =
      activeTool === "eraser" ? "destination-out" : "source-over";
    ctx.beginPath();
    ctx.moveTo(startX, startY);
  }
}

function moveDraw(evt) {
  if (!isDrawing || !canEditBoard()) return;
  const p = canvasPoint(evt);
  if (activeTool === "pen" || activeTool === "eraser") {
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    return;
  }
  if (!draftImageData) return;
  ctx.putImageData(draftImageData, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  if (
    activeTool === "text" ||
    activeTool === "textbox" ||
    activeTool === "smartbox"
  ) {
    ctx.save();
    ctx.setLineDash([9, 6]);
    ctx.strokeStyle = paintColor.value;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
    ctx.restore();
    return;
  }
  if (activeTool === "line") {
    ctx.moveTo(startX, startY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    return;
  }
  if (activeTool === "rect") {
    ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
    return;
  }
  if (activeTool === "circle") {
    const rx = (p.x - startX) / 2;
    const ry = (p.y - startY) / 2;
    const cx = startX + rx;
    const cy = startY + ry;
    ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function endDraw(evt) {
  if (!isDrawing || !canEditBoard()) return;
  isDrawing = false;
  ctx.globalCompositeOperation = "source-over";
  if (activeTool === "fill") return;
  if (
    activeTool === "text" ||
    activeTool === "textbox" ||
    activeTool === "smartbox"
  ) {
    const p = evt ? canvasPoint(evt) : { x: startX + 120, y: startY + 60 };
    if (draftImageData) ctx.putImageData(draftImageData, 0, 0);
    createTextEditor(
      startX,
      startY,
      p.x,
      p.y,
      activeTool === "textbox" || activeTool === "smartbox",
      activeTool === "smartbox",
    );
    return;
  }
  if (activeTool === "rect" || activeTool === "circle") {
    const p = evt ? canvasPoint(evt) : { x: startX + 100, y: startY + 80 };
    if (draftImageData) ctx.putImageData(draftImageData, 0, 0);
    createShapeEditor(activeTool, startX, startY, p.x, p.y);
    return;
  }
  pushHistory();
  persistBoard();
}

async function setActiveTool(tool) {
  await removeTextEditor(true);
  removeShapeEditor(true);
  activeTool = tool;
  paintToolbar
    .querySelectorAll("button[data-tool]")
    .forEach((x) => x.classList.toggle("active", x.dataset.tool === tool));
  setCanvasCursor();
}

function setBoardEditable(editable) {
  const ro = !editable;
  boardPage.classList.toggle("board-readonly", ro);
  if (wbReadOnlyBanner) wbReadOnlyBanner.hidden = editable;
  paintToolbar.classList.toggle("paint-toolbar-disabled", ro);
  paintToolbar.querySelectorAll("button, input, select").forEach((el) => {
    el.disabled = ro;
  });
  if (ro) {
    removeTextEditor(false);
    removeShapeEditor(false);
  }
}

function openBoard(bb) {
  updateBoardBackButton();
  loadBoardDrawing(bb);
  const viewOnly = activeSession?.role === "supervisor";
  boardTitle.textContent = viewOnly
    ? `Оперативная доска — ББ ${bb} (просмотр)`
    : `Оперативная доска — ББ ${bb}`;
  setBoardEditable(canEditBoard());
  brigadesPage.classList.remove("open");
  boardPage.classList.add("open");
  burgerIcon.classList.remove("open");
  sidePanel.classList.remove("open");
}

// =========================
// СОБЫТИЯ ИНТЕРФЕЙСА: ФОРМА, МЕНЮ, ТУЛБАР
// =========================
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
  updateWelcomeHeading();
  updateNavBoardsLabel();
  buildBrigadesGrid();
  applyRoleToBrigadesPage();
  updateBoardBackButton();
  btn.disabled = true;
  form.classList.add("hidden");
  page.classList.add("ignite");
  window.setTimeout(() => page.classList.add("opening"), IGNITE_BEFORE_OPEN_MS);
  window.setTimeout(
    () => {
      page.classList.add("gates-done");
      realm.classList.add("visible");
    },
    IGNITE_BEFORE_OPEN_MS + GATE_MS + 120,
  );
});

burgerIcon.addEventListener("click", () => {
  burgerIcon.classList.toggle("open");
  sidePanel.classList.toggle("open");
});

document.querySelectorAll(".side-panel li").forEach((li) => {
  li.addEventListener("click", () => {
    sidePanel.classList.remove("open");
    burgerIcon.classList.remove("open");
    const nav = li.dataset.nav;
    if (nav === "home") {
      boardPage.classList.remove("open");
      brigadesPage.classList.remove("open");
      return;
    }
    if (nav === "boards") {
      if (!activeSession) return;
      boardPage.classList.remove("open");
      if (activeSession.role === "master") {
        openBoard(activeSession.bb);
      } else {
        brigadesPage.classList.add("open");
      }
    }
  });
});

document.querySelector(".brigades-back-btn").addEventListener("click", () => {
  brigadesPage.classList.remove("open");
});

document
  .querySelector(".board-back-btn")
  .addEventListener("click", async () => {
    await removeTextEditor(true);
    removeShapeEditor(true);
    boardPage.classList.remove("open");
    if (activeSession?.role === "supervisor")
      brigadesPage.classList.add("open");
  });

paintToolbar.querySelectorAll("button[data-tool]").forEach((btnEl) => {
  btnEl.addEventListener("click", async () =>
    setActiveTool(btnEl.dataset.tool),
  );
});

paintUndo.addEventListener("click", () => {
  if (!canEditBoard()) return;
  if (historyStep <= 0) return;
  removeTextEditor(false);
  removeShapeEditor(false);
  historyStep -= 1;
  restoreFromDataUrl(history[historyStep]);
  persistBoard();
});

paintClear.addEventListener("click", () => {
  if (!canEditBoard()) return;
  clearCanvas(true);
  persistBoard();
});

paintSave.addEventListener("click", async () => {
  if (!canEditBoard()) return;
  await removeTextEditor(true);
  removeShapeEditor(true);
  persistBoard();
});

paintExport.addEventListener("click", async () => {
  await removeTextEditor(true);
  removeShapeEditor(true);
  const a = document.createElement("a");
  const bb = currentBb ?? "x";
  a.href = canvas.toDataURL("image/png");
  a.download = `bb-${bb}-board.png`;
  a.click();
});

paintFontFamily.addEventListener("change", () => {
  if (!textEditor) return;
  if (hasSelectedTextInEditor()) {
    document.execCommand("fontName", false, paintFontFamily.value);
    autoGrowTextEditor();
    return;
  }
  textEditor.dataset.fontFamily = paintFontFamily.value;
  updateEditorStyle();
});
paintFontSize.addEventListener("input", () => {
  if (!textEditor) return;
  if (hasSelectedTextInEditor()) {
    document.execCommand("fontSize", false, "7");
    textEditor.querySelectorAll('font[size="7"]').forEach((node) => {
      node.removeAttribute("size");
      node.style.fontSize = `${paintFontSize.value}px`;
    });
    autoGrowTextEditor();
    return;
  }
  textEditor.dataset.fontSize = paintFontSize.value;
  updateEditorStyle();
});
paintColor.addEventListener("input", () => {
  syncColorControlPreview();
  if (!textEditor) return;
  if (hasSelectedTextInEditor()) {
    if (applyInlineColorToSelection(paintColor.value)) {
      autoGrowTextEditor();
      return;
    }
  }
  textEditor.dataset.color = paintColor.value;
  updateEditorStyle();
});

function applyTextStyleToggle(styleKey, command) {
  if (hasSelectedTextInEditor()) {
    document.execCommand(command, false);
    autoGrowTextEditor();
    return;
  }
  textStyle[styleKey] = !textStyle[styleKey];
  setTextStyleButtonState();
  if (!textEditor) return;
  textEditor.dataset[styleKey] = textStyle[styleKey] ? "1" : "0";
  updateEditorStyle();
}

paintBoldBtn.addEventListener("click", () =>
  applyTextStyleToggle("bold", "bold"),
);
paintItalicBtn.addEventListener("click", () =>
  applyTextStyleToggle("italic", "italic"),
);
paintUnderlineBtn.addEventListener("click", () =>
  applyTextStyleToggle("underline", "underline"),
);
paintStrikeBtn.addEventListener("click", () =>
  applyTextStyleToggle("strike", "strikeThrough"),
);

[paintBoldBtn, paintItalicBtn, paintUnderlineBtn, paintStrikeBtn].forEach(
  (el) => {
    el.addEventListener("mousedown", (e) => {
      if (textEditor) e.preventDefault();
    });
  },
);

// =========================
// СОБЫТИЯ CANVAS И SMART-РАМОК
// =========================
canvas.addEventListener("pointerdown", startDraw);
canvas.addEventListener("pointermove", moveDraw);
canvas.addEventListener("pointerup", endDraw);
canvas.addEventListener("pointerleave", endDraw);

paintStage.addEventListener("pointerdown", (e) => {
  if (!canEditBoard()) return;
  const box =
    textEditor && textEditor.contains(e.target)
      ? textEditor
      : shapeEditor && shapeEditor.contains(e.target)
        ? shapeEditor
        : null;
  if (!box) return;
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (
    !target.classList.contains("paint-smart-handle") &&
    !target.classList.contains("paint-smart-move")
  ) {
    return;
  }
  if (target.parentElement !== box) return;
  e.preventDefault();
  const rect = box.getBoundingClientRect();
  activeBoxEditor = box;
  smartDrag = {
    role: target.dataset.role || "move",
    startX: e.clientX,
    startY: e.clientY,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
});

window.addEventListener("pointermove", (e) => {
  if (!smartDrag || !activeBoxEditor) return;
  const dx = e.clientX - smartDrag.startX;
  const dy = e.clientY - smartDrag.startY;
  let left = smartDrag.left;
  let top = smartDrag.top;
  let width = smartDrag.width;
  let height = smartDrag.height;
  const minW = 40;
  const minH = 28;

  if (smartDrag.role === "move") {
    left += dx;
    top += dy;
  } else {
    if (smartDrag.role.includes("l")) {
      left += dx;
      width -= dx;
    }
    if (smartDrag.role.includes("r")) {
      width += dx;
    }
    if (smartDrag.role.includes("t")) {
      top += dy;
      height -= dy;
    }
    if (smartDrag.role.includes("b")) {
      height += dy;
    }
    if (width < minW) {
      if (smartDrag.role.includes("l")) left -= minW - width;
      width = minW;
    }
    if (height < minH) {
      if (smartDrag.role.includes("t")) top -= minH - height;
      height = minH;
    }
  }

  const stageRect = paintStage.getBoundingClientRect();
  left = Math.max(stageRect.left, Math.min(left, stageRect.right - width));
  top = Math.max(stageRect.top, Math.min(top, stageRect.bottom - height));

  activeBoxEditor.style.left = `${left - stageRect.left}px`;
  activeBoxEditor.style.top = `${top - stageRect.top}px`;
  activeBoxEditor.style.width = `${width}px`;
  activeBoxEditor.style.height = `${height}px`;
  const scaleX = canvas.width / stageRect.width;
  const scaleY = canvas.height / stageRect.height;
  activeBoxEditor.dataset.cx = String((left - stageRect.left) * scaleX);
  activeBoxEditor.dataset.cy = String((top - stageRect.top) * scaleY);
  activeBoxEditor.dataset.cw = String(width * scaleX);
  activeBoxEditor.dataset.ch = String(height * scaleY);
});

window.addEventListener("pointerup", () => {
  smartDrag = null;
  activeBoxEditor = null;
});

// =========================
// ГЛОБАЛЬНЫЕ СОБЫТИЯ (ВНЕШНИЕ КЛИКИ, ГОРЯЧИЕ КЛАВИШИ)
// =========================
document.addEventListener(
  "pointerdown",
  async (e) => {
    if (!canEditBoard()) return;
    if (paintToolbar.contains(e.target)) return;
    if (
      textEditor &&
      e.target !== textEditor &&
      !textEditor.contains(e.target)
    ) {
      // Outside click commits current text box and must not start a new draw in same click.
      e.preventDefault();
      e.stopPropagation();
      suppressNextCanvasDown = true;
      await removeTextEditor(true);
      return;
    }
    if (
      shapeEditor &&
      e.target !== shapeEditor &&
      !shapeEditor.contains(e.target)
    ) {
      e.preventDefault();
      e.stopPropagation();
      suppressNextCanvasDown = true;
      removeShapeEditor(true);
      return;
    }
  },
  true,
);

window.addEventListener("keydown", (e) => {
  if ((textEditor || shapeEditor) && e.key === "Escape") {
    e.preventDefault();
    removeTextEditor(false);
    removeShapeEditor(false);
    return;
  }
  if (
    (textEditor || shapeEditor) &&
    (e.ctrlKey || e.metaKey) &&
    e.key === "Enter"
  ) {
    e.preventDefault();
    removeTextEditor(true);
    removeShapeEditor(true);
    return;
  }
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) return;
  if (
    e.code === "KeyZ" ||
    e.key.toLowerCase() === "z" ||
    e.key.toLowerCase() === "я"
  ) {
    e.preventDefault();
    paintUndo.click();
  }
});

// =========================
// ПАЛИТРА ЦВЕТОВ И СТАРТОВАЯ ИНИЦИАЛИЗАЦИЯ
// =========================
function renderPalette() {
  paintPalette.replaceChildren();
  PALETTE.forEach((hex) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "paint-swatch";
    b.style.background = hex;
    b.title = hex;
    b.addEventListener("click", () => {
      paintColor.value = hex;
      syncColorControlPreview();
      if (textEditor) {
        textEditor.dataset.color = hex;
        updateEditorStyle();
      }
    });
    paintPalette.appendChild(b);
  });
}

renderPalette();
syncColorControlPreview();
setTextStyleButtonState();
setActiveTool("pen");
