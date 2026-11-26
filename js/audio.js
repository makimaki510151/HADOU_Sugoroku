/** 波動すごろく — Web Audio の SE / BGM。サンプル素材は使わない。 */

const STORAGE_KEY = 'hadou-sugoroku-vol';

function loadVol() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      master: clamp01(v.master ?? 0.75),
      bgm: clamp01(v.bgm ?? 0.32),
      se: clamp01(v.se ?? 0.85),
      muted: !!v.muted,
    };
  } catch {
    return { master: 0.75, bgm: 0.32, se: 0.85, muted: false };
  }
}

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0));
}

export function createAudio() {
  let ctx = null;
  let masterGain = null;
  let bgmGain = null;
  let seGain = null;
  let bgmTimer = null;
  let bgmStep = 0;
  /** @type {'normal' | 'urgency'} */
  let bgmMode = 'normal';
  const vol = loadVol();

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    bgmGain = ctx.createGain();
    seGain = ctx.createGain();
    bgmGain.connect(masterGain);
    seGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    applyVol();
    return ctx;
  }

  function applyVol() {
    if (!masterGain) return;
    masterGain.gain.value = vol.muted ? 0 : vol.master;
    bgmGain.gain.value = vol.bgm;
    seGain.gain.value = vol.se;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vol));
    } catch { /* ignore */ }
  }

  function resume() {
    const c = ensure();
    if (c?.state === 'suspended') c.resume();
  }

  function tone(freq, dur, type = 'sine', gain = 0.12, when = 0, dest = null) {
    const c = ensure();
    if (!c || !freq) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || seGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur = 0.08, gain = 0.08, freq = 1800) {
    const c = ensure();
    if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    src.buffer = buf;
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(seGain);
    src.start();
  }

  const SFX = {
    click() {
      tone(720, 0.05, 'triangle', 0.06);
      tone(540, 0.04, 'square', 0.03, 0.03);
    },
    cancel() { tone(240, 0.08, 'triangle', 0.05); },
    dice() {
      noiseBurst(0.05, 0.1, 1400);
      tone(380, 0.05, 'square', 0.045, 0.02);
      tone(510, 0.05, 'square', 0.04, 0.08);
      tone(690, 0.09, 'square', 0.05, 0.14);
    },
    diceLand(face) {
      const f = 280 + (Number(face) || 1) * 36;
      tone(f, 0.12, 'triangle', 0.1);
      tone(f * 1.5, 0.18, 'sine', 0.06, 0.05);
    },
    step(back = false) {
      tone(back ? 160 : 230, 0.045, 'triangle', 0.05);
      noiseBurst(0.025, 0.035, back ? 600 : 900);
    },
    yourTurn() {
      noiseBurst(0.04, 0.06, 1600);
      tone(392, 0.08, 'square', 0.07);
      tone(523, 0.1, 'square', 0.08, 0.08);
      tone(659, 0.12, 'triangle', 0.1, 0.16);
      tone(784, 0.22, 'sine', 0.11, 0.26);
      tone(1046, 0.18, 'sine', 0.06, 0.4);
    },
    nudge() {
      noiseBurst(0.03, 0.07, 2000);
      tone(880, 0.06, 'square', 0.09);
      tone(880, 0.06, 'square', 0.08, 0.1);
      tone(1174, 0.1, 'triangle', 0.1, 0.2);
      tone(880, 0.14, 'sine', 0.06, 0.32);
    },
    damage() {
      noiseBurst(0.06, 0.08, 400);
      tone(196, 0.12, 'sawtooth', 0.06);
      tone(140, 0.16, 'square', 0.05, 0.06);
    },
    heal() {
      tone(523, 0.08, 'sine', 0.06);
      tone(659, 0.1, 'triangle', 0.07, 0.06);
      tone(784, 0.14, 'sine', 0.06, 0.12);
    },
    zero() {
      tone(196, 0.1, 'triangle', 0.07);
      tone(392, 0.12, 'sine', 0.06, 0.08);
      tone(784, 0.16, 'triangle', 0.07, 0.16);
      noiseBurst(0.04, 0.04, 2400);
    },
    trapSet() {
      noiseBurst(0.04, 0.06, 700);
      tone(160, 0.08, 'square', 0.06);
      tone(120, 0.12, 'triangle', 0.05, 0.06);
    },
    spring() {
      noiseBurst(0.08, 0.1, 500);
      tone(440, 0.06, 'square', 0.07);
      tone(180, 0.16, 'sawtooth', 0.06, 0.05);
    },
    curse() {
      tone(520, 0.1, 'sawtooth', 0.05);
      tone(390, 0.12, 'triangle', 0.05, 0.08);
      tone(260, 0.16, 'sine', 0.05, 0.16);
    },
    ko() {
      noiseBurst(0.1, 0.1, 300);
      tone(220, 0.16, 'sawtooth', 0.07);
      tone(146, 0.28, 'triangle', 0.07, 0.1);
      tone(98, 0.36, 'sine', 0.06, 0.22);
    },
    revive() {
      tone(262, 0.1, 'triangle', 0.07);
      tone(330, 0.1, 'triangle', 0.07, 0.08);
      tone(392, 0.12, 'sine', 0.08, 0.16);
      tone(523, 0.2, 'sine', 0.07, 0.26);
    },
    skill() {
      tone(494, 0.07, 'square', 0.06);
      tone(659, 0.1, 'triangle', 0.07, 0.06);
    },
    ult() {
      noiseBurst(0.1, 0.1, 900);
      [196, 262, 330, 392, 523, 659].forEach((f, i) => {
        tone(f, 0.2, i < 2 ? 'square' : 'triangle', 0.08, i * 0.07);
      });
      tone(784, 0.28, 'sine', 0.07, 0.46);
    },
    guard() {
      tone(180, 0.08, 'square', 0.06);
      tone(240, 0.14, 'triangle', 0.06, 0.05);
      noiseBurst(0.05, 0.04, 1200);
    },
    block() {
      tone(660, 0.05, 'square', 0.05);
      tone(880, 0.08, 'triangle', 0.04, 0.04);
    },
    roulette() {
      tone(520, 0.06, 'square', 0.05);
      tone(620, 0.06, 'square', 0.045, 0.07);
      tone(740, 0.08, 'triangle', 0.05, 0.14);
      noiseBurst(0.04, 0.04, 1800);
    },
    smash() {
      noiseBurst(0.08, 0.1, 800);
      tone(140, 0.12, 'sawtooth', 0.07);
      tone(420, 0.1, 'square', 0.05, 0.06);
    },
    draft() {
      tone(440, 0.07, 'triangle', 0.06);
      tone(554, 0.09, 'triangle', 0.06, 0.07);
      tone(659, 0.12, 'sine', 0.07, 0.14);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.11));
      tone(1318, 0.4, 'sine', 0.08, 0.5);
      noiseBurst(0.12, 0.08, 2000);
    },
    urgencyAlert() {
      tone(587, 0.1, 'square', 0.08);
      tone(466, 0.12, 'square', 0.07, 0.1);
      tone(349, 0.16, 'sawtooth', 0.06, 0.2);
    },
  };

  /** 夜店っぽい、少しハズした明るいループ */
  const BGM_NOTES = [
    392, 440, 494, 523, 494, 440, 392, 349,
    330, 349, 392, 440, 523, 440, 392, 330,
    349, 392, 440, 523, 587, 523, 494, 440,
    392, 0, 349, 330, 294, 330, 349, 392,
    440, 494, 523, 587, 659, 587, 523, 494,
    440, 392, 349, 330, 349, 392, 440, 0,
    523, 0, 494, 0, 440, 392, 349, 330,
    294, 330, 349, 392, 440, 392, 349, 0,
  ];
  const BGM_URGENCY_NOTES = [
    466, 440, 415, 392, 415, 440, 466, 0,
    523, 494, 466, 440, 466, 494, 523, 554,
    587, 554, 523, 494, 466, 440, 415, 392,
    415, 440, 466, 494, 523, 554, 587, 0,
    622, 587, 554, 523, 494, 466, 440, 415,
    466, 0, 494, 0, 523, 554, 587, 622,
    587, 554, 523, 494, 466, 440, 415, 392,
    440, 466, 494, 523, 554, 0, 466, 0,
  ];
  const BGM_STEP_MS = 280;
  const BGM_URGENCY_STEP_MS = 168;

  function tickBgm() {
    if (!ctx || vol.muted) return;
    const urgent = bgmMode === 'urgency';
    const notes = urgent ? BGM_URGENCY_NOTES : BGM_NOTES;
    const note = notes[bgmStep % notes.length];
    bgmStep += 1;
    if (!note) return;
    if (urgent) {
      const pulse = 0.04 + (bgmStep % 4 === 0 ? 0.02 : 0);
      tone(note, 0.16, 'square', pulse * 0.5, 0, bgmGain);
      tone(note / 2, 0.2, 'triangle', pulse * 0.35, 0, bgmGain);
      return;
    }
    const soft = 0.034 + (bgmStep % 8 === 0 ? 0.01 : 0);
    tone(note, 0.24, 'triangle', soft, 0, bgmGain);
    tone(note / 2, 0.3, 'sine', soft * 0.45, 0, bgmGain);
  }

  function restartBgmTimer() {
    if (bgmTimer) clearInterval(bgmTimer);
    bgmTimer = null;
    const ms = bgmMode === 'urgency' ? BGM_URGENCY_STEP_MS : BGM_STEP_MS;
    tickBgm();
    bgmTimer = setInterval(tickBgm, ms);
  }

  function startBgm() {
    resume();
    if (bgmTimer) return;
    bgmStep = 0;
    restartBgmTimer();
  }

  function stopBgm() {
    if (bgmTimer) clearInterval(bgmTimer);
    bgmTimer = null;
  }

  /** @param {'normal' | 'urgency'} mode */
  function setBgmMode(mode) {
    const next = mode === 'urgency' ? 'urgency' : 'normal';
    if (next === bgmMode) return bgmMode;
    const prev = bgmMode;
    bgmMode = next;
    bgmStep = 0;
    if (bgmTimer) restartBgmTimer();
    if (prev !== 'urgency' && next === 'urgency') SFX.urgencyAlert();
    return bgmMode;
  }

  return {
    resume,
    startBgm,
    stopBgm,
    setBgmMode,
    getBgmMode() { return bgmMode; },
    sfx: SFX,
    getVolume() { return { ...vol }; },
    setMaster(v) { vol.master = clamp01(v); applyVol(); },
    setBgm(v) { vol.bgm = clamp01(v); applyVol(); },
    setSe(v) { vol.se = clamp01(v); applyVol(); },
    setMuted(m) { vol.muted = !!m; applyVol(); },
    toggleMute() { vol.muted = !vol.muted; applyVol(); return vol.muted; },
  };
}
