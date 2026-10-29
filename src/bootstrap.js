/** Dev gate + branding (replaces document.write React bootstrap in legacy index). */
const branding = Object.freeze({
  title: "GUTTERBONES",
  year: "1977",
  get displayName() {
    return `${this.title} ${this.year}`;
  },
  get loadingMessage() {
    return `LOADING ${this.displayName}…`;
  },
});
window.__GUTTERBONES_BRANDING__ = branding;

const loadingEl = document.getElementById("gutterbones-loading");
if (loadingEl) loadingEl.textContent = branding.loadingMessage;

const params = new URLSearchParams(window.location.search);
const host = window.location.hostname;
const isDevHost =
  host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";
const isDev = isDevHost || params.get("dev") === "1";
window.__GUTTERBONES_DEV__ = isDev;
