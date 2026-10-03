const http = require("http");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const PORT = process.env.PORT || 3000;
const TTL = 60 * 1000;
const PUBLIC = path.join(__dirname, "public");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
};

let cache = { at: 0, data: null };

const scoreOf = (c) => {
  const s = c.score;
  if (s == null) return null;
  return typeof s === "object" ? s.displayValue ?? String(s.value ?? "") : String(s);
};

const BASE = "https://site.api.espn.com/apis/site/v2/sports/";
const getJson = async (url) => {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch (_) { return null; }
};

function venueOf(v) {
  if (!v?.fullName) return null;
  const a = v.address || {};
  return [v.fullName, a.city].filter(Boolean).join(", ");
}

function toEvent(e, comp, sport, team, leagueName) {
  const cs = comp.competitors || [];
  const home = cs.find((c) => c.homeAway === "home");
  const away = cs.find((c) => c.homeAway === "away");
  if (!home || !away) return null;
  const st = (comp.status || e.status)?.type || {};
  const side = (c) => ({
    name: c.team?.displayName, id: c.team?.id, score: scoreOf(c),
    logo: c.team?.logos?.[0]?.href || c.team?.logo || null,
  });
  return {
    id: e.id, sport, team: team.name, teamId: team.id, league: leagueName,
    date: e.date, state: st.state || "pre", detail: st.shortDetail || st.detail || "",
    venue: venueOf(comp.venue || e.venue),
    home: side(home), away: side(away),
  };
}

async function fromSchedule(sport, team, lg) {
  const types = lg.seasonTypes || [null];
  const out = [];
  await Promise.all(types.map(async (t) => {
    const j = await getJson(`${BASE}${lg.path}/teams/${team.id}/schedule${t ? `?seasontype=${t}` : ""}`);
    for (const e of j?.events || []) {
      const comp = e.competitions?.[0];
      const ev = comp && toEvent(e, comp, sport, team, lg.label || e.league?.name || j.season?.displayName || lg.path);
      if (ev) out.push(ev);
    }
  }));
  return out;
}

async function fromScoreboard(sport, team, lg) {
  const now = Date.now(), DAY = 864e5;
  const years = [...new Set([new Date(now - 30 * DAY).getFullYear(), new Date(now + 90 * DAY).getFullYear()])];
  const out = [];
  await Promise.all(years.map(async (y) => {
    const j = await getJson(`${BASE}${lg.path}/scoreboard?dates=${y}&limit=500`);
    const name = j?.leagues?.[0]?.name || lg.path;
    for (const e of j?.events || []) {
      const comp = e.competitions?.[0];
      if (!comp || !(comp.competitors || []).some((c) => c.team?.id === team.id)) continue;
      const ev = toEvent(e, comp, sport, team, name);
      if (ev) out.push(ev);
    }
  }));
  return out;
}

// MaxPreps embeds schedules as positional arrays in __NEXT_DATA__; indexes below match that layout.
function laToIso(local) {
  const [d, t] = local.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi, se] = t.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi, se || 0);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" }).formatToParts(new Date(guess));
  const off = Number((parts.find((p) => p.type === "timeZoneName").value.match(/-?\d+/) || ["-8"])[0]);
  return new Date(guess - off * 3600000).toISOString();
}

async function fromMaxPreps(sport, team, lg) {
  try {
    const r = await fetch(lg.url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return [];
    const m = (await r.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return [];
    const contests = JSON.parse(m[1]).props?.pageProps?.contests || [];
    const out = [];
    for (const c of contests) {
      const [a, b] = c[0] || [];
      if (!a || !b || typeof c[11] !== "string") continue;
      const [home, away] = a[11] === 0 ? [a, b] : [b, a];
      const done = !!(home[5] || away[5]);
      const side = (t) => ({ name: t[14], id: t[1], score: done ? String(t[6]) : null, logo: t[20] });
      out.push({
        id: c[1], sport, team: team.name, teamId: team.id, league: lg.label,
        date: laToIso(c[11]), state: done ? "post" : "pre", detail: done ? "Final" : "", venue: c[5] || null,
        home: side(home), away: side(away),
      });
    }
    return out;
  } catch (_) { return []; }
}
async function fetchTeam(sport, team) {
  const parts = await Promise.all(team.leagues.map((lg) => ({ scoreboard: fromScoreboard, maxpreps: fromMaxPreps }[lg.mode] || fromSchedule)(sport, team, lg)));
  return parts.flat();
}
async function getData() {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data;
  const all = [];
  for (const s of config) for (const t of s.teams) all.push(fetchTeam(s.sport, t));
  const seen = new Set();
  const events = (await Promise.all(all)).flat().filter((e) => {
    const k = e.teamId + ":" + e.id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  cache = { at: Date.now(), data: { events, sports: config.map((s) => ({ sport: s.sport, teams: s.teams.map((t) => t.name) })) } };
  return cache.data;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/events") {
    try {
      const data = await getData();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(502); return res.end(JSON.stringify({ error: "upstream failed" }));
    }
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  if (!p) p = "index.html";
  const file = path.join(PUBLIC, p);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`EggSport on ${PORT}`));






