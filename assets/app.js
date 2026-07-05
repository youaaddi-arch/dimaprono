/* ============================================================
   Dima Prono — Pronostics Coupe du Monde entre amis
   100% local (localStorage). Aucune installation.
   ============================================================ */

const STORE_KEY = "dimaprono_v1";
const AVATARS = ["😎","🔥","⚽","🦁","🐐","🚀","👑","🎯","🧠","🍀","🐉","🦅","💪","🎩","🤠","🐧","🦊","🐼","🌟","🥷"];
const FLAGS = ["🇫🇷","🇧🇷","🇦🇷","🏴","🇪🇸","🇵🇹","🇳🇱","🇩🇪","🇮🇹","🇧🇪","🇭🇷","🇲🇦","🇺🇸","🇲🇽","🇺🇾","🇯🇵","🇰🇷","🇸🇳","🇨🇦","🇨🇴","🇨🇭","🇩🇰","🇷🇸","🇬🇭","🏳️"];

/* ---------- Données de départ : Coupe du Monde 2026 (modifiable) ---------- */
function seedMatches() {
  return [
    { id: uid(), stage: "Quart de finale", a: { name: "France", flag: "🇫🇷" }, b: { name: "Brésil", flag: "🇧🇷" }, date: "2026-07-09T21:00", result: null },
    { id: uid(), stage: "Quart de finale", a: { name: "Argentine", flag: "🇦🇷" }, b: { name: "Angleterre", flag: "🏴" }, date: "2026-07-10T21:00", result: null },
    { id: uid(), stage: "Quart de finale", a: { name: "Espagne", flag: "🇪🇸" }, b: { name: "Pays-Bas", flag: "🇳🇱" }, date: "2026-07-11T18:00", result: null },
    { id: uid(), stage: "Quart de finale", a: { name: "Portugal", flag: "🇵🇹" }, b: { name: "Allemagne", flag: "🇩🇪" }, date: "2026-07-11T21:00", result: null },
    { id: uid(), stage: "Demi-finale", a: { name: "À déterminer", flag: "🏳️" }, b: { name: "À déterminer", flag: "🏳️" }, date: "2026-07-14T21:00", result: null },
    { id: uid(), stage: "Demi-finale", a: { name: "À déterminer", flag: "🏳️" }, b: { name: "À déterminer", flag: "🏳️" }, date: "2026-07-15T21:00", result: null },
    { id: uid(), stage: "Petite finale", a: { name: "À déterminer", flag: "🏳️" }, b: { name: "À déterminer", flag: "🏳️" }, date: "2026-07-18T21:00", result: null },
    { id: uid(), stage: "Finale", a: { name: "À déterminer", flag: "🏳️" }, b: { name: "À déterminer", flag: "🏳️" }, date: "2026-07-19T21:00", result: null },
  ];
}

function defaultState() {
  return {
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
  };
}

/* ---------- Persistance ---------- */
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...(parsed.settings || {}) } };
  } catch (e) { return defaultState(); }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
function uid() { return "id" + Math.random().toString(36).slice(2, 9); }

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
  let pts = 0, exact = 0, good = 0, played = 0;
  const preds = S.predictions[playerId] || {};
  for (const m of S.matches) {
    if (!m.result) continue;
    const r = pointsFor(preds[m.id], m.result);
    if (preds[m.id]) played++;
    pts += r.pts;
    if (r.kind === "exact") exact++;
    else if (r.kind === "outcome") good++;
  }
  return { pts, exact, good, played };
}
function ranking() {
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
  html += `<div class="hint">💡 Score exact = <b>${S.settings.ptsExact} pts</b> · Bon résultat = <b>${S.settings.ptsOutcome} pt</b>. Tu peux modifier tant que le match n'a pas commencé.</div>`;

  for (const m of sorted) {
    const locked = isLocked(m);
    const pr = preds[m.id] || {};
    const res = m.result;
    const gained = res ? pointsFor(pr, res) : null;
    html += `<div class="match" data-mid="${m.id}">
      <div class="match-top">
        <span class="stage-badge">${esc(m.stage)}</span>
        <span class="match-date">${fmtDate(m.date)}</span>
      </div>
      <div class="teams">
        <div class="team"><span class="flag">${m.a.flag}</span><span class="tname">${esc(m.a.name)}</span></div>
        <div class="score-inputs">
          <input class="score-input" type="number" min="0" max="30" inputmode="numeric" data-side="a" value="${pr.a ?? ""}" ${locked ? "disabled" : ""} />
          <span class="vs">–</span>
          <input class="score-input" type="number" min="0" max="30" inputmode="numeric" data-side="b" value="${pr.b ?? ""}" ${locked ? "disabled" : ""} />
        </div>
        <div class="team"><span class="flag">${m.b.flag}</span><span class="tname">${esc(m.b.name)}</span></div>
      </div>
      <div class="match-foot">
        <div>
          ${res ? `<span class="result-line">Résultat : <span class="r">${res.a}–${res.b}</span></span>` :
      locked ? `<span class="locked-badge">🔒 Match en cours / terminé</span>` :
        `<span class="saved-tag ${pr.a != null && pr.b != null ? "show" : ""}">✅ Prono enregistré</span>`}
        </div>
        <div class="inline">
          ${gained ? `<span class="pts-tag ${gained.kind === "exact" ? "pts-3" : gained.kind === "outcome" ? "pts-1" : "pts-0"}">+${gained.pts} pt${gained.pts > 1 ? "s" : ""}${gained.kind === "exact" ? " 🎯" : ""}</span>` : ""}
          <button class="btn btn-sm btn-ghost" onclick="showMatchPronos('${m.id}')">👀 Voir les pronos</button>
        </div>
      </div>
    </div>`;
  }
  html += `<div class="savebar"><button class="btn btn-primary btn-block" id="saveAll">💾 Enregistrer mes pronos</button></div>`;
  html += `</div>`;
  return html;
}

/* ---------- Vue CLASSEMENT ---------- */
let rankMode = "global"; // global | detail
let detailPlayerId = null;
function viewRanking() {
  const rk = ranking();
  let html = `<div class="view"><div class="section-head"><h2>🏆 Classement</h2>
    <span class="small-muted">${S.players.length} joueur${S.players.length > 1 ? "s" : ""}</span></div>`;

  html += `<div class="chip-tab">
    <button class="${rankMode === "global" ? "on" : ""}" onclick="setRankMode('global')">Général</button>
    <button class="${rankMode === "detail" ? "on" : ""}" onclick="setRankMode('detail')">Pronos par joueur</button>
  </div>`;

  if (!S.players.length) {
    return html + `<div class="empty"><div class="big">🙈</div><p>Aucun joueur pour l'instant.</p></div></div>`;
  }

  if (rankMode === "global") {
    html += `<div class="rank-list">`;
    rk.forEach((r, i) => {
      const pos = i + 1;
      const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos;
      const me = r.player.id === S.currentPlayerId;
      html += `<div class="rank-row rank-${pos} ${me ? "me" : ""}" onclick="openDetail('${r.player.id}')" style="cursor:pointer">
        <div class="rank-pos">${medal}</div>
        <div class="rank-id"><span class="av">${r.player.avatar}</span>
          <div><div class="nm">${esc(r.player.name)}${me ? " (toi)" : ""}</div>
          <div class="sub">🎯 ${r.exact} exact${r.exact > 1 ? "s" : ""} · ✅ ${r.good} bon${r.good > 1 ? "s" : ""} · ${r.played} joué${r.played > 1 ? "s" : ""}</div></div>
        </div>
        <div class="rank-pts"><b>${r.pts}</b><small>PTS</small></div>
      </div>`;
    });
    html += `</div><p class="hint" style="margin-top:14px">👆 Touche un joueur pour voir tous ses pronos.</p>`;
  } else {
    // detail: pick a player, show all their pronos
    const pid = detailPlayerId || (rk[0] && rk[0].player.id);
    html += `<div class="field"><label>Choisir un joueur</label><select id="detailSelect">`;
    rk.forEach(r => { html += `<option value="${r.player.id}" ${r.player.id === pid ? "selected" : ""}>${r.player.avatar} ${esc(r.player.name)} — ${r.pts} pts</option>`; });
    html += `</select></div>`;
    html += renderPlayerPronos(pid);
  }

  html += `</div>`;
  return html;
}

function renderPlayerPronos(pid) {
  const player = S.players.find(p => p.id === pid);
  if (!player) return "";
  const preds = S.predictions[pid] || {};
  const sc = playerScore(pid);
  let html = `<div class="card" style="text-align:center">
      <div style="font-size:34px">${player.avatar}</div>
      <h3 style="margin:4px 0 0">${esc(player.name)}</h3>
      <p class="sub" style="margin:2px 0 0">${sc.pts} pts · 🎯 ${sc.exact} score${sc.exact > 1 ? "s" : ""} exact${sc.exact > 1 ? "s" : ""} · ✅ ${sc.good} bon résultat${sc.good > 1 ? "s" : ""}</p>
    </div>`;
  const sorted = [...S.matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const m of sorted) {
    const pr = preds[m.id];
    const locked = isLocked(m);
    const hidden = !locked && pid !== S.currentPlayerId; // ne pas dévoiler avant le coup d'envoi
    const gained = m.result ? pointsFor(pr, m.result) : null;
    html += `<div class="admin-match">
      <div class="amt"><b>${m.a.flag} ${esc(m.a.name)} <span class="muted">vs</span> ${esc(m.b.name)} ${m.b.flag}</b>
        <span class="match-date">${esc(m.stage)}</span></div>
      <div class="inline" style="justify-content:space-between">
        <span>${hidden ? `<span class="muted">🔒 Caché jusqu'au coup d'envoi</span>` :
        pr && pr.a != null ? `Prono : <b>${pr.a}–${pr.b}</b>` : `<span class="muted">Pas de prono</span>`}
          ${m.result ? ` · Résultat : <span class="r" style="color:var(--gold)">${m.result.a}–${m.result.b}</span>` : ""}</span>
        ${gained && !hidden ? `<span class="pts-tag ${gained.kind === "exact" ? "pts-3" : gained.kind === "outcome" ? "pts-1" : "pts-0"}">+${gained.pts}</span>` : ""}
      </div>
    </div>`;
  }
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
    });
  });
  const saveAll = $("#saveAll");
  if (saveAll) saveAll.addEventListener("click", () => { save(); toast("💾 Pronos enregistrés !"); render(); });

  const pinBtn = $("#pinBtn");
  if (pinBtn) pinBtn.addEventListener("click", () => {
    if ($("#pinInput").value.trim() === String(S.settings.adminPin)) { adminUnlocked = true; render(); }
    else toast("❌ Code incorrect");
  });

  const detailSelect = $("#detailSelect");
  if (detailSelect) detailSelect.addEventListener("change", () => { detailPlayerId = detailSelect.value; render(); });
}

/* ============================================================
   ACTIONS globales (appelées via onclick)
   ============================================================ */
window.setRankMode = m => { rankMode = m; render(); };
window.openDetail = pid => { rankMode = "detail"; detailPlayerId = pid; render(); };
window.setAdminSub = s => { adminSub = s; render(); };
window.confetti = confetti;

window.showMatchPronos = mid => {
  const m = S.matches.find(x => x.id === mid);
  const locked = isLocked(m);
  const lines = S.players.map(p => {
    const pr = (S.predictions[p.id] || {})[mid];
    const hidden = !locked && p.id !== S.currentPlayerId;
    const val = hidden ? "🔒" : (pr && pr.a != null ? `${pr.a}–${pr.b}` : "—");
    return `${p.avatar} ${p.name} : ${val}`;
  });
  if (!lines.length) { toast("Aucun joueur"); return; }
  alert(`Pronos — ${m.a.name} vs ${m.b.name}\n\n${lines.join("\n")}${!locked ? "\n\n(🔒 = caché jusqu'au coup d'envoi)" : ""}`);
};

window.saveResult = mid => {
  const card = $(`.admin-match[data-mid="${mid}"]`);
  const a = card.querySelector('.res[data-side="a"]').value;
  const b = card.querySelector('.res[data-side="b"]').value;
  if (a === "" || b === "") { toast("Entre les 2 scores"); return; }
  const m = S.matches.find(x => x.id === mid);
  m.result = { a: +a, b: +b };
  save(); toast("✅ Résultat enregistré — classement mis à jour"); render();
};
window.clearResult = mid => {
  const m = S.matches.find(x => x.id === mid); m.result = null; save(); render();
};

window.saveMatch = mid => {
  const card = $(`.admin-match[data-mid="${mid}"]`);
  const g = f => card.querySelector(`.mfield[data-f="${f}"]`).value;
  const m = S.matches.find(x => x.id === mid);
  m.stage = g("stage") || "Match";
  m.a = { name: g("aname") || "Équipe A", flag: g("aflag") || "🏳️" };
  m.b = { name: g("bname") || "Équipe B", flag: g("bflag") || "🏳️" };
  m.date = g("date") || m.date;
  save(); toast("💾 Match enregistré"); render();
};
window.deleteMatch = mid => {
  if (!confirm("Supprimer ce match ?")) return;
  S.matches = S.matches.filter(x => x.id !== mid);
  Object.values(S.predictions).forEach(pp => delete pp[mid]);
  save(); render();
};
window.addMatch = () => {
  S.matches.push({ id: uid(), stage: "Match", a: { name: "Équipe A", flag: "🏳️" }, b: { name: "Équipe B", flag: "🏳️" },
    date: "2026-07-19T21:00", result: null });
  save(); render();
};

window.deletePlayer = pid => {
  if (!confirm("Retirer ce joueur et ses pronos ?")) return;
  S.players = S.players.filter(p => p.id !== pid);
  delete S.predictions[pid];
  if (S.currentPlayerId === pid) S.currentPlayerId = null;
  save(); render();
};

window.saveScoring = () => {
  S.settings.ptsExact = Math.max(0, +$("#setExact").value || 0);
  S.settings.ptsOutcome = Math.max(0, +$("#setOutcome").value || 0);
  save(); toast("🎯 Barème enregistré"); render();
};
window.saveSurprises = () => {
  S.settings.surprises = [$("#sur0").value, $("#sur1").value, $("#sur2").value];
  save(); toast("🎁 Surprises enregistrées");
};
window.savePin = () => { S.settings.adminPin = $("#setPin").value.trim() || "1234"; save(); toast("🔐 Code changé"); };

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
window.resetAll = () => {
  if (!confirm("Tout réinitialiser ? (joueurs, pronos, résultats)")) return;
  S = defaultState(); save(); adminUnlocked = false; setTab("matches");
};

/* ============================================================
   MODAL JOUEUR
   ============================================================ */
let pickAvatar = AVATARS[0];
window.openPlayerModal = () => {
  const modal = $("#playerModal"); modal.hidden = false;
  const list = $("#playerList");
  list.innerHTML = S.players.length
    ? S.players.map(p => `<div class="pchip" onclick="selectPlayer('${p.id}')">${p.avatar} ${esc(p.name)}</div>`).join("")
    : `<span class="muted">Aucun profil pour l'instant.</span>`;
  const row = $("#avatarRow");
  row.innerHTML = AVATARS.map(a => `<span class="av-opt ${a === pickAvatar ? "sel" : ""}" data-a="${a}">${a}</span>`).join("");
  row.querySelectorAll(".av-opt").forEach(el => el.addEventListener("click", () => {
    pickAvatar = el.dataset.a;
    row.querySelectorAll(".av-opt").forEach(x => x.classList.toggle("sel", x.dataset.a === pickAvatar));
  }));
};
function closeModal() { $("#playerModal").hidden = true; }
window.selectPlayer = pid => { S.currentPlayerId = pid; save(); closeModal(); render(); };
$("#addPlayerBtn").addEventListener("click", () => {
  const name = $("#newPlayerName").value.trim();
  if (!name) { toast("Entre un pseudo"); return; }
  const p = { id: uid(), name, avatar: pickAvatar };
  S.players.push(p); S.currentPlayerId = p.id; S.predictions[p.id] = {};
  save(); $("#newPlayerName").value = ""; closeModal(); render(); toast(`Bienvenue ${p.avatar} ${name} !`);
});
$("#whoChip").addEventListener("click", openPlayerModal);
$("#playerModal").addEventListener("click", e => { if (e.target.id === "playerModal") closeModal(); });

/* ============================================================
   INIT
   ============================================================ */
if (!S.currentPlayerId && !S.players.length) {
  // premier lancement : proposer la création de profil
  setTimeout(() => openPlayerModal(), 400);
}
render();
