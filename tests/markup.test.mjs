import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
const net = readFileSync(new URL('../js/net.js', import.meta.url), 'utf8');
const audio = readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');

describe('画面の骨', () => {
  it('タイトル・部屋・盤・音量・催促がある', () => {
    for (const id of [
      'screen-title',
      'btn-host',
      'btn-join',
      'btn-local',
      'btn-jobs',
      'screen-jobs',
      'jobs-catalog',
      'screen-lobby',
      'screen-game',
      'board',
      'btn-roll',
      'btn-draft-open',
      'btn-nudge',
      'vol-master',
      'event-flash',
      'winner',
    ]) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
  });

  it('PeerJSの部屋IDは hadou- で、バージョン不一致を弾く前提のネットがある', () => {
    assert.match(net, /hadou-\$\{code\}/);
    assert.match(net, /peerjs@1\.5\.4/);
    assert.match(net, /sendToHost/);
    assert.match(net, /broadcast/);
  });

  it('手番と催促のSEがある', () => {
    assert.match(audio, /yourTurn\(/);
    assert.match(audio, /nudge\(/);
    assert.match(audio, /hadou-sugoroku-vol/);
  });

  it('ポップな紙の色を使って、紫グラデの定型にしない', () => {
    assert.match(css, /#fff8ea|#f6e2b8|#ff4d6d/);
    assert.doesNotMatch(css, /linear-gradient\([^)]*#7c3aed/i);
    assert.match(css, /Yusei Magic/);
  });

  it('終了画面は結果PNGとタイトルへがある', () => {
    assert.match(html, /id="btn-export"/);
    assert.match(html, /結果をPNG/);
    assert.doesNotMatch(html, /結果JSON/);
    assert.match(html, /id="btn-again"/);
    assert.match(html, /タイトルへ/);
  });

  it('ブランドは覇道で、キャッチはぶち抜けまで', () => {
    assert.match(html, /覇道すごろく/);
    assert.match(html, /職を握って、100マスをぶち抜け。/);
    assert.doesNotMatch(html, /波動/);
    assert.doesNotMatch(html, /お金はない/);
    assert.doesNotMatch(html, /うっとうしいスキル/);
  });

  it('対局ログはおよそ10行分の高さを確保する', () => {
    assert.match(css, /#log\s*\{[^}]*max-height:\s*11rem/s);
    assert.doesNotMatch(css, /#log\s*\{[^}]*max-height:\s*4\.2rem/s);
  });

  it('ログのラウンド区切りスタイルがある', () => {
    assert.match(css, /#log \.divider/);
  });
  it('hidden 属性は display:flex より優先して消える', () => {
    assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
    assert.match(html, /id="lobby-room-wrap"/);
  });

  it('ダイス演出に個数・出目・合計の枠がある', () => {
    assert.match(html, /id="dice-kicker"/);
    assert.match(html, /id="dice-faces"/);
    assert.match(html, /id="dice-math"/);
    assert.match(html, /id="dice-label"/);
    assert.match(css, /\.die\b/);
    assert.match(css, /\.dice-math/);
  });

});
