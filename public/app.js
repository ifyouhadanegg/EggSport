const $ = (id) => document.getElementById(id);
let offset = 0;
let data = null;
const FILTERS = ["all", "final", "future"];
let filter = "all";
let sportFilter = localStorage.getItem("eggsport-sport") || "all";
let teamFilter = localStorage.getItem("eggsport-team") || "all";
window.setTimeout(() => $("splash").classList.add("hidden"), 5000);
const keep = (e) => {
  const statusMatch = filter === "all" || (filter === "final") === (e.state === "post");
  const sportMatch = sportFilter === "all" || e.sport === sportFilter;
  const teamMatch = teamFilter === "all" || e.team === teamFilter;
  return statusMatch && sportMatch && teamMatch;
};

function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function render() {
  if (new URLSearchParams(location.search).has("game")) return renderDetail();
  const start = mondayOf(new Date());
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  $("range").textContent = `${fmt(start)} \u2013 ${fmt(end)}` + (offset === 0 ? " \u00b7 This week" : "");

  $("filter").textContent = filter[0].toUpperCase() + filter.slice(1);
  const todayKey = dayKey(new Date());
  const html = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start); day.setDate(start.getDate() + i);
    const k = dayKey(day);
    const evs = data.events.filter(keep).filter((e) => dayKey(new Date(e.date)) === k)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!evs.length) continue;
    html.push(`<section class="day${k === todayKey ? " today" : ""}"><h2>${day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</h2>`);
    for (const s of data.sports) {
      const se = evs.filter((e) => e.sport === s.sport);
      if (!se.length) continue;
      html.push(`<div class="sport">${esc(s.sport)}</div>`);
      for (const e of se) html.push(game(e));
    }
    html.push("</section>");
  }
  $("main").innerHTML = html.join("") || `<p class="empty">No games match these filters this week</p>`;
}

function game(e) {
  const d = new Date(e.date);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const pre = e.state === "pre";
  const status = pre ? time : e.state === "in" ? `<span class="live">? ${esc(e.detail)}</span>` : esc(e.detail || "FT");
  const side = (t) => `<div class="row"><span class="t${t.id === e.teamId ? " mine" : ""}">${t.logo ? `<img src="${esc(t.logo)}" alt="">` : ""}${esc(t.name)}</span>${pre ? "" : `<span class="score">${esc(t.score ?? "")}</span>`}</div>`;
  const key = encodeURIComponent(`${e.teamId}:${e.id}`);
  return `<a class="game" href="?game=${key}"><div class="meta"><span>${esc(e.league)}</span><span>${status}</span></div>${side(e.home)}${side(e.away)}${e.venue ? `<div class="venue">${esc(e.venue)}</div>` : ""}</a>`;
}

function renderFilters() {
  const sports = [...new Set(data.events.map((e) => e.sport))].sort();
  const teams = [...new Set(data.events.map((e) => e.team))].sort();
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  $("sportFilter").innerHTML = option("all", "All sports") + sports.map((s) => option(s, s)).join("");
  $("teamFilter").innerHTML = option("all", "All teams") + teams.map((t) => option(t, t)).join("");
  if (!sports.includes(sportFilter)) sportFilter = "all";
  if (!teams.includes(teamFilter)) teamFilter = "all";
  $("sportFilter").value = sportFilter;
  $("teamFilter").value = teamFilter;
}

function renderDetail() {
  const key = new URLSearchParams(location.search).get("game");
  const e = data.events.find((event) => `${event.teamId}:${event.id}` === key);
  if (!e) {
    $("main").innerHTML = '<a class="back" href="/">&#x2190; Back to schedule</a><p class="err">Game not found.</p>';
    return;
  }
  const d = new Date(e.date);
  const pre = e.state === "pre";
  const status = pre ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : e.detail || "Final";
  const detailSide = (t) => `<div class="team"><span>${t.logo ? `<img src="${esc(t.logo)}" alt="">` : ""}${esc(t.name)}</span><span class="score">${pre ? "" : esc(t.score ?? "")}</span></div>`;
  $("main").innerHTML = `<article class="detail"><a class="back" href="/">&#x2190; Back to schedule</a><h2>${esc(e.league)}</h2><p class="sub">${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${esc(status)}</p><div class="teams">${detailSide(e.away)}${detailSide(e.home)}</div>${e.venue ? `<p class="sub">Venue: ${esc(e.venue)}</p>` : ""}</article>`;
}

async function load() {
  try {
    const r = await fetch("/api/events");
    if (!r.ok) throw new Error();
    data = await r.json();
    renderFilters();
    render();
  } catch {
    $("main").innerHTML = '<p class="err">Couldn\'t load games. Pull to retry.</p>';
  }
}

$("filter").onclick = () => { filter = FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length]; data && render(); window.scrollTo(0, 0); };
$("sportFilter").onchange = (event) => { sportFilter = event.target.value; localStorage.setItem("eggsport-sport", sportFilter); render(); };
$("teamFilter").onchange = (event) => { teamFilter = event.target.value; localStorage.setItem("eggsport-team", teamFilter); render(); };
$("prev").onclick = () => { offset--; data && render(); window.scrollTo(0, 0); };
$("next").onclick = () => { offset++; data && render(); window.scrollTo(0, 0); };
$("title").onclick = () => { offset = 0; data && render(); };
window.onpopstate = () => { data && render(); };
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
load();


