/** 覇道すごろく — 画面とネット。ルールは engine、盤は board、音は audio。 */

import { APP_VERSION } from './version.js';
import { createAudio } from './audio.js';
import { createNet } from './net.js';
import { JOB_LIST, JOBS, PLAYER_COLORS } from './jobs.js';
import { upgradeById } from './upgrades.js';
import { PATCH_NOTES } from './patchNotes.js';
import { isLocalPlayer, isMyTurnSeat } from './turn.js';
import {
  applyAction,
  badges,
  buildResults,
  createGame,
  currentPlayer,
  GOAL,
  listActions,
  rankOf,
  serializeState,
  skillLockReason,
} from './engine.js';
import { chooseCpuAction, chooseDraft } from './cpu.js';
import { createCamera, describeTile, drawBoard, fitCamera, hitTile } from './board.js';

const $ = (sel) => document.querySelector(sel);
const audio = createAudio();
const NAME_KEY = 'hadou-player-name';
const REJOIN_KEY = 'hadou-rejoin';

const app = {
  mode: null,
  net: null,
  game: null,
  localSeat: 0,
  localPeerId: null,
  localName: localStorage.getItem(NAME_KEY) || 'あなた',
  lobbyColor: PLAYER_COLORS[0],
  lobbyJob: 'vanguard',
  cpuLevel: 'normal',
  lobbyPlayers: [],
  setupSeats: [
    { name: 'あなた', job: 'vanguard', cpu: false },
    { name: 'CPU罠', job: 'trap', cpu: true },
  ],
  cam: createCamera(),
  userCam: false,
  displayPos: null,
  queue: [],
  inbox: [],
  busy: false,
  pumping: false,
  targeting: null,
  cpuSeat: null,
  cpuUsed: new Set(),
  cpuCount: 0,
  cpuTimer: null,
  disconnectTimers: new Map(),
  drag: null,
  toastTimer: null,
  flashResolve: null,
  draftPeek: false,
  lookSeat: null,
  inspectIndex: null,
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function toast(msg) {
  const el = $('#toast');
  el.hidden = false;
  el.textContent = msg;
  clearTimeout(app.toastTimer);
  app.toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === id));
  if (id === 'screen-game') requestAnimationFrame(resizeBoard);
}

/** 対局を閉じてタイトルへ。結果パネルやネットも片付ける。 */
function returnToTitle() {
  audio.stopBgm();
  clearTimeout(app.cpuTimer);
  app.cpuTimer = null;
  for (const t of app.disconnectTimers.values()) clearTimeout(t);
  app.disconnectTimers.clear();
  if (app.flashResolve) {
    const done = app.flashResolve;
    app.flashResolve = null;
    try { done(); } catch { /* ignore */ }
  }
  app.net?.destroy();
  app.net = null;
  app.game = null;
  app.mode = null;
  app.busy = false;
  app.pumping = false;
  app.queue = [];
  app.inbox = [];
  app.targeting = null;
  app.playerPick = null;
  app.draftPeek = false;
  app.lookSeat = null;
  app.inspectIndex = null;
  app.displayPos = null;
  app.cpuSeat = null;
  app.cpuUsed = new Set();
  app.cpuCount = 0;
  app.userCam = false;
  const winner = $('#winner');
  if (winner) winner.hidden = true;
  const modal = $('#modal');
  if (modal) modal.hidden = true;
  const flash = $('#event-flash');
  if (flash) flash.hidden = true;
  const reconnect = $('#reconnect-overlay');
  if (reconnect) reconnect.hidden = true;
  showScreen('screen-title');
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 結果画面の内容をPNGとして保存する */
function exportResultsPng() {
  const g = app.game;
  if (!g || g.phase !== 'gameover') {
    toast('まだ結果がない');
    return;
  }
  const { ranked, awards } = buildResults(g);
  const winner = g.players[g.winner];
  const W = 720;
  const pad = 40;
  const rowH = 54;
  const awardH = awards.length ? 28 + awards.length * 34 : 0;
  const H = pad + 120 + ranked.length * rowH + awardH + pad + 36;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const paper = '#fff8ea';
  const ink = '#221814';
  const hot = '#ff4d6d';
  const yolk = '#f6e2b8';
  const display = '"Yusei Magic", "Hiragino Maru Gothic ProN", sans-serif';
  const body = '"Dela Gothic One", "Hiragino Maru Gothic ProN", sans-serif';
  const roundRect = (x, y, w, h, r) => {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  ctx.fillStyle = hot;
  ctx.font = `28px ${display}`;
  ctx.fillText('GOAL', pad, pad + 28);
  ctx.fillStyle = ink;
  ctx.font = `44px ${display}`;
  ctx.fillText(`${winner?.name || ''} の勝ち`, pad, pad + 78);
  ctx.font = `20px ${body}`;
  ctx.fillStyle = '#5a4036';
  const jobName = winner ? (JOBS[winner.job]?.name || winner.job) : '';
  ctx.fillText(`${jobName}が100マス目に乗った  ·  v${APP_VERSION}`, pad, pad + 108);

  let y = pad + 140;
  ranked.forEach((p, i) => {
    ctx.fillStyle = ink;
    ctx.font = `22px ${body}`;
    ctx.fillText(`${i + 1}. ${p.name}`, pad, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${p.pos + 1}マス / HP${p.hp}`, W - pad, y);
    ctx.textAlign = 'left';
    const barY = y + 10;
    const barW = W - pad * 2;
    const barH = 16;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    roundRect(pad, barY, barW, barH, 999);
    ctx.fill();
    ctx.stroke();
    const fillW = Math.max(0, Math.min(1, (p.pos + 1) / 100)) * barW;
    if (fillW > 0) {
      ctx.fillStyle = p.color || hot;
      roundRect(pad, barY, fillW, barH, 999);
      ctx.fill();
    }
    y += rowH;
  });

  if (awards.length) {
    y += 8;
    for (const a of awards) {
      const label = `${a.title} ${a.name}（${a.detail}）`;
      ctx.font = `18px ${body}`;
      const tw = ctx.measureText(label).width;
      const bx = pad;
      const by = y - 18;
      const bw = Math.min(W - pad * 2, tw + 24);
      const bh = 28;
      ctx.fillStyle = yolk;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      roundRect(bx, by, bw, bh, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.fillText(label, bx + 12, y);
      y += 34;
    }
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      toast('PNGにできなかった');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadBlob(blob, `hadou-result-${stamp}.png`);
    toast('結果PNGを保存した');
  }, 'image/png');
}

function saveName(name) {
  app.localName = name;
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
}

function saveRejoin() {
  if (app.mode !== 'guest' && app.mode !== 'host') return;
  const room = app.net?.roomCode;
  if (!room) return;
  try {
    localStorage.setItem(REJOIN_KEY, JSON.stringify({
      room, name: app.localName, seat: app.localSeat,
    }));
  } catch { /* ignore */ }
}

function readRejoin() {
  try { return JSON.parse(localStorage.getItem(REJOIN_KEY) || 'null'); } catch { return null; }
}

function takenColors(exceptPeer) {
  return app.lobbyPlayers.filter((p) => p.peerId !== exceptPeer).map((p) => p.color);
}

function freeColor(preferred, used) {
  if (preferred && !used.includes(preferred)) return preferred;
  return PLAYER_COLORS.find((c) => !used.includes(c)) || PLAYER_COLORS[0];
}

function setStatus(msg, kind = 'info') {
  const el = $('#net-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `status-line ${kind}`;
}

function jobButtons(selected, attr = 'data-job', { compact = false } = {}) {
  return JOB_LIST.map((job) => `
    <button type="button" ${attr}="${job.id}" class="${selected === job.id ? 'on' : ''}" title="${escapeHtml(job.name)} — ${escapeHtml(job.blurb)}" aria-label="${escapeHtml(job.name)}">${compact ? job.mark : `${job.mark} ${job.name}`}</button>
  `).join('');
}

function renderSetup() {
  $('#setup-seats').innerHTML = app.setupSeats.map((seat, i) => `
    <div class="seat" data-i="${i}">
      <div class="seat-top">
        <input data-field="name" maxlength="12" value="${escapeHtml(seat.name)}" aria-label="名前" />
        <button type="button" data-field="cpu">${seat.cpu ? 'CPU' : '人間'}</button>
      </div>
      <div class="job-picks job-picks-compact">${jobButtons(seat.job, 'data-job', { compact: true })}</div>
    </div>
  `).join('');
  $('#setup-level').querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.level === app.cpuLevel);
  });
}

function renderPatch() {
  $('#patch-notes-list').innerHTML = PATCH_NOTES.map((note) => `
    <article class="patch-item">
      <h3>v${escapeHtml(note.version)} <small>${escapeHtml(note.date)}</small></h3>
      <ul>${note.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </article>
  `).join('');
}

function renderJobsCatalog() {
  $('#jobs-catalog').innerHTML = JOB_LIST.map((job) => `
    <article class="job-card">
      <div class="job-card-top">
        <h3>${escapeHtml(job.mark)} ${escapeHtml(job.name)}</h3>
        <span class="job-meta">ダイス ${job.dice[0]}〜${job.dice[1]} / HP${job.hp}</span>
      </div>
      <p class="job-blurb">${escapeHtml(job.blurb)}</p>
      <div class="job-skill"><span class="tag">常時</span><strong>${escapeHtml(job.passive.name)}</strong> — ${escapeHtml(job.passive.desc)}</div>
      ${job.skills.map((sk) => `
        <div class="job-skill"><span class="tag">${sk.kind === 'ult' ? '必殺' : '通常'}</span><strong>${escapeHtml(sk.name)}</strong>（CT${sk.ct}） — ${escapeHtml(sk.desc)}</div>
      `).join('')}
    </article>
  `).join('');
}

function renderLobby() {
  const host = app.mode === 'host';
  $('#lobby-title').textContent = host ? '部屋を開く' : '部屋に入る';
  $('#lobby-role').textContent = host
    ? 'コードを渡して、2人以上になったら開始。'
    : 'ホストと同じバージョンのコードを入れる。';
  $('#lobby-room-wrap').hidden = host;
  $('#lobby-host-box').hidden = !host;
  $('#btn-lobby-connect').textContent = host ? '部屋を作る' : '入室';
  $('#btn-lobby-connect').hidden = !!app.net;
  $('#btn-lobby-dismantle').hidden = !(host && app.net);
  $('#btn-lobby-reconnect').hidden = host || !readRejoin();
  $('#btn-lobby-start').disabled = !host || !app.net || app.lobbyPlayers.length < 2;
  $('#lobby-code').textContent = app.net?.roomCode || '------';
  $('#lobby-jobs').innerHTML = jobButtons(app.lobbyJob);
  const used = takenColors(app.localPeerId);
  $('#lobby-colors').innerHTML = PLAYER_COLORS.map((color) => `
    <button type="button" data-color="${color}" style="background:${color}" aria-label="${color}" ${used.includes(color) && color !== app.lobbyColor ? 'disabled' : ''} class="${color === app.lobbyColor ? 'on' : ''}"></button>
  `).join('');
  $('#lobby-level').querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.level === app.cpuLevel);
  });
  $('#lobby-level').hidden = !host;
  $('#lobby-players').innerHTML = app.lobbyPlayers.map((p) => `
    <div class="lobby-player">
      <span class="lp-dot" style="--pc:${p.color}"></span>
      <span>${escapeHtml(p.name)}（${escapeHtml(JOBS[p.job]?.name || '')}）${p.isHost ? ' ホスト' : ''}${p.isCPU ? ' CPU' : ''}</span>
      ${host && p.isCPU ? `<select data-cpu-job="${escapeHtml(p.peerId)}">${JOB_LIST.map((job) => `<option value="${job.id}" ${job.id === p.job ? 'selected' : ''}>${job.name}</option>`).join('')}</select>` : ''}
    </div>
  `).join('') || '<p class="hint">まだ誰もいない</p>';
}

function mePlayer() {
  if (!app.game) return null;
  if (app.mode === 'local') return null;
  return app.game.players.find((p) => p.peerId && p.peerId === app.localPeerId)
    || app.game.players[app.localSeat]
    || null;
}

function controlling(player) {
  if (!player) return false;
  return isLocalPlayer({
    mode: app.mode,
    player,
    localSeat: app.localSeat,
    localPeerId: app.localPeerId,
  });
}

function myTurn() {
  return isMyTurnSeat({
    mode: app.mode,
    phase: app.game?.phase,
    currentPlayer: app.game ? currentPlayer(app.game) : null,
    localSeat: app.localSeat,
    localPeerId: app.localPeerId,
  });
}

function renderHud() {
  const g = app.game;
  if (!g) return;
  const cur = currentPlayer(g);
  $('#round-chip').textContent = `R${g.round}`;
  $('#turn-chip').textContent = g.phase === 'draft' ? '強化' : g.phase === 'gameover' ? '終了' : `${cur?.name || ''}の番`;
  const lead = Math.max(...g.players.map((p) => p.pos));
  $('#goal-chip').textContent = `先頭 残り${Math.max(0, GOAL - lead)}`;
  $('#current-name').textContent = cur ? `${cur.name} / ${JOBS[cur.job].name}` : '';

  $('#players-panel').innerHTML = g.players.map((p) => {
    const ratio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    const tags = badges(p);
    const looking = app.lookSeat === p.id;
    return `
      <button type="button" class="player-card ${p.id === cur?.id ? 'turn' : ''} ${controlling(p) ? 'me' : ''} ${looking ? 'looking' : ''}" data-look="${p.id}" style="--pc:${p.color}">
        <div class="pc-top"><strong>${rankOf(g, p.id)}位 ${escapeHtml(p.name)}</strong><span>${p.hp}/${p.maxHp}</span></div>
        <div class="pc-sub">${JOBS[p.job].mark} ${JOBS[p.job].name} ・ ${p.pos + 1}マス${p.isCPU ? ' ・ CPU' : ''}${p.offline ? ' ・ 切断' : ''}</div>
        <div class="hp"><span style="width:${ratio * 100}%; background-color:${p.color}"></span></div>
        <div class="badges">${tags.map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join('')}<span class="badge look-badge">${looking ? '表示中' : '技'}</span></div>
      </button>
    `;
  }).join('');

  const looked = app.lookSeat != null ? g.players[app.lookSeat] : null;
  const focus = looked || (g.phase === 'act' ? cur : (g.players.find((p) => controlling(p)) || cur));
  const job = focus ? JOBS[focus.job] : null;
  const actionable = !!(
    focus && g.phase === 'act' && focus.id === cur?.id && myTurn() && !app.busy
  );
  let skills = '';
  if (job && focus) {
    const showBack = looked && !(g.phase === 'act' && looked.id === cur?.id);
    const back = showBack
      ? `<button type="button" class="btn tiny" id="btn-look-back">手番に戻す</button>`
      : '';
    skills = `<div class="sheet-head"><div><strong>${escapeHtml(focus.name)} のスキル</strong><div class="pc-sub">${escapeHtml(job.name)} ・ ダイス${job.dice[0]}〜${job.dice[1]}</div></div>${back}</div>`
      + `<p class="passive">常時 ${escapeHtml(job.passive.name)} — ${escapeHtml(job.passive.desc)}</p>`
      + job.skills.map((sk) => {
        const ct = focus.ct[sk.id] || 0;
        const lock = skillLockReason(g, focus.id, sk.id);
        const usable = actionable && !lock;
        const ctLabel = ct > 0 ? `CT${ct}` : (lock ? '条件' : (sk.kind === 'ult' ? '必殺' : '使える'));
        const detail = lock && ct === 0 ? `${sk.desc}（${lock}）` : sk.desc;
        return `<button type="button" class="btn skill-btn${usable ? '' : ' look'}" ${usable ? `data-skill="${sk.id}"` : 'disabled'}>
          <span class="ct">${ctLabel}</span>
          ${escapeHtml(sk.name)}
          <small>${escapeHtml(detail)}</small>
        </button>`;
      }).join('');
  }
  $('#skills-panel').innerHTML = skills;

  const canRoll = g.phase === 'act' && myTurn() && !app.busy && !!cur
    && listActions(g, cur.id).some((a) => a.type === 'roll');
  $('#btn-roll').hidden = g.phase === 'draft';
  $('#btn-roll').disabled = !canRoll;
  const draftWaiting = myDraftSeats().length > 0;
  $('#btn-draft-open').hidden = !(draftWaiting && app.draftPeek);
  const waiting = g.phase === 'act' && !myTurn() && g.phase !== 'gameover';
  $('#wait-hint').hidden = !(waiting || g.phase === 'draft');
  $('#wait-hint').textContent = g.phase === 'draft'
    ? (draftWaiting && app.draftPeek ? '盤と相手を見てから、強化を選んで' : '強化を選んでいる')
    : `${cur?.name || ''}の番`;
  const pickingDraft = myDraftSeats().length > 0;
  $('#btn-nudge').hidden = !(app.mode !== 'local' && app.game && g.phase !== 'gameover' && !myTurn() && !pickingDraft);
  $('#target-hint').hidden = !app.targeting;
  $('#btn-cancel-target').hidden = !app.targeting;
  if (app.targeting) {
    const spec = job?.skills.find((s) => s.id === app.targeting.id);
    $('#target-hint').textContent = `${spec?.name || ''} — 盤の赤枠をタップ`;
  }
  const logEl = $('#log');
  if (logEl) {
    const lines = g.log.slice(-24);
    const stickBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 48;
    logEl.innerHTML = lines.map((line) => (
      `<p class="${escapeHtml(line.kind || '')}">${escapeHtml(line.text)}</p>`
    )).join('');
    if (stickBottom || lines.length) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  const urgent = g.phase !== 'gameover' && g.players.some((p) => p.pos >= 85);
  audio.setBgmMode(urgent ? 'urgency' : 'normal');
  renderModal();
  renderWinner();
}

function myDraftSeats() {
  const g = app.game;
  if (!g || g.phase !== 'draft' || !g.drafts) return [];
  return Object.keys(g.drafts.offers).map(Number).filter((seat) => {
    if (g.drafts.picks[seat]) return false;
    return controlling(g.players[seat]);
  });
}

function renderModal() {
  const seats = app.busy ? [] : myDraftSeats();
  const picking = app.playerPick;
  if (app.game?.phase !== 'draft') app.draftPeek = false;
  if (!seats.length && !picking) {
    $('#modal').hidden = true;
    return;
  }
  if (seats.length && !picking && app.draftPeek) {
    $('#modal').hidden = true;
    return;
  }
  $('#modal').hidden = false;
  if (picking) {
    $('#modal-title').textContent = picking.title;
    $('#modal-body').innerHTML = `<div class="draft-grid">${picking.buttons.map((b) => `
      <button type="button" class="btn draft-card" data-pick-target="${b.id}">${escapeHtml(b.label)}</button>
    `).join('')}</div>`;
    $('#btn-modal-cancel').hidden = false;
    $('#btn-modal-cancel').textContent = '閉じる';
    return;
  }
  $('#modal-title').textContent = '強化を1枚';
  $('#btn-modal-cancel').hidden = false;
  $('#btn-modal-cancel').textContent = '盤面を見る';
  $('#modal-body').innerHTML = seats.map((seat) => {
    const player = app.game.players[seat];
    const cards = app.game.drafts.offers[seat].map((id) => {
      const up = upgradeById(id);
      return `<button type="button" class="btn draft-card" data-draft-seat="${seat}" data-upgrade="${id}"><strong>${escapeHtml(up?.name || id)}</strong><small>${escapeHtml(up?.blurb || '')}</small></button>`;
    }).join('');
    return `<p class="draft-who">${escapeHtml(player.name)} が選ぶ</p><div class="draft-grid">${cards}</div>`;
  }).join('');
}

function renderWinner() {
  const g = app.game;
  if (!g || g.phase !== 'gameover' || app.busy) {
    $('#winner').hidden = true;
    return;
  }
  const { ranked, awards } = buildResults(g);
  const winner = g.players[g.winner];
  $('#winner').hidden = false;
  $('#winner-name').textContent = `${winner?.name || ''} の勝ち`;
  $('#winner-sub').textContent = `${JOBS[winner.job].name}が100マス目に乗った`;
  $('#results-body').innerHTML = ranked.map((p, i) => `
    <div class="result-row">
      <div class="pc-top"><span>${i + 1}. ${escapeHtml(p.name)}</span><span>${p.pos + 1}マス / HP${p.hp}</span></div>
      <div class="result-bar"><span style="width:${((p.pos + 1) / 100) * 100}%; --pc:${p.color}"></span></div>
    </div>
  `).join('') + `<div>${awards.map((a) => `<span class="award">${escapeHtml(a.title)} ${escapeHtml(a.name)}（${escapeHtml(a.detail)}）</span>`).join('')}</div>`;
}

function resizeBoard() {
  const canvas = $('#board');
  const wrap = $('#board-wrap');
  if (!canvas || !wrap) return;
  const rect = wrap.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(10, Math.floor(rect.width * dpr));
  canvas.height = Math.max(10, Math.floor(rect.height * dpr));
  if (!app.userCam) fitCamera(app.cam, canvas.width, canvas.height);
}

function syncInspect() {
  const el = $('#inspect');
  if (!el) return;
  if (app.inspectIndex == null || !app.game) {
    el.textContent = 'マスをタップすると中身が出る';
    el.classList.remove('pinned');
    return;
  }
  el.textContent = describeTile(app.game, app.inspectIndex);
  el.classList.add('pinned');
}

function draw() {
  const canvas = $('#board');
  if (!canvas || !$('#screen-game').classList.contains('active') || !app.game) return;
  const ctx = canvas.getContext('2d');
  drawBoard(ctx, {
    state: app.game,
    cam: app.cam,
    viewW: canvas.width,
    viewH: canvas.height,
    displayPos: app.displayPos,
    highlight: app.targeting?.tiles,
    inspect: app.inspectIndex,
    time: performance.now(),
  });
}

function loop() {
  draw();
  requestAnimationFrame(loop);
}

function rewind(events, state) {
  const pos = {};
  for (const p of state.players) pos[p.id] = p.pos;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.t === 'step' && e.from != null) pos[e.seat] = e.from;
    if (e.t === 'swap') {
      pos[e.seat] = e.fromA;
      pos[e.target] = e.fromB;
    }
  }
  return pos;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flash(kicker, title, detail) {
  $('#ef-kicker').textContent = kicker || '';
  $('#ef-title').textContent = title || '';
  $('#ef-detail').textContent = detail || '';
  $('#event-flash').hidden = false;
  return new Promise((resolve) => {
    const done = () => {
      $('#event-flash').hidden = true;
      app.flashResolve = null;
      resolve();
    };
    app.flashResolve = done;
    setTimeout(done, 1500);
  });
}

function diceKindLabel(kind) {
  if (kind === 'charge') return '突撃';
  if (kind === 'allin') return 'オールイン';
  if (kind === 'overdrive') return 'オーバーラン';
  if (kind === 'roll') return '通常ダイス';
  return 'ダイス';
}

function diceMoveLabel(e) {
  if (e.bust) return '0が出た → その場でダウン';
  const n = e.total | 0;
  if (e.kind === 'charge') return `合計 ${n} → ${n}マス進む（突撃）`;
  if (e.kind === 'allin') return `合計 ${n} → ${n}マス進む（オールイン）`;
  if (e.kind === 'overdrive') return `合計 ${n} → ${n}マス進む（オーバーラン）`;
  if (n === 0) return '合計 0 → その場で足踏み';
  return `合計 ${n} → ${n}マス進む`;
}

/** 個数・各出目・合計・何マス進むをはっきり見せる */
async function playDiceOverlay(e) {
  audio.sfx.dice();
  const overlay = $('#dice-overlay');
  const facesEl = $('#dice-faces');
  const kicker = $('#dice-kicker');
  const mathEl = $('#dice-math');
  const label = $('#dice-label');
  const count = e.faces?.length || 0;
  overlay.hidden = false;
  kicker.textContent = `${diceKindLabel(e.kind)} · ${count}個`;
  mathEl.textContent = '';
  label.textContent = '振っている…';
  facesEl.innerHTML = e.faces.map(() => '<span class="die spinning">?</span>').join('');
  const diceNodes = [...facesEl.querySelectorAll('.die')];
  const spin = setInterval(() => {
    diceNodes.forEach((node) => {
      node.textContent = String(Math.floor(Math.random() * 9));
    });
  }, 70);
  await wait(560);
  clearInterval(spin);
  diceNodes.forEach((node, i) => {
    const face = e.faces[i];
    node.classList.remove('spinning');
    node.classList.add('landed');
    if (e.bust && (face?.natural === 0 || face?.value === 0)) node.classList.add('bust');
    node.textContent = String(face?.value ?? '?');
  });
  const parts = e.faces.map((f) => String(f.value));
  mathEl.textContent = e.bust
    ? `${parts.join(' + ')} → 失敗`
    : (parts.length > 1 ? `${parts.join(' + ')} = ${e.total}` : `出目 ${e.total}`);
  label.textContent = diceMoveLabel(e);
  audio.sfx.diceLand(e.faces[0]?.value || 1);
  await wait(720);
  overlay.hidden = true;
}

async function playEvent(e) {
  const g = app.game;
  const name = (id) => g?.players?.[id]?.name || '';
  if (e.t === 'dice') {
    await playDiceOverlay(e);
    return;
  }
  if (e.t === 'step') {
    if (!app.displayPos) app.displayPos = {};
    app.displayPos[e.seat] = e.pos;
    audio.sfx.step(!!e.back);
    await wait(e.back ? 70 : 95);
    return;
  }
  if (e.t === 'swap') {
    if (!app.displayPos) app.displayPos = {};
    app.displayPos[e.seat] = e.posA;
    app.displayPos[e.target] = e.posB;
    audio.sfx.skill();
    await wait(280);
    return;
  }
  if (e.t === 'damage') {
    audio.sfx.damage();
    $('#board-wrap').classList.add('shake');
    setTimeout(() => $('#board-wrap').classList.remove('shake'), 280);
    renderHud();
    await wait(160);
    return;
  }
  if (e.t === 'heal' || e.t === 'zero') {
    audio.sfx[e.t === 'zero' ? 'zero' : 'heal']();
    renderHud();
    return;
  }
  if (e.t === 'ko') {
    audio.sfx.ko();
    await flash('ダウン', `${name(e.seat)}`, '次の自分の番は休み');
    return;
  }
  if (e.t === 'rest') {
    await flash('休み', name(e.seat), 'この番は寝ている');
    return;
  }
  if (e.t === 'revive') {
    audio.sfx.revive();
    await flash('復帰', name(e.seat), e.bonus ? `HP${e.hp} / 出目+${e.bonus}` : `HP${e.hp}`);
    return;
  }
  if (e.t === 'win') {
    audio.sfx.win();
    await flash('GOAL', `${name(e.seat)} の勝ち`, '100マス目');
    return;
  }
  if (e.t === 'skill') {
    audio.sfx[e.ult ? 'ult' : e.id === 'guard' ? 'guard' : 'skill']();
    if (e.ult) await flash('必殺', JOBS[g.players[e.seat].job].skills.find((s) => s.id === e.id)?.name || '', name(e.seat));
    return;
  }
  if (e.t === 'place') audio.sfx.trapSet();
  else if (e.t === 'spring') audio.sfx[e.kind === 'curse' ? 'curse' : 'spring']();
  else if (e.t === 'smash' || e.t === 'boom') audio.sfx[e.t === 'boom' ? 'ult' : 'smash']();
  else if (e.t === 'block') audio.sfx.block();
  else if (e.t === 'roulette') audio.sfx.roulette();
  else if (e.t === 'upgrade' || e.t === 'draft') audio.sfx.draft();
  else if (e.t === 'turn') {
    const player = g.players[e.seat];
    if (controlling(player)) audio.sfx.yourTurn();
    app.cpuSeat = null;
  }
  renderHud();
}

function enqueue(events) {
  const list = events || [];
  if (!list.length) {
    refresh();
    scheduleCpu();
    return;
  }
  if (list.some((e) => e.t === 'step' || e.t === 'swap')) {
    app.displayPos = rewind(list, app.game);
  }
  app.queue.push(...list);
  pump();
}

async function pump() {
  if (app.pumping) return;
  app.pumping = true;
  app.busy = true;
  refresh();
  try {
    while (app.queue.length) {
      const e = app.queue.shift();
      await playEvent(e);
    }
  } finally {
    app.displayPos = null;
    app.busy = false;
    app.pumping = false;
    app.targeting = null;
    refresh();
    scheduleCpu();
    drainInbox();
  }
}

function refresh() {
  if (!$('#screen-game').classList.contains('active')) return;
  renderHud();
  syncInspect();
}

function publish(events) {
  if (app.mode === 'host' && app.net) {
    app.net.broadcast({ type: 'state', state: serializeState(app.game), events });
  }
  enqueue(events);
}

function resolveAction(seat, action) {
  if (!app.game || app.busy) return;
  const res = applyAction(app.game, seat, action);
  if (!res.ok) {
    if (controlling(app.game.players[seat])) toast(res.error || 'だめ');
    return;
  }
  if (action.type === 'skill') {
    const ct = app.game.players[seat].ct[action.id] || 0;
    if (ct === 0) app.cpuUsed.delete(action.id);
    else app.cpuUsed.add(action.id);
  }
  publish(res.events);
}

function sendLocal(seat, action) {
  audio.sfx.click();
  if (app.mode === 'guest') {
    if (!app.net?.sendToHost({ type: 'action', seat, action })) {
      toast('ホストに届かなかった。再接続して');
    }
    return;
  }
  resolveAction(seat, action);
}

function scheduleCpu() {
  clearTimeout(app.cpuTimer);
  if (app.mode === 'guest' || app.busy || !app.game || app.game.phase === 'gameover') return;
  const g = app.game;
  if (g.phase === 'draft') {
    const seat = Object.keys(g.drafts.offers).map(Number).find((id) => (
      !g.drafts.picks[id] && g.players[id].isCPU
    ));
    if (seat == null) return;
    app.cpuTimer = setTimeout(() => {
      if (app.busy) return scheduleCpu();
      const upgradeId = chooseDraft(g, seat);
      if (upgradeId) resolveAction(seat, { type: 'draft', upgradeId });
    }, 650);
    return;
  }
  const cur = currentPlayer(g);
  if (!cur?.isCPU || g.phase !== 'act') return;
  if (app.cpuSeat !== cur.id) {
    app.cpuSeat = cur.id;
    app.cpuUsed = new Set();
    app.cpuCount = 0;
  }
  app.cpuTimer = setTimeout(() => {
    if (app.busy || !app.game) return;
    const now = currentPlayer(app.game);
    if (!now?.isCPU) return;
    if (app.cpuCount >= 6) {
      resolveAction(now.id, { type: 'roll' });
      return;
    }
    const action = chooseCpuAction(app.game, now.id, app.game.cpuLevel || app.cpuLevel, app.cpuUsed);
    if (!action) return;
    if (action.type === 'skill') app.cpuCount += 1;
    resolveAction(now.id, action);
  }, 720);
}

function showGame() {
  $('#winner').hidden = true;
  $('#modal').hidden = true;
  $('#event-flash').hidden = true;
  $('#dice-overlay').hidden = true;
  app.inspectIndex = null;
  syncInspect();
  showScreen('screen-game');
  audio.startBgm();
}

function beginMatch(players) {
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const { state, events } = createGame({
    players,
    seed,
    cpuLevel: app.cpuLevel,
  });
  app.game = state;
  app.inspectIndex = null;
  app.cpuSeat = null;
  app.cpuUsed = new Set();
  app.userCam = false;
  app.queue = [];
  app.inbox = [];
  showGame();
  saveRejoin();
  publish(events);
}

function startLocal() {
  const humans = app.setupSeats.filter((s) => !s.cpu);
  if (!humans.length) {
    toast('人間を1人は残して');
    return;
  }
  app.mode = 'local';
  app.net?.destroy();
  app.net = null;
  app.localSeat = app.setupSeats.findIndex((s) => !s.cpu);
  app.localPeerId = null;
  beginMatch(app.setupSeats.map((s, i) => ({
    name: s.name.trim() || `P${i + 1}`,
    job: s.job,
    isCPU: !!s.cpu,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    peerId: null,
  })));
}

function openLobby(mode) {
  app.mode = mode;
  app.game = null;
  $('#lobby-name').value = app.localName;
  if (mode === 'host') {
    app.lobbyPlayers = [];
  }
  const re = readRejoin();
  if (mode === 'guest' && re?.room) $('#lobby-room').value = re.room;
  showScreen('screen-lobby');
  renderLobby();
}

function broadcastLobby() {
  if (app.mode === 'host' && app.net) {
    app.net.broadcast({
      type: 'lobby',
      players: app.lobbyPlayers,
      cpuLevel: app.cpuLevel,
      version: APP_VERSION,
    });
  }
  renderLobby();
}

function upsertLobby(peerId, patch) {
  let row = app.lobbyPlayers.find((p) => p.peerId === peerId);
  if (!row) {
    if (app.lobbyPlayers.length >= 4) return null;
    row = {
      peerId,
      name: 'プレイヤー',
      job: 'vanguard',
      color: freeColor(null, takenColors(peerId)),
      isCPU: false,
      isHost: false,
    };
    app.lobbyPlayers.push(row);
  }
  Object.assign(row, patch);
  row.color = freeColor(row.color, takenColors(peerId));
  return row;
}

async function connectLobby() {
  const name = $('#lobby-name').value.trim() || 'あなた';
  saveName(name);
  const roomInput = $('#lobby-room').value.trim().toUpperCase();
  if (app.mode === 'guest' && roomInput.length < 4) {
    toast('部屋コードを入れて');
    return;
  }
  try {
    app.net?.destroy();
    app.net = createNet({
      role: app.mode,
      roomCode: app.mode === 'guest' ? roomInput : undefined,
      onStatus: ({ msg, kind }) => setStatus(msg, kind),
      onEvent: handleNetEvent,
    });
    const info = await app.net.start();
    app.localPeerId = info.peerId;
    if (app.mode === 'host') {
      app.lobbyPlayers = [{
        peerId: info.peerId,
        name,
        job: app.lobbyJob,
        color: freeColor(app.lobbyColor, []),
        isCPU: false,
        isHost: true,
      }];
      app.lobbyColor = app.lobbyPlayers[0].color;
      broadcastLobby();
      setStatus(`部屋 ${info.roomCode} を開けた`, 'ok');
    } else {
      const sent = app.net.sendToHost({
        type: 'hello',
        version: APP_VERSION,
        name,
        job: app.lobbyJob,
        color: app.lobbyColor,
        peerId: info.peerId,
      });
      if (!sent) throw new Error('ホストへ送れなかった');
      setStatus('入室を送った', 'ok');
    }
    renderLobby();
    saveRejoin();
  } catch (err) {
    app.net?.destroy();
    app.net = null;
    setStatus(err.message || String(err), 'error');
    toast(app.mode === 'host' ? '部屋を作れなかった' : '入れなかった');
    renderLobby();
  }
}

function startOnline() {
  if (app.mode !== 'host' || !app.net) return;
  if (app.lobbyPlayers.length < 2) {
    toast('2人以上。CPUを足してもいい');
    return;
  }
  app.localSeat = 0;
  beginMatch(app.lobbyPlayers.map((p) => ({
    name: p.name,
    job: p.job || 'vanguard',
    isCPU: !!p.isCPU,
    color: p.color,
    peerId: p.peerId,
  })));
}

function handToCpu(seat) {
  const player = app.game?.players?.[seat];
  if (!player || player.isCPU || app.mode !== 'host') return;
  player.isCPU = true;
  player.offline = true;
  const text = `${player.name} の代わりをCPUがやる`;
  pushSystem(text);
  toast(text);
  publish([{ t: 'log', text, kind: 'system' }]);
}

function notePeerLeft(peerId) {
  if (app.mode !== 'host') return;
  if (!app.game) {
    app.lobbyPlayers = app.lobbyPlayers.filter((p) => p.peerId !== peerId || p.isHost);
    broadcastLobby();
    return;
  }
  const seat = app.game.players.findIndex((p) => p.peerId === peerId);
  if (seat < 0) return;
  const player = app.game.players[seat];
  player.offline = true;
  const text = `${player.name} が切れた。20秒でCPU代打`;
  pushSystem(text);
  toast(`${player.name} が切れた`);
  clearTimeout(app.disconnectTimers.get(seat));
  app.disconnectTimers.set(seat, setTimeout(() => handToCpu(seat), 20000));
  publish([{ t: 'log', text, kind: 'system' }]);
}

function pushSystem(text) {
  app.game.seq += 1;
  app.game.log.push({ text, kind: 'system', seq: app.game.seq });
  if (app.game.log.length > 80) app.game.log.splice(0, app.game.log.length - 80);
}

function handleNetEvent({ from, data }) {
  if (!data) return;
  if (app.mode === 'host') {
    if (data.type === 'peer_left') {
      notePeerLeft(data.peerId || from);
      return;
    }
    if (data.type === 'hello' || data.type === 'profile') {
      if (data.version && data.version !== APP_VERSION && data.type === 'hello') {
        app.net.sendTo(from, {
          type: 'version_mismatch',
          hostVersion: APP_VERSION,
          clientVersion: data.version,
        });
        return;
      }
      const peerId = data.peerId || from;
      if (app.game) {
        const seat = app.game.players.findIndex((p) => p.name === data.name);
        if (seat < 0) {
          app.net.sendTo(from, { type: 'game_already' });
          return;
        }
        const player = app.game.players[seat];
        clearTimeout(app.disconnectTimers.get(seat));
        player.peerId = peerId;
        player.isCPU = false;
        player.offline = false;
        app.net.sendTo(from, { type: 'welcome', seat, version: APP_VERSION });
        const text = `${player.name} が戻った`;
        pushSystem(text);
        publish([{ t: 'log', text, kind: 'system' }]);
        toast(text);
        return;
      }
      const row = upsertLobby(peerId, {
        name: String(data.name || 'プレイヤー').slice(0, 12),
        job: JOBS[data.job] ? data.job : 'vanguard',
        color: data.color,
        isCPU: false,
      });
      if (!row) {
        app.net.sendTo(from, { type: 'full' });
        return;
      }
      app.net.sendTo(from, { type: 'welcome', seat: app.lobbyPlayers.indexOf(row), version: APP_VERSION });
      broadcastLobby();
      return;
    }
    if (data.type === 'action' && app.game) {
      const player = app.game.players[data.seat];
      if (!player || player.isCPU) return;
      if (player.peerId !== from) return;
      resolveAction(data.seat, data.action);
      return;
    }
    if (data.type === 'nudge') {
      app.net.broadcast({ type: 'nudge', fromName: data.fromName || '誰か' });
      audio.sfx.nudge();
      toast(`${data.fromName || '誰か'}が催促`);
    }
    return;
  }

  if (data.type === 'host_left') {
    $('#reconnect-detail').textContent = `部屋 ${app.net?.roomCode || ''} に、同じ名前で戻れる。`;
    $('#reconnect-overlay').hidden = false;
    return;
  }
  if (data.type === 'version_mismatch') {
    toast(`バージョンが違う。ホストは v${data.hostVersion}`);
    setStatus(`ホスト v${data.hostVersion} / 自分 v${APP_VERSION}`, 'error');
    return;
  }
  if (data.type === 'full' || data.type === 'game_already') {
    toast(data.type === 'full' ? '部屋が満員' : 'その名前の席がない');
    return;
  }
  if (data.type === 'welcome') {
    app.localSeat = data.seat ?? 0;
    saveRejoin();
    return;
  }
  if (data.type === 'lobby') {
    app.lobbyPlayers = data.players || [];
    if (data.cpuLevel) app.cpuLevel = data.cpuLevel;
    const me = app.lobbyPlayers.find((p) => p.peerId === app.localPeerId);
    if (me) {
      app.localName = me.name;
      app.lobbyJob = me.job;
      app.lobbyColor = me.color;
      app.localSeat = app.lobbyPlayers.indexOf(me);
    }
    renderLobby();
    return;
  }
  if (data.type === 'state') {
    app.inbox.push(data);
    drainInbox();
    return;
  }
  if (data.type === 'nudge') {
    audio.sfx.nudge();
    toast(`${data.fromName || '誰か'}が催促`);
  }
}

function drainInbox() {
  if (app.busy || !app.inbox.length) return;
  const data = app.inbox.shift();
  app.game = data.state;
  const me = app.game.players.find((p) => p.peerId === app.localPeerId);
  if (me) app.localSeat = me.id;
  showGame();
  enqueue(data.events || []);
}

function useSkill(skillId) {
  if (!myTurn() || app.busy) return;
  const cur = currentPlayer(app.game);
  const actions = listActions(app.game, cur.id).filter((a) => a.id === skillId);
  if (!actions.length) {
    toast(skillLockReason(app.game, cur.id, skillId) || 'いまは使えない');
    return;
  }
  if (actions.length === 1 && actions[0].tile == null && actions[0].target == null) {
    sendLocal(cur.id, actions[0]);
    return;
  }
  if (actions[0].tile != null) {
    app.targeting = { id: skillId, tiles: new Set(actions.map((a) => a.tile)) };
    refresh();
    return;
  }
  app.playerPick = {
    title: JOBS[cur.job].skills.find((s) => s.id === skillId)?.name || '対象',
    skillId,
    buttons: actions.map((a) => ({
      id: a.target,
      label: app.game.players[a.target].name,
    })),
  };
  renderModal();
}

function pointerOnBoard(ev) {
  const canvas = $('#board');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - rect.left) * (canvas.width / rect.width),
    y: (ev.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function bindBoard() {
  const canvas = $('#board');
  canvas.addEventListener('pointerdown', (ev) => {
    const p = pointerOnBoard(ev);
    app.drag = { x: p.x, y: p.y, cx: app.cam.x, cy: app.cam.y, moved: false, id: ev.pointerId };
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!app.drag) return;
    const p = pointerOnBoard(ev);
    const dx = p.x - app.drag.x;
    const dy = p.y - app.drag.y;
    if (Math.hypot(dx, dy) > 6) {
      app.drag.moved = true;
      canvas.classList.add('dragging');
      app.userCam = true;
      app.cam.x = app.drag.cx + dx;
      app.cam.y = app.drag.cy + dy;
    }
  });
  const endDrag = (ev) => {
    if (!app.drag) return;
    const moved = app.drag.moved;
    const p = pointerOnBoard(ev);
    app.drag = null;
    canvas.classList.remove('dragging');
    if (moved || !app.game) return;
    const index = hitTile(app.cam, p.x, p.y);
    if (index < 0) return;
    // 同じマスをもう一度タップしたら説明を閉じる。勝手には消さない。
    app.inspectIndex = app.inspectIndex === index ? null : index;
    syncInspect();
    if (app.targeting?.tiles?.has(index)) {
      const seat = currentPlayer(app.game).id;
      const tile = index;
      const id = app.targeting.id;
      app.targeting = null;
      sendLocal(seat, { type: 'skill', id, tile });
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { app.drag = null; });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const p = pointerOnBoard(ev);
    const prev = app.cam.scale;
    const next = Math.max(0.2, Math.min(2.6, prev * (ev.deltaY > 0 ? 0.92 : 1.08)));
    const wx = (p.x - app.cam.x) / prev;
    const wy = (p.y - app.cam.y) / prev;
    app.cam.scale = next;
    app.cam.x = p.x - wx * next;
    app.cam.y = p.y - wy * next;
    app.userCam = true;
  }, { passive: false });
  $('#btn-zoom-in').onclick = () => { app.userCam = true; app.cam.scale = Math.min(2.6, app.cam.scale * 1.12); };
  $('#btn-zoom-out').onclick = () => { app.userCam = true; app.cam.scale = Math.max(0.2, app.cam.scale / 1.12); };
  $('#btn-zoom-fit').onclick = () => {
    app.userCam = false;
    fitCamera(app.cam, canvas.width, canvas.height);
  };
  new ResizeObserver(() => resizeBoard()).observe($('#board-wrap'));
}

function bindVolume() {
  const vol = audio.getVolume();
  $('#vol-master').value = vol.master;
  $('#vol-bgm').value = vol.bgm;
  $('#vol-se').value = vol.se;
  $('#btn-mute').textContent = vol.muted ? '消' : '音';
  $('#vol-master').oninput = () => audio.setMaster($('#vol-master').value);
  $('#vol-bgm').oninput = () => audio.setBgm($('#vol-bgm').value);
  $('#vol-se').oninput = () => audio.setSe($('#vol-se').value);
  $('#btn-mute').onclick = () => {
    const muted = audio.toggleMute();
    $('#btn-mute').textContent = muted ? '消' : '音';
  };
  $('#btn-vol-expand').onclick = () => $('#vol-dock').classList.toggle('vol-collapsed');
}

function sendProfile() {
  if (app.mode !== 'guest' || !app.net) return;
  app.net.sendToHost({
    type: 'profile',
    version: APP_VERSION,
    name: app.localName,
    job: app.lobbyJob,
    color: app.lobbyColor,
    peerId: app.localPeerId,
  });
}

function bind() {
  $('#app-version-label').textContent = `v${APP_VERSION}`;
  $('#btn-host').onclick = () => { audio.sfx.click(); openLobby('host'); };
  $('#btn-join').onclick = () => { audio.sfx.click(); openLobby('guest'); };
  $('#btn-local').onclick = () => { audio.sfx.click(); showScreen('screen-setup'); renderSetup(); };
  $('#btn-howto').onclick = () => { audio.sfx.click(); showScreen('screen-howto'); };
  $('#btn-jobs').onclick = () => { audio.sfx.click(); renderJobsCatalog(); showScreen('screen-jobs'); };
  $('#btn-patch').onclick = () => { audio.sfx.click(); renderPatch(); showScreen('screen-patch'); };
  $('#btn-howto-back').onclick = () => showScreen('screen-title');
  $('#btn-jobs-back').onclick = () => showScreen('screen-title');
  $('#btn-patch-back').onclick = () => showScreen('screen-title');
  $('#btn-setup-back').onclick = () => showScreen('screen-title');
  $('#btn-lobby-back').onclick = () => {
    if (!app.game) {
      app.net?.destroy();
      app.net = null;
    }
    showScreen('screen-title');
  };

  $('#setup-seats').addEventListener('input', (ev) => {
    const seat = app.setupSeats[Number(ev.target.closest('.seat')?.dataset.i)];
    if (seat && ev.target.dataset.field === 'name') seat.name = ev.target.value;
  });
  $('#setup-seats').addEventListener('click', (ev) => {
    const seatEl = ev.target.closest('.seat');
    if (!seatEl) return;
    const seat = app.setupSeats[Number(seatEl.dataset.i)];
    if (ev.target.dataset.field === 'cpu') {
      seat.cpu = !seat.cpu;
      renderSetup();
    }
    if (ev.target.dataset.job) {
      seat.job = ev.target.dataset.job;
      renderSetup();
    }
  });
  $('#btn-add-seat').onclick = () => {
    if (app.setupSeats.length >= 4) return;
    const jobs = ['assassin', 'gambler', 'vanguard', 'trap'];
    const job = jobs.find((id) => !app.setupSeats.some((s) => s.job === id)) || 'vanguard';
    app.setupSeats.push({ name: `CPU${JOBS[job].mark}`, job, cpu: true });
    renderSetup();
  };
  $('#btn-remove-seat').onclick = () => {
    if (app.setupSeats.length <= 2) return;
    app.setupSeats.pop();
    renderSetup();
  };
  $('#setup-level').onclick = (ev) => {
    if (!ev.target.dataset.level) return;
    app.cpuLevel = ev.target.dataset.level;
    renderSetup();
  };
  $('#btn-start-local').onclick = () => { audio.sfx.click(); startLocal(); };

  $('#lobby-name').oninput = () => {
    saveName($('#lobby-name').value.trim() || 'あなた');
    if (app.mode === 'host') {
      const me = app.lobbyPlayers.find((p) => p.isHost);
      if (me) me.name = app.localName;
      broadcastLobby();
    } else sendProfile();
  };
  $('#lobby-jobs').onclick = (ev) => {
    if (!ev.target.dataset.job) return;
    app.lobbyJob = ev.target.dataset.job;
    if (app.mode === 'host') {
      const me = app.lobbyPlayers.find((p) => p.isHost);
      if (me) me.job = app.lobbyJob;
      broadcastLobby();
    } else {
      renderLobby();
      sendProfile();
    }
  };
  $('#lobby-colors').onclick = (ev) => {
    const color = ev.target.dataset.color;
    if (!color) return;
    app.lobbyColor = color;
    if (app.mode === 'host') {
      const me = app.lobbyPlayers.find((p) => p.isHost);
      if (me) me.color = freeColor(color, takenColors(me.peerId));
      app.lobbyColor = me?.color || color;
      broadcastLobby();
    } else {
      renderLobby();
      sendProfile();
    }
  };
  $('#lobby-level').onclick = (ev) => {
    if (app.mode !== 'host' || !ev.target.dataset.level) return;
    app.cpuLevel = ev.target.dataset.level;
    broadcastLobby();
  };
  $('#lobby-players').onchange = (ev) => {
    const peerId = ev.target.dataset.cpuJob;
    if (!peerId || app.mode !== 'host') return;
    const row = app.lobbyPlayers.find((p) => p.peerId === peerId);
    if (row) row.job = ev.target.value;
    broadcastLobby();
  };
  $('#btn-lobby-connect').onclick = () => { audio.sfx.click(); connectLobby(); };
  $('#btn-lobby-dismantle').onclick = () => {
    app.net?.destroy();
    app.net = null;
    app.lobbyPlayers = [];
    setStatus('部屋を閉じた', 'warn');
    renderLobby();
  };
  $('#btn-copy-code').onclick = async () => {
    const code = $('#lobby-code').textContent.trim();
    try {
      await navigator.clipboard.writeText(code);
      toast('コードをコピーした');
    } catch {
      toast(code);
    }
  };
  $('#btn-add-cpu').onclick = () => {
    if (!app.net) return toast('先に部屋を作って');
    if (app.lobbyPlayers.length >= 4) return toast('4人まで');
    const usedJobs = app.lobbyPlayers.map((p) => p.job);
    const job = JOB_LIST.map((j) => j.id).find((id) => !usedJobs.includes(id)) || 'vanguard';
    const peerId = `cpu-${Date.now()}`;
    app.lobbyPlayers.push({
      peerId,
      name: `CPU${JOBS[job].mark}`,
      job,
      color: freeColor(null, takenColors(null)),
      isCPU: true,
      isHost: false,
    });
    broadcastLobby();
  };
  $('#btn-lobby-start').onclick = () => { audio.sfx.click(); startOnline(); };
  $('#btn-lobby-reconnect').onclick = () => { audio.sfx.click(); connectLobby(); };

  $('#players-panel').onclick = (ev) => {
    const card = ev.target.closest('[data-look]');
    if (!card || !app.game) return;
    const seat = Number(card.dataset.look);
    app.lookSeat = app.lookSeat === seat ? null : seat;
    audio.sfx.click();
    refresh();
  };
  $('#skills-panel').onclick = (ev) => {
    if (ev.target.closest('#btn-look-back')) {
      app.lookSeat = null;
      audio.sfx.cancel();
      refresh();
      return;
    }
    const btn = ev.target.closest('[data-skill]');
    if (!btn) return;
    useSkill(btn.dataset.skill);
  };
  $('#btn-draft-open').onclick = () => {
    app.draftPeek = false;
    audio.sfx.click();
    refresh();
  };
  $('#btn-roll').onclick = () => {
    if (!myTurn()) return;
    sendLocal(currentPlayer(app.game).id, { type: 'roll' });
  };
  $('#btn-cancel-target').onclick = () => {
    app.targeting = null;
    audio.sfx.cancel();
    refresh();
  };
  $('#btn-nudge').onclick = () => {
    audio.sfx.nudge();
    if (app.mode === 'guest') {
      app.net?.sendToHost({ type: 'nudge', fromName: app.localName });
    } else if (app.mode === 'host') {
      app.net?.broadcast({ type: 'nudge', fromName: app.localName });
      toast('催促した');
    } else {
      toast('急かした');
    }
  };
  $('#modal').onclick = (ev) => {
    if (ev.target === $('#modal') && !app.playerPick && myDraftSeats().length) {
      app.draftPeek = true;
      audio.sfx.cancel();
      refresh();
      return;
    }
    const draft = ev.target.closest('[data-upgrade]');
    if (draft) {
      sendLocal(Number(draft.dataset.draftSeat), { type: 'draft', upgradeId: draft.dataset.upgrade });
      return;
    }
    const target = ev.target.closest('[data-pick-target]');
    if (target && app.playerPick) {
      const seat = currentPlayer(app.game).id;
      const id = app.playerPick.skillId;
      const who = Number(target.dataset.pickTarget);
      app.playerPick = null;
      $('#modal').hidden = true;
      sendLocal(seat, { type: 'skill', id, target: who });
    }
  };
  $('#btn-modal-cancel').onclick = () => {
    if (app.playerPick) {
      app.playerPick = null;
      audio.sfx.cancel();
      refresh();
      return;
    }
    if (myDraftSeats().length) {
      app.draftPeek = true;
      audio.sfx.cancel();
      refresh();
    }
  };
  $('#ef-continue').onclick = () => app.flashResolve?.();
  $('#btn-again').onclick = () => {
    audio.sfx.click();
    returnToTitle();
  };
  $('#btn-export').onclick = () => {
    audio.sfx.click();
    exportResultsPng();
  };
  $('#btn-reconnect-title').onclick = () => {
    $('#reconnect-overlay').hidden = true;
    returnToTitle();
  };
  $('#btn-reconnect-now').onclick = () => {
    $('#reconnect-overlay').hidden = true;
    const re = readRejoin();
    app.mode = 'guest';
    if (re?.room) $('#lobby-room').value = re.room;
    if (re?.name) $('#lobby-name').value = re.name;
    showScreen('screen-lobby');
    connectLobby();
  };

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      app.targeting = null;
      app.playerPick = null;
      if (app.game?.phase === 'draft' && myDraftSeats().length) app.draftPeek = true;
      refresh();
    }
    if (ev.key !== ' ' && ev.code !== 'Space') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    ev.preventDefault();
    if (app.flashResolve) {
      app.flashResolve();
      return;
    }
    if (myTurn() && !app.busy && app.game?.phase === 'act') {
      sendLocal(currentPlayer(app.game).id, { type: 'roll' });
    }
  });

  window.addEventListener('pointerdown', () => {
    audio.resume();
    audio.startBgm();
  }, { once: true });
}

function bootDemo() {
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo !== 'match') return;
  app.setupSeats = [
    { name: 'あなた', job: 'vanguard', cpu: false },
    { name: 'CPU罠', job: 'trap', cpu: true },
    { name: 'CPU刃', job: 'assassin', cpu: true },
    { name: 'CPU運', job: 'gambler', cpu: true },
  ];
  app.cpuLevel = 'normal';
  startLocal();
}

bind();
bindBoard();
bindVolume();
requestAnimationFrame(loop);
bootDemo();
