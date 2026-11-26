/** 覇道すごろく — 100マスの蛇行コースを Canvas に描く */

export const BOARD_W = 1000;
export const BOARD_H = 1120;

const COLS = 10;
const SIZE = 76;
const GAP = 12;
const X0 = 78;
const Y0 = 108;

function hash(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function tileRect(i) {
  const row = Math.floor(i / COLS);
  const colIn = i % COLS;
  const col = row % 2 === 0 ? colIn : (COLS - 1 - colIn);
  const jx = (hash(i + 3) - 0.5) * 5;
  const jy = (hash(i + 11) - 0.5) * 5;
  return {
    x: X0 + col * (SIZE + GAP) + jx,
    y: Y0 + row * (SIZE + GAP) + jy,
    w: SIZE,
    h: SIZE,
    row,
    col,
  };
}

export function createCamera() {
  return { scale: 1, x: 0, y: 0 };
}

export function fitCamera(cam, viewW, viewH) {
  const s = Math.min((viewW - 20) / BOARD_W, (viewH - 20) / BOARD_H);
  cam.scale = Math.max(0.18, s);
  cam.x = (viewW - BOARD_W * cam.scale) / 2;
  cam.y = (viewH - BOARD_H * cam.scale) / 2;
}

export function hitTile(cam, mx, my) {
  const x = (mx - cam.x) / cam.scale;
  const y = (my - cam.y) / cam.scale;
  let found = -1;
  for (let i = 0; i < 100; i++) {
    const r = tileRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) found = i;
  }
  return found;
}

const ROW_COLORS = ['#fff6d8', '#ffe1ea', '#d9f6ef', '#fff0cc', '#e4f1ff', '#ffe8d2', '#f3e6ff', '#e7f8d8', '#ffe4e1', '#fff4b8'];

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function centerOf(i) {
  const r = tileRect(i);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function trapMark(tile) {
  if (!tile || tile.hidden) return null;
  if (tile.kind === 'spike') return { label: '杭', fill: '#ff6b6b', ink: '#fff8ea' };
  if (tile.kind === 'curse') return { label: '呪', fill: '#6c5ce7', ink: '#fff8ea' };
  if (tile.kind === 'boost') return { label: '走', fill: '#2fbf71', ink: '#fff8ea' };
  return { label: '？', fill: '#221814', ink: '#fff8ea' };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   state: object,
 *   cam: {scale:number,x:number,y:number},
 *   viewW: number,
 *   viewH: number,
 *   displayPos?: Record<number, number>,
 *   highlight?: Set<number>|number[],
 *   inspect?: number|null,
 *   time?: number,
 * }} opts
 */
export function drawBoard(ctx, opts) {
  const { state, cam, viewW, viewH } = opts;
  const time = opts.time || 0;
  const highlight = opts.highlight instanceof Set ? opts.highlight : new Set(opts.highlight || []);
  const inspect = Number.isInteger(opts.inspect) ? opts.inspect : -1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.fillStyle = '#f6e2b8';
  ctx.fillRect(0, 0, viewW, viewH);
  // 網点
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let y = 8; y < viewH; y += 14) {
    for (let x = (y / 14) % 2 ? 8 : 0; x < viewW; x += 14) {
      ctx.fillStyle = '#c9844a';
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.restore();

  ctx.setTransform(cam.scale, 0, 0, cam.scale, cam.x, cam.y);

  roundRect(ctx, 28, 28, BOARD_W - 56, BOARD_H - 52, 28);
  ctx.fillStyle = '#fff8ea';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#221814';
  ctx.stroke();

  ctx.save();
  ctx.translate(78, 62);
  ctx.rotate(-0.03);
  ctx.fillStyle = '#221814';
  ctx.font = '700 28px "Dela Gothic One", sans-serif';
  ctx.fillText('覇道コース', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(BOARD_W - 168, 48);
  ctx.rotate(0.08);
  ctx.beginPath();
  ctx.arc(48, 28, 36, 0, Math.PI * 2);
  ctx.fillStyle = '#e23d3d';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff4ea';
  ctx.stroke();
  ctx.fillStyle = '#fff8ea';
  ctx.font = '700 16px "Yusei Magic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('100', 48, 24);
  ctx.font = '700 12px "Yusei Magic", sans-serif';
  ctx.fillText('一番乗り', 48, 42);
  ctx.restore();
  ctx.textAlign = 'left';

  // 道
  ctx.beginPath();
  for (let i = 0; i < 100; i++) {
    const c = centerOf(i);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  }
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#f0c36a';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#221814';
  ctx.stroke();

  const current = state?.players?.[state.turn];

  for (let i = 0; i < 100; i++) {
    const r = tileRect(i);
    const tile = state?.tiles?.[i];
    const mark = trapMark(tile);
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate((hash(i + 21) - 0.5) * 0.06);
    roundRect(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 12);
    if (i === 99) ctx.fillStyle = '#ff4d6d';
    else if (i === 0) ctx.fillStyle = '#2fbf71';
    else if (mark?.label === '杭') ctx.fillStyle = '#ffd0cc';
    else if (mark?.label === '呪') ctx.fillStyle = '#d9d2ff';
    else if (mark?.label === '走') ctx.fillStyle = '#c8f5d8';
    else ctx.fillStyle = ROW_COLORS[r.row % ROW_COLORS.length];
    ctx.fill();
    const isInspect = i === inspect;
    ctx.lineWidth = highlight.has(i) || isInspect ? 6 : 3;
    ctx.strokeStyle = highlight.has(i) ? '#e23d3d' : isInspect ? '#c47a12' : '#221814';
    ctx.stroke();
    if (highlight.has(i)) {
      ctx.strokeStyle = 'rgba(226,61,61,0.35)';
      ctx.lineWidth = 10;
      ctx.stroke();
    } else if (isInspect) {
      ctx.strokeStyle = 'rgba(196,122,18,0.35)';
      ctx.lineWidth = 10;
      ctx.stroke();
    }
    ctx.fillStyle = i === 99 || i === 0 ? '#fffaf0' : '#221814';
    ctx.font = '700 14px "Yusei Magic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 0, -14);
    if (i === 0) {
      ctx.font = '700 18px "Yusei Magic", sans-serif';
      ctx.fillText('出', 0, 16);
    } else if (i === 99) {
      ctx.font = '700 18px "Yusei Magic", sans-serif';
      ctx.fillText('着', 0, 16);
    } else if (i === 24 || i === 49 || i === 74) {
      ctx.font = '700 12px "Yusei Magic", sans-serif';
      ctx.fillText('中間', 0, 8);
    } else {
      ctx.globalAlpha = 0.35;
      ctx.font = '700 12px "Yusei Magic", sans-serif';
      ctx.fillText('·', 0, 6);
      ctx.globalAlpha = 1;
    }
    if (mark) {
      roundRect(ctx, 8, 8, 26, 22, 8);
      ctx.fillStyle = mark.fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#221814';
      ctx.stroke();
      ctx.fillStyle = mark.ink;
      ctx.font = '700 13px "Yusei Magic", sans-serif';
      ctx.fillText(mark.label, 21, 24);
    }
    ctx.restore();
  }

  if (!state) return;

  const buckets = new Map();
  for (const p of state.players) {
    const pos = opts.displayPos && opts.displayPos[p.id] != null ? opts.displayPos[p.id] : p.pos;
    if (!buckets.has(pos)) buckets.set(pos, []);
    buckets.get(pos).push(p);
  }

  for (const [pos, group] of buckets) {
    const c = centerOf(pos);
    group.forEach((p, idx) => {
      const spread = (idx - (group.length - 1) / 2) * 16;
      const bob = current && p.id === current.id && state.phase === 'act'
        ? Math.sin(time / 180) * 3
        : 0;
      drawToken(ctx, c.x + spread, c.y - 6 + bob, p, current && p.id === current.id);
    });
  }
}

function drawToken(ctx, x, y, player, active) {
  ctx.save();
  ctx.translate(x, y);
  if (active) {
    ctx.beginPath();
    ctx.arc(0, 2, 24, 0, Math.PI * 2);
    ctx.strokeStyle = '#221814';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fillStyle = player.color || '#ff4d6d';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#221814';
  ctx.stroke();
  // 顔
  ctx.fillStyle = '#221814';
  ctx.fillRect(-6, -4, 3, 3);
  ctx.fillRect(3, -4, 3, 3);
  ctx.beginPath();
  if (player.hp <= 0 || player.downed || player.justRevived) {
    ctx.moveTo(-5, 6);
    ctx.lineTo(5, 4);
  } else {
    ctx.arc(0, 3, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  ctx.strokeStyle = '#221814';
  ctx.lineWidth = 2;
  ctx.stroke();
  const mark = player.job === 'trap' ? '罠'
    : player.job === 'assassin' ? '刃'
      : player.job === 'gambler' ? '運'
        : player.job === 'magnet' ? '磁'
          : player.job === 'runner' ? '走'
            : '盾';
  ctx.font = '700 10px "Yusei Magic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = '#221814';
  ctx.lineWidth = 3;
  ctx.strokeText(mark, 0, -16);
  ctx.fillText(mark, 0, -16);
  ctx.restore();
}

export function describeTile(state, index) {
  if (index < 0 || index > 99) return 'コースの外';
  if (index === 0) return 'マス1 スタート';
  if (index === 99) return 'マス100 ゴール。乗った人の勝ち';
  const tile = state?.tiles?.[index];
  const who = state?.players?.filter((p) => p.pos === index).map((p) => p.name).join('、');
  let body = `マス${index + 1}`;
  if (!tile) body += ' なんもない';
  else if (tile.hidden) body += ' なにか仕掛けてありそう…';
  else if (tile.kind === 'spike') {
    const owner = state.players[tile.owner]?.name || '誰か';
    body += ` 【杭】スパイク（${owner} / ${tile.damage}ダメ・強制停止${tile.durable ? '・粘着' : '・起動で壊れる'}）`;
  } else if (tile.kind === 'curse') {
    const owner = state.players[tile.owner]?.name || '誰か';
    body += ` 【呪】逆走の呪印（${owner} / ${tile.back || 2}マス戻る${tile.durable ? '・粘着' : '・起動で壊れる'}）`;
  } else if (tile.kind === 'boost') {
    const owner = state.players[tile.owner]?.name || '誰か';
    body += ` 【走】加速床（${owner} / +${tile.steps || 3}マス・起動で消える）`;
  } else {
    body += ' 仕掛けあり';
  }
  if (who) body += ` ｜ ${who}`;
  return body;
}
