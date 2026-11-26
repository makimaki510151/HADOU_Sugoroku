/** ラウンド開始の強化ドラフト。1位以外に3枚見せて1枚。 */

export const UPGRADES = [
  { id: 'dice_plus', name: '出目のクセ', blurb: 'この先、ダイス1個につき出目+1（2回まで）' },
  { id: 'hp_up', name: '体力の貯金', blurb: '最大HP+2、いまのHPも+2' },
  { id: 'candy', name: '応急キャンディ', blurb: 'HPを4回復' },
  { id: 'shortcut', name: '裏路地', blurb: 'すぐに3マス進む' },
  { id: 'ct_cut', name: '手慣れた技', blurb: '通常スキルのCTを1短縮（永続・最低1）', once: true },
  { id: 'punch', name: 'ひと押し', blurb: '与えるダメージ+1（永続・2回まで）' },
  { id: 'cheer', name: '気合い', blurb: '次に振るダイスの合計+2' },
  { id: 'omamori', name: 'お守り', blurb: '次に受けるダメージを1回無効', once: true },
  { id: 'watchstep', name: '足元注意', blurb: '次に踏む他人の罠を1回無視' },
  { id: 'floor', name: '底上げ', blurb: '次の3個のダイスは、2未満なら2にする' },
  { id: 'guts', name: '根性', blurb: '次の致命傷をHP1で耐える', once: true },
  { id: 'dash_plus', name: '突進のコツ', blurb: 'ダッシュアタックのダメージ+1', job: 'vanguard', once: true },
  { id: 'spike_plus', name: '研いだ杭', blurb: 'これから置くスパイクのダメージ+1', job: 'trap', once: true },
  { id: 'blade_plus', name: '刃の油', blurb: '毒刃・歩法・処刑のダメージ+1', job: 'assassin', once: true },
  { id: 'zero_guard', name: 'ゼロ保険', blurb: '次のオールインの0を1回だけ1として扱う', job: 'gambler', once: true },
  { id: 'field_plus', name: '強い磁場', blurb: '磁力帯のダメージ+1', job: 'magnet', once: true },
  { id: 'sprint_plus', name: '長いストライド', blurb: 'スプリントが6マスになる', job: 'runner', once: true },
];

export function upgradeById(id) {
  return UPGRADES.find((u) => u.id === id) || null;
}

/** その人に今出してよい候補 */
export function upgradePool(player) {
  return UPGRADES.filter((u) => {
    if (u.job && u.job !== player.job) return false;
    if (u.once && player.perks?.[u.id]) return false;
    if (u.id === 'dice_plus' && (player.dicePlus || 0) >= 2) return false;
    if (u.id === 'punch' && (player.dmgPlus || 0) >= 2) return false;
    if (u.id === 'hp_up' && player.maxHp >= player.baseHp + 6) return false;
    if (u.id === 'candy' && player.hp >= player.maxHp) return false;
    if (u.id === 'omamori' && player.oneShotGuard) return false;
    if (u.id === 'guts' && player.koShield) return false;
    if (u.id === 'watchstep' && (player.trapIgnore || 0) >= 2) return false;
    if (u.id === 'floor' && (player.floorRolls || 0) >= 3) return false;
    if (u.id === 'ct_cut' && (player.ctCut || 0) >= 1) return false;
    if (u.id === 'zero_guard' && (player.zeroInsure || 0) >= 1) return false;
    if (u.id === 'field_plus' && (player.perks?.fieldPlus || 0) >= 1) return false;
    if (u.id === 'sprint_plus' && (player.perks?.sprintPlus || 0) >= 1) return false;
    return true;
  });
}
