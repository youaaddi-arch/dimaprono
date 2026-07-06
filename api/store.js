/* ============================================================
   Dima Prono — API partagée (Vercel Serverless Function)
   Stocke l'état du jeu dans une base KV (Vercel KV / Upstash Redis).

   CONFIDENTIALITÉ :
   - Les pronos de chaque joueur restent PRIVÉS : ils ne sont JAMAIS
     renvoyés aux autres. Le serveur calcule lui-même le classement
     (points) et ne renvoie que { nom, avatar, points, ... }.
   - Chaque joueur a un CODE SECRET (pin). Impossible de jouer à sa
     place ou de récupérer ses pronos sans ce code.

   Routes :
   - GET  /api/store            -> { online, config, ranking }
   - POST /api/store {action}   -> createPlayer | player | login | config | deletePlayer | reset
   ============================================================ */

const KV_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "";

const K_PIDS = "dimaprono:pids";
const K_PLAYER = (id) => "dimaprono:player:" + id;
const K_CONFIG = "dimaprono:config";
const K_LIVETS = "dimaprono:live:ts";
const K_CHEERS = "dimaprono:cheers";
const K_CHAT = "dimaprono:chat";

// Clé (gratuite) football-data.org pour les scores en direct — optionnelle.
const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN || "";

function kvConfigured() { return Boolean(KV_URL && KV_TOKEN); }

async function redis(cmd) {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error("KV error " + res.status);
  return (await res.json()).result;
}
async function pipeline(cmds) {
  const res = await fetch(KV_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error("KV pipeline error " + res.status);
  return (await res.json()).map((d) => d.result);
}
function parse(v) { if (v == null) return null; try { return typeof v === "string" ? JSON.parse(v) : v; } catch (e) { return null; } }

async function getPlayer(id) { return parse(await redis(["GET", K_PLAYER(id)])); }
async function getConfig() { return parse(await redis(["GET", K_CONFIG])); }
async function allPlayers() {
  const ids = (await redis(["SMEMBERS", K_PIDS])) || [];
  if (!ids.length) return [];
  const vals = await pipeline(ids.map((id) => ["GET", K_PLAYER(id)]));
  return vals.map(parse).filter(Boolean);
}

/* Barème identique au client. */
function pointsFor(pred, result, s) {
  if (!pred || !result || pred.a == null || pred.b == null) return { pts: 0, kind: "none" };
  const pa = +pred.a, pb = +pred.b, ra = +result.a, rb = +result.b;
  if (pa === ra && pb === rb) return { pts: s.ptsExact, kind: "exact" };
  if (Math.sign(pa - pb) === Math.sign(ra - rb)) return { pts: s.ptsOutcome, kind: "outcome" };
  return { pts: 0, kind: "miss" };
}

/* Classement calculé côté serveur — NE renvoie AUCUN prono. */
function buildRanking(players, config) {
  const s = (config && config.settings) || { ptsExact: 3, ptsOutcome: 1 };
  const matches = (config && config.matches) || [];
  return players.map((p) => {
    let pts = 0, exact = 0, good = 0, played = 0, filled = 0, closeness = 0;
    const preds = p.predictions || {};
    for (const m of matches) {
      const pr = preds[m.id];
      if (pr && pr.a != null) filled++;            // participation (tous matchs)
      if (!m.result) continue;
      if (pr && pr.a != null) played++;
      const r = pointsFor(pr, m.result, s);
      pts += r.pts;
      if (r.kind === "exact") exact++; else if (r.kind === "outcome") good++;
      // proximité au score réel (plus petit = plus proche) -> départage les égalités
      if (pr && pr.a != null && pr.b != null) closeness += Math.abs(+pr.a - +m.result.a) + Math.abs(+pr.b - +m.result.b);
      else closeness += 50; // pas de prono sur un match terminé -> pénalisé
    }
    return { id: p.id, name: p.name, avatar: p.avatar, pts, exact, good, played, filled, closeness };
  }).sort((x, y) =>
    y.pts - x.pts ||
    x.closeness - y.closeness ||       // égalité de points -> le plus proche du score gagne
    String(x.name).localeCompare(String(y.name))  // sinon vrais ex æquo (ordre stable)
  );
}

/* Renvoie la config SANS le code secret admin brut (on garde juste ce qu'il faut au client). */
function publicConfig(config) {
  if (!config) return null;
  return { matches: config.matches || [], settings: config.settings || {} };
}

/* ---------- Scores en direct (football-data.org) ---------- */
// Correspondance des noms d'équipes (FR de l'appli <-> EN de l'API).
const TEAM_ALIASES = {
  france: "FRA", maroc: "MAR", morocco: "MAR",
  bresil: "BRA", brazil: "BRA", norvege: "NOR", norway: "NOR",
  mexique: "MEX", mexico: "MEX", angleterre: "ENG", england: "ENG",
  portugal: "POR", espagne: "ESP", spain: "ESP",
  "etats unis": "USA", usa: "USA", "united states": "USA", "united states of america": "USA",
  belgique: "BEL", belgium: "BEL", argentine: "ARG", argentina: "ARG",
  egypte: "EGY", egypt: "EGY", suisse: "SUI", switzerland: "SUI",
  colombie: "COL", colombia: "COL",
  allemagne: "GER", germany: "GER", "pays bas": "NED", netherlands: "NED",
  italie: "ITA", italy: "ITA", croatie: "CRO", croatia: "CRO",
  senegal: "SEN", "coree du sud": "KOR", "south korea": "KOR", "korea republic": "KOR",
  japon: "JPN", japan: "JPN", uruguay: "URU", "etats-unis": "USA",
  canada: "CAN", danemark: "DEN", denmark: "DEN", serbie: "SRB", serbia: "SRB",
  ghana: "GHA", "pays-bas": "NED",
};
function normalizeName(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
}
function teamKey(name) {
  const n = normalizeName(name);
  if (TEAM_ALIASES[n]) return TEAM_ALIASES[n];
  // essaie aussi le 1er mot (ex: "coree" )
  const first = n.split(" ")[0];
  return TEAM_ALIASES[first] || null;
}

// Met à jour les scores en direct depuis football-data.org (throttle 30 s, partagé via KV).
async function maybeRefreshLive() {
  if (!FD_TOKEN) return;
  const tsRaw = await redis(["GET", K_LIVETS]);
  const now = Date.now();
  if (tsRaw && now - (+tsRaw) < 30000) return;   // throttle global
  await redis(["SET", K_LIVETS, String(now)]);
  const config = await getConfig();
  if (!config || !Array.isArray(config.matches)) return;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 5000);
  let data;
  try {
    const r = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": FD_TOKEN }, signal: ctrl.signal,
    });
    if (!r.ok) return;
    data = await r.json();
  } catch (e) { return; } finally { clearTimeout(to); }

  const apiMatches = (data && data.matches) || [];
  let changed = false;
  for (const m of config.matches) {
    const kA = teamKey(m.a.name), kB = teamKey(m.b.name);
    if (!kA || !kB) continue; // équipe non déterminée -> on saute
    const am = apiMatches.find((x) => {
      const h = teamKey(x.homeTeam && x.homeTeam.name), a = teamKey(x.awayTeam && x.awayTeam.name);
      return (h === kA && a === kB) || (h === kB && a === kA);
    });
    if (!am) continue;
    const st = am.status;
    if (st === "IN_PLAY" || st === "PAUSED" || st === "FINISHED") {
      const ft = (am.score && am.score.fullTime) || {};
      const sh = ft.home == null ? 0 : ft.home, sa = ft.away == null ? 0 : ft.away;
      const homeK = teamKey(am.homeTeam && am.homeTeam.name);
      const aScore = homeK === kA ? sh : sa;
      const bScore = homeK === kA ? sa : sh;
      if (st === "FINISHED") {
        // Match terminé : c'est le score OFFICIEL -> il compte pour le classement.
        if (!m.result || m.result.a !== aScore || m.result.b !== bScore || m.live) {
          m.result = { a: aScore, b: bScore };
          m.liveScore = { a: aScore, b: bScore };
          m.live = false;
          changed = true;
        }
      } else {
        // Match EN COURS : score en direct SEULEMENT (affichage), ne compte PAS
        // dans le classement tant que le match n'est pas fini.
        const cur = m.liveScore || {};
        if (!m.live || cur.a !== aScore || cur.b !== bScore || m.result) {
          m.liveScore = { a: aScore, b: bScore };
          m.live = true;
          m.result = null;   // pas de points tant que ce n'est pas terminé
          changed = true;
        }
      }
    }
  }
  if (changed) await redis(["SET", K_CONFIG, JSON.stringify(config)]);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!kvConfigured()) { res.status(200).json({ online: false }); return; }
  try {
    if (req.method === "GET") {
      try { await maybeRefreshLive(); } catch (e) { /* jamais bloquant */ }
      const [players, config, cheersRaw, chatRaw] = [await allPlayers(), await getConfig(), await redis(["GET", K_CHEERS]), await redis(["LRANGE", K_CHAT, 0, 49])];
      const comments = (chatRaw || []).map(parse).filter(Boolean).reverse();  // du plus ancien au plus récent
      res.status(200).json({ online: true, config: publicConfig(config), ranking: buildRanking(players, config), cheers: +(cheersRaw || 0), comments });
      return;
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const action = body.action;

      // Créer un profil avec un code secret.
      if (action === "createPlayer" && body.player && body.player.id) {
        const p = body.player;
        const existing = await getPlayer(p.id);
        if (existing) { res.status(200).json({ ok: false, error: "exists" }); return; }
        const doc = { id: p.id, name: p.name, avatar: p.avatar, pin: String(body.pin || ""), predictions: {} };
        await pipeline([["SADD", K_PIDS, p.id], ["SET", K_PLAYER(p.id), JSON.stringify(doc)]]);
        res.status(200).json({ ok: true });
        return;
      }

      // Se connecter : vérifie le code secret, renvoie SES pronos (à lui seul).
      if (action === "login" && body.id) {
        const doc = await getPlayer(body.id);
        if (!doc) { res.status(200).json({ ok: false, error: "notfound" }); return; }
        if (String(doc.pin || "") !== String(body.pin || "")) { res.status(200).json({ ok: false, error: "badpin" }); return; }
        res.status(200).json({ ok: true, player: { id: doc.id, name: doc.name, avatar: doc.avatar, predictions: doc.predictions || {} } });
        return;
      }

      // Révéler les pronos des autres — UNIQUEMENT pour les matchs où le
      // demandeur a déjà validé le sien (ou match commencé/terminé). Anti-triche.
      if (action === "reveal" && body.id) {
        const me = await getPlayer(body.id);
        if (!me) { res.status(200).json({ ok: false, error: "notfound" }); return; }
        if (String(me.pin || "") !== String(body.pin || "")) { res.status(200).json({ ok: false, error: "badpin" }); return; }
        const config = await getConfig();
        const matches = (config && config.matches) || [];
        const players = await allPlayers();
        const reveal = {};
        for (const m of matches) {
          const myPr = (me.predictions || {})[m.id];
          const iLocked = myPr && myPr.a != null && myPr.locked === true;
          // Règle stricte : on ne voit les pronos des autres (et de Claude)
          // QUE si on a validé le sien pour ce match.
          if (!iLocked) continue;
          reveal[m.id] = players.map((p) => {
            const pr = (p.predictions || {})[m.id];
            return (pr && pr.a != null) ? { name: p.name, avatar: p.avatar, a: pr.a, b: pr.b } : null;
          }).filter(Boolean);
        }
        res.status(200).json({ ok: true, reveal });
        return;
      }

      // Enregistrer ses pronos : nécessite le bon code secret.
      if (action === "player" && body.player && body.player.id) {
        const p = body.player;
        const doc = await getPlayer(p.id);
        if (!doc) { res.status(200).json({ ok: false, error: "notfound" }); return; }
        if (String(doc.pin || "") !== String(body.pin || "")) { res.status(403).json({ ok: false, error: "badpin" }); return; }
        doc.name = p.name || doc.name;
        doc.avatar = p.avatar || doc.avatar;
        // ANTI-TRICHE : on n'accepte un prono QUE si le match n'a pas commencé,
        // et on ne modifie jamais un prono déjà verrouillé.
        const cfg = await getConfig();
        const now = Date.now();
        const started = {};
        ((cfg && cfg.matches) || []).forEach((m) => {
          started[m.id] = Boolean(m.live) || Boolean(m.result) || (m.date && Date.parse(m.date) <= now);
        });
        const incoming = body.predictions || {};
        const existing = doc.predictions || {};
        const hadLockedBefore = Object.values(existing).some((x) => x && x.locked);
        const finalPreds = {};
        // 1) on conserve tous les pronos déjà verrouillés (définitifs, jamais modifiables)
        for (const id in existing) { if (existing[id] && existing[id].locked) finalPreds[id] = existing[id]; }
        // 2) on accepte les nouveaux pronos uniquement pour les matchs pas commencés
        for (const id in incoming) {
          if (finalPreds[id]) continue;        // déjà verrouillé -> on ne touche pas
          if (started[id]) continue;           // match commencé -> refusé
          finalPreds[id] = incoming[id];
        }
        doc.predictions = finalPreds;
        // Règle d'égalité : on note l'heure de la TOUTE PREMIÈRE validation du joueur.
        const willHaveLocked = Object.values(finalPreds).some((x) => x && x.locked);
        if (!doc.firstAt && !hadLockedBefore && willHaveLocked) doc.firstAt = Date.now();
        await redis(["SET", K_PLAYER(p.id), JSON.stringify(doc)]);
        res.status(200).json({ ok: true });
        return;
      }

      if (action === "deletePlayer" && body.id) {
        await pipeline([["SREM", K_PIDS, body.id], ["DEL", K_PLAYER(body.id)]]);
        res.status(200).json({ ok: true });
        return;
      }
      if (action === "config" && body.config) {
        await redis(["SET", K_CONFIG, JSON.stringify(body.config)]);
        res.status(200).json({ ok: true });
        return;
      }
      if (action === "cheer") {
        const c = await redis(["INCR", K_CHEERS]);
        res.status(200).json({ ok: true, cheers: +c });
        return;
      }
      // Poster un commentaire (nécessite le code secret du joueur).
      if (action === "comment" && body.id) {
        const doc = await getPlayer(body.id);
        if (!doc) { res.status(200).json({ ok: false, error: "notfound" }); return; }
        if (String(doc.pin || "") !== String(body.pin || "")) { res.status(200).json({ ok: false, error: "badpin" }); return; }
        const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 280);
        if (!text) { res.status(200).json({ ok: false, error: "empty" }); return; }
        const entry = { id: doc.id, name: doc.name, avatar: doc.avatar, text, ts: Date.now() };
        await pipeline([["LPUSH", K_CHAT, JSON.stringify(entry)], ["LTRIM", K_CHAT, 0, 199]]);
        res.status(200).json({ ok: true });
        return;
      }
      if (action === "reset") {
        const ids = (await redis(["SMEMBERS", K_PIDS])) || [];
        const cmds = [["DEL", K_CONFIG], ["DEL", K_PIDS], ["DEL", K_CHEERS], ["DEL", K_CHAT]];
        ids.forEach((id) => cmds.push(["DEL", K_PLAYER(id)]));
        await pipeline(cmds);
        res.status(200).json({ ok: true });
        return;
      }
      res.status(400).json({ error: "action inconnue" });
      return;
    }
    res.status(405).json({ error: "méthode non autorisée" });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
