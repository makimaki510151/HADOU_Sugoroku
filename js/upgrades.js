/** ラウンド開始の強化ドラフト。1位以外に3枚見せて1枚。 */

/**
 * max … 生涯の取得上限（perks[id] で数える）。達したら出ない。
 * hold … ストックが満タンのあいだ出ない（消費後は再出現可）。
 * need … 状況条件。
 * grant … 取得時の効果。
 */
export const UPGRADES = [
  // —— 永続・重ね ——
  { id: 'dice_plus', name: '出目のクセ', blurb: 'この先、出目+1（ダイス1個ごと・永続・重ねて最大+2）', max: 2, grant: { type: 'stat', key: 'dicePlus', by: 1 } },
  { id: 'punch', name: 'ひと押し', blurb: '与えるダメージ+1（永続・重ねて最大+2）', max: 2, grant: { type: 'stat', key: 'dmgPlus', by: 1 } },
  { id: 'thick_skin', name: '厚皮', blurb: '受けるダメージを1減らす（永続・重ねて最大+2）', max: 2, grant: { type: 'stat', key: 'armor', by: 1 } },
  { id: 'trickle', name: 'じわ回復', blurb: '自分のターン開始時にHP+1（永続・1回まで）', max: 1, grant: { type: 'stat', key: 'regen', by: 1 } },
  { id: 'ct_cut', name: '手慣れた技', blurb: '通常スキルのCTを1短縮（永続・最低1）', max: 1, grant: { type: 'stat', key: 'ctCut', by: 1 } },
  { id: 'ult_cut', name: '必殺の呼吸', blurb: '必殺技のCTを1短縮（永続・最低1）', max: 1, grant: { type: 'stat', key: 'ultCut', by: 1 } },
  { id: 'hp_up', name: '体力の貯金', blurb: '最大HP+2、いまのHPも+2（重ねて最大3回）', max: 3, grant: { type: 'hpUp', max: 2, heal: 2 } },
  { id: 'stretch', name: '伸びしろ', blurb: '最大HP+1、いまのHPも+1（重ねて最大4回）', max: 4, grant: { type: 'hpUp', max: 1, heal: 1 } },
  { id: 'iron_ration', name: '鉄の糧食', blurb: '最大HPだけ+2（いまのHPは増えない・重ねて最大2回）', max: 2, grant: { type: 'hpUp', max: 2, heal: 0 } },

  // —— いま使う ——
  { id: 'candy', name: '応急キャンディ', blurb: 'HPを4回復', need: 'hurt', grant: { type: 'heal', amount: 4 } },
  { id: 'bandage', name: '応急テープ', blurb: 'HPを3回復', need: 'hurt', grant: { type: 'heal', amount: 3 } },
  { id: 'sugar', name: 'ひとくち砂糖', blurb: 'HPを2回復', need: 'hurt', grant: { type: 'heal', amount: 2 } },
  { id: 'feast', name: 'どか食い', blurb: 'HPを6回復（HPが半分以下のときだけ出る）', need: 'lowHp', grant: { type: 'heal', amount: 6 } },
  { id: 'panic', name: '起死回生', blurb: 'HPを5回復（HP40%以下のときだけ出る）', need: 'critical', grant: { type: 'heal', amount: 5 } },
  { id: 'shortcut', name: '裏路地', blurb: 'すぐに3マス進む', grant: { type: 'move', steps: 3 } },
  { id: 'hop', name: 'ひと跳び', blurb: 'すぐに2マス進む', grant: { type: 'move', steps: 2 } },
  { id: 'leap', name: '大股', blurb: 'すぐに5マス進む', grant: { type: 'move', steps: 5 } },
  { id: 'mule', name: '荷運び', blurb: 'すぐに4マス進む', grant: { type: 'move', steps: 4 } },
  { id: 'cheer', name: '気合い', blurb: '次に振るダイスの合計+2', grant: { type: 'mod', by: 2 } },
  { id: 'whisper', name: 'ひそひそ', blurb: '次に振るダイスの合計+1', grant: { type: 'mod', by: 1 } },
  { id: 'espresso', name: '強めの一杯', blurb: '次に振るダイスの合計+3', grant: { type: 'mod', by: 3 } },
  { id: 'roar', name: '雄叫び', blurb: '次に振るダイスの合計+4', grant: { type: 'mod', by: 4 } },
  { id: 'calm', name: '深呼吸', blurb: '次の出目へのマイナス補正を打ち消す', need: 'penalty', grant: { type: 'clearPenalty' } },
  { id: 'spare_die', name: '予備ダイス', blurb: 'このラウンド、ダイス+1（振る個数が1増える）', grant: { type: 'stat', key: 'extraDice', by: 1 } },

  // —— ストック（消費後はまた出る） ——
  { id: 'omamori', name: 'お守り', blurb: '次に受けるダメージを1回無効', hold: { key: 'oneShotGuard', max: 1 }, grant: { type: 'flag', key: 'oneShotGuard' } },
  { id: 'guts', name: '根性', blurb: '次の致命傷をHP1で耐える', hold: { key: 'koShield', max: 1 }, grant: { type: 'flag', key: 'koShield' } },
  { id: 'watchstep', name: '足元注意', blurb: '次に踏む他人の罠を1回無視', hold: { key: 'trapIgnore', max: 2 }, grant: { type: 'stock', key: 'trapIgnore', by: 1 } },
  { id: 'clear_eyes', name: 'クリアアイ', blurb: '罠無視を2回分ためる', hold: { key: 'trapIgnore', max: 1 }, grant: { type: 'stock', key: 'trapIgnore', by: 2 } },
  { id: 'floor', name: '底上げ', blurb: '次の3個のダイスは、2未満なら2にする', hold: { key: 'floorRolls', max: 3 }, grant: { type: 'stock', key: 'floorRolls', by: 3 } },
  { id: 'soft_land', name: '安定脚', blurb: '次の5個のダイスは、2未満なら2にする', hold: { key: 'floorRolls', max: 3 }, grant: { type: 'stock', key: 'floorRolls', by: 5 } },

  // —— 職：ヴァンガード ——
  { id: 'dash_plus', name: '突進のコツ', blurb: 'ダッシュアタックのダメージ+1（1回まで）', job: 'vanguard', max: 1, grant: { type: 'perk', key: 'dashPlus', by: 1 } },
  { id: 'dash_long', name: '長い突進', blurb: 'ダッシュアタックが4マスになる（1回まで）', job: 'vanguard', max: 1, grant: { type: 'perk', key: 'dashSteps', by: 1 } },
  { id: 'spirit_plus', name: '不屈の上積み', blurb: '復帰時の出目ボーナスが+2増える（1回まで）', job: 'vanguard', max: 1, grant: { type: 'perk', key: 'spiritPlus', by: 2 } },
  { id: 'guard_heal', name: '守りながら整える', blurb: 'アイアンガード発動時にHP+2（1回まで）', job: 'vanguard', max: 1, grant: { type: 'perk', key: 'guardHeal', by: 2 } },

  // —— 職：トラップ ——
  { id: 'spike_plus', name: '研いだ杭', blurb: 'これから置くスパイクのダメージ+1（1回まで）', job: 'trap', max: 1, grant: { type: 'perk', key: 'spikePlus', by: 1 } },
  { id: 'sticky_trap', name: '粘着の罠', blurb: '次に置く杭か呪印が、起動しても壊れない', job: 'trap', hold: { key: 'stickyTrap', max: 1 }, grant: { type: 'stock', key: 'stickyTrap', by: 1 } },
  { id: 'curse_plus', name: '深い呪印', blurb: 'これから置く呪印の後退が+1（1回まで）', job: 'trap', max: 1, grant: { type: 'perk', key: 'cursePlus', by: 1 } },
  { id: 'boom_plus', name: '起爆の粉', blurb: 'パンデモニウムのダメージ+1（1回まで）', job: 'trap', max: 1, grant: { type: 'perk', key: 'boomPlus', by: 1 } },
  { id: 'trap_kit', name: '予備の粘着', blurb: '粘着の罠をさらに1回分ためる', job: 'trap', hold: { key: 'stickyTrap', max: 2 }, grant: { type: 'stock', key: 'stickyTrap', by: 1 } },

  // —— 職：アサシン ——
  { id: 'blade_plus', name: '刃の油', blurb: '毒刃・歩法・処刑のダメージ+1（重ねて最大2）', job: 'assassin', max: 2, grant: { type: 'perk', key: 'bladePlus', by: 1 } },
  { id: 'poison_far', name: '遠投げ', blurb: '毒刃の射程が前後5マスになる（1回まで）', job: 'assassin', max: 1, grant: { type: 'perk', key: 'poisonRange', by: 1 } },
  { id: 'shadow_long', name: '長い影', blurb: 'シャドウステップの射程+2（1回まで）', job: 'assassin', max: 1, grant: { type: 'perk', key: 'shadowRange', by: 2 } },
  { id: 'foot_plus', name: '歩法のキレ', blurb: '暗殺者の歩法の追加移動が+1（1回まで）', job: 'assassin', max: 1, grant: { type: 'perk', key: 'footBonus', by: 1 } },

  // —— 職：ギャンブラー ——
  { id: 'zero_guard', name: 'ゼロ保険', blurb: '次のオールインの0を1回だけ1として扱う', job: 'gambler', hold: { key: 'zeroInsure', max: 1 }, grant: { type: 'stock', key: 'zeroInsure', by: 1 } },
  { id: 'zero_vault', name: '保険の重ね', blurb: 'ゼロ保険をさらに1回分（最大2）', job: 'gambler', hold: { key: 'zeroInsure', max: 2 }, grant: { type: 'stock', key: 'zeroInsure', by: 1 } },
  { id: 'lucky_zero', name: 'ゼロの恵み', blurb: '出目0のとき回復が+1（1回まで）', job: 'gambler', max: 1, grant: { type: 'perk', key: 'zeroHeal', by: 1 } },
  { id: 'roulette_plus', name: '太めのルーレット', blurb: '道連れルーレットの移動が4マスになる（1回まで）', job: 'gambler', max: 1, grant: { type: 'perk', key: 'rouletteSteps', by: 1 } },

  // —— 職：マグネット ——
  { id: 'field_plus', name: '強い磁場', blurb: '磁力帯のダメージ+1（1回まで）', job: 'magnet', max: 1, grant: { type: 'perk', key: 'fieldPlus', by: 1 } },
  { id: 'pull_plus', name: '強い引き寄せ', blurb: '引き寄せが最大4マスになる（1回まで）', job: 'magnet', max: 1, grant: { type: 'perk', key: 'pullPlus', by: 1 } },
  { id: 'push_plus', name: '強い弾き', blurb: '弾き飛ばしが4マスになる（1回まで）', job: 'magnet', max: 1, grant: { type: 'perk', key: 'pushPlus', by: 1 } },
  { id: 'field_wide', name: '広い磁場', blurb: '磁力帯の範囲が前後3マスになる（1回まで）', job: 'magnet', max: 1, grant: { type: 'perk', key: 'fieldRange', by: 1 } },

  // —— 職：ランナー ——
  { id: 'sprint_plus', name: '長いストライド', blurb: 'スプリントが6マスになる（1回まで）', job: 'runner', max: 1, grant: { type: 'perk', key: 'sprintPlus', by: 1 } },
  { id: 'boost_plus', name: '弾む床', blurb: 'これから置く加速床が+1マス（1回まで）', job: 'runner', max: 1, grant: { type: 'perk', key: 'boostPlus', by: 1 } },
  { id: 'stride_plus', name: 'ストライド強化', blurb: '自然な7の追加移動が+1（1回まで）', job: 'runner', max: 1, grant: { type: 'perk', key: 'stridePlus', by: 1 } },
  { id: 'boost_far', name: '遠い床', blurb: '加速床の設置射程+2（1回まで）', job: 'runner', max: 1, grant: { type: 'perk', key: 'boostRange', by: 2 } },
];

export function upgradeById(id) {
  return UPGRADES.find((u) => u.id === id) || null;
}

function holdValue(player, key) {
  const v = player[key];
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v || 0;
}

/** 重複・ストック上限や状況条件を含め、いま出してよいか */
export function isUpgradeAvailable(player, u) {
  if (!player || !u) return false;
  if (u.job && u.job !== player.job) return false;
  const taken = player.perks?.[u.id] || 0;
  if (u.max != null && taken >= u.max) return false;
  if (u.hold) {
    if (holdValue(player, u.hold.key) >= u.hold.max) return false;
  }
  if (u.need === 'hurt' && player.hp >= player.maxHp) return false;
  if (u.need === 'lowHp' && player.hp > player.maxHp * 0.5) return false;
  if (u.need === 'critical' && player.hp > player.maxHp * 0.4) return false;
  if (u.need === 'penalty' && (player.diceModNext || 0) >= 0) return false;
  return true;
}

/** その人に今出してよい候補 */
export function upgradePool(player) {
  return UPGRADES.filter((u) => isUpgradeAvailable(player, u));
}
