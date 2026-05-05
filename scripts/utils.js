/** Глобальная функция: вызывается из main.js (без ES modules — работает с file://). */
function wrapLetters(element) {
  if (!element) return;
  const text = element.textContent || "";
  element.innerHTML = Array.from(text)
    .map((char) => {
      if (char === " ") {
        return '<span class="glow-letter-space">&nbsp;</span>';
      }
      return `<span class="glow-letter"><span>${char}</span></span>`;
    })
    .join("");
}