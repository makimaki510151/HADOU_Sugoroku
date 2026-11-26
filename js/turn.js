/**
 * 手番・自分座席の判定。
 * ローカルは人間の席なら誰でも操作できる（一台回し）。
 * オンラインは peerId が一致した席だけ。
 */

/**
 * @param {{
 *   mode?: string|null,
 *   player?: { id?: number, peerId?: string|null, isCPU?: boolean }|null,
 *   localSeat?: number|null,
 *   localPeerId?: string|null,
 * }} opts
 */
export function isLocalPlayer({
  mode = null,
  player = null,
  localSeat = null,
  localPeerId = null,
} = {}) {
  if (!player || player.isCPU) return false;
  if (mode === 'local') return true;
  if (mode !== 'host' && mode !== 'guest') return false;
  if (player.peerId && localPeerId) return player.peerId === localPeerId;
  if (localSeat == null || localSeat < 0) return false;
  return player.id === localSeat;
}

/**
 * @param {{
 *   mode?: string|null,
 *   phase?: string|null,
 *   currentPlayer?: { id?: number, peerId?: string|null, isCPU?: boolean }|null,
 *   localSeat?: number|null,
 *   localPeerId?: string|null,
 * }} opts
 */
export function isMyTurnSeat({
  mode = null,
  phase = null,
  currentPlayer = null,
  localSeat = null,
  localPeerId = null,
} = {}) {
  if (!currentPlayer || phase === 'gameover' || phase === 'draft') return false;
  return isLocalPlayer({
    mode,
    player: currentPlayer,
    localSeat,
    localPeerId,
  });
}
