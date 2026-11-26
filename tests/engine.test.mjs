import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOAL,
  applyAction,
  createGame,
  listActions,
  orderByLastFirst,
  rankOf,
  serializeState,
  skillLockReason,
} from '../js/engine.js';
import { chooseCpuAction } from '../js/cpu.js';
import { isMyTurnSeat } from '../js/turn.js';
import { describeTile, tileRect } from '../js/board.js';
import { JOB_LIST } from '../js/jobs.js';
import { UPGRADES, upgradePool, isUpgradeAvailable, upgradeById } from '../js/upgrades.js';

function setup(jobs, seed = 3) {
  const { state } = createGame({
    seed,
    players: jobs.map((job, i) => ({
      name: `P${i}`,
      job,
      isCPU: false,
      color: '#ff4d6d',
    })),
  });
  // スキル単体テストは席0から操作する想定なので、ロビー順に固定する
  state.turnOrder = state.players.map((p) => p.id);
  state.turnIndex = 0;
  state.turn = 0;
  state.phase = 'act';
  return state;
}

function setupNatural(jobs, seed = 3) {
  const { state } = createGame({
    seed,
    players: jobs.map((job, i) => ({
      name: `P${i}`,
      job,
      isCPU: false,
      color: '#ff4d6d',
    })),
  });
  return state;
}

function act(state, seat, action, faces) {
  if (faces) state.forcedRolls = faces.slice();
  return applyAction(state, seat, action);
}

describe('コース', () => {
  it('100マス目はぴったりでなくても到達で勝ち', () => {
    const s = setup(['vanguard', 'trap']);
    s.players[0].pos = 96;
    const res = act(s, 0, { type: 'roll' }, [5]);
    assert.equal(res.ok, true);
    assert.equal(s.players[0].pos, GOAL);
    assert.equal(s.phase, 'gameover');
    assert.equal(s.winner, 0);
  });

  it('蛇行は偶数行が左から、奇数行が右から', () => {
    assert.equal(tileRect(0).col, 0);
    assert.equal(tileRect(9).col, 9);
    assert.equal(tileRect(10).col, 9);
    assert.equal(tileRect(19).col, 0);
    assert.equal(tileRect(99).row, 9);
  });
});

describe('ヴァンガード', () => {
  it('ダッシュは3マス進み、追い越しにダメージ', () => {
    const s = setup(['vanguard', 'assassin']);
    s.players[1].pos = 2;
    const res = act(s, 0, { type: 'skill', id: 'dash' });
    assert.equal(res.ok, true);
    assert.equal(s.players[0].pos, 3);
    assert.equal(s.players[1].hp, s.players[1].maxHp - 3);
    assert.equal(s.players[0].ct.dash, 2);
    assert.equal(s.phase, 'act');
    assert.equal(s.turn, 0);
  });

  it('アイアンガードは罠のダメージと強制停止を無視する', () => {
    const s = setup(['vanguard', 'trap']);
    act(s, 0, { type: 'skill', id: 'guard' });
    s.tiles[2] = { kind: 'spike', owner: 1, damage: 6 };
    act(s, 0, { type: 'roll' }, [5]);
    assert.equal(s.players[0].pos, 5);
    assert.equal(s.players[0].hp, s.players[0].maxHp);
    assert.equal(s.tiles[2].kind, 'spike');
  });

  it('ガードがないとスパイクで止まり、ダメージを受ける', () => {
    const s = setup(['vanguard', 'trap']);
    s.tiles[2] = { kind: 'spike', owner: 1, damage: 6 };
    act(s, 0, { type: 'roll' }, [5]);
    assert.equal(s.players[0].pos, 2);
    assert.equal(s.players[0].hp, s.players[0].maxHp - 6);
    assert.equal(s.tiles[2], null);
  });

  it('呪印は戻して移動を打ち切る', () => {
    const s = setup(['vanguard', 'trap']);
    s.tiles[3] = { kind: 'curse', owner: 1, back: 2 };
    act(s, 0, { type: 'roll' }, [4]);
    assert.equal(s.players[0].pos, 1);
    assert.equal(s.players[0].hp, s.players[0].maxHp);
    assert.equal(s.tiles[3], null);
  });

  it('ガードは次の自分のターン開始で切れる', () => {
    const s = setup(['vanguard', 'trap']);
    act(s, 0, { type: 'skill', id: 'guard' });
    assert.equal(s.players[0].ironGuard, true);
    act(s, 0, { type: 'roll' }, [1]);
    s.players[0].pos = 1;
    s.players[1].pos = 8;
    act(s, 1, { type: 'roll' }, [1]);
    if (s.phase === 'draft') {
      const seat = Number(Object.keys(s.drafts.offers)[0]);
      act(s, seat, { type: 'draft', upgradeId: s.drafts.offers[seat][0] });
    }
    assert.equal(s.turn, 0);
    assert.equal(s.players[0].ironGuard, false);
  });

  it('ダッシュのCTは自分のターン開始で減る', () => {
    const s = setup(['vanguard', 'trap']);
    act(s, 0, { type: 'skill', id: 'dash' });
    act(s, 0, { type: 'roll' }, [1]);
    s.players[0].pos = 1;
    s.players[1].pos = 8;
    act(s, 1, { type: 'roll' }, [0]);
    if (s.phase === 'draft') {
      const seat = Number(Object.keys(s.drafts.offers)[0]);
      act(s, seat, { type: 'draft', upgradeId: s.drafts.offers[seat][0] });
    }
    assert.equal(s.round, 2);
    assert.equal(s.phase, 'act');
    assert.equal(s.turn, 0);
    assert.equal(s.players[0].ct.dash, 1);
  });

  it('突撃は2ダイスで進み、通った罠を壊してターンが終わる', () => {
    const s = setup(['vanguard', 'trap']);
    s.players[0].pos = 10;
    s.players[1].pos = 0;
    s.tiles[12] = { kind: 'spike', owner: 1, damage: 9 };
    const res = act(s, 0, { type: 'skill', id: 'charge' }, [3, 4]);
    assert.equal(res.ok, true);
    assert.equal(s.players[0].pos, 17);
    assert.equal(s.tiles[12], null);
    assert.equal(s.players[0].hp, s.players[0].maxHp);
    assert.notEqual(s.turn, 0);
  });

  it('後ろに6マス以上いないと突撃できない', () => {
    const s = setup(['vanguard', 'trap']);
    assert.match(skillLockReason(s, 0, 'charge'), /6マス/);
    const res = act(s, 0, { type: 'skill', id: 'charge' }, [6, 6]);
    assert.equal(res.ok, false);
    assert.equal(s.players[0].pos, 0);
  });
});

describe('トラップマスター', () => {
  it('自分の罠は踏まず、HPが少し戻る', () => {
    const s = setup(['trap', 'vanguard']);
    s.players[0].hp = 6;
    s.tiles[1] = { kind: 'spike', owner: 0, damage: 6 };
    act(s, 0, { type: 'roll' }, [1]);
    assert.equal(s.players[0].pos, 1);
    assert.equal(s.players[0].hp, 7);
    assert.equal(s.tiles[1].kind, 'spike');
  });

  it('他人の罠は普通に刺さる', () => {
    const s = setup(['trap', 'vanguard']);
    s.players[0].hp = 10;
    s.tiles[1] = { kind: 'spike', owner: 1, damage: 3 };
    act(s, 0, { type: 'roll' }, [3]);
    assert.equal(s.players[0].pos, 1);
    assert.equal(s.players[0].hp, 7);
    assert.equal(s.tiles[1], null);
  });

  it('起動した罠は壊れ、粘着だけ残る', () => {
    const s = setup(['vanguard', 'trap']);
    s.tiles[2] = { kind: 'spike', owner: 1, damage: 3, durable: true };
    act(s, 0, { type: 'roll' }, [3]);
    assert.equal(s.players[0].pos, 2);
    assert.equal(s.tiles[2].kind, 'spike');
    assert.equal(s.tiles[2].durable, true);
  });

  it('スパイクは後ろ3マスの空マスだけ', () => {
    const s = setup(['trap', 'vanguard']);
    s.players[0].pos = 5;
    const tiles = listActions(s, 0).filter((a) => a.id === 'spike').map((a) => a.tile);
    assert.deepEqual(tiles, [4, 3, 2]);
    s.tiles[4] = { kind: 'curse', owner: 1, back: 3 };
    const left = listActions(s, 0).filter((a) => a.id === 'spike').map((a) => a.tile);
    assert.deepEqual(left, [3, 2]);
  });

  it('パンデモニウムは罠2つの周囲に複数回ヒットして後退させる', () => {
    const s = setup(['trap', 'vanguard']);
    s.tiles[4] = { kind: 'spike', owner: 0, damage: 6 };
    s.tiles[6] = { kind: 'curse', owner: 0, back: 3 };
    s.players[1].maxHp = 40;
    s.players[1].hp = 40;
    s.players[1].pos = 5;
    const res = act(s, 0, { type: 'skill', id: 'pandemonium' });
    assert.equal(res.ok, true);
    assert.equal(s.players[1].hp, s.players[1].maxHp - 8);
    assert.equal(s.players[1].pos, 3);
    assert.equal(s.tiles[4], null);
    assert.equal(s.tiles[6], null);
  });

  it('罠が1つでは起爆できない', () => {
    const s = setup(['trap', 'vanguard']);
    s.tiles[4] = { kind: 'spike', owner: 0, damage: 6 };
    assert.equal(act(s, 0, { type: 'skill', id: 'pandemonium' }).ok, false);
    assert.ok(s.tiles[4]);
  });
});

describe('アサシン', () => {
  it('同じマスで刺して、さらに2マス進む', () => {
    const s = setup(['assassin', 'vanguard']);
    s.players[1].pos = 3;
    act(s, 0, { type: 'roll' }, [3]);
    assert.equal(s.players[0].pos, 5);
    assert.equal(s.players[1].hp, s.players[1].maxHp - 3);
  });

  it('ガードされても歩法の前進は残る', () => {
    const s = setup(['assassin', 'vanguard']);
    s.players[1].pos = 3;
    s.players[1].ironGuard = true;
    act(s, 0, { type: 'roll' }, [3]);
    assert.equal(s.players[0].pos, 5);
    assert.equal(s.players[1].hp, s.players[1].maxHp);
  });

  it('6マス以内の先頭と入れ替わる', () => {
    const s = setup(['assassin', 'vanguard']);
    s.players[0].pos = 2;
    s.players[1].pos = 7;
    const res = act(s, 0, { type: 'skill', id: 'shadow' });
    assert.equal(res.ok, true);
    assert.equal(s.players[0].pos, 7);
    assert.equal(s.players[1].pos, 2);
  });

  it('差が7マスだと入れ替わらない', () => {
    const s = setup(['assassin', 'vanguard']);
    s.players[0].pos = 2;
    s.players[1].pos = 9;
    assert.equal(act(s, 0, { type: 'skill', id: 'shadow' }).ok, false);
    assert.equal(s.players[0].pos, 2);
  });

  it('ガード中の相手とは入れ替わらない', () => {
    const s = setup(['vanguard', 'assassin']);
    act(s, 0, { type: 'skill', id: 'guard' });
    act(s, 0, { type: 'roll' }, [4]);
    const res = act(s, 1, { type: 'skill', id: 'shadow' });
    assert.equal(res.ok, false);
    assert.equal(s.players[0].pos, 4);
    assert.equal(s.players[1].pos, 0);
  });

  it('半分以下を処刑で倒すと全CTが戻る', () => {
    const s = setup(['assassin', 'vanguard']);
    s.players[0].pos = 2;
    s.players[1].pos = 4;
    s.players[1].hp = 5;
    s.players[0].ct.poison = 2;
    s.players[0].ct.shadow = 4;
    const res = act(s, 0, { type: 'skill', id: 'execute', target: 1 });
    assert.equal(res.ok, true);
    assert.equal(s.players[1].hp, 0);
    assert.equal(s.players[1].downed, true);
    assert.equal(s.players[0].ct.poison, 0);
    assert.equal(s.players[0].ct.shadow, 0);
    assert.equal(s.players[0].ct.execute, 0);
  });

  it('処刑は前後3マスを超えると届かない', () => {
    const s = setup(['assassin', 'vanguard']);
    s.players[0].pos = 0;
    s.players[1].pos = 5;
    s.players[1].hp = 4;
    assert.match(skillLockReason(s, 0, 'execute'), /3マス/);
    assert.equal(act(s, 0, { type: 'skill', id: 'execute', target: 1 }).ok, false);
    assert.equal(s.players[1].hp, 4);
  });

  it('毒刃はダメージと次の出目-2', () => {
    const s = setup(['assassin', 'vanguard']);
    s.players[0].pos = 0;
    s.players[1].pos = 3;
    act(s, 0, { type: 'skill', id: 'poison', target: 1 });
    assert.equal(s.players[1].hp, s.players[1].maxHp - 3);
    assert.equal(s.players[1].diceModNext, -2);
    act(s, 0, { type: 'roll' }, [2]);
    act(s, 1, { type: 'roll' }, [3]);
    assert.equal(s.players[1].pos, 4);
    assert.equal(s.players[1].diceModNext, 0);
  });

  it('毒刃は前後4マスを超えると届かない', () => {
    const s = setup(['assassin', 'vanguard']);
    s.players[0].pos = 0;
    s.players[1].pos = 5;
    assert.match(skillLockReason(s, 0, 'poison'), /届く範囲/);
    assert.equal(act(s, 0, { type: 'skill', id: 'poison', target: 1 }).ok, false);
    assert.equal(s.players[1].hp, s.players[1].maxHp);
  });
});

describe('ギャンブラー', () => {
  it('0で回復し、通常スキルのCTが縮む', () => {
    const s = setup(['gambler', 'vanguard']);
    s.players[0].hp = 4;
    s.players[0].ct.loaded = 2;
    s.players[0].ct.roulette = 1;
    act(s, 0, { type: 'roll' }, [0]);
    assert.equal(s.players[0].pos, 0);
    assert.equal(s.players[0].hp, 6);
    assert.equal(s.players[0].ct.loaded, 1);
    assert.equal(s.players[0].ct.roulette, 0);
    assert.equal(s.players[0].stats.zeros, 1);
  });

  it('イカサマは4か8だけ', () => {
    const seen = new Set();
    for (let seed = 1; seed < 40 && seen.size < 2; seed++) {
      const s = setup(['gambler', 'vanguard'], seed);
      act(s, 0, { type: 'skill', id: 'loaded' });
      const res = act(s, 0, { type: 'roll' });
      const dice = res.events.find((e) => e.t === 'dice');
      assert.equal(dice.faces.length, 1);
      assert.ok(dice.faces[0].natural === 4 || dice.faces[0].natural === 8);
      seen.add(dice.faces[0].natural);
    }
    assert.equal(seen.size, 2);
  });

  it('オールインで0が出たら進まずダウン', () => {
    const s = setup(['gambler', 'vanguard']);
    s.players[1].pos = 12;
    const pos = s.players[0].pos;
    const res = act(s, 0, { type: 'skill', id: 'allin' }, [0, 4, 5]);
    assert.equal(res.ok, true);
    assert.equal(s.players[0].pos, pos);
    assert.equal(s.players[0].hp, 0);
    assert.equal(s.players[0].downed, true);
    assert.notEqual(s.turn, 0);
  });

  it('オールイン成功は3つの合計だけ進む', () => {
    const s = setup(['gambler', 'vanguard']);
    act(s, 0, { type: 'skill', id: 'allin' }, [2, 3, 4]);
    assert.equal(s.players[0].pos, 9);
    assert.equal(s.players[0].hp, s.players[0].maxHp);
    assert.notEqual(s.turn, 0);
  });

  it('ゼロ保険は0を1回だけ1にする', () => {
    const s = setup(['gambler', 'vanguard']);
    s.players[0].zeroInsure = 1;
    act(s, 0, { type: 'skill', id: 'allin' }, [0, 2, 2]);
    assert.equal(s.players[0].pos, 5);
    assert.equal(s.players[0].zeroInsure, 0);
    assert.equal(s.players[0].downed, false);
  });

  it('ルーレットの余波で自分がダウンしたら、その番は終わる', () => {
    const s = setup(['gambler', 'assassin']);
    // 呪印は1回で壊れるので、歩法の刺しは1回分。HP3ならそこでダウン。
    s.players[0].hp = 3;
    s.players[1].pos = 0;
    s.tiles[2] = { kind: 'curse', owner: 1, back: 3 };
    const res = act(s, 0, { type: 'skill', id: 'roulette' }, [1, 1]);
    assert.equal(res.ok, true);
    assert.equal(s.players[0].hp, 0);
    assert.equal(s.players[0].downed, true);
    assert.equal(s.tiles[2], null);
    assert.notEqual(s.turn, 0);
  });

  it('ルーレットの強制移動はガードで止まる', () => {
    const s = setup(['gambler', 'vanguard']);
    s.players[1].ironGuard = true;
    s.players[1].pos = 6;
    const res = act(s, 0, { type: 'skill', id: 'roulette' }, [1, 0]);
    assert.equal(res.ok, true);
    assert.equal(s.players[1].pos, 6);
    assert.equal(s.turn, 0);
    assert.ok(res.events.some((e) => e.t === 'block'));
  });
});

describe('ラウンド', () => {
  it('ログは古い順で、ラウンドごとに区切りがある', () => {
    const s = setup(['vanguard', 'trap']);
    assert.equal(s.log[0].kind, 'divider');
    assert.match(s.log[0].text, /ラウンド 1/);
    assert.ok(s.log[0].seq < s.log[s.log.length - 1].seq);
    act(s, 0, { type: 'roll' }, [1]);
    s.players[0].pos = 10;
    s.players[1].pos = 4;
    act(s, 1, { type: 'roll' }, [0]);
    assert.equal(s.round, 2);
    const dividers = s.log.filter((l) => l.kind === 'divider');
    assert.equal(dividers.length, 2);
    assert.match(dividers[1].text, /ラウンド 2/);
    const i1 = s.log.findIndex((l) => l.kind === 'divider' && /ラウンド 1/.test(l.text));
    const i2 = s.log.findIndex((l) => l.kind === 'divider' && /ラウンド 2/.test(l.text));
    assert.ok(i1 < i2);
  });

  it('2ラウンド目、最下位だけダイス+1。1位はドラフトしない', () => {
    const s = setup(['vanguard', 'gambler']);
    act(s, 0, { type: 'roll' }, [1]);
    s.players[0].pos = 20;
    s.players[1].pos = 5;
    act(s, 1, { type: 'roll' }, [0]);
    assert.equal(s.round, 2);
    assert.equal(s.phase, 'draft');
    assert.equal(s.players[0].extraDice, 0);
    assert.equal(s.players[1].extraDice, 1);
    assert.equal(s.drafts.offers[0], undefined);
    assert.equal(s.drafts.offers[1].length, 3);
    assert.deepEqual(s.turnOrder, [1, 0]);
    assert.equal(s.turn, 1);
    const pick = s.drafts.offers[1][0];
    act(s, 1, { type: 'draft', upgradeId: pick });
    assert.equal(s.phase, 'act');
    assert.equal(s.turn, 1);
    assert.equal(s.drafts, null);
  });

  it('全員同着なら全員ダイス+1で、ドラフトはなし', () => {
    const s = setup(['vanguard', 'gambler']);
    act(s, 0, { type: 'roll' }, [1]);
    s.players[0].pos = 8;
    s.players[1].pos = 8;
    act(s, 1, { type: 'roll' }, [0]);
    assert.equal(s.round, 2);
    assert.equal(s.phase, 'act');
    assert.equal(s.players[0].extraDice, 1);
    assert.equal(s.players[1].extraDice, 1);
    assert.equal(s.drafts, null);
    assert.deepEqual(s.turnOrder, [1, 0]);
    assert.equal(s.turn, 1);
  });

  it('ラウンド開始の手番は後ろの人から前の人へ', () => {
    const s = setupNatural(['vanguard', 'trap', 'assassin']);
    assert.deepEqual(s.turnOrder, [2, 1, 0]);
    assert.equal(s.turn, 2);
    s.players[0].pos = 30;
    s.players[1].pos = 10;
    s.players[2].pos = 20;
    s.turnOrder = [0, 1, 2];
    s.turnIndex = 2;
    s.turn = 2;
    act(s, 2, { type: 'roll' }, [0]);
    assert.equal(s.round, 2);
    assert.deepEqual(s.turnOrder, [1, 2, 0]);
    assert.equal(s.turn, 1);
  });

  it('ラウンド中に追い抜いても手番順は開始時点のまま', () => {
    const s = setup(['vanguard', 'trap', 'assassin']);
    s.players[0].pos = 5;
    s.players[1].pos = 10;
    s.players[2].pos = 15;
    s.turnOrder = [0, 1, 2];
    s.turnIndex = 0;
    s.turn = 0;
    s.actedThisRound = true;
    act(s, 0, { type: 'roll' }, [6]);
    // 席0が進んでも、ラウンド中の次手番は開始順どおり席1
    assert.equal(s.round, 1);
    assert.deepEqual(s.turnOrder, [0, 1, 2]);
    assert.equal(s.turn, 1);
  });

  it('同着の順位と、開始時の後ろ扱い（席番号大が先）', () => {
    const s = setupNatural(['vanguard', 'trap', 'assassin']);
    s.players[0].pos = 10;
    s.players[1].pos = 10;
    s.players[2].pos = 4;
    assert.equal(rankOf(s, 0), 1);
    assert.equal(rankOf(s, 1), 1);
    assert.equal(rankOf(s, 2), 2);
    assert.deepEqual(orderByLastFirst(s), [2, 1, 0]);
  });

  it('全員休みの一周ではラウンドが進まずドラフトが二重にならない', () => {
    const s = setup(['vanguard', 'trap']);
    act(s, 0, { type: 'roll' }, [1]);
    s.players[0].pos = 12;
    s.players[1].pos = 5;
    act(s, 1, { type: 'roll' }, [0]);
    assert.equal(s.round, 2);
    assert.equal(s.phase, 'draft');
    // ドラフト直後の手番で両方ダウンしている状況を作る
    s.players[0].downed = true;
    s.players[0].hp = 0;
    s.players[1].downed = true;
    s.players[1].hp = 0;
    const draftRound = s.round;
    for (const seat of Object.keys(s.drafts.offers).map(Number)) {
      act(s, seat, { type: 'draft', upgradeId: s.drafts.offers[seat][0] });
    }
    assert.equal(s.round, draftRound);
    assert.equal(s.phase, 'act');
    assert.equal(s.drafts, null);
    assert.ok(s.players[s.turn].hp > 0);
    assert.equal(s.players[s.turn].justRevived, false);
  });

  it('休みの次の自分の番で復帰し、ヴァンガードは出目+3', () => {
    const s = setup(['vanguard', 'trap']);
    act(s, 0, { type: 'roll' }, [1]);
    s.players[0].pos = 3;
    s.players[1].pos = 10;
    s.players[0].downed = true;
    s.players[0].hp = 0;
    act(s, 1, { type: 'roll' }, [0]);
    assert.equal(s.phase, 'draft');
    assert.equal(s.turn, 0);
    act(s, 0, { type: 'draft', upgradeId: s.drafts.offers[0][0] });
    // 席0の番で休み処理 → justRevived のまま席1へ
    assert.equal(s.players[0].justRevived, true);
    assert.equal(s.players[0].hp, 0);
    assert.equal(s.turn, 1);
    s.players[0].pos = 3;
    s.players[1].pos = 10;
    act(s, 1, { type: 'roll' }, [0, 0]);
    if (s.phase === 'draft') {
      const seat = Number(Object.keys(s.drafts.offers)[0]);
      act(s, seat, { type: 'draft', upgradeId: s.drafts.offers[seat][0] });
    }
    assert.equal(s.turn, 0);
    assert.equal(s.players[0].hp, s.players[0].maxHp);
    assert.equal(s.players[0].diceModNext, 3);
    assert.equal(s.players[0].justRevived, false);
  });
});

describe('同期とCPU', () => {
  it('配信状態にテスト用の出目キューは残さない', () => {
    const s = setup(['vanguard', 'trap']);
    s.forcedRolls = [6];
    const raw = serializeState(s);
    assert.equal(raw.forcedRolls, undefined);
  });

  it('CPUは自分の番にロールかスキルを返す', () => {
    const s = setup(['vanguard', 'trap']);
    s.players[0].isCPU = true;
    const action = chooseCpuAction(s, 0, 'normal', new Set());
    assert.ok(action);
    assert.ok(action.type === 'roll' || action.type === 'skill');
  });

  it('オンラインの手番はpeerIdで見る', () => {
    const host = { id: 1, peerId: 'hadou-host', isCPU: false };
    assert.equal(isMyTurnSeat({
      mode: 'guest',
      phase: 'act',
      currentPlayer: host,
      localSeat: 0,
      localPeerId: 'guest-peer',
    }), false);
    assert.equal(isMyTurnSeat({
      mode: 'host',
      phase: 'act',
      currentPlayer: host,
      localSeat: 1,
      localPeerId: 'hadou-host',
    }), true);
  });
});

describe('罠のマーク', () => {
  it('仕掛けた罠は隠さない限り説明できる', () => {
    const s = setup(['trap', 'vanguard']);
    s.players[0].pos = 5;
    act(s, 0, { type: 'skill', id: 'spike', tile: 3 });
    assert.equal(s.tiles[3].hidden, false);
    assert.match(describeTile(s, 3), /スパイク/);
    s.tiles[3].hidden = true;
    assert.match(describeTile(s, 3), /しかけてありそう|仕掛けてありそう/);
  });
});

describe('マグネットとランナー', () => {
  it('職は6つある', () => {
    assert.equal(JOB_LIST.length, 6);
    assert.ok(JOB_LIST.some((j) => j.id === 'magnet'));
    assert.ok(JOB_LIST.some((j) => j.id === 'runner'));
  });

  it('引き寄せは前方の相手を自分側へ寄せる', () => {
    const s = setup(['magnet', 'vanguard']);
    s.players[1].pos = 6;
    const res = act(s, 0, { type: 'skill', id: 'pull', target: 1 });
    assert.equal(res.ok, true);
    assert.equal(s.players[1].pos, 3);
  });

  it('加速床を踏むとさらに進んで床が消える', () => {
    const s = setup(['runner', 'vanguard']);
    act(s, 0, { type: 'skill', id: 'boost', tile: 2 });
    assert.equal(s.tiles[2].kind, 'boost');
    assert.equal(s.tiles[2].hidden, false);
    assert.match(describeTile(s, 2), /加速床/);
    act(s, 0, { type: 'roll' }, [2]);
    assert.equal(s.players[0].pos, 5);
    assert.equal(s.tiles[2], null);
  });

  it('磁力帯はターン開始に近い相手を削る', () => {
    const s = setup(['magnet', 'vanguard']);
    s.players[0].pos = 5;
    s.players[1].pos = 6;
    s.turn = 1;
    act(s, 1, { type: 'roll' }, [0]);
    if (s.phase === 'draft') {
      const seat = Number(Object.keys(s.drafts.offers)[0]);
      act(s, seat, { type: 'draft', upgradeId: s.drafts.offers[seat][0] });
    }
    assert.equal(s.turn, 0);
    assert.equal(s.players[1].hp, s.players[1].maxHp - 1);
  });
});

describe('強化プール', () => {
  it('強化の種類はおよそ3倍ある', () => {
    assert.ok(UPGRADES.length >= 50, `got ${UPGRADES.length}`);
  });

  it('重複上限に達した強化は候補に出ない', () => {
    const s = setup(['vanguard', 'trap']);
    const p = s.players[0];
    p.perks.dice_plus = 2;
    p.dicePlus = 2;
    p.perks.punch = 2;
    p.dmgPlus = 2;
    p.perks.thick_skin = 2;
    p.armor = 2;
    p.perks.ct_cut = 1;
    p.ctCut = 1;
    p.hp = p.maxHp;
    const pool = upgradePool(p).map((u) => u.id);
    assert.equal(pool.includes('dice_plus'), false);
    assert.equal(pool.includes('punch'), false);
    assert.equal(pool.includes('thick_skin'), false);
    assert.equal(pool.includes('ct_cut'), false);
    assert.equal(pool.includes('candy'), false);
    assert.equal(isUpgradeAvailable(p, upgradeById('dash_plus')), true);
  });

  it('厚皮はダメージを減らし、じわ回復はターン開始に効く', () => {
    const s2 = setup(['vanguard', 'trap']);
    s2.players[0].pos = 0;
    s2.players[1].pos = 2;
    s2.players[1].armor = 1;
    s2.players[1].hp = 10;
    act(s2, 0, { type: 'skill', id: 'dash' }, []);
    assert.equal(s2.players[1].hp, 10 - 2);

    const s3 = setup(['vanguard', 'trap']);
    s3.players[0].regen = 1;
    s3.players[0].hp = 8;
    s3.players[0].pos = 1;
    s3.players[1].pos = 5;
    act(s3, 0, { type: 'roll' }, [1]);
    act(s3, 1, { type: 'roll' }, [0]);
    if (s3.phase === 'draft') {
      for (const seat of Object.keys(s3.drafts.offers).map(Number)) {
        if (!s3.drafts.picks[seat]) act(s3, seat, { type: 'draft', upgradeId: s3.drafts.offers[seat][0] });
      }
    }
    assert.equal(s3.turn, 0);
    assert.equal(s3.players[0].hp, Math.min(s3.players[0].maxHp, 8 + 1));
  });
});
