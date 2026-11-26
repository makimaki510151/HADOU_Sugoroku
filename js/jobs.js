/** 波動すごろく — 職定義。数値の正はここ。エンジンとUIが両方読む。 */

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
        damage: 5,
        desc: 'すぐに3マス進む。追い越した相手に5ダメージ。その後、通常のダイスも振る。',
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
      desc: '自分の罠は踏んでも発動しない。通過するたびHP+2。',
      heal: 2,
    },
    skills: [
      {
        id: 'spike',
        kind: 'active',
        name: 'スパイク設置',
        ct: 2,
        range: 3,
        damage: 6,
        desc: '後ろ3マス以内の空マスに、踏むと6ダメージで強制停止する罠。',
      },
      {
        id: 'curse',
        kind: 'active',
        name: '逆走の呪印',
        ct: 3,
        range: 5,
        back: 3,
        desc: '前5マス以内の1マスに、踏むと3マス戻される罠。上書きできる。',
      },
      {
        id: 'pandemonium',
        kind: 'ult',
        name: 'パンデモニウム',
        ct: 6,
        need: 2,
        radius: 2,
        damage: 9,
        back: 1,
        desc: '自分の罠が2つ以上あるとき。全部起爆し、各罠の前後2マスの相手に9ダメージ、1マス後退。',
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
      desc: '誰かと同じマスに止まると6ダメージ、さらに2マス進む。',
      damage: 6,
      bonus: 2,
    },
    skills: [
      {
        id: 'poison',
        kind: 'active',
        name: '毒刃の投擲',
        ct: 2,
        range: 8,
        damage: 6,
        penalty: 2,
        desc: '前後8マスの相手1人に6ダメージ。次の出目合計が-2。',
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
        damage: 14,
        hpRate: 0.5,
        desc: 'HPが半分以下の相手に14ダメージ。この技で倒すと、自分の全CTが0に戻る。',
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
      desc: '出目0でHP+4。通常スキルのCTが1つ分短くなる（0の個数ぶん）。',
      heal: 4,
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
        steps: 4,
        desc: '全員から1人をランダムに選び、半々で4マス進めるか戻す。ガードは無効化する。',
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
};

export const JOB_LIST = [JOBS.vanguard, JOBS.trap, JOBS.assassin, JOBS.gambler];

export function jobById(id) {
  return JOBS[id] || null;
}

export function skillById(jobId, skillId) {
  const job = JOBS[jobId];
  if (!job) return null;
  return job.skills.find((s) => s.id === skillId) || null;
}
