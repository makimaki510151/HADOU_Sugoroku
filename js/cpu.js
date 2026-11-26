/** CPUの一手。ホストだけが呼び、結果は状態配信に載る。 */

import { JOBS } from './jobs.js';
import { listActions, rankOf } from './engine.js';
import { upgradeById } from './upgrades.js';

function closestChaser(state, seat) {
  const pos = state.players[seat].pos;
  let best = null;
  for (const o of state.players) {
    if (o.id === seat || o.pos >= pos) continue;
    if (!best || o.pos > best.pos) best = o;
  }
  return best;
}

function bestSpikeTile(state, seat) {
  const tiles = listActions(state, seat).filter((a) => a.id === 'spike').map((a) => a.tile);
  if (!tiles.length) return null;
  const chaser = closestChaser(state, seat);
  if (!chaser) return Math.min(...tiles);
  const ahead = tiles.filter((t) => t > chaser.pos).sort((a, b) => a - b);
  return ahead[0] ?? Math.min(...tiles);
}

function bestCurseTile(state, seat) {
  const tiles = listActions(state, seat).filter((a) => a.id === 'curse').map((a) => a.tile);
  if (!tiles.length) return null;
  const pos = state.players[seat].pos;
  const leaders = state.players.filter((o) => o.id !== seat && o.pos > pos).sort((a, b) => a.pos - b.pos);
  if (!leaders.length) return Math.max(...tiles);
  const ahead = tiles.filter((t) => t > leaders[0].pos).sort((a, b) => a - b);
  return ahead[0] ?? Math.max(...tiles);
}

function pandemoniumHot(state, seat) {
  const traps = [];
  state.tiles.forEach((tile, i) => {
    if (tile && tile.owner === seat) traps.push(i);
  });
  return state.players.some((o) => (
    o.id !== seat && traps.some((i) => Math.abs(o.pos - i) <= 2)
  ));
}

function scoreAction(state, seat, action) {
  const player = state.players[seat];
  const id = action.id;
  if (id === 'execute') return 12;
  if (id === 'charge') return 10;
  if (id === 'pandemonium') return pandemoniumHot(state, seat) ? 9 : 3;
  if (id === 'shadow') {
    const ahead = state.players
      .filter((o) => o.id !== seat && o.pos > player.pos && o.pos - player.pos <= 6)
      .sort((a, b) => a.pos - b.pos)[0];
    if (!ahead) return 0;
    return ahead.pos - player.pos >= 3 ? 8 : 4;
  }
  if (id === 'dash') {
    const hit = state.players.some((o) => o.id !== seat && player.pos < o.pos && player.pos + 3 >= o.pos);
    if (hit) return 9;
    // 先頭でただ伸びるより、追いつくか刺しにいくときに使う
    return rankOf(state, seat) > 1 ? 8 : 4;
  }
  if (id === 'guard') return player.hp / player.maxHp < 0.55 ? 8 : 1;
  if (id === 'loaded') return 7;
  if (id === 'roulette') return rankOf(state, seat) > 1 ? 6 : 2;
  if (id === 'allin') {
    const gap = Math.max(...state.players.map((p) => p.pos)) - player.pos;
    if (player.hp / player.maxHp <= 0.3 || gap >= 12) return 8;
    return 3;
  }
  if (id === 'poison') {
    const target = state.players[action.target];
    if (!target) return 0;
    let s = 6;
    if (target.pos >= player.pos) s += 2;
    if (target.hp / target.maxHp <= 0.45) s += 2;
    return s;
  }
  if (id === 'spike') return action.tile === bestSpikeTile(state, seat) ? 7 : 3;
  if (id === 'curse') return action.tile === bestCurseTile(state, seat) ? 7 : 3;
  if (id === 'sprint') return rankOf(state, seat) > 1 ? 8 : 5;
  if (id === 'boost') return rankOf(state, seat) === 1 ? 7 : 5;
  if (id === 'overdrive') return 10;
  if (id === 'pull') {
    const target = state.players[action.target];
    if (!target) return 0;
    return target.pos > player.pos ? 7 : 4;
  }
  if (id === 'push') return 6;
  if (id === 'polarity') return 9;
  return 0;
}

function scoreUpgrade(state, seat, id) {
  const player = state.players[seat];
  const gap = Math.max(...state.players.map((p) => p.pos)) - player.pos;
  const ratio = player.hp / player.maxHp;
  switch (id) {
    case 'shortcut':
    case 'leap':
    case 'mule':
      return 5 + (gap >= 8 ? 4 : 0);
    case 'hop': return 3 + (gap >= 8 ? 2 : 0);
    case 'dice_plus': return 7;
    case 'ct_cut':
    case 'ult_cut':
      return 6;
    case 'punch':
    case 'thick_skin':
      return 5;
    case 'trickle': return 4;
    case 'hp_up':
    case 'stretch':
    case 'iron_ration':
      return ratio < 0.7 ? 6 : 4;
    case 'candy':
    case 'bandage':
    case 'sugar':
    case 'feast':
    case 'panic':
      return ratio < 0.55 ? 7 : 2;
    case 'cheer':
    case 'whisper':
    case 'espresso':
    case 'roar':
    case 'spare_die':
      return 4;
    case 'calm': return (player.diceModNext || 0) < 0 ? 8 : 1;
    case 'omamori': return ratio < 0.6 ? 6 : 3;
    case 'guts': return ratio < 0.45 ? 7 : 3;
    case 'watchstep':
    case 'clear_eyes':
      return state.tiles.some(Boolean) ? 5 : 2;
    case 'floor':
    case 'soft_land':
      return player.job === 'gambler' ? 6 : 3;
    case 'dash_plus':
    case 'dash_long':
    case 'spirit_plus':
    case 'guard_heal':
    case 'spike_plus':
    case 'sticky_trap':
    case 'trap_kit':
    case 'curse_plus':
    case 'boom_plus':
    case 'blade_plus':
    case 'poison_pen':
    case 'shadow_long':
    case 'foot_plus':
    case 'zero_guard':
    case 'zero_vault':
    case 'lucky_zero':
    case 'roulette_plus':
    case 'field_plus':
    case 'pull_plus':
    case 'push_plus':
    case 'field_wide':
    case 'sprint_plus':
    case 'boost_plus':
    case 'stride_plus':
    case 'boost_far':
      return 6;
    default: return 1;
  }
}

export function chooseDraft(state, seat) {
  const offer = state.drafts?.offers?.[seat] || [];
  if (!offer.length) return null;
  let best = offer[0];
  let score = -1;
  for (const id of offer) {
    const s = scoreUpgrade(state, seat, id);
    if (s > score) {
      score = s;
      best = id;
    }
  }
  return best;
}

/**
 * @param {Set<string>} used このターンに使ったスキルid
 */
export function chooseCpuAction(state, seat, level = 'normal', used = new Set()) {
  const actions = listActions(state, seat);
  const roll = actions.find((a) => a.type === 'roll');
  const drafts = actions.filter((a) => a.type === 'draft');
  if (drafts.length) {
    const upgradeId = chooseDraft(state, seat);
    return upgradeId ? { type: 'draft', upgradeId } : null;
  }
  if (!roll) return null;
  const easy = level === 'easy';
  if (easy && Math.random() < 0.5) return roll;

  let best = null;
  let bestScore = 0;
  for (const action of actions) {
    if (action.type !== 'skill') continue;
    if (used.has(action.id)) continue;
    const score = scoreAction(state, seat, action);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  const threshold = easy ? 8 : 6;
  if (best && bestScore >= threshold) return best;
  return roll;
}

export function describeUpgrade(id) {
  return upgradeById(id);
}

export function cpuLabel(jobId) {
  return JOBS[jobId]?.name || 'CPU';
}
