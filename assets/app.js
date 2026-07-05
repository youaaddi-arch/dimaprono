/* ============================================================
   Dima Prono — Pronostics Coupe du Monde entre amis
   100% local (localStorage). Aucune installation.
   ============================================================ */

const STORE_KEY = "dimaprono_v1";
const AVATARS = ["😎","🔥","⚽","🦁","🐐","🚀","👑","🎯","🧠","🍀","🐉","🦅","💪","🎩","🤠","🐧","🦊","🐼","🌟","🥷"];
const FLAGS = ["🇫🇷","🇧🇷","🇦🇷","🏴","🇪🇸","🇵🇹","🇳🇱","🇩🇪","🇮🇹","🇧🇪","🇭🇷","🇲🇦","🇺🇸","🇲🇽","🇺🇾","🇯🇵","🇰🇷","🇸🇳","🇨🇦","🇨🇴","🇨🇭","🇩🇰","🇷🇸","🇬🇭","🏳️"];

/* ---------- Données de départ : Coupe du Monde 2026 — vrai calendrier (modifiable) ----------
   Au 5 juillet 2026, seul le quart France–Maroc est confirmé ; les autres affiches
   suivent le tableau officiel ("Vainqueur 8e …") en attendant la fin des huitièmes. */
const SEED_VERSION = 3;
function seedMatches() {
  return [
    // Huitièmes de finale encore à jouer (5–7 juillet 2026, heure de Paris)
    { id: uid(), stage: "Huitième de finale", a: { name: "Brésil", flag: "🇧🇷" }, b: { name: "Norvège", flag: "🇳🇴" }, date: "2026-07-05T22:00", result: null },
    { id: uid(), stage: "Huitième de finale", a: { name: "Mexique", flag: "🇲🇽" }, b: { name: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" }, date: "2026-07-06T02:00", result: null },
    { id: uid(), stage: "Huitième de finale", a: { name: "Portugal", flag: "🇵🇹" }, b: { name: "Espagne", flag: "🇪🇸" }, date: "2026-07-06T21:00", result: null },
    { id: uid(), stage: "Huitième de finale", a: { name: "États-Unis", flag: "🇺🇸" }, b: { name: "Belgique", flag: "🇧🇪" }, date: "2026-07-07T02:00", result: null },
    { id: uid(), stage: "Huitième de finale", a: { name: "Argentine", flag: "🇦🇷" }, b: { name: "Égypte", flag: "🇪🇬" }, date: "2026-07-07T18:00", result: null },
    { id: uid(), stage: "Huitième de finale", a: { name: "Suisse", flag: "🇨🇭" }, b: { name: "Colombie", flag: "🇨🇴" }, date: "2026-07-07T22:00", result: null },
    // Quarts de finale
    { id: uid(), stage: "Quart de finale", venue: "Boston", a: { name: "France", flag: "🇫🇷" }, b: { name: "Maroc", flag: "🇲🇦" }, date: "2026-07-09T22:00", result: null },
    { id: uid(), stage: "Quart de finale", venue: "Los Angeles", a: { name: "Vainqueur 8e-5", flag: "🏳️" }, b: { name: "Vainqueur 8e-6", flag: "🏳️" }, date: "2026-07-10T21:00", result: null },
    { id: uid(), stage: "Quart de finale", venue: "Miami", a: { name: "Vainqueur 8e-3", flag: "🏳️" }, b: { name: "Vainqueur 8e-4", flag: "🏳️" }, date: "2026-07-11T18:00", result: null },
    { id: uid(), stage: "Quart de finale", venue: "Kansas City", a: { name: "Vainqueur 8e-7", flag: "🏳️" }, b: { name: "Vainqueur 8e-8", flag: "🏳️" }, date: "2026-07-11T21:00", result: null },
    { id: uid(), stage: "Demi-finale", venue: "Dallas", a: { name: "Vainqueur QF1", flag: "🏳️" }, b: { name: "Vainqueur QF2", flag: "🏳️" }, date: "2026-07-14T21:00", result: null },
    { id: uid(), stage: "Demi-finale", venue: "Atlanta", a: { name: "Vainqueur QF3", flag: "🏳️" }, b: { name: "Vainqueur QF4", flag: "🏳️" }, date: "2026-07-15T21:00", result: null },
    { id: uid(), stage: "3e place", venue: "Miami", a: { name: "Perdant DF1", flag: "🏳️" }, b: { name: "Perdant DF2", flag: "🏳️" }, date: "2026-07-18T21:00", result: null },
    { id: uid(), stage: "Finale", venue: "New York / New Jersey", a: { name: "Finaliste 1", flag: "🏆" }, b: { name: "Finaliste 2", flag: "🏆" }, date: "2026-07-19T22:00", result: null },
  ];
}

function defaultState() {
  return {
    seedVersion: SEED_VERSION,
    players: [],
    matches: seedMatches(),
    // predictions[playerId][matchId] = {a, b}
    predictions: {},
    settings: {
      ptsExact: 3,
      ptsOutcome: 1,
      adminPin: "1234",
      surprises: [
        "🥇 1er : le trophée + les autres paient le resto 🍽️",
        "🥈 2e : une boisson offerte par les perdants 🥤",
        "🥉 3e : l'honneur… et un petit dessert 🍰",
      ],
    },
    currentPlayerId: null,
    currentPin: null,   // code secret du joueur de cet appareil (jamais partagé sauf pour s'authentifier)
  };
}

/* ---------- Persistance ---------- */
let S = load();
save(); // persiste l'état (et une éventuelle migration du calendrier) dès le démarrage
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const merged = { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...(parsed.settings || {}) } };
    // Migration : si le calendrier de départ a changé, on rafraîchit les matchs
    // (les joueurs, le barème et les surprises sont conservés).
    if (parsed.seedVersion !== SEED_VERSION) {
      merged.matches = seedMatches();
      merged.seedVersion = SEED_VERSION;
    }
    return merged;
  } catch (e) { return defaultState(); }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
function uid() { return "id" + Math.random().toString(36).slice(2, 9); }

/* ============================================================
   SYNCHRONISATION EN LIGNE (base partagée via /api/store)
   Repli automatique en mode local si la base n'est pas configurée.
   ============================================================ */
const API = "/api/store";
let ONLINE = false;          // true si la base partagée répond
let SYNCED_ONCE = false;
let SERVER_RANKING = null;   // classement calculé par le serveur (mode en ligne)
let REVEAL = null;           // cache des pronos révélés (matchs où j'ai le droit de voir)

function post(payload) {
  return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    .then(r => r.json()).catch(() => null);
}

async function syncPull(silent) {
  try {
    const r = await fetch(API, { cache: "no-store" });
    const d = await r.json();
    if (!d || !d.online) { ONLINE = false; updateNetBadge(); return; }
    const wasOffline = !ONLINE;
    ONLINE = true;
    if (d.config && Array.isArray(d.config.matches) && d.config.matches.length) {
      S.matches = d.config.matches;
      if (d.config.settings) S.settings = { ...S.settings, ...d.config.settings };
    } else {
      // Base vide : on l'initialise avec le calendrier/local courant.
      await pushConfig();
    }
    // Le serveur renvoie UNIQUEMENT le classement (points), jamais les pronos des autres.
    SERVER_RANKING = d.ranking || [];
    REVEAL = null;  // on rechargera les pronos révélés à la demande (données à jour)
    S.players = SERVER_RANKING.map(r => ({ id: r.id, name: r.name, avatar: r.avatar }));
    // Les pronos du joueur de cet appareil restent en local (privés).
    // Si le joueur de cet appareil n'existe plus côté serveur, on le déconnecte.
    if (S.currentPlayerId && !S.players.some(p => p.id === S.currentPlayerId)) { S.currentPlayerId = null; S.currentPin = null; }
    detectGoals();  // alerte "⚽ BUT !" si un score a changé
    save();
    SYNCED_ONCE = true;
    updateNetBadge();
    if (!silent || wasOffline) render();
    else refreshLiveViews();
  } catch (e) { ONLINE = false; updateNetBadge(); }
}

async function pushPlayer(pid) {
  if (!ONLINE) return;
  const p = S.players.find(x => x.id === pid); if (!p) return;
  await post({ action: "player", player: { id: p.id, name: p.name, avatar: p.avatar }, pin: S.currentPin || "", predictions: S.predictions[pid] || {} });
}
async function createPlayerOnline(p, pin) {
  if (!ONLINE) return { ok: true };
  return (await post({ action: "createPlayer", player: { id: p.id, name: p.name, avatar: p.avatar }, pin })) || { ok: false };
}
async function loginOnline(id, pin) {
  return (await post({ action: "login", id, pin })) || { ok: false };
}
async function pushConfig() {
  if (!ONLINE) return;
  await post({ action: "config", config: { matches: S.matches, settings: S.settings } });
}
async function pushDeletePlayer(id) { if (ONLINE) await post({ action: "deletePlayer", id }); }
async function pushReset() { if (ONLINE) await post({ action: "reset" }); }

// Rafraîchit les vues "temps réel" (classement/podium) sans casser une saisie en cours.
function refreshLiveViews() {
  if (activeTab === "ranking" || activeTab === "podium" || activeTab === "matches") render();
}

/* ---------- Détection des buts (alerte en direct) ---------- */
let lastResults = null;
function detectGoals() {
  const cur = {};
  S.matches.forEach(m => { cur[m.id] = m.result ? (m.result.a + "-" + m.result.b) : null; });
  if (lastResults === null) { lastResults = cur; return; }   // 1er passage : pas d'alerte
  for (const m of S.matches) {
    const before = lastResults[m.id], after = cur[m.id];
    if (after && after !== before) {
      let isGoal = true;
      if (before) {
        const [oa, ob] = before.split("-").map(Number);
        const [na, nb] = after.split("-").map(Number);
        isGoal = (na + nb) > (oa + ob);
      }
      if (isGoal) goalBanner(m);
    }
  }
  lastResults = cur;
}
function goalBanner(m) {
  const sc = m.result ? `${m.result.a}–${m.result.b}` : "";
  const el = document.createElement("div");
  el.className = "goal-banner";
  el.innerHTML = `<div class="gb-in">⚽ BUT !<span>${m.a.flag} ${esc(m.a.name)} <b>${sc}</b> ${esc(m.b.name)} ${m.b.flag}</span></div>`;
  document.body.appendChild(el);
  try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) {}
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 4200);
}

function updateNetBadge() {
  const el = document.getElementById("netBadge");
  if (!el) return;
  if (ONLINE) { el.textContent = "🟢 En ligne · partagé"; el.className = "net-badge on"; }
  else { el.textContent = "🟡 Local (cet appareil)"; el.className = "net-badge off"; }
}

/* ---------- Helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
function esc(s = "") { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function currentPlayer() { return S.players.find(p => p.id === S.currentPlayerId) || null; }
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function isLocked(m) { return new Date(m.date).getTime() <= Date.now(); }

/* ---------- Scoring ---------- */
function pointsFor(pred, result) {
  if (!pred || !result || pred.a == null || pred.b == null) return { pts: 0, kind: "none" };
  const pa = +pred.a, pb = +pred.b, ra = +result.a, rb = +result.b;
  if (pa === ra && pb === rb) return { pts: S.settings.ptsExact, kind: "exact" };
  const po = Math.sign(pa - pb), ro = Math.sign(ra - rb);
  if (po === ro) return { pts: S.settings.ptsOutcome, kind: "outcome" };
  return { pts: 0, kind: "miss" };
}
function playerScore(playerId) {
  let pts = 0, exact = 0, good = 0, played = 0, filled = 0;
  const preds = S.predictions[playerId] || {};
  for (const m of S.matches) {
    const pr = preds[m.id];
    if (pr && pr.a != null) filled++;
    if (!m.result) continue;
    const r = pointsFor(pr, m.result);
    if (pr && pr.a != null) played++;
    pts += r.pts;
    if (r.kind === "exact") exact++;
    else if (r.kind === "outcome") good++;
  }
  return { pts, exact, good, played, filled };
}
function ranking() {
  // En ligne : le serveur calcule les points (sans exposer les pronos des autres).
  if (ONLINE && SERVER_RANKING) {
    return SERVER_RANKING.map(r => ({ player: { id: r.id, name: r.name, avatar: r.avatar }, pts: r.pts, exact: r.exact, good: r.good, played: r.played, filled: r.filled }));
  }
  // Hors-ligne : calcul local.
  return S.players
    .map(p => ({ player: p, ...playerScore(p.id) }))
    .sort((x, y) => y.pts - x.pts || y.exact - x.exact || y.good - x.good || x.player.name.localeCompare(y.player.name));
}

/* ---------- Toast + Confetti ---------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
function confetti() {
  const cv = $("#confetti"), ctx = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ["#2dd4bf", "#f59e0b", "#f472b6", "#22c55e", "#ffd54a", "#60a5fa"];
  const N = 140, parts = [];
  for (let i = 0; i < N; i++) parts.push({
    x: Math.random() * cv.width, y: -20 - Math.random() * cv.height,
    r: 4 + Math.random() * 6, c: colors[i % colors.length],
    vy: 2 + Math.random() * 4, vx: -2 + Math.random() * 4, rot: Math.random() * 6, vr: -.2 + Math.random() * .4,
  });
  let frames = 0;
  (function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); ctx.restore();
    });
    frames++;
    if (frames < 200) requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ============================================================
   ROUTING / TABS
   ============================================================ */
let activeTab = "matches";
function setTab(tab) {
  activeTab = tab;
  $$(".tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === tab));
  render();
}
$("#tabs").addEventListener("click", e => {
  const btn = e.target.closest(".tab"); if (btn) setTab(btn.dataset.tab);
});
$("#brandHome").addEventListener("click", () => setTab("matches"));

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  updateWhoChip();
  const main = $("#main");
  if (activeTab === "matches") main.innerHTML = viewMatches();
  else if (activeTab === "ranking") main.innerHTML = viewRanking();
  else if (activeTab === "podium") main.innerHTML = viewPodium();
  else if (activeTab === "admin") main.innerHTML = viewAdmin();
  wire();
}

function updateWhoChip() {
  const p = currentPlayer();
  $("#whoAvatar").textContent = p ? p.avatar : "🙂";
  $("#whoName").textContent = p ? p.name : "Choisir un joueur";
}

/* ---------- Vue MATCHS ---------- */
function viewMatches() {
  const p = currentPlayer();
  const next = S.matches.filter(m => !isLocked(m)).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  let html = `<div class="view">`;
  html += `<div class="hero">
      <h1>Salut ${p ? esc(p.name) + " " + p.avatar : "👋"}</h1>
      <p>Pronostique les prochains matchs, gagne des points et vise le podium&nbsp;! 🏆</p>
      ${next ? `<span class="pill">⏳ Prochain : ${esc(next.a.name)} ${next.a.flag} vs ${next.b.flag} ${esc(next.b.name)} · ${fmtDate(next.date)}</span>` : ""}
    </div>`;

  if (!p) {
    html += `<div class="empty"><div class="big">🎮</div><p>Crée ton profil pour commencer à jouer.</p>
      <button class="btn btn-primary" onclick="openPlayerModal()">Choisir mon joueur</button></div></div>`;
    return html;
  }

  const preds = S.predictions[p.id] || {};
  const sorted = [...S.matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  html += `<div class="hint">💡 Score exact = <b>${S.settings.ptsExact} pts</b> · Bon résultat = <b>${S.settings.ptsOutcome} pt</b>.<br>✅ Tu peux valider tes pronos <b>match par match</b> (pas besoin de tout faire d'un coup). ⚠️ Un prono validé est <b>définitif</b>.</div>`;

  for (const m of sorted) {
    const locked = isLocked(m);
    const pr = preds[m.id] || {};
    const res = m.result;
    const committed = pr.locked === true;      // prono validé = définitif
    const disabled = locked || committed;
    const gained = res ? pointsFor(pr, res) : null;
    const canReveal = committed;   // on ne voit les pronos des autres (et de Claude) qu'une fois SON prono validé
    html += `<div class="match" data-mid="${m.id}">
      <div class="match-top">
        <span class="stage-badge">${esc(m.stage)}</span>
        ${m.live ? `<span class="live-badge">EN DIRECT</span>` : `<span class="match-date">${fmtDate(m.date)}${m.venue ? " · 📍" + esc(m.venue) : ""}</span>`}
      </div>
      <div class="teams">
        <div class="team"><span class="flag">${m.a.flag}</span><span class="tname">${esc(m.a.name)}</span></div>
        <div class="score-inputs">
          <input class="score-input" type="number" min="0" max="30" inputmode="numeric" data-side="a" value="${pr.a ?? ""}" ${disabled ? "disabled" : ""} />
          <span class="vs">–</span>
          <input class="score-input" type="number" min="0" max="30" inputmode="numeric" data-side="b" value="${pr.b ?? ""}" ${disabled ? "disabled" : ""} />
        </div>
        <div class="team"><span class="flag">${m.b.flag}</span><span class="tname">${esc(m.b.name)}</span></div>
      </div>
      <div class="match-foot">
        <div>
          ${m.live && res ? `<span class="live-line">🔴 EN DIRECT · <span class="r">${res.a}–${res.b}</span></span>` :
      res ? `<span class="result-line">Résultat : <span class="r">${res.a}–${res.b}</span></span>` :
      committed ? `<span class="locked-badge">🔒 Prono validé : <b>${pr.a}–${pr.b}</b> · définitif</span>` :
      locked ? `<span class="locked-badge">🔒 Match commencé — prono impossible</span>` :
        (pr.a != null && pr.b != null) ? `<span class="saved-tag show">✏️ Brouillon — pas encore validé</span>` : ""}
        </div>
        <div class="inline">
          ${gained ? `<span class="pts-tag ${gained.kind === "exact" ? "pts-3" : gained.kind === "outcome" ? "pts-1" : "pts-0"}">+${gained.pts} pt${gained.pts > 1 ? "s" : ""}${gained.kind === "exact" ? " 🎯" : ""}</span>` : ""}
          ${(!disabled && !res) ? `<button class="btn btn-sm btn-primary" onclick="validateMatch('${m.id}')">✅ Valider ce prono</button>` : ""}
          ${canReveal ? `<button class="btn btn-sm btn-ghost" onclick="showPronos('${m.id}')">👀 Voir les pronos</button>` : ""}
        </div>
      </div>
    </div>`;
  }
  html += `<div class="savebar"><button class="btn btn-primary btn-block" id="saveAll">💾 Tout valider d'un coup (pronos remplis)</button></div>`;
  html += `</div>`;
  return html;
}

/* ---------- Vue CLASSEMENT (points uniquement — pronos privés) ---------- */
function viewRanking() {
  const rk = ranking();
  let html = `<div class="view"><div class="section-head"><h2>🏆 Classement</h2>
    <span class="small-muted">${S.players.length} joueur${S.players.length > 1 ? "s" : ""}</span></div>`;

  if (!S.players.length) {
    return html + `<div class="empty"><div class="big">🙈</div><p>Aucun joueur pour l'instant.</p></div></div>`;
  }

  html += `<div class="rank-list">`;
  rk.forEach((r, i) => {
    const pos = i + 1;
    const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos;
    const me = r.player.id === S.currentPlayerId;
    html += `<div class="rank-row rank-${pos} ${me ? "me" : ""}">
        <div class="rank-pos">${medal}</div>
        <div class="rank-id"><span class="av">${r.player.avatar}</span>
          <div><div class="nm">${esc(r.player.name)}${me ? " (toi)" : ""}</div>
          <div class="sub">📝 ${r.filled || 0} prono${(r.filled || 0) > 1 ? "s" : ""} · 🎯 ${r.exact} exact${r.exact > 1 ? "s" : ""} · ✅ ${r.good} bon${r.good > 1 ? "s" : ""}</div></div>
        </div>
        <div class="rank-pts"><b>${r.pts}</b><small>PTS</small></div>
      </div>`;
  });
  html += `</div><p class="hint" style="margin-top:14px">🔒 Les pronos de chacun restent <b>privés</b> : on ne voit que les points.</p>`;

  html += `</div>`;
  return html;
}

/* ---------- Vue PODIUM ---------- */
function viewPodium() {
  const rk = ranking();
  let html = `<div class="view podium-wrap"><div class="section-head"><h2>🎁 Podium & Surprises</h2></div>`;
  const hasResults = S.matches.some(m => m.result);
  if (!S.players.length || !hasResults) {
    return html + `<div class="empty"><div class="big">🏟️</div><p>Le podium s'affichera dès que des résultats seront saisis.</p>
      <p class="small-muted">L'organisateur peut entrer les résultats dans l'onglet ⚙️ Orga.</p></div></div>`;
  }
  const top3 = rk.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]]; // 2,1,3
  const cls = ["second", "first", "third"];
  const crown = ["🥈", "👑", "🥉"];
  html += `<div class="podium">`;
  order.forEach((r, i) => {
    if (!r) { html += `<div class="pod ${cls[i]}"></div>`; return; }
    html += `<div class="pod ${cls[i]}">
      <span class="crown">${crown[i]}</span>
      <span class="pav">${r.player.avatar}</span>
      <span class="pnm">${esc(r.player.name)}</span>
      <span class="ppt">${r.pts} pts</span>
    </div>`;
  });
  html += `</div>`;

  html += `<button class="btn btn-primary" onclick="confetti();toast('🎉 Bravo au podium !')">🎉 Lancer les confettis</button>`;

  html += `<div class="surprise-card">
    <h3>🎁 Les surprises pour les 3 premiers</h3>
    <p class="small-muted">Récompenses définies par l'organisateur</p>
    <div class="gift-list">`;
  const medals = ["🥇", "🥈", "🥉"];
  for (let i = 0; i < 3; i++) {
    const r = top3[i];
    html += `<div class="gift"><span class="rk">${medals[i]}</span>
      <div class="gtxt"><b>${r ? esc(r.player.name) + " " + r.player.avatar : "—"}</b>
        <span>${esc(S.settings.surprises[i] || "")}</span></div></div>`;
  }
  html += `</div></div></div>`;
  return html;
}

/* ---------- Vue ORGA (admin) ---------- */
let adminUnlocked = false;
let adminSub = "results"; // results | matches | settings | players
function viewAdmin() {
  let html = `<div class="view"><div class="section-head"><h2>⚙️ Espace Organisateur</h2></div>`;
  if (!adminUnlocked) {
    return html + `<div class="card pin-gate">
      <div class="lock">🔒</div>
      <h3>Code organisateur</h3>
      <p class="sub">Entre le code pour gérer matchs, résultats et récompenses.</p>
      <input id="pinInput" type="password" inputmode="numeric" placeholder="Code (par défaut : 1234)" style="max-width:220px;margin:0 auto 12px;text-align:center" />
      <div><button class="btn btn-primary" id="pinBtn">Déverrouiller</button></div>
    </div></div>`;
  }

  html += `<div class="chip-tab">
    <button class="${adminSub === "results" ? "on" : ""}" onclick="setAdminSub('results')">📊 Résultats</button>
    <button class="${adminSub === "matches" ? "on" : ""}" onclick="setAdminSub('matches')">⚽ Matchs</button>
    <button class="${adminSub === "players" ? "on" : ""}" onclick="setAdminSub('players')">👥 Joueurs</button>
    <button class="${adminSub === "settings" ? "on" : ""}" onclick="setAdminSub('settings')">🎁 Réglages</button>
  </div>`;

  if (adminSub === "results") html += adminResults();
  else if (adminSub === "matches") html += adminMatches();
  else if (adminSub === "players") html += adminPlayers();
  else if (adminSub === "settings") html += adminSettings();

  html += `</div>`;
  return html;
}

function adminResults() {
  let html = `<div class="card"><h3>Saisir les résultats</h3><p class="sub">Le classement se met à jour automatiquement.</p>`;
  const sorted = [...S.matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const m of sorted) {
    const r = m.result || {};
    html += `<div class="admin-match" data-mid="${m.id}">
      <div class="amt"><b>${m.a.flag} ${esc(m.a.name)} vs ${esc(m.b.name)} ${m.b.flag}</b><span class="match-date">${esc(m.stage)}</span></div>
      <div class="result-set">
        <input type="number" min="0" max="30" class="res" data-side="a" value="${r.a ?? ""}" placeholder="-" />
        <span class="vs">–</span>
        <input type="number" min="0" max="30" class="res" data-side="b" value="${r.b ?? ""}" placeholder="-" />
        <button class="btn btn-sm btn-primary" onclick="saveResult('${m.id}')">Valider</button>
        ${m.result ? `<button class="btn btn-sm btn-ghost" onclick="clearResult('${m.id}')">Effacer</button>` : ""}
      </div>
    </div>`;
  }
  return html + `</div>`;
}

function adminMatches() {
  let html = `<div class="card"><h3>Gérer les matchs</h3><p class="sub">Ajoute, modifie ou supprime les rencontres à pronostiquer.</p>`;
  const sorted = [...S.matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const m of sorted) {
    html += `<div class="admin-match" data-mid="${m.id}">
      <div class="field"><input class="mfield" data-f="stage" value="${esc(m.stage)}" placeholder="Phase (ex: Quart de finale)" /></div>
      <div class="row2">
        <div class="inline"><input class="mfield" data-f="aflag" value="${m.a.flag}" style="width:52px;text-align:center" /><input class="mfield" data-f="aname" value="${esc(m.a.name)}" placeholder="Équipe A" /></div>
        <div class="inline"><input class="mfield" data-f="bflag" value="${m.b.flag}" style="width:52px;text-align:center" /><input class="mfield" data-f="bname" value="${esc(m.b.name)}" placeholder="Équipe B" /></div>
      </div>
      <div class="field" style="margin-top:10px"><input class="mfield" data-f="date" type="datetime-local" value="${m.date}" /></div>
      <div class="inline"><button class="btn btn-sm btn-primary" onclick="saveMatch('${m.id}')">💾 Enregistrer</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMatch('${m.id}')">🗑 Supprimer</button></div>
    </div>`;
  }
  html += `<div class="divider"></div><button class="btn btn-primary btn-block" onclick="addMatch()">➕ Ajouter un match</button>`;
  return html + `</div>`;
}

function adminPlayers() {
  let html = `<div class="card"><h3>Joueurs</h3><p class="sub">La liste des amis qui participent.</p>`;
  if (!S.players.length) html += `<p class="muted">Aucun joueur.</p>`;
  S.players.forEach(p => {
    html += `<div class="admin-match"><div class="amt"><b>${p.avatar} ${esc(p.name)}</b>
      <button class="btn btn-sm btn-danger" onclick="deletePlayer('${p.id}')">Retirer</button></div></div>`;
  });
  html += `<div class="divider"></div><button class="btn btn-primary btn-block" onclick="openPlayerModal()">➕ Ajouter un joueur</button></div>`;
  return html;
}

function adminSettings() {
  const s = S.settings;
  let html = `<div class="card"><h3>🎯 Barème des points</h3>
    <div class="row2">
      <div class="field"><label>Score exact</label><input id="setExact" type="number" min="0" value="${s.ptsExact}" /></div>
      <div class="field"><label>Bon résultat</label><input id="setOutcome" type="number" min="0" value="${s.ptsOutcome}" /></div>
    </div>
    <button class="btn btn-primary" onclick="saveScoring()">Enregistrer le barème</button>
  </div>`;

  html += `<div class="card"><h3>🎁 Surprises du podium</h3><p class="sub">Ce que gagnent les 3 premiers.</p>
    <div class="field"><label>🥇 1er</label><textarea id="sur0">${esc(s.surprises[0] || "")}</textarea></div>
    <div class="field"><label>🥈 2e</label><textarea id="sur1">${esc(s.surprises[1] || "")}</textarea></div>
    <div class="field"><label>🥉 3e</label><textarea id="sur2">${esc(s.surprises[2] || "")}</textarea></div>
    <button class="btn btn-primary" onclick="saveSurprises()">Enregistrer les surprises</button>
  </div>`;

  html += `<div class="card"><h3>🔐 Code organisateur</h3>
    <div class="field"><input id="setPin" placeholder="Nouveau code" value="${esc(s.adminPin)}" /></div>
    <button class="btn btn-primary" onclick="savePin()">Changer le code</button>
  </div>`;

  html += `<div class="card"><h3>💾 Données</h3><p class="sub">Sauvegarde ou remise à zéro.</p>
    <div class="inline">
      <button class="btn btn-sm" onclick="exportData()">⬇️ Exporter</button>
      <button class="btn btn-sm" onclick="importData()">⬆️ Importer</button>
      <button class="btn btn-sm btn-danger" onclick="resetAll()">♻️ Tout réinitialiser</button>
    </div></div>`;
  return html;
}

/* ============================================================
   WIRING (événements après chaque render)
   ============================================================ */
function wire() {
  // score inputs (matchs)
  $$("#main .match .score-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const p = currentPlayer(); if (!p) return;
      const card = inp.closest(".match"); const mid = card.dataset.mid;
      const side = inp.dataset.side;
      S.predictions[p.id] = S.predictions[p.id] || {};
      S.predictions[p.id][mid] = S.predictions[p.id][mid] || {};
      const v = inp.value === "" ? null : Math.max(0, Math.min(30, +inp.value));
      S.predictions[p.id][mid][side] = v;
      save(); // on garde le brouillon localement (pas encore validé)
    });
  });
  const saveAll = $("#saveAll");
  if (saveAll) saveAll.addEventListener("click", () => {
    const p = currentPlayer(); if (!p) return;
    const preds = S.predictions[p.id] || {};
    // pronos complets, pas encore verrouillés, et dont le match n'a pas commencé
    const toLock = S.matches.filter(m => {
      const pr = preds[m.id];
      return pr && pr.a != null && pr.b != null && !pr.locked && !isLocked(m);
    });
    if (!toLock.length) { toast("Aucun nouveau prono à enregistrer"); return; }
    const lignes = toLock.map(m => `• ${m.a.name} ${preds[m.id].a}–${preds[m.id].b} ${m.b.name}`).join("\n");
    if (!confirm(`⚠️ ATTENTION : une fois enregistrés, ces ${toLock.length} prono(s) seront DÉFINITIFS et ne pourront PLUS être modifiés :\n\n${lignes}\n\nConfirmer l'enregistrement ?`)) return;
    toLock.forEach(m => { S.predictions[p.id][m.id].locked = true; });
    REVEAL = null;  // nouveaux pronos validés -> on pourra voir ceux des autres
    save(); pushPlayer(p.id); toast("🔒 Pronos enregistrés et verrouillés !"); render();
  });

  const pinBtn = $("#pinBtn");
  if (pinBtn) pinBtn.addEventListener("click", () => {
    if ($("#pinInput").value.trim() === String(S.settings.adminPin)) { adminUnlocked = true; render(); }
    else toast("❌ Code incorrect");
  });

}

/* ============================================================
   ACTIONS globales (appelées via onclick)
   ============================================================ */
window.setAdminSub = s => { adminSub = s; render(); };
window.confetti = confetti;

// Voir les pronos des autres pour un match (autorisé une fois le sien validé / match commencé).
window.showPronos = async (mid) => {
  const m = S.matches.find(x => x.id === mid); if (!m) return;
  let list;
  if (ONLINE) {
    if (!REVEAL) {
      const r = await post({ action: "reveal", id: S.currentPlayerId, pin: S.currentPin });
      REVEAL = (r && r.ok) ? (r.reveal || {}) : {};
    }
    list = REVEAL[mid];
    if (!list) { toast("🔒 Valide d'abord ton prono pour voir ceux des autres"); return; }
  } else {
    list = S.players.map(p => {
      const pr = (S.predictions[p.id] || {})[mid];
      return (pr && pr.a != null) ? { name: p.name, avatar: p.avatar, a: pr.a, b: pr.b } : null;
    }).filter(Boolean);
  }
  if (!list.length) { toast("Personne n'a encore mis de prono ici"); return; }
  openRevealModal(m, list);
};

function isClaude(x) { return x && (x.avatar === "🤖" || /^claude$/i.test(x.name || "")); }

function openRevealModal(m, list) {
  const claude = list.find(isClaude);
  const humans = list.filter(x => !isClaude(x));
  let statsHtml = "";

  if (claude) {
    statsHtml += `<div class="gift" style="border-color:rgba(240,192,64,.5)">
      <span class="rk">🤖</span>
      <div class="gtxt"><b>Le prono de Claude (analyse)</b>
        <span>${m.a.flag} ${esc(m.a.name)} <b style="color:var(--gold)">${claude.a}–${claude.b}</b> ${esc(m.b.name)} ${m.b.flag}</span></div>
    </div>`;
  }
  if (humans.length) {
    const avgA = humans.reduce((s, x) => s + (+x.a), 0) / humans.length;
    const avgB = humans.reduce((s, x) => s + (+x.b), 0) / humans.length;
    const freq = {};
    humans.forEach(x => { const k = x.a + "–" + x.b; freq[k] = (freq[k] || 0) + 1; });
    const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    statsHtml += `<div class="gift"><span class="rk">📊</span>
      <div class="gtxt"><b>Moyenne du groupe</b><span>${avgA.toFixed(1)} – ${avgB.toFixed(1)} (sur ${humans.length} joueur${humans.length > 1 ? "s" : ""})</span></div></div>`;
    statsHtml += `<div class="gift"><span class="rk">⭐</span>
      <div class="gtxt"><b>Le prono le plus choisi</b><span><b>${best[0]}</b> · ${best[1]} joueur${best[1] > 1 ? "s" : ""}</span></div></div>`;
  }

  const listHtml = list.map(x => `<div class="gift" style="padding:8px 12px${isClaude(x) ? ";border-color:rgba(240,192,64,.5)" : ""}">
      <span class="rk" style="font-size:18px">${x.avatar}</span>
      <div class="gtxt"><b>${esc(x.name)}${isClaude(x) ? " 🤖" : ""}</b><span>${x.a}–${x.b}</span></div>
    </div>`).join("");

  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = `<div class="modal">
      <h2 style="font-size:18px">${m.a.flag} ${esc(m.a.name)} <span class="muted">vs</span> ${esc(m.b.name)} ${m.b.flag}</h2>
      ${m.result ? `<p class="muted" style="margin:2px 0 0">Résultat : <b style="color:var(--gold)">${m.result.a}–${m.result.b}</b></p>` : `<p class="muted" style="margin:2px 0 0">${esc(m.stage)}</p>`}
      <div class="gift-list" style="margin-top:14px">${statsHtml}</div>
      <div class="divider"></div>
      <p class="small-muted" style="margin:0 0 8px">Tous les pronos</p>
      <div class="gift-list">${listHtml}</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="this.closest('.modal-backdrop').remove()">Fermer</button>
    </div>`;
  back.addEventListener("click", e => { if (e.target === back) back.remove(); });
  document.body.appendChild(back);
}

// Valider UN seul prono (match par match), sans toucher aux autres.
window.validateMatch = (mid) => {
  const p = currentPlayer(); if (!p) { toast("Choisis ton joueur"); return; }
  const m = S.matches.find(x => x.id === mid); if (!m) return;
  const pr = (S.predictions[p.id] || {})[mid];
  if (!pr || pr.a == null || pr.b == null) { toast("Entre les 2 scores d'abord ✍️"); return; }
  if (isLocked(m)) { toast("🔒 Match déjà commencé"); return; }
  if (pr.locked) { toast("Déjà validé ✅"); return; }
  if (!confirm(`✅ Valider ton prono : ${m.a.name} ${pr.a}–${pr.b} ${m.b.name} ?\n\n⚠️ Il sera DÉFINITIF et ne pourra plus être modifié.`)) return;
  S.predictions[p.id][mid].locked = true;
  REVEAL = null;
  save(); pushPlayer(p.id); toast("🔒 Prono validé !"); render();
};

window.saveResult = mid => {
  const card = $(`.admin-match[data-mid="${mid}"]`);
  const a = card.querySelector('.res[data-side="a"]').value;
  const b = card.querySelector('.res[data-side="b"]').value;
  if (a === "" || b === "") { toast("Entre les 2 scores"); return; }
  const m = S.matches.find(x => x.id === mid);
  m.result = { a: +a, b: +b };
  save(); pushConfig(); toast("✅ Résultat enregistré — classement mis à jour"); render();
};
window.clearResult = mid => {
  const m = S.matches.find(x => x.id === mid); m.result = null; save(); pushConfig(); render();
};

window.saveMatch = mid => {
  const card = $(`.admin-match[data-mid="${mid}"]`);
  const g = f => card.querySelector(`.mfield[data-f="${f}"]`).value;
  const m = S.matches.find(x => x.id === mid);
  m.stage = g("stage") || "Match";
  m.a = { name: g("aname") || "Équipe A", flag: g("aflag") || "🏳️" };
  m.b = { name: g("bname") || "Équipe B", flag: g("bflag") || "🏳️" };
  m.date = g("date") || m.date;
  save(); pushConfig(); toast("💾 Match enregistré"); render();
};
window.deleteMatch = mid => {
  if (!confirm("Supprimer ce match ?")) return;
  S.matches = S.matches.filter(x => x.id !== mid);
  Object.values(S.predictions).forEach(pp => delete pp[mid]);
  save(); pushConfig(); render();
};
window.addMatch = () => {
  S.matches.push({ id: uid(), stage: "Match", a: { name: "Équipe A", flag: "🏳️" }, b: { name: "Équipe B", flag: "🏳️" },
    date: "2026-07-19T21:00", result: null });
  save(); pushConfig(); render();
};

window.deletePlayer = pid => {
  if (!confirm("Retirer ce joueur et ses pronos ?")) return;
  S.players = S.players.filter(p => p.id !== pid);
  delete S.predictions[pid];
  if (S.currentPlayerId === pid) S.currentPlayerId = null;
  save(); pushDeletePlayer(pid); render();
};

window.saveScoring = () => {
  S.settings.ptsExact = Math.max(0, +$("#setExact").value || 0);
  S.settings.ptsOutcome = Math.max(0, +$("#setOutcome").value || 0);
  save(); pushConfig(); toast("🎯 Barème enregistré"); render();
};
window.saveSurprises = () => {
  S.settings.surprises = [$("#sur0").value, $("#sur1").value, $("#sur2").value];
  save(); pushConfig(); toast("🎁 Surprises enregistrées");
};
window.savePin = () => { S.settings.adminPin = $("#setPin").value.trim() || "1234"; save(); pushConfig(); toast("🔐 Code changé"); };

window.exportData = () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "dimaprono-sauvegarde.json"; a.click(); URL.revokeObjectURL(url);
  toast("⬇️ Sauvegarde téléchargée");
};
window.importData = () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json";
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { S = { ...defaultState(), ...JSON.parse(reader.result) }; save(); toast("⬆️ Données importées"); render(); }
      catch (e) { toast("❌ Fichier invalide"); }
    };
    reader.readAsText(f);
  };
  inp.click();
};
window.resetAll = async () => {
  if (!confirm("Tout réinitialiser ? (joueurs, pronos, résultats)")) return;
  await pushReset();
  S = defaultState(); save(); adminUnlocked = false; setTab("matches");
  if (ONLINE) syncPull();  // ré-initialise la base partagée avec le calendrier
};

/* ============================================================
   MODAL JOUEUR
   ============================================================ */
let pickAvatar = AVATARS[0];
window.openPlayerModal = () => {
  const modal = $("#playerModal"); modal.hidden = false;
  const list = $("#playerList");
  list.innerHTML = S.players.length
    ? S.players.map(p => `<div class="pchip" onclick="loginPlayer('${p.id}')">${p.avatar} ${esc(p.name)}</div>`).join("")
    : `<span class="muted">Aucun profil pour l'instant. Crée le tien ci-dessous 👇</span>`;
  const row = $("#avatarRow");
  row.innerHTML = AVATARS.map(a => `<span class="av-opt ${a === pickAvatar ? "sel" : ""}" data-a="${a}">${a}</span>`).join("");
  row.querySelectorAll(".av-opt").forEach(el => el.addEventListener("click", () => {
    pickAvatar = el.dataset.a;
    row.querySelectorAll(".av-opt").forEach(x => x.classList.toggle("sel", x.dataset.a === pickAvatar));
  }));
};
function closeModal() { $("#playerModal").hidden = true; }

// Se connecter à un profil existant (code secret requis en ligne).
window.loginPlayer = async (pid) => {
  if (!ONLINE) { S.currentPlayerId = pid; save(); closeModal(); render(); return; }
  const pin = prompt("🔒 Entre TON code secret pour te connecter à ce profil :");
  if (pin == null) return;
  const r = await loginOnline(pid, pin.trim());
  if (r && r.ok) {
    S.currentPlayerId = pid; S.currentPin = pin.trim();
    S.predictions[pid] = r.player.predictions || {};
    save(); closeModal(); render(); toast("Connecté ✅");
  } else if (r && r.error === "badpin") toast("❌ Code secret incorrect");
  else toast("❌ Connexion impossible");
};

$("#addPlayerBtn").addEventListener("click", async () => {
  const name = $("#newPlayerName").value.trim();
  const pin = ($("#newPlayerPin").value || "").trim();
  if (!name) { toast("Entre un pseudo"); return; }
  if (!/^\d{4,8}$/.test(pin)) { toast("Choisis un code secret de 4 à 8 chiffres 🔒"); return; }
  const p = { id: uid(), name, avatar: pickAvatar };
  if (ONLINE) {
    const r = await createPlayerOnline(p, pin);
    if (!r || r.ok !== true) { toast("❌ Création impossible, réessaie"); return; }
  }
  S.players.push(p); S.currentPlayerId = p.id; S.currentPin = pin; S.predictions[p.id] = {};
  save();
  $("#newPlayerName").value = ""; $("#newPlayerPin").value = "";
  closeModal(); render(); toast(`Bienvenue ${p.avatar} ${name} ! Retiens bien ton code 🔒`);
});
$("#whoChip").addEventListener("click", openPlayerModal);
$("#playerModal").addEventListener("click", e => { if (e.target.id === "playerModal") closeModal(); });

/* ============================================================
   INIT
   ============================================================ */
render();

// Synchronisation en ligne : 1er chargement, puis rafraîchissement régulier.
(async function initSync() {
  await syncPull();
  // Premier lancement : proposer la création de profil si personne n'existe (local + serveur).
  if (!S.currentPlayerId && !S.players.length) setTimeout(() => openPlayerModal(), 300);
  updateNetBadge();
})();

// Rafraîchit le classement avec les pronos des amis toutes les 15 s + au retour sur l'onglet.
setInterval(() => { if (ONLINE) syncPull(true); }, 15000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && ONLINE) syncPull(true); });
