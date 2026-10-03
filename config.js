// Add sports/teams here. Each league is an ESPN path.
// mode "schedule" uses the team schedule endpoint; "scoreboard" scans the league scoreboard by year and filters by team id.
const us = (path, label) => ({ path, label, mode: "schedule", seasonTypes: [2, 3] });
const soccer = (slug) => ({ path: `soccer/${slug}`, mode: "schedule" });
const rugby = (id) => ({ path: `rugby/${id}`, mode: "scoreboard" });

module.exports = [
  {
    sport: "Soccer",
    teams: [
      { name: "Liverpool", id: "364", leagues: [soccer("eng.1")] },
      { name: "Seattle Sounders", id: "9726", leagues: [soccer("usa.1")] },
      {
        name: "Republic of Ireland",
        id: "476",
        leagues: ["fifa.friendly", "uefa.nations", "fifa.worldq.uefa", "uefa.euroq", "fifa.world", "uefa.euro"].map(soccer),
      },
    ],
  },
  {
    sport: "Rugby",
    teams: [
      { name: "Leinster", id: "25924", leagues: [rugby("270557"), rugby("271937")] },
      { name: "Ireland", id: "3", leagues: [rugby("180659"), rugby("17567"), rugby("289234"), rugby("164205")] },
    ],
  },
  { sport: "Baseball", teams: [{ name: "Seattle Mariners", id: "12", leagues: [us("baseball/mlb", "MLB")] }] },
  { sport: "NFL", teams: [{ name: "Seattle Seahawks", id: "26", leagues: [us("football/nfl", "NFL")] }] },
  { sport: "NHL", teams: [{ name: "Seattle Kraken", id: "124292", leagues: [us("hockey/nhl", "NHL")] }] },
  {
    sport: "College Football",
    teams: [
      { name: "Washington Huskies", id: "264", leagues: [us("football/college-football", "College Football")] },
      { name: "San Diego State Aztecs", id: "21", leagues: [us("football/college-football", "College Football")] },
    ],
  },
  {
    sport: "HS Football",
    teams: [
      {
        name: "Eastlake Wolves",
        id: "a3c93aad-daa4-4495-8e32-fc6f6c8b4921",
        leagues: [{ mode: "maxpreps", label: "WIAA", url: "https://www.maxpreps.com/wa/sammamish/eastlake-wolves/football/schedule/" }],
      },
    ],
  },
];
