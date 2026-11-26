/** 覇道すごろく — 職定義。数値の正はここ。エンジンとUIが両方読む。 */

export const PLAYER_COLORS = ['#ff4d6d', '#1aa58a', '#f4a261', '#3d5a80'];

export const JOBS = {
  vanguard: {
    id: 'vanguard',
    name: 'ヴァンガード',
    mark: '盾',
    dice: [1, 6],
    hp: 12,
    blurb: '正面から折る。硬くて、抜けがいい。',
    passive: {
      id: 'spirit',
      name: '不屈の精神',
      desc: '1ターン休みから復帰したターンの出目に+3。',
      bonus: 3,
    },
    skills: [
      {
        id: 'dash',
        kind: 'active',
        name: 'ダッシュアタック',
        ct: 2,
        steps: 3,
        damage: 3,
        desc: 'すぐに3マス進む。追い越した相手に3ダメージ。その後、通常のダイスも振る。',
      },
      {
        id: 'guard',
        kind: 'active',
        name: 'アイアンガード',
        ct: 3,
        desc: '次の自分のターン開始まで、ダメージと強制移動を無効。',
      },
      {
        id: 'charge',
        kind: 'ult',
        name: '戦場の突撃',
        ct: 5,
        dice: 2,
        behind: 6,
        desc: '6マス以上後ろに誰かいるとき。基礎ダイス2個の合計だけ進み、通ったマイナスマスを壊す。この振った目が移動になり、ターンが終わる。',
      },
    ],
  },
  trap: {
    id: 'trap',
    name: 'トラップマスター',
    mark: '罠',
    dice: [1, 6],
    hp: 10,
    blurb: '空いてるマスに杭と呪印。自分の罠は踏んでも得する。',
    passive: {
      id: 'insight',
      name: '罠師の知見',
      desc: '自分の罠は踏んでも発動しない。通過するたびHP+1。',
      heal: 1,
    },
    skills: [
      {
        id: 'spike',
        kind: 'active',
        name: 'スパイク設置',
        ct: 2,
        range: 3,
        damage: 3,
        desc: '後ろ3マス以内の空マスに、踏むと3ダメージで強制停止する罠。起動したら壊れる。',
      },
      {
        id: 'curse',
        kind: 'active',
        name: '逆走の呪印',
        ct: 3,
        range: 5,
        back: 2,
        desc: '前5マス以内の1マスに、踏むと2マス戻される罠。起動したら壊れる。上書きできる。',
      },
      {
        id: 'pandemonium',
        kind: 'ult',
        name: 'パンデモニウム',
        ct: 6,
        need: 2,
        radius: 2,
        damage: 4,
        back: 1,
        desc: '自分の罠が2つ以上あるとき。全部起爆し、各罠の前後2マスの相手に4ダメージ、1マス後退。',
      },
    ],
  },
  assassin: {
    id: 'assassin',
    name: 'アサシン',
    mark: '刃',
    dice: [2, 5],
    hp: 8,
    blurb: '出目は2〜5で読みやすい。隣に立ったら刺して、さらに前へ。',
    passive: {
      id: 'footwork',
      name: '暗殺者の歩法',
      desc: '誰かと同じマスに止まると3ダメージ、さらに2マス進む。',
      damage: 3,
      bonus: 2,
    },
    skills: [
      {
        id: 'poison',
        kind: 'active',
        name: '毒刃の投擲',
        ct: 2,
        range: 4,
        damage: 3,
        desc: '前後4マスの相手1人に3ダメージ。',
      },
      {
        id: 'shadow',
        kind: 'active',
        name: 'シャドウステップ',
        ct: 4,
        range: 6,
        desc: '前方で最も近い相手と位置を入れ替える。差は6マスまで。ガード中は失敗。',
      },
      {
        id: 'execute',
        kind: 'ult',
        name: '処刑執行',
        ct: 5,
        range: 3,
        damage: 6,
        hpRate: 0.5,
        desc: '前後3マス以内で、HPが半分以下の相手に6ダメージ。この技で倒すと、自分の全CTが0に戻る。',
      },
    ],
  },
  gambler: {
    id: 'gambler',
    name: 'ギャンブラー',
    mark: '運',
    dice: [0, 8],
    hp: 10,
    blurb: '0も出る。8も出る。当たれば一番うるさい。',
    passive: {
      id: 'luck',
      name: '強運の持ち主',
      desc: '出目0でHP+2。通常スキルのCTが1つ分短くなる（0の個数ぶん）。',
      heal: 2,
    },
    skills: [
      {
        id: 'loaded',
        kind: 'active',
        name: 'イカサマダイス',
        ct: 3,
        faces: [4, 8],
        desc: 'このターンの通常ダイスを、4か8が半々の特殊ダイスに変える。',
      },
      {
        id: 'roulette',
        kind: 'active',
        name: '道連れルーレット',
        ct: 3,
        steps: 3,
        desc: '全員から1人をランダムに選び、半々で3マス進めるか戻す。ガードは無効化する。',
      },
      {
        id: 'allin',
        kind: 'ult',
        name: 'オールイン',
        ct: 6,
        dice: 3,
        hpRate: 0.3,
        desc: '最下位、またはHP30%以下のとき。ダイス3個の合計だけ進んでターン終了。1個でも0ならその場でダウン。',
      },
    ],
  },
  magnet: {
    id: 'magnet',
    name: 'マグネット',
    mark: '磁',
    dice: [1, 6],
    hp: 11,
    blurb: '距離をねじる。引き寄せて、弾き飛ばす。',
    passive: {
      id: 'aura',
      name: '磁力帯',
      desc: '自分のターン開始時、前後2マス以内の相手に1ダメージ。',
      range: 2,
      damage: 1,
    },
    skills: [
      {
        id: 'pull',
        kind: 'active',
        name: '引き寄せ',
        ct: 2,
        range: 6,
        steps: 3,
        desc: '前後6マス以内の相手1人を、自分のほうへ最大3マス引き寄せる。',
      },
      {
        id: 'push',
        kind: 'active',
        name: '弾き飛ばし',
        ct: 3,
        range: 3,
        steps: 3,
        desc: '前後3マス以内でいちばん近い相手を、自分から離れる向きへ3マス飛ばす。',
      },
      {
        id: 'polarity',
        kind: 'ult',
        name: '極性反転',
        ct: 5,
        near: 5,
        range: 10,
        desc: '前後5マス以内に誰かいるとき。10マス以内でいちばん遠い相手と位置を入れ替える。',
      },
    ],
  },
  runner: {
    id: 'runner',
    name: 'ランナー',
    mark: '走',
    dice: [2, 7],
    hp: 9,
    blurb: '出目は2〜7。加速床を敷いて、自分だけが気持ちよく走る。',
    passive: {
      id: 'stride',
      name: 'ストライド',
      desc: 'ダイスで自然な7が出たら、その移動のあとさらに2マス進む。',
      face: 7,
      bonus: 2,
    },
    skills: [
      {
        id: 'sprint',
        kind: 'active',
        name: 'スプリント',
        ct: 2,
        steps: 4,
        desc: 'すぐに4マス進む。その後、通常のダイスも振る。',
      },
      {
        id: 'boost',
        kind: 'active',
        name: '加速床',
        ct: 3,
        range: 5,
        steps: 3,
        desc: '前方5マス以内の空マスに加速床。踏むと3マスさらに進み、起動したら消える。',
      },
      {
        id: 'overdrive',
        kind: 'ult',
        name: 'オーバーラン',
        ct: 5,
        needRank: 2,
        dice: 2,
        desc: '2位以下のとき。基礎ダイス2個の合計だけ進み、通ったマイナスマスを壊す。ターン終了。',
      },
    ],
  },
};

export const JOB_LIST = [
  JOBS.vanguard,
  JOBS.trap,
  JOBS.assassin,
  JOBS.gambler,
  JOBS.magnet,
  JOBS.runner,
];

export function jobById(id) {
  return JOBS[id] || null;
}

export function skillById(jobId, skillId) {
  const job = JOBS[jobId];
  if (!job) return null;
  return job.skills.find((s) => s.id === skillId) || null;
}

/** 強化で数値が変わっているときだけ 現在値(初期値) にする */
export function markedNum(current, base) {
  const cur = Number(current);
  const bas = Number(base);
  if (!Number.isFinite(cur) || !Number.isFinite(bas) || cur === bas) return String(bas);
  return `${cur}(${bas})`;
}

function perk(player, key) {
  return player?.perks?.[key] || 0;
}

/** スキルに実際かかる CT 上限（短縮込み） */
export function skillCtCap(player, sk) {
  const base = sk?.ct ?? 0;
  if (!player || !sk) return { current: base, base };
  let current = base;
  if (sk.kind === 'active') current = Math.max(1, base - (player.ctCut || 0));
  if (sk.kind === 'ult') current = Math.max(1, base - (player.ultCut || 0));
  return { current, base };
}

/** HUD 用：パッシブ説明（強化反映） */
export function passiveDescFor(player, passive) {
  if (!passive) return '';
  if (!player) return passive.desc;
  const id = passive.id;
  if (id === 'spirit') {
    const base = passive.bonus || 3;
    const cur = base + perk(player, 'spiritPlus');
    return `1ターン休みから復帰したターンの出目に+${markedNum(cur, base)}。`;
  }
  if (id === 'footwork') {
    const dmgBase = passive.damage || 3;
    const bonusBase = passive.bonus || 2;
    const dmg = dmgBase + (player.dmgPlus || 0) + perk(player, 'bladePlus');
    const bonus = bonusBase + perk(player, 'footBonus');
    return `誰かと同じマスに止まると${markedNum(dmg, dmgBase)}ダメージ、さらに${markedNum(bonus, bonusBase)}マス進む。`;
  }
  if (id === 'luck') {
    const base = passive.heal || 2;
    const cur = base + perk(player, 'zeroHeal');
    return `出目0でHP+${markedNum(cur, base)}。通常スキルのCTが1つ分短くなる（0の個数ぶん）。`;
  }
  if (id === 'aura') {
    const rangeBase = passive.range || 2;
    const dmgBase = passive.damage || 1;
    const range = rangeBase + perk(player, 'fieldRange');
    const dmg = dmgBase + perk(player, 'fieldPlus');
    return `自分のターン開始時、前後${markedNum(range, rangeBase)}マス以内の相手に${markedNum(dmg, dmgBase)}ダメージ。`;
  }
  if (id === 'stride') {
    const base = passive.bonus || 2;
    const cur = base + perk(player, 'stridePlus');
    return `ダイスで自然な${passive.face || 7}が出たら、その移動のあとさらに${markedNum(cur, base)}マス進む。`;
  }
  return passive.desc;
}

/** HUD 用：スキル説明（強化反映）。変わった数値だけ 4(3) 形式 */
export function skillDescFor(player, sk) {
  if (!sk) return '';
  if (!player) return sk.desc;
  const dmgPlus = player.dmgPlus || 0;
  switch (sk.id) {
    case 'dash': {
      const stepsBase = sk.steps || 3;
      const dmgBase = sk.damage || 3;
      const steps = perk(player, 'dashSteps') ? 4 : stepsBase;
      const dmg = dmgBase + dmgPlus + perk(player, 'dashPlus');
      return `すぐに${markedNum(steps, stepsBase)}マス進む。追い越した相手に${markedNum(dmg, dmgBase)}ダメージ。その後、通常のダイスも振る。`;
    }
    case 'guard': {
      const heal = perk(player, 'guardHeal');
      return heal > 0
        ? `次の自分のターン開始まで、ダメージと強制移動を無効。発動時にHP+${heal}。`
        : sk.desc;
    }
    case 'spike': {
      const dmgBase = sk.damage || 3;
      const dmg = dmgBase + dmgPlus + perk(player, 'spikePlus');
      return `後ろ${sk.range || 3}マス以内の空マスに、踏むと${markedNum(dmg, dmgBase)}ダメージで強制停止する罠。起動したら壊れる。`;
    }
    case 'curse': {
      const backBase = sk.back || 2;
      const back = backBase + perk(player, 'cursePlus');
      return `前${sk.range || 5}マス以内の1マスに、踏むと${markedNum(back, backBase)}マス戻される罠。起動したら壊れる。上書きできる。`;
    }
    case 'pandemonium': {
      const dmgBase = sk.damage || 4;
      const dmg = dmgBase + dmgPlus + perk(player, 'boomPlus');
      return `自分の罠が2つ以上あるとき。全部起爆し、各罠の前後${sk.radius || 2}マスの相手に${markedNum(dmg, dmgBase)}ダメージ、1マス後退。`;
    }
    case 'poison': {
      const rangeBase = sk.range || 4;
      const dmgBase = sk.damage || 3;
      const penBase = sk.penalty || 0;
      const range = rangeBase + perk(player, 'poisonRange');
      const dmg = dmgBase + dmgPlus + perk(player, 'bladePlus');
      const pen = penBase + perk(player, 'poisonPen');
      let text = `前後${markedNum(range, rangeBase)}マスの相手1人に${markedNum(dmg, dmgBase)}ダメージ。`;
      if (penBase > 0) text += `次の出目合計が-${markedNum(pen, penBase)}。`;
      return text;
    }
    case 'shadow': {
      const rangeBase = sk.range || 6;
      const range = rangeBase + perk(player, 'shadowRange');
      return `前方で最も近い相手と位置を入れ替える。差は${markedNum(range, rangeBase)}マスまで。ガード中は失敗。`;
    }
    case 'execute': {
      const rangeBase = sk.range || 3;
      const dmgBase = sk.damage || 6;
      const dmg = dmgBase + dmgPlus + perk(player, 'bladePlus');
      return `前後${rangeBase}マス以内で、HPが半分以下の相手に${markedNum(dmg, dmgBase)}ダメージ。この技で倒すと、自分の全CTが0に戻る。`;
    }
    case 'roulette': {
      const stepsBase = sk.steps || 3;
      const steps = perk(player, 'rouletteSteps') ? 4 : stepsBase;
      return `全員から1人をランダムに選び、半々で${markedNum(steps, stepsBase)}マス進めるか戻す。ガードは無効化する。`;
    }
    case 'pull': {
      const stepsBase = sk.steps || 3;
      const steps = stepsBase + perk(player, 'pullPlus');
      return `前後${sk.range || 6}マス以内の相手1人を、自分のほうへ最大${markedNum(steps, stepsBase)}マス引き寄せる。`;
    }
    case 'push': {
      const stepsBase = sk.steps || 3;
      const steps = stepsBase + perk(player, 'pushPlus');
      return `前後${sk.range || 3}マス以内でいちばん近い相手を、自分から離れる向きへ${markedNum(steps, stepsBase)}マス飛ばす。`;
    }
    case 'sprint': {
      const stepsBase = sk.steps || 4;
      const steps = perk(player, 'sprintPlus') ? 6 : stepsBase;
      return `すぐに${markedNum(steps, stepsBase)}マス進む。その後、通常のダイスも振る。`;
    }
    case 'boost': {
      const rangeBase = sk.range || 5;
      const stepsBase = sk.steps || 3;
      const range = rangeBase + perk(player, 'boostRange');
      const steps = stepsBase + perk(player, 'boostPlus');
      return `前方${markedNum(range, rangeBase)}マス以内の空マスに加速床。踏むと${markedNum(steps, stepsBase)}マスさらに進み、起動したら消える。`;
    }
    default:
      return sk.desc;
  }
}
