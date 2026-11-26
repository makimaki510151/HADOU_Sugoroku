/**
 * 波動すごろく — 純ルールエンジン（DOMなし）。
 * ホスト（とローカル）がこれを権威にする。ゲストは結果の状態を描くだけ。
 *
 * コースはマス1〜100（内部index 0〜99）。99に到達した瞬間勝ち。ぴったり不要。
 * HP0で次の自分のターンを1回休み、その次のターン開始時に最大HPの40%で復帰。
 */

import { JOBS, skillById } from './jobs.js';
import { upgradeById, upgradePool } from './upgrades.js';

export const TRACK_LEN = 100;
export const GOAL = 99;
export const REVIVE_RATE = 0.4;

export function currentPlayer(state) {
  return state.players[state.turn] || null;
}

export function rankOf(state, seat) {
  const pos = state.players[seat].pos;
  let better = 0;
  const seen = new Set();
  for (const p of state.players) {
    if (p.pos > pos && !seen.has(p.pos)) {
      seen.add(p.pos);
      better += 1;
    }
  }
  return better + 1;
}

export function standings(state) {
  return [...state.players].sort((a, b) => b.pos - a.pos || a.id - b.id);
}

export function badges(player) {
  const b = [];
  if (player.downed || player.justRevived || player.hp <= 0) b.push('休み');
  if (player.ironGuard) b.push('ガード');
  if (player.loaded) b.push('イカサマ');
  if (player.extraDice) b.push(`ダイス+${player.extraDice}`);
  if (player.diceModNext) {
    b.push(`出目${player.diceModNext > 0 ? '+' : ''}${player.diceModNext}`);
  }
  if (player.oneShotGuard) b.push('お守り');
  if (player.trapIgnore) b.push(`罠無視${player.trapIgnore}`);
  if (player.koShield) b.push('根性');
  if (player.zeroInsure) b.push('ゼロ保険');
  if (player.dicePlus) b.push(`出目補正+${player.dicePlus}`);
  return b;
}

function rand(state) {
  let a = state.rng >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  state.rng = (t ^ (t >>> 14)) >>> 0;
  return state.rng / 4294967296;
}

/** テスト用 forcedRolls があればそれを優先する。 */
function pullInt(state, min, max) {
  if (state.forcedRolls?.length) return state.forcedRolls.shift();
  return min + Math.floor(rand(state) * (max - min + 1));
}

function rollOne(state, min, max, loaded) {
  if (state.forcedRolls?.length) return state.forcedRolls.shift();
  if (loaded) return rand(state) < 0.5 ? 4 : 8;
  return min + Math.floor(rand(state) * (max - min + 1));
}

function pushLog(state, text, kind = 'info') {
  state.seq += 1;
  state.log.unshift({ text, kind, seq: state.seq });
  if (state.log.length > 80) state.log.length = 80;
  return { t: 'log', text, kind };
}

function blankPlayer(raw, index) {
  const job = JOBS[raw.job] || JOBS.vanguard;
  return {
    id: index,
    name: String(raw.name || `プレイヤー${index + 1}`).slice(0, 12),
    job: job.id,
    color: raw.color || '#ff4d6d',
    isCPU: !!raw.isCPU,
    peerId: raw.peerId || null,
    hp: job.hp,
    maxHp: job.hp,
    baseHp: job.hp,
    pos: 0,
    ct: {},
    ctCut: 0,
    dicePlus: 0,
    dmgPlus: 0,
    diceModNext: 0,
    floorRolls: 0,
    ironGuard: false,
    oneShotGuard: false,
    trapIgnore: 0,
    koShield: false,
    downed: false,
    justRevived: false,
    loaded: false,
    extraDice: 0,
    zeroInsure: 0,
    perks: {},
    finished: false,
    offline: false,
    stats: { moved: 0, dealt: 0, taken: 0, zeros: 0, traps: 0, kos: 0 },
  };
}

/**
 * @param {{ players: Array<{name:string, job:string, isCPU?:boolean, color?:string, peerId?:string|null}>, seed?:number, cpuLevel?:string }} opts
 */
export function createGame({ players, seed = 1, cpuLevel = 'normal' }) {
  if (!players || players.length < 2 || players.length > 4) {
    throw new Error('2〜4人で始める');
  }
  const state = {
    seed: (seed >>> 0) || 1,
    rng: (seed >>> 0) || 1,
    round: 1,
    turn: 0,
    phase: 'act',
    cpuLevel: cpuLevel === 'easy' ? 'easy' : 'normal',
    tiles: Array.from({ length: TRACK_LEN }, () => null),
    players: players.map((p, i) => blankPlayer(p, i)),
    drafts: null,
    winner: null,
    log: [],
    seq: 0,
    goal: GOAL,
  };
  const events = [];
  events.push(pushLog(state, '波動スタート。100マス目に先に乗った人が勝ち', 'system'));
  beginTurn(state, events);
  return { state, events };
}

export function serializeState(state) {
  const copy = JSON.parse(JSON.stringify(state));
  delete copy.forcedRolls;
  return copy;
}

function jobOf(player) {
  return JOBS[player.job];
}

function power(player, base, perkKey) {
  return base + (player.dmgPlus || 0) + (perkKey ? (player.perks[perkKey] || 0) : 0);
}

function setCt(player, skillId) {
  const sk = skillById(player.job, skillId);
  if (!sk) return;
  let ct = sk.ct;
  if (sk.kind === 'active') ct = Math.max(1, ct - (player.ctCut || 0));
  player.ct[skillId] = ct;
}

function tickCt(player) {
  for (const id of Object.keys(player.ct)) {
    if (player.ct[id] > 0) player.ct[id] -= 1;
  }
}

function isLastPlace(state, seat) {
  const pos = state.players[seat].pos;
  return state.players.every((p) => p.pos >= pos);
}

function someoneBehind(state, seat, gap) {
  const pos = state.players[seat].pos;
  return state.players.some((p) => p.id !== seat && !p.finished && pos - p.pos >= gap);
}

function spikeTiles(state, seat) {
  const pos = state.players[seat].pos;
  const out = [];
  for (let d = 1; d <= 3; d++) {
    const i = pos - d;
    if (i < 0 || i >= GOAL) continue;
    if (state.tiles[i]) continue;
    out.push(i);
  }
  return out;
}

function curseTiles(state, seat) {
  const pos = state.players[seat].pos;
  const out = [];
  for (let d = 1; d <= 5; d++) {
    const i = pos + d;
    if (i >= GOAL) continue;
    out.push(i);
  }
  return out;
}

function nearestAhead(state, seat, range) {
  const pos = state.players[seat].pos;
  let best = null;
  let bestD = Infinity;
  for (const o of state.players) {
    if (o.id === seat || o.finished) continue;
    const d = o.pos - pos;
    if (d <= 0 || d > range) continue;
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

function playersInRange(state, seat, range) {
  const pos = state.players[seat].pos;
  return state.players.filter((o) => {
    if (o.id === seat || o.finished || o.hp <= 0) return false;
    return Math.abs(o.pos - pos) <= range;
  });
}

export function skillLockReason(state, seat, skillId) {
  const player = state.players[seat];
  if (!player) return 'いない';
  const sk = skillById(player.job, skillId);
  if (!sk) return '知らない技';
  const ct = player.ct[skillId] || 0;
  if (ct > 0) return `CT ${ct}`;
  if (skillId === 'charge' && !someoneBehind(state, seat, sk.behind || 6)) {
    return '6マス以上後ろに誰かいるとき';
  }
  if (skillId === 'pandemonium') {
    const n = state.tiles.filter((t) => t && t.owner === seat).length;
    if (n < (sk.need || 2)) return '自分の罠が2つ以上いる';
  }
  if (skillId === 'shadow') {
    const ahead = nearestAhead(state, seat, sk.range || 6);
    if (!ahead) return '6マス以内の前方に誰もいない';
    if (ahead.ironGuard) return `${ahead.name} はガード中`;
  }
  if (skillId === 'execute') {
    const ok = state.players.some((o) => (
      o.id !== seat && !o.finished && o.hp > 0 && o.hp / o.maxHp <= (sk.hpRate || 0.5)
    ));
    if (!ok) return 'HP半分以下の相手がいない';
  }
  if (skillId === 'allin') {
    const low = player.hp / player.maxHp <= (sk.hpRate || 0.3);
    if (!low && !isLastPlace(state, seat)) return '最下位か、HP30%以下のとき';
  }
  if (skillId === 'poison' && playersInRange(state, seat, sk.range || 8).length === 0) {
    return '届く範囲に相手がいない';
  }
  if (skillId === 'spike' && spikeTiles(state, seat).length === 0) {
    return '後ろ3マスに空がない';
  }
  if (skillId === 'curse' && curseTiles(state, seat).length === 0) {
    return '前に置けるマスがない';
  }
  return '';
}

export function listActions(state, seat) {
  if (!state || state.phase === 'gameover') return [];
  if (state.phase === 'draft') {
    const offer = state.drafts?.offers?.[seat];
    if (!offer || state.drafts.picks?.[seat]) return [];
    return offer.map((upgradeId) => ({ type: 'draft', upgradeId }));
  }
  if (state.phase !== 'act') return [];
  const cur = currentPlayer(state);
  if (!cur || cur.id !== seat || cur.downed || cur.hp <= 0) return [];
  const actions = [];
  for (const sk of jobOf(cur).skills) {
    if (skillLockReason(state, seat, sk.id)) continue;
    if (sk.id === 'spike') {
      for (const tile of spikeTiles(state, seat)) actions.push({ type: 'skill', id: 'spike', tile });
      continue;
    }
    if (sk.id === 'curse') {
      for (const tile of curseTiles(state, seat)) actions.push({ type: 'skill', id: 'curse', tile });
      continue;
    }
    if (sk.id === 'poison') {
      for (const o of playersInRange(state, seat, sk.range || 8)) {
        actions.push({ type: 'skill', id: 'poison', target: o.id });
      }
      continue;
    }
    if (sk.id === 'execute') {
      for (const o of state.players) {
        if (o.id === seat || o.finished || o.hp <= 0) continue;
        if (o.hp / o.maxHp <= (sk.hpRate || 0.5)) {
          actions.push({ type: 'skill', id: 'execute', target: o.id });
        }
      }
      continue;
    }
    actions.push({ type: 'skill', id: sk.id });
  }
  actions.push({ type: 'roll' });
  return actions;
}

function heal(state, seat, amount, events, reason) {
  const player = state.players[seat];
  if (!player || player.downed || player.hp <= 0 || player.finished) return 0;
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + amount);
  const got = player.hp - before;
  if (got > 0) events.push({ t: 'heal', seat, amount: got, hp: player.hp, reason });
  return got;
}

function hurt(state, targetSeat, amount, srcSeat, events, reason) {
  const target = state.players[targetSeat];
  const src = srcSeat == null ? null : state.players[srcSeat];
  if (!target || target.finished) return { dealt: 0, killed: false, blocked: false };
  if (target.ironGuard) {
    events.push({ t: 'block', seat: targetSeat, reason: 'guard' });
    events.push(pushLog(state, `${target.name} はガードで受け流した`, 'good'));
    return { dealt: 0, killed: false, blocked: true };
  }
  const dmg = Math.max(0, amount | 0);
  if (dmg <= 0 || target.hp <= 0) return { dealt: 0, killed: false, blocked: false };
  if (target.oneShotGuard) {
    target.oneShotGuard = false;
    events.push({ t: 'block', seat: targetSeat, reason: 'omamori' });
    events.push(pushLog(state, `${target.name} のお守りが割れた`, 'good'));
    return { dealt: 0, killed: false, blocked: true };
  }
  if (target.koShield && target.hp - dmg <= 0) {
    target.koShield = false;
    target.hp = 1;
    events.push({ t: 'damage', seat: targetSeat, amount: dmg, hp: 1, soaked: true, reason });
    events.push(pushLog(state, `${target.name} は根性でHP1`, 'good'));
    return { dealt: dmg, killed: false, blocked: false };
  }
  target.hp = Math.max(0, target.hp - dmg);
  target.stats.taken += dmg;
  if (src) src.stats.dealt += dmg;
  events.push({ t: 'damage', seat: targetSeat, amount: dmg, hp: target.hp, reason, from: srcSeat });
  if (target.hp === 0) {
    target.downed = true;
    if (src) src.stats.kos += 1;
    events.push({ t: 'ko', seat: targetSeat, by: srcSeat });
    events.push(pushLog(state, `${target.name} はダウン。次の自分の番は休み`, 'bad'));
    return { dealt: dmg, killed: true, blocked: false };
  }
  return { dealt: dmg, killed: false, blocked: false };
}

function declareWin(state, seat, events) {
  if (state.phase === 'gameover') return;
  const player = state.players[seat];
  player.pos = GOAL;
  player.finished = true;
  state.phase = 'gameover';
  state.winner = seat;
  state.drafts = null;
  events.push({ t: 'win', seat });
  events.push(pushLog(state, `${player.name} が100マス目に到達。勝ち！`, 'ult'));
}

function knockback(state, seat, n, events) {
  const player = state.players[seat];
  for (let i = 0; i < n; i++) {
    if (player.pos <= 0) break;
    const from = player.pos;
    player.pos -= 1;
    events.push({ t: 'step', seat, from, pos: player.pos, back: true });
  }
}

function maybeAssassin(state, seat, events, chain) {
  const player = state.players[seat];
  if (chain >= 3) return;
  if (player.job !== 'assassin' || player.downed || player.finished) return;
  if (state.phase === 'gameover' || player.pos >= GOAL) return;
  const sharing = state.players.filter((o) => o.id !== seat && o.pos === player.pos);
  if (!sharing.length) return;
  const dmg = power(player, jobOf(player).passive.damage || 6, 'bladePlus');
  for (const o of sharing) hurt(state, o.id, dmg, seat, events, 'footwork');
  if (player.downed || state.phase === 'gameover') return;
  events.push(pushLog(state, `${player.name} の歩法。刺して2マス滑る`, 'skill'));
  moveBy(state, seat, jobOf(player).passive.bonus || 2, events, { chain: chain + 1 });
}

function enterTile(state, seat, pos, events, opts) {
  const tile = state.tiles[pos];
  if (!tile) return false;
  const player = state.players[seat];
  if (tile.owner === seat && player.job === 'trap') {
    const got = heal(state, seat, jobOf(player).passive.heal || 2, events, 'trap');
    if (got) events.push(pushLog(state, `${player.name} は自分の罠でHP+${got}`, 'good'));
    return false;
  }
  if (player.trapIgnore > 0) {
    player.trapIgnore -= 1;
    events.push({ t: 'block', seat, reason: 'watch' });
    events.push(pushLog(state, `${player.name} は足元を見て罠を踏まなかった`, 'good'));
    return false;
  }
  if (opts.destroyBad && (tile.kind === 'spike' || tile.kind === 'curse')) {
    state.tiles[pos] = null;
    events.push({ t: 'smash', pos, kind: tile.kind, seat });
    events.push(pushLog(state, `${player.name} が${pos + 1}マスの罠を踏み砕いた`, 'ult'));
    return false;
  }
  if (player.ironGuard) {
    events.push({ t: 'block', seat, reason: 'guard' });
    events.push(pushLog(state, `${player.name} はガードのまま罠を通過`, 'good'));
    return false;
  }
  if (tile.kind === 'spike') {
    events.push({ t: 'spring', kind: 'spike', seat, pos });
    events.push(pushLog(state, `${player.name} が${pos + 1}マスのスパイクを踏んだ`, 'bad'));
    hurt(state, seat, tile.damage || 6, tile.owner, events, 'spike');
    return true;
  }
  if (tile.kind === 'curse') {
    events.push({ t: 'spring', kind: 'curse', seat, pos });
    events.push(pushLog(state, `${player.name} は${pos + 1}マスの呪印で戻される`, 'bad'));
    knockback(state, seat, tile.back || 3, events);
    return true;
  }
  return false;
}

/**
 * @param {object} opts
 * @param {boolean} [opts.destroyBad]
 * @param {number} [opts.overtakeDamage] 指定すると追い越しダメージ
 * @param {number} [opts.chain]
 */
function moveBy(state, seat, steps, events, opts = {}) {
  const player = state.players[seat];
  if (!player || player.finished || state.phase === 'gameover') return;
  const chain = opts.chain || 0;
  const n = Math.trunc(steps);
  if (n < 0) {
    knockback(state, seat, -n, events);
    maybeAssassin(state, seat, events, chain);
    return;
  }
  if (n === 0) {
    maybeAssassin(state, seat, events, chain);
    return;
  }
  let left = n;
  let maxReached = player.pos;
  const from0 = player.pos;
  while (left > 0 && state.phase !== 'gameover' && !player.finished) {
    if (player.pos >= GOAL) break;
    const next = player.pos + 1;
    if (next >= GOAL) {
      const from = player.pos;
      player.pos = GOAL;
      player.stats.moved += 1;
      events.push({ t: 'step', seat, from, pos: GOAL });
      declareWin(state, seat, events);
      return;
    }
    const from = player.pos;
    player.pos = next;
    player.stats.moved += 1;
    if (player.pos > maxReached) maxReached = player.pos;
    events.push({ t: 'step', seat, from, pos: player.pos });
    left -= 1;
    if (player.downed) break;
    const halt = enterTile(state, seat, player.pos, events, opts);
    if (player.pos > maxReached) maxReached = player.pos;
    if (halt || player.downed) break;
  }
  if (opts.overtakeDamage && state.phase !== 'gameover') {
    for (const o of state.players) {
      if (o.id === seat) continue;
      if (from0 < o.pos && maxReached >= o.pos) {
        const dmg = power(player, opts.overtakeDamage, 'dashPlus');
        hurt(state, o.id, dmg, seat, events, 'dash');
        events.push(pushLog(state, `${player.name} が${o.name}を突き抜けた`, 'skill'));
      }
    }
  }
  if (!player.downed) maybeAssassin(state, seat, events, chain);
}

function applyFace(player, natural) {
  let value = natural + (player.dicePlus || 0);
  if (player.floorRolls > 0) {
    if (value < 2) value = 2;
    player.floorRolls -= 1;
  }
  return value;
}

function consumeMod(player, sum) {
  const total = sum + (player.diceModNext || 0);
  player.diceModNext = 0;
  return Math.max(0, total);
}

function beginTurn(state, events) {
  if (state.phase === 'gameover') return;
  const player = currentPlayer(state);
  tickCt(player);
  player.ironGuard = false;
  player.loaded = false;
  if (player.downed) {
    player.downed = false;
    player.justRevived = true;
    player.hp = 0;
    events.push({ t: 'rest', seat: player.id });
    events.push(pushLog(state, `${player.name} は休み。次の自分の番で起き上がる`, 'rest'));
    endTurn(state, events);
    return;
  }
  if (player.justRevived) {
    player.justRevived = false;
    player.hp = Math.max(1, Math.ceil(player.maxHp * REVIVE_RATE));
    let bonus = 0;
    if (player.job === 'vanguard') {
      bonus = jobOf(player).passive.bonus || 3;
      player.diceModNext += bonus;
    }
    events.push({ t: 'revive', seat: player.id, hp: player.hp, bonus });
    const extra = bonus ? ` 出目+${bonus}` : '';
    events.push(pushLog(state, `${player.name} が復帰（HP${player.hp}）${extra}`, 'good'));
  }
  state.phase = 'act';
  events.push({ t: 'turn', seat: player.id, round: state.round });
}

function endTurn(state, events) {
  if (state.phase === 'gameover') return;
  const n = state.players.length;
  state.turn = (state.turn + 1) % n;
  if (state.turn === 0) {
    state.round += 1;
    if (state.round >= 2 && openRoundBonuses(state, events)) return;
  }
  beginTurn(state, events);
}

function shuffle(state, list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function openRoundBonuses(state, events) {
  const positions = state.players.map((p) => p.pos);
  const max = Math.max(...positions);
  const min = Math.min(...positions);
  const offers = {};
  for (const player of state.players) {
    player.extraDice = player.pos === min ? 1 : 0;
    if (player.pos < max) {
      const pool = shuffle(state, upgradePool(player).map((u) => u.id));
      if (pool.length) offers[player.id] = pool.slice(0, Math.min(3, pool.length));
    }
  }
  const lastNames = state.players.filter((p) => p.extraDice).map((p) => p.name);
  if (lastNames.length) {
    events.push(pushLog(state, `ラウンド${state.round}。最下位ボーナス（ダイス+1）: ${lastNames.join('、')}`, 'system'));
  } else {
    events.push(pushLog(state, `ラウンド${state.round}`, 'system'));
  }
  const seats = Object.keys(offers);
  if (!seats.length) return false;
  state.drafts = { offers, picks: {} };
  state.phase = 'draft';
  events.push({ t: 'draft', seats: seats.map(Number) });
  events.push(pushLog(state, '1位以外は強化を1枚選ぶ', 'system'));
  return true;
}

function applyUpgrade(state, seat, upgradeId, events) {
  const player = state.players[seat];
  const up = upgradeById(upgradeId);
  if (!up) return;
  player.perks[upgradeId] = (player.perks[upgradeId] || 0) + 1;
  if (upgradeId === 'dice_plus') player.dicePlus += 1;
  else if (upgradeId === 'hp_up') {
    player.maxHp += 4;
    if (!player.downed && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + 4);
  } else if (upgradeId === 'candy') {
    heal(state, seat, 8, events, 'candy');
  } else if (upgradeId === 'shortcut') {
    moveBy(state, seat, 3, events, {});
  } else if (upgradeId === 'ct_cut') player.ctCut += 1;
  else if (upgradeId === 'punch') player.dmgPlus += 2;
  else if (upgradeId === 'cheer') player.diceModNext += 2;
  else if (upgradeId === 'omamori') player.oneShotGuard = true;
  else if (upgradeId === 'watchstep') player.trapIgnore += 1;
  else if (upgradeId === 'floor') player.floorRolls += 3;
  else if (upgradeId === 'guts') player.koShield = true;
  else if (upgradeId === 'dash_plus') player.perks.dashPlus = (player.perks.dashPlus || 0) + 3;
  else if (upgradeId === 'spike_plus') player.perks.spikePlus = (player.perks.spikePlus || 0) + 3;
  else if (upgradeId === 'blade_plus') player.perks.bladePlus = (player.perks.bladePlus || 0) + 3;
  else if (upgradeId === 'zero_guard') player.zeroInsure += 1;
  events.push({ t: 'upgrade', seat, upgradeId });
  events.push(pushLog(state, `${player.name} は「${up.name}」を掴んだ`, 'good'));
}

function resolveDrafts(state, events) {
  const seats = Object.keys(state.drafts.offers).map(Number).sort((a, b) => a - b);
  const picks = state.drafts.picks;
  state.drafts = null;
  for (const seat of seats) {
    if (state.phase === 'gameover') break;
    applyUpgrade(state, seat, picks[seat], events);
  }
  if (state.phase !== 'gameover') beginTurn(state, events);
}

function fail(error) {
  return { ok: false, error, events: [] };
}

/**
 * @returns {{ ok: boolean, error?: string, events: object[] }}
 */
export function applyAction(state, seat, action) {
  const events = [];
  if (!state || state.phase === 'gameover') return fail('もう終わってる');
  if (!action || !state.players[seat]) return fail('誰の操作？');

  if (action.type === 'draft') {
    if (state.phase !== 'draft' || !state.drafts?.offers?.[seat]) return fail('いまは選ばなくていい');
    if (state.drafts.picks[seat]) return fail('もう選んでる');
    const offer = state.drafts.offers[seat];
    if (!offer.includes(action.upgradeId)) return fail('その強化は候補にない');
    state.drafts.picks[seat] = action.upgradeId;
    const pending = Object.keys(state.drafts.offers).some((id) => !state.drafts.picks[id]);
    if (!pending) resolveDrafts(state, events);
    else events.push(pushLog(state, `${state.players[seat].name} が強化を選んだ`, 'system'));
    return { ok: true, events };
  }

  if (state.phase !== 'act') return fail('いまは動けない');
  if (currentPlayer(state).id !== seat) return fail('あなたの番じゃない');
  const player = state.players[seat];
  if (player.downed || player.hp <= 0) return fail('ダウン中');

  if (action.type === 'roll') {
    doRoll(state, seat, events);
    return { ok: true, events };
  }
  if (action.type === 'skill') {
    const err = doSkill(state, seat, action, events);
    if (err) return { ok: false, error: err, events: [] };
    // スキルの副作用で自分がダウンしたのに、まだ番が残っているとき
    if (state.phase !== 'gameover' && state.players[state.turn]?.id === seat) {
      const actor = state.players[seat];
      if (actor.downed || actor.hp <= 0) endTurn(state, events);
    }
    return { ok: true, events };
  }
  return fail('不明な操作');
}

function doRoll(state, seat, events) {
  const player = state.players[seat];
  const job = jobOf(player);
  const [min, max] = job.dice;
  const loaded = !!player.loaded;
  player.loaded = false;
  const count = 1 + (player.extraDice || 0);
  const faces = [];
  let sum = 0;
  let zeros = 0;
  for (let i = 0; i < count; i++) {
    const natural = rollOne(state, min, max, loaded);
    if (natural === 0) zeros += 1;
    const value = applyFace(player, natural);
    faces.push({ natural, value });
    sum += value;
  }
  sum = consumeMod(player, sum);
  events.push({ t: 'dice', seat, faces, total: sum, loaded, kind: 'roll' });
  if (zeros > 0 && player.job === 'gambler') {
    player.stats.zeros += zeros;
    const healEach = job.passive.heal || 4;
    for (let z = 0; z < zeros; z++) {
      heal(state, seat, healEach, events, 'luck');
      for (const sk of job.skills) {
        if (sk.kind === 'active' && (player.ct[sk.id] || 0) > 0) player.ct[sk.id] -= 1;
      }
    }
    events.push({ t: 'zero', seat, count: zeros });
    events.push(pushLog(state, `${player.name} は0を${zeros}個。強運が顔を出す`, 'good'));
  }
  const faceText = faces.map((f) => f.value).join('+');
  events.push(pushLog(state, `${player.name} の出目 ${faceText} → ${sum}マス`, 'info'));
  if (sum > 0) moveBy(state, seat, sum, events, {});
  else events.push(pushLog(state, `${player.name} はその場で足踏み`, 'info'));
  if (state.phase !== 'gameover') endTurn(state, events);
}

function finishSkillTurn(state, player, events) {
  if (state.phase === 'gameover') return;
  if (player.downed) endTurn(state, events);
}

function doSkill(state, seat, action, events) {
  const player = state.players[seat];
  const id = action.id;
  const reason = skillLockReason(state, seat, id);
  if (reason) return reason;
  const sk = skillById(player.job, id);

  if (id === 'spike') {
    const tiles = spikeTiles(state, seat);
    if (!tiles.includes(action.tile)) return 'そこには置けない';
    const damage = (sk.damage || 6) + (player.dmgPlus || 0) + (player.perks.spikePlus || 0);
    state.tiles[action.tile] = { kind: 'spike', owner: seat, damage };
    player.stats.traps += 1;
    setCt(player, id);
    events.push({ t: 'place', seat, tile: action.tile, kind: 'spike' });
    events.push(pushLog(state, `${player.name} が${action.tile + 1}マスにスパイク`, 'skill'));
    return '';
  }
  if (id === 'curse') {
    const tiles = curseTiles(state, seat);
    if (!tiles.includes(action.tile)) return 'そこには置けない';
    state.tiles[action.tile] = { kind: 'curse', owner: seat, back: sk.back || 3 };
    player.stats.traps += 1;
    setCt(player, id);
    events.push({ t: 'place', seat, tile: action.tile, kind: 'curse' });
    events.push(pushLog(state, `${player.name} が${action.tile + 1}マスに呪印`, 'skill'));
    return '';
  }
  if (id === 'poison') {
    const targets = playersInRange(state, seat, sk.range || 8);
    const target = state.players[action.target];
    if (!target || !targets.includes(target)) return 'その相手には届かない';
    setCt(player, id);
    const dmg = power(player, sk.damage || 6, 'bladePlus');
    const hit = hurt(state, target.id, dmg, seat, events, 'poison');
    if (!hit.blocked) target.diceModNext -= sk.penalty || 2;
    events.push({ t: 'skill', seat, id, target: target.id });
    events.push(pushLog(
      state,
      hit.blocked
        ? `${player.name} の毒刃は${target.name}に弾かれた`
        : `${player.name} の毒刃 → ${target.name}。次の出目-2`,
      'skill',
    ));
    return '';
  }
  if (id === 'execute') {
    const target = state.players[action.target];
    if (!target || target.id === seat || target.hp <= 0) return '対象がいない';
    if (target.hp / target.maxHp > (sk.hpRate || 0.5)) return 'まだHPが半分より上';
    setCt(player, id);
    const dmg = power(player, sk.damage || 14, 'bladePlus');
    const res = hurt(state, target.id, dmg, seat, events, 'execute');
    events.push({ t: 'skill', seat, id, target: target.id, ult: true });
    if (res.killed) {
      for (const s of jobOf(player).skills) player.ct[s.id] = 0;
      events.push(pushLog(state, `${player.name} の処刑が決まった。CTが全部戻る`, 'ult'));
    } else {
      events.push(pushLog(state, `${player.name} が${target.name}に処刑を放った`, 'ult'));
    }
    return '';
  }
  if (id === 'shadow') {
    const target = nearestAhead(state, seat, sk.range || 6);
    if (!target) return '入れ替わる相手がいない';
    if (target.ironGuard) return `${target.name} はガード中で入れ替えられない`;
    setCt(player, id);
    const fromA = player.pos;
    const fromB = target.pos;
    player.pos = fromB;
    target.pos = fromA;
    events.push({
      t: 'swap', seat, target: target.id, fromA, fromB, posA: player.pos, posB: target.pos,
    });
    events.push(pushLog(state, `${player.name} と${target.name}が入れ替わった`, 'skill'));
    return '';
  }
  if (id === 'guard') {
    setCt(player, id);
    player.ironGuard = true;
    events.push({ t: 'skill', seat, id });
    events.push(pushLog(state, `${player.name} はアイアンガード`, 'skill'));
    return '';
  }
  if (id === 'loaded') {
    setCt(player, id);
    player.loaded = true;
    events.push({ t: 'skill', seat, id });
    events.push(pushLog(state, `${player.name} はダイスに細工した`, 'skill'));
    return '';
  }
  if (id === 'dash') {
    setCt(player, id);
    events.push({ t: 'skill', seat, id });
    events.push(pushLog(state, `${player.name} のダッシュ！`, 'skill'));
    moveBy(state, seat, sk.steps || 3, events, { overtakeDamage: sk.damage || 5 });
    finishSkillTurn(state, player, events);
    return '';
  }
  if (id === 'roulette') {
    setCt(player, id);
    const idx = pullInt(state, 0, state.players.length - 1);
    const target = state.players[Math.max(0, Math.min(state.players.length - 1, idx))];
    const forward = pullInt(state, 0, 1) === 1;
    const steps = sk.steps || 4;
    events.push({ t: 'roulette', seat, target: target.id, forward, steps });
    if (target.ironGuard) {
      events.push({ t: 'block', seat: target.id, reason: 'guard' });
      events.push(pushLog(state, `ルーレットは${target.name}。ガードで動かない`, 'skill'));
      return '';
    }
    const dir = forward ? `+${steps}` : `-${steps}`;
    events.push(pushLog(state, `ルーレットは${target.name}（${dir}）`, 'skill'));
    moveBy(state, target.id, forward ? steps : -steps, events, {});
    if (state.phase !== 'gameover' && target.downed && target.id === seat) endTurn(state, events);
    return '';
  }
  if (id === 'pandemonium') {
    const traps = [];
    state.tiles.forEach((tile, i) => {
      if (tile && tile.owner === seat) traps.push(i);
    });
    if (traps.length < (sk.need || 2)) return '罠が足りない';
    setCt(player, id);
    const snap = state.players.map((p) => p.pos);
    const hits = new Map();
    const radius = sk.radius || 2;
    for (const i of traps) {
      for (const o of state.players) {
        if (o.id === seat || o.finished) continue;
        if (Math.abs(snap[o.id] - i) <= radius) hits.set(o.id, (hits.get(o.id) || 0) + 1);
      }
    }
    events.push({ t: 'boom', seat, tiles: traps.slice(), hits: [...hits.keys()] });
    events.push(pushLog(state, `${player.name} が罠を全部起爆！`, 'ult'));
    const dmg = (sk.damage || 9) + (player.dmgPlus || 0);
    for (const [idHit, n] of hits) {
      for (let k = 0; k < n; k++) {
        const res = hurt(state, idHit, dmg, seat, events, 'boom');
        if (!res.blocked) knockback(state, idHit, sk.back || 1, events);
      }
    }
    for (const i of traps) state.tiles[i] = null;
    return '';
  }
  if (id === 'charge') {
    setCt(player, id);
    const [min, max] = jobOf(player).dice;
    const faces = [];
    let sum = 0;
    const diceN = sk.dice || 2;
    for (let i = 0; i < diceN; i++) {
      const natural = rollOne(state, min, max, false);
      const value = applyFace(player, natural);
      faces.push({ natural, value });
      sum += value;
    }
    sum = consumeMod(player, sum);
    events.push({ t: 'dice', seat, faces, total: sum, kind: 'charge' });
    events.push({ t: 'skill', seat, id, ult: true });
    events.push(pushLog(state, `${player.name} の突撃 ${faces.map((f) => f.value).join('+')} → ${sum}`, 'ult'));
    if (sum > 0) moveBy(state, seat, sum, events, { destroyBad: true });
    if (state.phase !== 'gameover') endTurn(state, events);
    return '';
  }
  if (id === 'allin') {
    setCt(player, id);
    player.loaded = false;
    const [min, max] = jobOf(player).dice;
    const faces = [];
    let sum = 0;
    let bust = false;
    for (let i = 0; i < (sk.dice || 3); i++) {
      let natural = rollOne(state, min, max, false);
      let insured = false;
      if (natural === 0 && player.zeroInsure > 0) {
        player.zeroInsure -= 1;
        insured = true;
        natural = 1;
      } else if (natural === 0) bust = true;
      const value = applyFace(player, insured ? 1 : natural);
      faces.push({ natural: insured ? 0 : natural, value: insured ? value : value, insured });
      if (!bust) sum += value;
    }
    if (!bust) sum = consumeMod(player, sum);
    else player.diceModNext = 0;
    events.push({ t: 'dice', seat, faces, total: bust ? 0 : sum, kind: 'allin', bust });
    events.push({ t: 'skill', seat, id, ult: true });
    if (bust) {
      player.hp = 0;
      player.downed = true;
      events.push({ t: 'ko', seat, by: seat });
      events.push(pushLog(state, `${player.name} のオールインは0。その場でダウン`, 'bad'));
      endTurn(state, events);
      return '';
    }
    events.push(pushLog(state, `${player.name} のオールイン ${faces.map((f) => f.value).join('+')} → ${sum}`, 'ult'));
    if (sum > 0) moveBy(state, seat, sum, events, {});
    if (state.phase !== 'gameover') endTurn(state, events);
    return '';
  }
  return '使えない技';
}

export function buildResults(state) {
  const ranked = [...state.players].sort((a, b) => {
    if (state.winner === a.id) return -1;
    if (state.winner === b.id) return 1;
    return b.pos - a.pos || b.hp - a.hp || a.id - b.id;
  });
  const awards = [];
  const byDealt = [...state.players].sort((a, b) => b.stats.dealt - a.stats.dealt)[0];
  if (byDealt && byDealt.stats.dealt > 0) {
    awards.push({ title: 'よく殴った', name: byDealt.name, detail: `${byDealt.stats.dealt}ダメージ` });
  }
  const byZeros = [...state.players].sort((a, b) => b.stats.zeros - a.stats.zeros)[0];
  if (byZeros && byZeros.stats.zeros > 0) {
    awards.push({ title: 'ゼロの顔', name: byZeros.name, detail: `${byZeros.stats.zeros}回` });
  }
  const byTraps = [...state.players].sort((a, b) => b.stats.traps - a.stats.traps)[0];
  if (byTraps && byTraps.stats.traps > 0) {
    awards.push({ title: '仕掛け人', name: byTraps.name, detail: `${byTraps.stats.traps}個` });
  }
  const byMoved = [...state.players].sort((a, b) => b.stats.moved - a.stats.moved)[0];
  if (byMoved) {
    awards.push({ title: 'よく歩いた', name: byMoved.name, detail: `${byMoved.stats.moved}マス` });
  }
  return { ranked, awards };
}
