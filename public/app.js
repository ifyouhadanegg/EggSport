const $ = (id) => document.getElementById(id);
let offset = 0;
let data = null;
const FILTERS = ["all", "final", "future"];
let filter = "all";
const keep = (e) => filter === "all" || (filter === "final") === (e.state === "post");

function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function render() {
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
  $("main").innerHTML = html.join("") || `<p class="empty">No ${filter === "all" ? "" : filter + " "}games this week</p>`;
}

function game(e) {
  const d = new Date(e.date);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const pre = e.state === "pre";
  const status = pre ? time : e.state === "in" ? `<span class="live">? ${esc(e.detail)}</span>` : esc(e.detail || "FT");
  const side = (t) => `<div class="row"><span class="t${t.id === e.teamId ? " mine" : ""}">${t.logo ? `<img src="${esc(t.logo)}" alt="">` : ""}${esc(t.name)}</span>${pre ? "" : `<span class="score">${esc(t.score ?? "")}</span>`}</div>`;
  return `<div class="game"><div class="meta"><span>${esc(e.league)}</span><span>${status}</span></div>${side(e.home)}${side(e.away)}${e.venue ? `<div class="venue">${esc(e.venue)}</div>` : ""}</div>`;
}

async function load() {
  try {
    const r = await fetch("/api/events");
    if (!r.ok) throw new Error();
    data = await r.json();
    render();
  } catch {
    $("main").innerHTML = '<p class="err">Couldn\'t load games. Pull to retry.</p>';
  }
}

$("filter").onclick = () => { filter = FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length]; data && render(); window.scrollTo(0, 0); };
$("prev").onclick = () => { offset--; data && render(); window.scrollTo(0, 0); };
$("next").onclick = () => { offset++; data && render(); window.scrollTo(0, 0); };
$("title").onclick = () => { offset = 0; data && render(); };
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
load();





