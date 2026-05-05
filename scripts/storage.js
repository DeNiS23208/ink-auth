const STORAGE_PREFIX = "ink-auth-draw-bb-";

function getBoardStorageKey(bb) {
  return `${STORAGE_PREFIX}${bb}`;
}

function saveBoardToStorage(bb, dataUrl) {
  localStorage.setItem(getBoardStorageKey(bb), dataUrl);
}

function loadBoardFromStorage(bb) {
  return localStorage.getItem(getBoardStorageKey(bb));
}