// CloudCode: server-checked rankings for NOT YOUR CARGO (title QA0X2DY9).
// Published together with nyc-trail.js (a revision replaces the whole script).
//
// Campaign: the client reports a won mission; the SERVER keeps the player's verified progress in the
// ReadOnly bucket (clients can't write it), checks mission order, a minimum duration, real elapsed
// time between reports, and computes the stars itself. The top list lives in the title's Runtime
// data (only scripts write it; every client reads it).
// Duels: a win counts only when BOTH players of the match report the same result.
// Limits (said openly in the game): a modified client can still play a mission and report it; what
// it can no longer do is skip missions, finish faster than the mission physically takes, or give
// itself duel wins without an opponent's confirmation (two colluding accounts still can — capped).

var NYC_MISSIONS = ["C01", "C02", "C03", "C04", "C05"];
var NYC_DIFF_W = { easy: 1, normal: 2, hard: 3 };
// Seconds: below the fastest input-only autopilot run (C01 ~70, C02 ~38, C03 ~60, C04 ~62, C05 ~25).
var NYC_MIN_TIME = { C01: 45, C02: 25, C03: 50, C04: 55, C05: 18 };
var NYC_PAR = { C01: 300, C02: 270, C03: 240, C04: 180, C05: 210 };
var NYC_TOP = 20;
var NYC_PAIR_DAILY_CAP = 5; // credited wins per pair of players per UTC day

function nycOk(r) {
  return r && r.Success !== false;
}
function nycData(r) {
  return r && r.Data !== undefined ? r.Data : r;
}
function nycName(s) {
  return String(s || "").replace(/[^\w\u0400-\u04FF .\-]/g, "").slice(0, 20) || "courier";
}
// GetTitleCustomData → Data.Runtime.{Public|Private}[key] = { Value, Version, … }
function nycRuntime(bucket, key) {
  var all = nycData(server.GetTitleCustomData());
  var b = all && all.Runtime && all.Runtime[bucket];
  return (b && b[key]) || null;
}
function nycNum(r) {
  var d = nycData(r);
  return Number((d && d.Value) || 0);
}
function nycWeek(ms) {
  // ISO-like week index since 1970-01-05 (a Monday), UTC
  return Math.floor((ms - 345600000) / 604800000);
}

// Update a top list stored in title Runtime data with compare-and-set (concurrent calls retry).
function nycPushTop(key, userId, name, score) {
  for (var attempt = 0; attempt < 4; attempt++) {
    var rec = nycRuntime("Public", key);
    var list = [];
    try {
      list = rec && rec.Value ? JSON.parse(rec.Value) : [];
    } catch (e) {
      list = [];
    }
    var found = false;
    for (var i = 0; i < list.length; i++)
      if (list[i].u === userId) {
        found = true;
        if (score <= list[i].s && list[i].n === name) return true;
        list[i].s = Math.max(list[i].s, score);
        list[i].n = name;
      }
    if (!found) list.push({ u: userId, n: name, s: score });
    list.sort(function (a, b) {
      return b.s - a.s;
    });
    list = list.slice(0, NYC_TOP);
    var w = server.SetTitleCustomData("Public", key, JSON.stringify(list), rec ? rec.Version : undefined);
    if (nycOk(w)) return true;
  }
  return false;
}

handlers.nycMissionWon = function (args, context) {
  var id = String(args && args.id);
  var diff = String(args && args.difficulty);
  var time = Number(args && args.time);
  var hp = Number(args && args.hp);
  if (NYC_MISSIONS.indexOf(id) < 0 || !NYC_DIFF_W[diff]) return { ok: false, error: "bad mission" };
  if (!(time >= NYC_MIN_TIME[id]) || time > 3600) return { ok: false, error: "time not plausible" };
  if (!(hp > 0) || hp > 100) return { ok: false, error: "hp not plausible" };

  var mine = nycData(server.GetUserCustomData());
  var raw = mine && mine.ReadOnly && mine.ReadOnly.nyc_verified;
  var v = { done: {}, lastAt: 0 };
  try {
    if (raw && raw.Value) v = JSON.parse(raw.Value);
  } catch (e) {}
  if (!v.done) v.done = {};

  var idx = NYC_MISSIONS.indexOf(id);
  if (idx > 0 && !v.done[NYC_MISSIONS[idx - 1]]) return { ok: false, error: "previous mission not verified" };
  var now = Date.now();
  // real time must have passed: you can't win a mission faster than it lasted
  if (v.lastAt && now - v.lastAt < time * 1000 * 0.9) return { ok: false, error: "too fast after the previous report" };

  var stars = 1 + (time <= NYC_PAR[id] ? 1 : 0) + (hp >= 50 ? 1 : 0);
  var entry = v.done[id] || {};
  entry[diff] = Math.max(entry[diff] || 0, stars);
  v.done[id] = entry;
  v.lastAt = now;
  var score = 0;
  for (var m in v.done) {
    var best = 0;
    for (var d in v.done[m]) best = Math.max(best, v.done[m][d] * NYC_DIFF_W[d]);
    score += best;
  }
  v.score = score;
  var w = server.SetUserCustomData("ReadOnly", "nyc_verified", JSON.stringify(v));
  if (!nycOk(w)) return { ok: false, error: "save failed" };
  nycPushTop("nyc_top_campaign", context.UserID, nycName(args.name), score);
  return { ok: true, stars: stars, score: score };
};

// Each player of a finished match reports { matchId, me, opponent, winner, name }.
// The first report waits; the second, if it agrees, credits the winner once.
handlers.nycDuelResult = function (args, context) {
  var matchId = String(args && args.matchId).replace(/[^\w:\-]/g, "").slice(0, 80);
  var opp = String(args && args.opponent);
  var winner = String(args && args.winner);
  var me = context.UserID;
  if (!matchId || !opp || opp === me) return { ok: false, error: "bad match" };
  if (winner !== me && winner !== opp) return { ok: false, error: "bad winner" };
  var key = "duel_" + matchId;
  var now = Date.now();
  for (var attempt = 0; attempt < 4; attempt++) {
    var rec = nycRuntime("Private", key);
    var st = null;
    try {
      st = rec && rec.Value ? JSON.parse(rec.Value) : null;
    } catch (e) {}
    if (!st) {
      st = { a: me, b: opp, w: {}, n: {}, at: now, done: false };
    }
    if (!((st.a === me && st.b === opp) || (st.a === opp && st.b === me))) return { ok: false, error: "not your match" };
    if (st.done) return { ok: true, credited: false, already: true };
    st.w[me] = winner;
    st.n[me] = nycName(args.name);
    var agreed = st.w[st.a] && st.w[st.b] && st.w[st.a] === st.w[st.b];
    if (agreed) st.done = true;
    var w = server.SetTitleCustomData("Private", key, JSON.stringify(st), rec ? rec.Version : undefined);
    if (!nycOk(w)) continue;
    if (!agreed) return { ok: true, credited: false, waiting: true };
    // credit once: per-player weekly counter, a pair cap per day, then the weekly top
    var day = Math.floor(now / 86400000);
    var pair = [st.a, st.b].sort().join("_");
    var capVal = nycNum(server.IncrementTitleCustomData("Private", "pair_" + pair + "_" + day, 1));
    if (capVal > NYC_PAIR_DAILY_CAP) return { ok: true, credited: false, capped: true };
    var win = st.w[me];
    var week = nycWeek(now);
    var wins = nycNum(server.IncrementTitleCustomData("Private", "duelwins_" + week + "_" + win, 1));
    nycPushTop("nyc_top_duels_" + week, win, st.n[win] || "courier", wins);
    return { ok: true, credited: true, winner: win, wins: wins };
  }
  return { ok: false, error: "busy, retry" };
};
