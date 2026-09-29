const Reanim = (() => {
  const DEG = Math.PI / 180;
  const N_FRAMES = 24;   // animation phases pre-rendered per state

  let data = null;
  let ready = false;
  const images = {};
  const meta = {};   // per-reanim render cache + measured bounds
  let onReady = null;
  const progress = { loaded: 0, total: 0 };

  // ---- which reanim drives each plant / zombie -------------------------

  const PLANT_REANIM = {
    sunflower: 'SunFlower', peashooter: 'PeaShooter', cherrybomb: 'CherryBomb', wallnut: 'Wallnut',
    potatomine: 'PotatoMine', snowpea: 'SnowPea', chomper: 'Chomper', repeater: 'PeaShooter',
    puffshroom: 'PuffShroom', sunshroom: 'SunShroom', fumeshroom: 'FumeShroom', gravebuster: 'Gravebuster',
    hypnoshroom: 'HypnoShroom', scaredyshroom: 'ScaredyShroom', iceshroom: 'IceShroom', doomshroom: 'DoomShroom',
    lilypad: 'LilyPad', squash: 'Squash', threepeater: 'ThreePeater', tanglekelp: 'Tanglekelp',
    jalapeno: 'Jalapeno', spikewalk: 'SpikeRock', torchwood: 'Torchwood', tallnut: 'Tallnut',
    seashroom: 'SeaShroom', plantern: 'Plantern', cactus: 'Cactus', blover: 'Blover',
    splitpea: 'SplitPea', starfruit: 'Starfruit', pumpkin: 'Pumpkin', magnetshroom: 'Magnetshroom',
    cabbagepult: 'Cabbagepult', kernelpult: 'Cornpult', coffeebean: 'Coffeebean', umbrellaleaf: 'Umbrellaleaf',
    marigold: 'Marigold', melonpult: 'Melonpult', gatlingpea: 'GatlingPea', twinsunflower: 'TwinSunflower',
    wintermelon: 'WinterMelon', goldmagnet: 'GoldMagnet', imitater: 'Imitater',
  };

  // Tracks for the accessories that the shared base `Zombie` reanim carries.
  // PopCap keeps cone/bucket/screen-door/diving-tube all switched on and lets
  // the game code hide the ones a given zombie type must not show, so we do
  // the same instead of trusting the file.
  const ACC = {
    cone: ['anim_cone'],
    bucket: ['anim_bucket'],
    door: ['anim_screendoor', 'Zombie_outerarm_screendoor', 'Zombie_innerarm_screendoor', 'Zombie_innerarm_screendoor_hand'],
    tube: ['Zombie_duckytube'],
    snorkel: ['Zombie_whitewater', 'Zombie_whitewater2'],
    flaghand: ['Zombie_flaghand'],
    moustache: ['Zombie_mustache'],
    tongue: ['anim_tongue'],
    outerarm: ['Zombie_outerarm_upper', 'Zombie_outerarm_lower', 'Zombie_outerarm_hand'],
  };
  const ALL_ACC = Object.keys(ACC).reduce((a, k) => a.concat(ACC[k]), []);

  // type -> reanim, default state, accessories to keep, tracks to force-hide
  const ZOMBIE_DEF = {
    basic: { r: 'Zombie', s: 'anim_walk' },
    conehead: { r: 'Zombie', s: 'anim_walk', show: ['cone'] },
    buckethead: { r: 'Zombie', s: 'anim_walk', show: ['bucket'] },
    screendoor: { r: 'Zombie', s: 'anim_walk', show: ['door'], hide: ['outerarm'] },
    flag: { r: 'Zombie', s: 'anim_walk', show: ['flaghand'], over: ['Zombie_flagpole'] },
    polevault: { r: 'Zombie_polevaulter', s: 'anim_walk' },
    football: { r: 'Zombie_football', s: 'anim_walk' },
    dancing: { r: 'Zombie_dancer', s: 'anim_armraise' },
    backupdancer: { r: 'Zombie_backup', s: 'anim_armraise' },
    balloon: { r: 'Zombie_balloon', s: 'anim_walk' },
    gargantuar: { r: 'Zombie_gargantuar', s: 'anim_walk' },
    imp: { r: 'Zombie_imp', s: 'anim_walk' },
    bungee: { r: 'Zombie_bungi', s: 'anim_idle' },
    catapult: { r: 'Zombie_catapult', s: 'anim_walk' },
    yeti: { r: 'Zombie_yeti', s: 'anim_walk' },
    snorkel: { r: 'Zombie_snorkle', s: 'anim_aquarium_swim' },
    zomboni: { r: 'Zombie_zamboni', s: 'anim_walk' },
    dolphinrider: { r: 'Zombie_dolphinrider', s: 'anim_walk', show: ['tube'] },
    jackinthebox: { r: 'Zombie_jackbox', s: 'anim_walk' },
    pogo: { r: 'Zombie_pogo', s: 'anim_walk' },
    digger: { r: 'Zombie_digger', s: 'anim_walk' },
    bobsled: { r: 'Zombie_bobsled', s: 'anim_walk' },
  };

  // ---- state lookup ---------------------------------------------------

  function pickWindow(v) {
    if (!v) return null;
    if (typeof v[0] === 'number') return v;             // [start, end]
    let best = v[0];                                     // [start, end, len] runs
    for (const r of v) if (r[2] > best[2]) best = r;
    return best;
  }

  function windowOf(r, state) {
    if (!r || !r.states) return null;
    return pickWindow(r.states[state]) || null;
  }

  // Which frame window does this track follow for the requested state?
  // `s` holds the states a track is visible in, `d` its default state. A track
  // must not leak into a state it is not part of - falling back to `d`
  // unconditionally is what kept zombie legs on screen while swimming.
  function trackWindow(r, t, state) {
    if (t.s && t.s.indexOf(state) !== -1) return windowOf(r, state);
    if (t.d && t.d === state) return windowOf(r, state);
    return null;
  }

  // ---- sampling -------------------------------------------------------

  // Keyframes are [f, x, y, sx, sy, kx, ky, a, fileIdx]; values are already
  // carry-forward resolved at build time, so plain interpolation is correct.
  function sample(t, frame) {
    const k = t.k;
    const i0 = Math.min(Math.max(Math.floor(frame), 0), t.len - 1);
    const i1 = Math.min(i0 + 1, t.len - 1);
    const fr = frame - Math.floor(frame);
    const A = k[i0], B = k[i1];
    const L = (a, b) => a + (b - a) * fr;
    return {
      f: fr < 0.5 ? A[0] : B[0],
      x: L(A[1], B[1]), y: L(A[2], B[2]),
      sx: L(A[3], B[3]), sy: L(A[4], B[4]),
      kx: L(A[5], B[5]), ky: L(A[6], B[6]),
      a: L(A[7], B[7]),
      file: fr < 0.5 ? A[8] : B[8],
    };
  }

  // ---- geometry -------------------------------------------------------

  // Reanim places each sprite by its bottom-centre; kx/ky are skew angles in
  // degrees, so they must go through tan() before use as matrix terms.
  function applyMatrix(ctx, k, ox, oy) {
    const tx = Math.tan(k.kx * DEG);
    const ty = Math.tan(k.ky * DEG);
    ctx.transform(k.sx, k.sy * ty, k.sx * tx, k.sy, ox, oy);
  }

  function spriteBox(r, t, frame, vis) {
    if (vis && vis[t.n] === false) return null;
    // A force-show has to win over an explicitly hidden keyframe.
    const forced = !!(vis && vis[t.n] === true);
    const k = sample(t, frame);
    if (!forced && (k.f < 0 || k.file < 0)) return null;
    const img = images[r.files[k.file]];
    if (!img || !img.naturalWidth) return null;
    const w = img.naturalWidth * k.sx;
    const h = img.naturalHeight * k.sy;
    return { k, img, left: k.x - w / 2, right: k.x + w / 2, top: k.y - h, bottom: k.y };
  }

  // ---- state plans ------------------------------------------------------
  //
  // A "plan" says which state each individual track follows. A plain plan is
  // just one state for everything; a composite plan drives some tracks from a
  // second state. That is needed because PopCap splits a plant into a moving
  // head animation (`anim_shooting`) and a separate body animation
  // (`anim_full_idle`) - playing the head state alone would make the stalk and
  // leaves vanish mid-shot.

  function singlePlan(state) { return { base: state, map: null }; }

  function compositePlan(base, map) { return { base, map }; }

  function planKey(p) {
    if (!p.map) return p.base;
    const parts = [];
    for (const k of Object.keys(p.map).sort()) parts.push(k + '=' + p.map[k]);
    return p.base + '|' + parts.join('&');
  }

  function planState(p, trackName) {
    return (p.map && p.map[trackName]) || p.base;
  }

  function visKey(vis) {
    if (!vis) return '';
    const on = Object.keys(vis).filter(k => vis[k]).sort();
    return on.length ? '+' + on.join(',') : '';
  }

  function ensureMeta(name) {
    if (meta[name]) return meta[name];
    const r = data[name];
    if (!r) return null;
    const m = { name, frames: new Map(), boxes: new Map(), content: new Map(), plans: new Map() };
    meta[name] = m;
    return m;
  }

  // A "dup" group re-draws a set of tracks at an offset. The GOTY PAK has no
  // Repeater.reanim, so the Repeater is drawn as a PeaShooter with its head
  // layers repeated beside the originals - the same stalk, two mouths.
  function dupKey(dup) {
    if (!dup || !dup.length) return '';
    return '~' + dup.map(g => g.tracks.join('+') + '@' + g.dx + ',' + g.dy).join(';');
  }

  // Bounds are measured across every frame of the plan so the anchor stays
  // put; measuring per frame would make the sprite jitter as it breathes.
  function stateBox(name, plan, vis, dup) {
    const r = data[name];
    const m = ensureMeta(name);
    const key = planKey(plan) + visKey(vis) + dupKey(dup);
    if (m.boxes.has(key)) return m.boxes.get(key);

    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let f = 0; f < N_FRAMES; f++) {
      const phase = f / N_FRAMES;
      for (const pass of [null].concat(dup || [])) {
        const off = pass ? { dx: pass.dx || 0, dy: pass.dy || 0 } : { dx: 0, dy: 0 };
        for (const t of r.tracks) {
          if (pass && pass.tracks.indexOf(t.n) === -1) continue;
          if (vis && vis[t.n] === false) continue;
          const w = trackWindow(r, t, planState(plan, t.n));
          if (!w) continue;
          const box = spriteBox(r, t, w[0] + phase * (w[1] - w[0]), vis);
          if (!box) continue;
          if (box.left + off.dx < minX) minX = box.left + off.dx;
          if (box.right + off.dx > maxX) maxX = box.right + off.dx;
          if (box.top + off.dy < minY) minY = box.top + off.dy;
          if (box.bottom + off.dy > maxY) maxY = box.bottom + off.dy;
        }
      }
    }
    // `ay` still pins the feet to the anchor; the canvas simply grows upward
    // far enough to hold layers whose y sits above the origin.
    const out = minX > maxX ? null : {
      w: Math.ceil(maxX - minX) + 4,
      h: Math.ceil(maxY - minY) + 4,
      ax: -minX + 2,
      ay: -maxY + 2,
    };
    m.boxes.set(key, out);
    return out;
  }

  // A state can exist and still be empty - the snorkel zombie's 7-frame
  // `anim_swim` is nothing but a head and a water splash. Fall back to a state
  // that actually has something to draw instead of rendering an empty box.
  function stateHasContent(name, state, vis) {
    const r = data[name];
    if (!r) return false;
    const m = ensureMeta(name);
    const key = state + visKey(vis);
    if (m.content.has(key)) return m.content.get(key);
    const w = windowOf(r, state);
    let any = false;
    if (w) {
      for (const t of r.tracks) {
        if (vis && vis[t.n] === false) continue;
        const win = trackWindow(r, t, state);
        if (!win) continue;
        if (spriteBox(r, t, win[0] + (win[1] - win[0]) / 2, vis)) { any = true; break; }
      }
    }
    m.content.set(key, any);
    return any;
  }

  // Pick the requested state when it draws something, else the caller's
  // preferred state, else whatever shows the whole body.
  function resolveState(name, want, fallback, vis) {
    if (want && data[name].states[want] && stateHasContent(name, want, vis)) return want;
    if (fallback && data[name].states[fallback] && stateHasContent(name, fallback, vis)) return fallback;
    return defaultState(data[name]);
  }

  // Which tracks does this state actually draw? Used to work out what a second
  // state has to supply so the two together form a whole plant.
  function tracksOf(name, state, vis) {
    const r = data[name];
    const m = ensureMeta(name);
    const key = state + visKey(vis);
    if (m.plans.has(key)) return m.plans.get(key);
    const set = new Set();
    const w = windowOf(r, state);
    if (w) {
      for (let f = 0; f < 5 && !set.size; f++) {
        const frame = w[0] + (w[1] - w[0]) * (f / 5);
        for (const t of r.tracks) {
          if (vis && vis[t.n] === false) continue;
          const win = trackWindow(r, t, state);
          if (!win) continue;
          if (spriteBox(r, t, frame, vis)) set.add(t.n);
        }
      }
    }
    m.plans.set(key, set);
    return set;
  }

  // Build the plan for a state, topped up with the rest of the plant from the
  // body state so nothing disappears.
  function planFor(name, want, fallback, vis, fill) {
    const state = resolveState(name, want, fallback, vis);
    const r = data[name];
    const base = defaultState(r);
    if (!fill || state === base || !r.states[state]) return singlePlan(state);
    const inState = tracksOf(name, state, vis);
    const map = {};
    let extra = 0;
    for (const n of tracksOf(name, base, vis)) {
      if (!inState.has(n)) { map[n] = base; extra++; }
    }
    return extra ? compositePlan(state, map) : singlePlan(state);
  }

  function buildFrame(name, plan, frameIdx, vis, dup) {
    const r = data[name];
    const m = ensureMeta(name);
    const key = planKey(plan) + '#' + frameIdx + visKey(vis) + dupKey(dup);
    if (m.frames.has(key)) return m.frames.get(key);

    const box = stateBox(name, plan, vis, dup);
    if (!box) { const empty = { c: null, ax: 0, ay: 0 }; m.frames.set(key, empty); return empty; }

    const cv = document.createElement('canvas');
    cv.width = Math.max(1, box.w);
    cv.height = Math.max(1, box.h);
    const c = cv.getContext('2d');
    const phase = frameIdx / N_FRAMES;

    // The duplicate pass runs last so the repeated head sits on top, matching
    // how the real Repeater's second head overlaps the first.
    for (const pass of [null].concat(dup || [])) {
      const dx = pass ? (pass.dx || 0) : 0;
      const dy = pass ? (pass.dy || 0) : 0;
      for (const t of r.tracks) {
        if (pass && pass.tracks.indexOf(t.n) === -1) continue;
        if (vis && vis[t.n] === false) continue;
        const win = trackWindow(r, t, planState(plan, t.n));
        if (!win) continue;
        const kf = sample(t, win[0] + phase * (win[1] - win[0]));
        const forced = !!(vis && vis[t.n] === true);
        if (!forced && (kf.f < 0 || kf.file < 0)) continue;
        const img = images[r.files[kf.file]];
        if (!img || !img.naturalWidth) continue;
        c.save();
        c.globalAlpha = kf.a;
        applyMatrix(c, kf, kf.x + dx + box.ax, kf.y + dy + box.ay);
        c.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight);
        c.restore();
      }
    }
    const out = { c: cv, ax: box.ax, ay: box.ay };
    m.frames.set(key, out);
    return out;
  }

  // ---- loading --------------------------------------------------------

  function load(cb) {
    onReady = cb;
    fetch('js/assets/reanim-data.json')
      .then(r => r.json())
      .then(d => {
        data = d;
        const files = new Set();
        for (const r of Object.values(data)) for (const f of r.files) files.add(f);
        progress.total = files.size;
        progress.loaded = 0;
        for (const f of files) {
          const img = new Image();
          const done = () => {
            progress.loaded++;
            if (progress.loaded === progress.total) {
              ready = true;
              if (onReady) onReady();
            }
          };
          img.onload = done;
          img.onerror = done;
          img.src = 'js/assets/reanim/' + f;
          images[f] = img;
        }
        if (progress.total === 0) { ready = true; if (onReady) onReady(); }
      })
      .catch(() => { if (onReady) onReady(); });
  }

  // ---- public draw ----------------------------------------------------

  function drawReanim(ctx, name, x, y, t, opts) {
    opts = opts || {};
    const r = data && data[name];
    if (!r) return false;
    const plan = planFor(name, opts.state, opts.preferState, opts.vis, opts.fill);
    const phase = ((t || 0) % 1 + 1) % 1;
    const idx = Math.min(N_FRAMES - 1, Math.floor(phase * N_FRAMES));
    const fr = buildFrame(name, plan, idx, opts.vis, opts.dup);
    if (!fr.c) return true;
    const scale = opts.scale || 1;
    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (opts.tint) { ctx.drawImage(fr.c, 0, 0); ctx.restore(); return true; }
    ctx.drawImage(fr.c, x - fr.ax * scale, y - fr.ay * scale, fr.c.width * scale, fr.c.height * scale);
    ctx.restore();
    return true;
  }

  function defaultState(r) {
    // Prefer a state that shows the whole body at rest.
    for (const s of ['anim_full_idle', 'anim_idle', 'anim_idle2', 'anim_walk', '_all']) {
      if (r.states && r.states[s]) return s;
    }
    const k = Object.keys(r.states || {});
    const idleish = k.find(s => /idle/.test(s));
    return idleish || (k.length ? k[0] : null);
  }

  // The head layers are the ones the shooting animation moves; the stem state
  // only carries leaves and stalk. Used to give the Repeater a second head.
  function headTracks(name) {
    const r = data[name];
    const m = ensureMeta(name);
    if (m.heads) return m.heads;
    const heads = [];
    if (r && r.states.anim_shooting && r.states.anim_idle) {
      const inShoot = tracksOf(name, 'anim_shooting', null);
      const inBody = tracksOf(name, 'anim_idle', null);
      for (const n of inShoot) if (!inBody.has(n)) heads.push(n);
    }
    m.heads = heads;
    return heads;
  }

  function drawPlant(type, ctx, x, y, t, opts) {
    opts = opts || {};
    const name = PLANT_REANIM[type];
    if (!name || !ready || !data || !data[name]) {
      if (typeof Sprites !== 'undefined') Sprites.drawPlant(type, ctx, x, y, t, opts);
      return;
    }
    let extra = {};
    if (type === 'repeater') {
      // No Repeater.reanim ships with the GOTY PAK, so approximate it by
      // repeating PeaShooter's head layers beside the originals.
      const heads = headTracks(name);
      if (heads.length) extra = { state: 'anim_shooting', dup: [{ tracks: heads, dx: 21, dy: 1 }] };
    }
    const merged = Object.assign({}, opts, { fill: true }, extra);
    drawReanim(ctx, name, x, y, t, Object.assign({}, merged, { state: pickPlantState(type, merged) }));
  }

  function pickPlantState(type, opts) {
    const name = PLANT_REANIM[type];
    const r = data[name];
    if (!r) return null;
    return opts.shooting && r.states.anim_shooting ? 'anim_shooting' : (opts.state || null);
  }

  function drawZombie(type, ctx, x, y, t, opts) {
    opts = opts || {};
    const def = ZOMBIE_DEF[type];
    if (!def || !ready || !data || !data[def.r]) {
      if (typeof Sprites !== 'undefined') Sprites.drawZombie(type, ctx, x, y, t, opts);
      return;
    }
    // Hide every accessory the file switches on by default, then re-enable the
    // ones this zombie type actually wears.
    const vis = {};
    for (const n of ALL_ACC) vis[n] = false;
    for (const key of def.show || []) for (const n of ACC[key]) vis[n] = true;
    for (const n of def.hide || []) vis[n] = false;

    const r = data[def.r];
    drawReanim(ctx, def.r, x, y, t, Object.assign({}, opts, { preferState: def.s, vis }));

    for (const o of def.over || []) {
      if (data[o]) drawReanim(ctx, o, x, y, t, Object.assign({}, opts, { state: defaultState(data[o]) }));
    }
  }

  return {
    load, drawPlant, drawZombie, drawReanim, getReanimName: t => PLANT_REANIM[t],
    isReady: () => ready, progress,
  };
})();
