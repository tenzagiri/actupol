const FEEDS = [
  { name: "France Info", url: "https://www.francetvinfo.fr/politique.rss" },
  { name: "Le Monde", url: "https://www.lemonde.fr/politique/rss_full.xml" },
  { name: "Public Sénat", url: "https://www.publicsenat.fr/rss.xml" },
  { name: "LCP", url: "https://lcp.fr/rss.xml" },
  { name: "Assemblée nationale", url: "https://www.assemblee-nationale.fr/dyn/rss/rss_actualites.xml" },
];

const PROXY = "https://api.allorigins.win/raw?url=";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = "actu_politique_cache_v1";
const THEME_KEY = "actu_politique_theme";

let allArticles = [];
let activeSource = "Toutes";

const mainEl = document.getElementById("main");
const statusEl = document.getElementById("status");
const filtersEl = document.getElementById("filters");
const searchInput = document.getElementById("searchInput");
const refreshBtn = document.getElementById("refreshBtn");
const themeToggle = document.getElementById("themeToggle");

// ---------- Thème ----------
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}
themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});
initTheme();

// ---------- Fetch RSS ----------
async function fetchFeed(feed) {
  try {
    const res = await fetch(PROXY + encodeURIComponent(feed.url));
    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, "text/xml");
    const items = Array.from(xml.querySelectorAll("item"));
    return items.map(item => ({
      title: item.querySelector("title")?.textContent?.trim() || "Sans titre",
      link: item.querySelector("link")?.textContent?.trim() || "#",
      desc: stripHtml(item.querySelector("description")?.textContent || ""),
      date: item.querySelector("pubDate")?.textContent || null,
      source: feed.name,
    }));
  } catch (e) {
    console.error("Erreur flux", feed.name, e);
    return [];
  }
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").slice(0, 200);
}

async function loadAllFeeds() {
  refreshBtn.classList.add("spinning");
  statusEl.textContent = "Chargement des actualités...";
  statusEl.style.display = "block";

  const results = await Promise.all(FEEDS.map(fetchFeed));
  let merged = results.flat();

  merged.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (merged.length === 0) {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      merged = JSON.parse(cached);
      statusEl.textContent = "Hors ligne — affichage des données en cache.";
    } else {
      statusEl.textContent = "Impossible de charger les actualités. Vérifiez votre connexion.";
    }
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    statusEl.style.display = "none";
  }

  allArticles = merged;
  buildFilters();
  renderArticles();
  refreshBtn.classList.remove("spinning");
}

// ---------- Filtres par source ----------
function buildFilters() {
  const sources = ["Toutes", ...new Set(allArticles.map(a => a.source))];
  filtersEl.innerHTML = "";
  sources.forEach(src => {
    const btn = document.createElement("button");
    btn.textContent = src;
    if (src === activeSource) btn.classList.add("active");
    btn.addEventListener("click", () => {
      activeSource = src;
      buildFilters();
      renderArticles();
    });
    filtersEl.appendChild(btn);
  });
}

// ---------- Affichage ----------
function renderArticles() {
  const query = searchInput.value.trim().toLowerCase();

  let filtered = allArticles;
  if (activeSource !== "Toutes") {
    filtered = filtered.filter(a => a.source === activeSource);
  }
  if (query) {
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.desc.toLowerCase().includes(query)
    );
  }

  mainEl.innerHTML = "";

  if (filtered.length === 0) {
    mainEl.innerHTML = `<div class="empty">Aucun article trouvé.</div>`;
    return;
  }

  filtered.forEach(article => {
    const a = document.createElement("a");
    a.href = article.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "article";

    const dateStr = article.date
      ? new Date(article.date).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "";

    a.innerHTML = `
      <div class="source">${escapeHtml(article.source)}</div>
      <h2>${escapeHtml(article.title)}</h2>
      <div class="desc">${escapeHtml(article.desc)}</div>
      <div class="meta">${dateStr}</div>
    `;
    mainEl.appendChild(a);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Events ----------
searchInput.addEventListener("input", renderArticles);
refreshBtn.addEventListener("click", loadAllFeeds);

// ---------- Init ----------
loadAllFeeds();
setInterval(loadAllFeeds, REFRESH_INTERVAL);

// ---------- Service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}
