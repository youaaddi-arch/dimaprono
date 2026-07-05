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
    let pts = 0, exact = 0, good = 0, played = 0;
    const preds = p.predictions || {};
    for (const m of matches) {
      if (!m.result) continue;
      const pr = preds[m.id];
      if (pr && pr.a != null) played++;
      const r = pointsFor(pr, m.result, s);
      pts += r.pts;
      if (r.kind === "exact") exact++; else if (r.kind === "outcome") good++;
    }
    return { id: p.id, name: p.name, avatar: p.avatar, pts, exact, good, played };
  }).sort((x, y) => y.pts - x.pts || y.exact - x.exact || y.good - x.good || String(x.name).localeCompare(String(y.name)));
}

/* Renvoie la config SANS le code secret admin brut (on garde juste ce qu'il faut au client). */
function publicConfig(config) {
  if (!config) return null;
  return { matches: config.matches || [], settings: config.settings || {} };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!kvConfigured()) { res.status(200).json({ online: false }); return; }
  try {
    if (req.method === "GET") {
      const [players, config] = [await allPlayers(), await getConfig()];
      res.status(200).json({ online: true, config: publicConfig(config), ranking: buildRanking(players, config) });
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

      // Enregistrer ses pronos : nécessite le bon code secret.
      if (action === "player" && body.player && body.player.id) {
        const p = body.player;
        const doc = await getPlayer(p.id);
        if (!doc) { res.status(200).json({ ok: false, error: "notfound" }); return; }
        if (String(doc.pin || "") !== String(body.pin || "")) { res.status(403).json({ ok: false, error: "badpin" }); return; }
        doc.name = p.name || doc.name;
        doc.avatar = p.avatar || doc.avatar;
        doc.predictions = body.predictions || doc.predictions || {};
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
      if (action === "reset") {
        const ids = (await redis(["SMEMBERS", K_PIDS])) || [];
        const cmds = [["DEL", K_CONFIG], ["DEL", K_PIDS]];
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
