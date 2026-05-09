const GATE_THEME_KEY = "ink-auth-gate-theme";
const GATE_THEMES = ["aurora", "cinema", "cinema_alt"];
const GATE_THEME_LABELS = {
  aurora: "Лунная ночь",
  cinema: "Видео фон",
  cinema_alt: "Видео фон 2",
};

/** Задержка + длительность створок + запас под глаза (см. --gate-leaf-delay/duration в gate-themes.css) */
const GATE_OPEN_MS = {
  aurora: 6500,
  cinema: 6500,
  cinema_alt: 6500,
};

const gateBackdrop = document.getElementById("gate-backdrop");
const gateEntry = document.getElementById("gate-entry");
const gateLogin = document.getElementById("gate-login");
const gateUser = document.getElementById("gate-user");
const gatePass = document.getElementById("gate-pass");
const gateError = document.getElementById("gate-error");
const gateStyleToggle = document.getElementById("gate-style-toggle");
const gateBgVideo = document.getElementById("gate-bg-video");
const gateBgVideoAlt = document.getElementById("gate-bg-video-alt");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  .matches;

function getStoredGateTheme() {
  try {
    const raw = localStorage.getItem(GATE_THEME_KEY);
    if (raw && GATE_THEMES.includes(raw)) return raw;
  } catch {}
  return "aurora";
}

function syncGateBackgroundVideo(theme) {
  const usePrimary = theme === "cinema" && !prefersReducedMotion;
  const useAlt = theme === "cinema_alt" && !prefersReducedMotion;

  if (gateBgVideo) {
    if (usePrimary) {
      gateBgVideo.play().catch(() => {});
    } else {
      gateBgVideo.pause();
      try {
        gateBgVideo.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }

  if (gateBgVideoAlt) {
    if (useAlt) {
      gateBgVideoAlt.play().catch(() => {});
    } else {
      gateBgVideoAlt.pause();
      try {
        gateBgVideoAlt.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }
}

function applyGateTheme(themeId) {
  const theme = GATE_THEMES.includes(themeId) ? themeId : "aurora";
  document.documentElement.setAttribute("data-gate-theme", theme);
  try {
    localStorage.setItem(GATE_THEME_KEY, theme);
  } catch {}
  syncGateBackgroundVideo(theme);
  if (gateStyleToggle) {
    const label = GATE_THEME_LABELS[theme];
    gateStyleToggle.title = `Стиль: ${label}. Нажмите — следующий.`;
    gateStyleToggle.setAttribute(
      "aria-label",
      `Сменить стиль экрана входа. Сейчас: ${label}`,
    );
  }
}

function getGateOpenDurationMs() {
  const theme =
    document.documentElement.getAttribute("data-gate-theme") || "aurora";
  if (prefersReducedMotion) return 1200;
  return GATE_OPEN_MS[theme] ?? GATE_OPEN_MS.aurora;
}

function cycleGateTheme() {
  const raw = document.documentElement.getAttribute("data-gate-theme");
  const current = raw && GATE_THEMES.includes(raw) ? raw : "aurora";
  let i = GATE_THEMES.indexOf(current);
  if (i < 0) i = 0;
  applyGateTheme(GATE_THEMES[(i + 1) % GATE_THEMES.length]);
}

applyGateTheme(getStoredGateTheme());

if (gateStyleToggle) {
  gateStyleToggle.addEventListener("click", () => {
    cycleGateTheme();
  });
}

if (gateEntry && gateLogin) {
  const existingSession = sessionStorage.getItem("ink-auth-session");
  if (existingSession) {
    gateEntry.classList.add("hidden");
    gateBackdrop?.classList.add("hidden");
  }

  gateLogin.addEventListener("submit", (event) => {
    event.preventDefault();
    gateError.textContent = "";

    const username = gateUser.value.trim();
    const password = gatePass.value;
    const session = authenticateUser(username, password);
    if (!session) {
      gateError.textContent = "Неверный логин или пароль.";
      return;
    }

    sessionStorage.setItem("ink-auth-session", JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("ink-auth-success", { detail: session }));

    gateBackdrop?.classList.add("opening");
    gateEntry.classList.add("opening");

    window.setTimeout(() => {
      gateBackdrop?.classList.add("hidden");
      gateBackdrop?.classList.remove("opening");
      gateEntry.classList.add("hidden");
      gateEntry.classList.remove("opening");
    }, getGateOpenDurationMs());
  });
}
