import { wrapLetters } from "./utils.js";
/** Подставьте свои данные или замените на запрос к серверу. */
const AUTH = {
  username: "ink",
  password: "ink",
};

const page = document.getElementById("page");
const form = document.getElementById("auth");
const errorEl = document.getElementById("error");
const btn = document.getElementById("submit");
const realm = document.getElementById("realm");



wrapLetters(realm.querySelector("h1"));
const secondElement =
  realm.querySelector("p") || realm.querySelectorAll("h1")[1];
wrapLetters(secondElement);

const GATE_MS = 1350;
/** Сначала «зажигание» букв, затем расхождение створок */
const IGNITE_BEFORE_OPEN_MS = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches
  ? 0
  : 760;

form.addEventListener("submit", (e) => {
  e.preventDefault();
  errorEl.textContent = "";

  const username = document.getElementById("user").value.trim();
  const password = document.getElementById("pass").value;

  const ok = username === AUTH.username && password === AUTH.password;

  if (!ok) {
    errorEl.textContent = "Неверный логин или пароль.";
    return;
  }

  btn.disabled = true;
  form.classList.add("hidden");
  page.classList.add("ignite");
  window.setTimeout(() => {
    page.classList.add("opening");
  }, IGNITE_BEFORE_OPEN_MS);

  window.setTimeout(
    () => {
      page.classList.add("gates-done");
      realm.classList.add("visible");
    },
    IGNITE_BEFORE_OPEN_MS + GATE_MS + 120,
  );
});

// Burger Menu
const burgerIcon = document.querySelector(".burger-icon");
const sidePanel = document.querySelector(".side-panel");
const brigadesPage = document.querySelector(".brigades-page");
const boardPage = document.querySelector(".board-page");
const brigadesGrid = document.querySelector(".brigades-grid");
const backBtns = document.querySelectorAll(".back-btn");
const boardTitle = document.getElementById("board-title");

burgerIcon.addEventListener("click", () => {
  burgerIcon.classList.toggle("open");
  sidePanel.classList.toggle("open");
});

// Generate brigades
for (let i = 1; i <= 30; i++) {
  const cube = document.createElement("button");
  cube.className = "brigade-cube";
  cube.textContent = `ББ${i}`;
  cube.addEventListener("click", () => {
    boardTitle.textContent = `Доска бригады ББ${i}`;
    brigadesPage.classList.remove("open");
    boardPage.classList.add("open");
  });
  brigadesGrid.appendChild(cube);
}

// Menu clicks
document.querySelectorAll(".side-panel li").forEach((li) => {
  li.addEventListener("click", () => {
    if (li.textContent === "Буровые бригады") {
      sidePanel.classList.remove("open");
      burgerIcon.classList.remove("open");
      brigadesPage.classList.add("open");
    }
  });
});

// Back buttons
backBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    brigadesPage.classList.remove("open");
    boardPage.classList.remove("open");
  });
});
