const Audio2 = (() => {
  let ctx = null, master, musicGain, sfxGain, musicTimer = null, currentTrack = null;
  let musicVol = 0.6, sfxVol = 0.8, muted = false;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.connect(master);
      applyVolumes();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function applyVolumes() {
    if (!ctx) return;
    master.gain.value = muted ? 0 : 1;
    musicGain.gain.value = musicVol * 0.5;
    sfxGain.gain.value = sfxVol;
  }

  function tone(freq, dur, type = 'square', vol = 0.3, when = 0, dest = null, slide = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol = 0.3, when = 0, freq = 1000) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  const SFX = {
    pea() { tone(500, 0.08, 'square', 0.12, 0, null, -200); },
    firepea() { tone(400, 0.1, 'sawtooth', 0.14, 0, null, -150); noise(0.06, 0.08, 0, 2000); },
    sun() { tone(880, 0.12, 'sine', 0.25); tone(1320, 0.18, 'sine', 0.2, 0.07); },
    plant() { noise(0.12, 0.25, 0, 500); tone(180, 0.1, 'sine', 0.2, 0, null, -60); },
    shovel() { noise(0.15, 0.2, 0, 800); },
    groan() { tone(90 + Math.random() * 40, 0.5, 'sawtooth', 0.12, 0, null, -30); },
    eat() { noise(0.08, 0.2, 0, 900); tone(140, 0.06, 'square', 0.1, 0.02); },
    chomp() { noise(0.1, 0.3, 0, 600); tone(100, 0.12, 'square', 0.2, 0, null, -40); },
    explosion() { noise(0.7, 0.6, 0, 400); tone(60, 0.6, 'sine', 0.5, 0, null, -30); },
    mower() { tone(80, 0.8, 'sawtooth', 0.3, 0, null, 120); noise(0.8, 0.2, 0, 300); },
    splash() { noise(0.25, 0.25, 0, 1200); },
    freeze() { tone(1200, 0.3, 'sine', 0.2, 0, null, -600); },
    fire() { noise(0.5, 0.3, 0, 1500); },
    coin() { tone(990, 0.08, 'square', 0.15); tone(1320, 0.15, 'square', 0.15, 0.07); },
    diamond() { tone(1568, 0.1, 'sine', 0.25); tone(2093, 0.2, 'sine', 0.2, 0.08); },
    pop() { tone(600, 0.06, 'square', 0.15, 0, null, 300); },
    throw() { noise(0.15, 0.12, 0, 2000); },
    vault() { tone(300, 0.2, 'sine', 0.2, 0, null, 400); },
    crack() { noise(0.1, 0.3, 0, 2500); },
    huge() { tone(65, 1.2, 'sawtooth', 0.35); tone(98, 1.2, 'sawtooth', 0.25, 0.1); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'square', 0.22, i * 0.15)); },
    lose() { [392, 370, 349, 311].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.2, i * 0.3)); tone(233, 1.2, 'sawtooth', 0.2, 1.2); },
    click() { tone(700, 0.05, 'square', 0.12); },
    error() { tone(200, 0.15, 'square', 0.15); tone(150, 0.2, 'square', 0.15, 0.1); },
    wave() { tone(440, 0.3, 'square', 0.2); tone(440, 0.3, 'square', 0.2, 0.4); },
    magnet() { tone(200, 0.3, 'sine', 0.2, 0, null, 600); },
    butter() { noise(0.15, 0.2, 0, 700); },
    sputter() { noise(0.3, 0.15, 0, 1800); },
  };

  function sfx(name) {
    if (!ctx || muted) return;
    const fn = SFX[name];
    if (fn) fn();
  }

  const TRACKS = {
    day: {
      bpm: 132,
      bass: [130.8, 0, 130.8, 0, 164.8, 0, 130.8, 0, 196, 0, 164.8, 0, 146.8, 0, 196, 0],
      mel: [523, 0, 659, 523, 0, 392, 0, 0, 440, 0, 523, 440, 0, 392, 0, 0,
            587, 0, 659, 587, 0, 523, 0, 0, 440, 0, 392, 0, 0, 0, 0, 0,
            523, 0, 659, 523, 0, 392, 0, 0, 440, 0, 523, 659, 587, 0, 523, 0,
            440, 0, 392, 0, 330, 0, 392, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    night: {
      bpm: 100,
      bass: [110, 0, 0, 110, 0, 0, 130.8, 0, 98, 0, 0, 98, 0, 0, 110, 0],
      mel: [440, 0, 0, 523, 0, 0, 440, 0, 0, 0, 392, 0, 0, 0, 0, 0,
            466, 0, 0, 587, 0, 0, 466, 0, 0, 0, 440, 0, 0, 0, 0, 0,
            440, 0, 0, 523, 0, 0, 440, 0, 0, 0, 392, 0, 330, 0, 0, 0,
            392, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    pool: {
      bpm: 120,
      bass: [146.8, 0, 146.8, 0, 174.6, 0, 146.8, 0, 196, 0, 174.6, 0, 164.8, 0, 196, 0],
      mel: [587, 0, 0, 698, 0, 587, 0, 0, 523, 0, 0, 587, 0, 0, 0, 0,
            698, 0, 0, 880, 0, 698, 0, 0, 587, 0, 523, 0, 0, 0, 0, 0,
            587, 0, 0, 698, 0, 587, 0, 0, 523, 0, 0, 587, 0, 0, 0, 0,
            523, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    roof: {
      bpm: 140,
      bass: [164.8, 0, 164.8, 0, 196, 0, 164.8, 0, 220, 0, 196, 0, 174.6, 0, 220, 0],
      mel: [659, 0, 784, 659, 0, 523, 0, 0, 587, 0, 659, 587, 0, 523, 0, 0,
            698, 0, 784, 698, 0, 587, 0, 0, 523, 0, 440, 0, 0, 0, 0, 0,
            659, 0, 784, 659, 0, 523, 0, 0, 587, 0, 659, 784, 880, 0, 784, 0,
            659, 0, 587, 0, 523, 0, 587, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    menu: {
      bpm: 90,
      bass: [130.8, 0, 0, 0, 164.8, 0, 0, 0, 196, 0, 0, 0, 146.8, 0, 0, 0],
      mel: [523, 0, 0, 659, 0, 0, 784, 0, 659, 0, 0, 523, 0, 0, 0, 0,
            587, 0, 0, 698, 0, 0, 880, 0, 698, 0, 0, 587, 0, 0, 0, 0,
            523, 0, 0, 659, 0, 0, 784, 0, 880, 0, 784, 0, 659, 0, 0, 0,
            587, 0, 0, 659, 0, 0, 523, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  };

  let step = 0;
  function musicStep() {
    if (!ctx || !currentTrack) return;
    const tr = TRACKS[currentTrack];
    if (!tr) return;
    const len = tr.mel.length;
    const i = step % len;
    const b = tr.bass[i] || tr.bass[i % 16], m = tr.mel[i];
    if (b) tone(b, 0.22, 'triangle', 0.35, 0, musicGain);
    if (m) {
      tone(m, 0.18, 'square', 0.12, 0, musicGain);
      tone(m * 2, 0.1, 'sine', 0.05, 0, musicGain);
    }
    if (i % 4 === 2) noise(0.03, 0.05, 0, 6000);
    step++;
  }

  function playMusic(name) {
    ensure();
    if (currentTrack === name) return;
    stopMusic();
    currentTrack = name;
    if (!name || !TRACKS[name]) return;
    step = 0;
    const interval = 60000 / TRACKS[name].bpm / 2;
    musicTimer = setInterval(musicStep, interval);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    currentTrack = null;
  }

  return {
    ensure, sfx, playMusic, stopMusic,
    setMusicVol(v) { musicVol = v; applyVolumes(); },
    setSfxVol(v) { sfxVol = v; applyVolumes(); },
    setMuted(m) { muted = m; applyVolumes(); },
  };
})();
