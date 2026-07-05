/* ============================================================
   Dima Prono — API partagée (Vercel Serverless Function)
   Stocke l'état du jeu dans une base KV (Vercel KV / Upstash Redis).
   - GET  /api/store            -> renvoie { online, config, players }
   - POST /api/store {action}   -> action = "player" | "config" | "reset"
   Si aucune base n'est configurée, renvoie { online:false } et l'appli
   bascule automatiquement en mode local (hors-ligne).
   ============================================================ */

const KV_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_URL ||
  "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_READ_ONLY_TOKEN ||
  "";

const K_PIDS = "dimaprono:pids";
const K_PLAYER = (id) => "dimaprono:player:" + id;
const K_CONFIG = "dimaprono:config";

function kvConfigured() {
  return Boolean(KV_URL && KV_TOKEN);
}

/* Exécute une ou plusieurs commandes Redis via l'API REST Upstash. */
async function redis(cmd) {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error("KV error " + res.status);
  const data = await res.json();
  return data.result;
}
async function pipeline(cmds) {
  const res = await fetch(KV_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error("KV pipeline error " + res.status);
  const data = await res.json();
  return data.map((d) => d.result);
}

function parse(v) {
  if (v == null) return null;
  try { return typeof v === "string" ? JSON.parse(v) : v; } catch (e) { return null; }
}

async function readState() {
  const ids = (await redis(["SMEMBERS", K_PIDS])) || [];
  let players = [];
  if (ids.length) {
    const vals = await pipeline(ids.map((id) => ["GET", K_PLAYER(id)]));
    players = vals.map(parse).filter(Boolean);
  }
  const config = parse(await redis(["GET", K_CONFIG]));
  return { online: true, config, players };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!kvConfigured()) {
    res.status(200).json({ online: false });
    return;
  }
  try {
    if (req.method === "GET") {
      res.status(200).json(await readState());
      return;
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const action = body.action;

      if (action === "player" && body.player && body.player.id) {
        const p = body.player;
        await pipeline([
          ["SADD", K_PIDS, p.id],
          ["SET", K_PLAYER(p.id), JSON.stringify(p)],
        ]);
        res.status(200).json({ ok: true });
        return;
      }
      if (action === "deletePlayer" && body.id) {
        await pipeline([
          ["SREM", K_PIDS, body.id],
          ["DEL", K_PLAYER(body.id)],
        ]);
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
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
