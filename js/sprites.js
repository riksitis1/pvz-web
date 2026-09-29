const Sprites = (() => {
  function ell(c, x, y, rx, ry, fill, stroke, lw = 2) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  function rr(c, x, y, w, h, r, fill, stroke, lw = 2) {
    c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  function circ(c, x, y, r, fill, stroke, lw = 2) { ell(c, x, y, r, r, fill, stroke, lw); }
  function poly(c, pts, fill, stroke, lw = 2) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  function leaf(c, x, y, len, ang, fill) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.ellipse(len / 2, 0, len / 2, len / 4.5, 0, 0, Math.PI * 2);
    c.fillStyle = fill; c.fill(); c.strokeStyle = '#1b5e20'; c.lineWidth = 1.5; c.stroke();
    c.restore();
  }
  function stem(c, x1, y1, x2, y2, w = 3) {
    c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2 + 3, (y1 + y2) / 2, x2, y2);
    c.strokeStyle = '#2e7d32'; c.lineWidth = w; c.lineCap = 'round'; c.stroke();
  }
  const OUT = '#183018';

  const PLANTS = {
    sunflower(c, x, y, t, o) {
      const sway = Math.sin(t * 2) * 0.06;
      c.save(); c.translate(x, y); c.rotate(sway);
      stem(c, 0, 0, 0, -26);
      leaf(c, 0, -12, 16, -0.6, '#43a047'); leaf(c, 0, -16, 16, 0.7, '#43a047');
      const bob = Math.sin(t * 3) * 1.5;
      circ(c, 0, -34 + bob, 13, '#ffb300', OUT);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.2;
        ell(c, Math.cos(a) * 17, -34 + bob + Math.sin(a) * 17, 5, 8, '#ffca28', null);
      }
      circ(c, 0, -34 + bob, 10, '#6d4c41', OUT);
      circ(c, -3.5, -36 + bob, 1.6, '#263238'); circ(c, 3.5, -36 + bob, 1.6, '#263238');
      c.beginPath(); c.arc(0, -31 + bob, 4, 0.2, Math.PI - 0.2); c.strokeStyle = '#263238'; c.lineWidth = 1.5; c.stroke();
      c.restore();
    },
    peashooter(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 4 : 0;
      c.save(); c.translate(x + rec, y);
      stem(c, 0, 0, 0, -24);
      leaf(c, 0, -10, 15, -0.5, '#43a047'); leaf(c, 0, -14, 15, 0.6, '#43a047');
      const tilt = Math.sin(t * 2.2) * 0.04;
      c.save(); c.translate(0, -30); c.rotate(tilt);
      circ(c, 0, 0, 13, '#7cb342', OUT);
      rr(c, 8, -6, 12, 12, 5, '#7cb342', OUT);
      circ(c, 19, 0, 4.5, '#33691e', OUT);
      circ(c, -3, -4, 2, '#1b5e20'); circ(c, 4, -4, 2, '#1b5e20');
      c.restore(); c.restore();
    },
    cherrybomb(c, x, y, t, o) {
      const fuse = o && o.fuse !== undefined ? o.fuse : 1;
      const s = 1 + (1 - fuse) * 0.25;
      c.save(); c.translate(x, y); c.scale(s, s);
      stem(c, -4, 0, -8, -18, 2.5); stem(c, 4, 0, 8, -18, 2.5);
      const wob = Math.sin(t * 10) * 0.08 * (1 - fuse + 0.3);
      circ(c, -10, -24 + wob * 8, 11, '#e53935', OUT);
      circ(c, 10, -24 - wob * 8, 11, '#c62828', OUT);
      circ(c, -13, -27, 2, '#ff8a80'); circ(c, 7, -27, 2, '#ff8a80');
      circ(c, -12, -26, 1.8, '#4e342e'); circ(c, 8, -26, 1.8, '#4e342e');
      c.beginPath(); c.arc(-10, -21, 3.5, 0.3, Math.PI - 0.3); c.strokeStyle = '#4e342e'; c.lineWidth = 1.5; c.stroke();
      c.beginPath(); c.arc(10, -21, 3.5, 0.3, Math.PI - 0.3); c.stroke(); c.stroke();
      c.restore();
    },
    wallnut(c, x, y, t, o) {
      const hp = o ? o.hpFrac : 1;
      c.save(); c.translate(x, y);
      const sq = 1 + Math.sin(t * 1.8) * 0.015;
      c.scale(1, sq);
      ell(c, 0, -20, 15, 21, '#d7a86e', OUT, 2.5);
      ell(c, -4, -24, 4, 8, '#e8c898', null);
      if (hp < 0.66) {
        c.beginPath(); c.moveTo(-8, -38); c.lineTo(-2, -28); c.lineTo(-9, -18);
        c.strokeStyle = '#5d4037'; c.lineWidth = 2; c.stroke();
      }
      if (hp < 0.33) {
        c.beginPath(); c.moveTo(6, -36); c.lineTo(2, -26); c.lineTo(9, -14); c.moveTo(2, -26); c.lineTo(-4, -12);
        c.stroke();
      }
      circ(c, -5, -24, 2, '#3e2723'); circ(c, 5, -24, 2, '#3e2723');
      c.beginPath(); c.arc(0, -18, 5, 0.3, Math.PI - 0.3); c.strokeStyle = '#3e2723'; c.lineWidth = 2; c.stroke();
      c.restore();
    },
    potatomine(c, x, y, t, o) {
      const armed = o && o.armed;
      c.save(); c.translate(x, y);
      ell(c, 0, -8, 12, 9, armed ? '#a1887f' : '#8d6e63', OUT);
      ell(c, -3, -11, 3, 4, '#bcaaa4', null);
      if (armed) {
        const bl = Math.sin(t * 8) > 0;
        circ(c, 0, -18, 3.5, bl ? '#ff1744' : '#7f0000', OUT, 1.5);
      } else {
        stem(c, 0, -14, 0, -22, 2);
        leaf(c, 0, -22, 8, 0, '#66bb6a');
      }
      c.restore();
    },
    snowpea(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 4 : 0;
      c.save(); c.translate(x + rec, y);
      stem(c, 0, 0, 0, -24);
      leaf(c, 0, -10, 15, -0.5, '#0277bd'); leaf(c, 0, -14, 15, 0.6, '#0277bd');
      c.save(); c.translate(0, -30); c.rotate(Math.sin(t * 2.2) * 0.04);
      circ(c, 0, 0, 13, '#4fc3f7', OUT);
      rr(c, 8, -6, 12, 12, 5, '#4fc3f7', OUT);
      circ(c, 19, 0, 4.5, '#01579b', OUT);
      circ(c, -3, -4, 2, '#01579b'); circ(c, 4, -4, 2, '#01579b');
      for (let i = 0; i < 3; i++) ell(c, -6 + i * 6, -14, 2, 3.5, '#b3e5fc', null);
      c.restore(); c.restore();
    },
    chomper(c, x, y, t, o) {
      const chewing = o && o.chewing;
      const open = o && o.attack ? Math.sin(Math.min(1, o.attack * 3) * Math.PI) : 0;
      c.save(); c.translate(x, y);
      stem(c, 0, 0, chewing ? 2 : 0, -26, 4);
      leaf(c, -4, -12, 14, -0.5, '#7b1fa2'); leaf(c, 4, -16, 14, 0.6, '#7b1fa2');
      c.save(); c.translate(0, -34);
      const jaw = chewing ? 0.15 : 0.25 + open * 0.55;
      c.save(); c.rotate(-jaw);
      ell(c, 6, -6, 14, 10, '#ab47bc', OUT);
      for (let i = 0; i < 3; i++) poly(c, [[14 + i * 4, -10], [17 + i * 4, -5], [13 + i * 4, -5]], '#fff', null);
      c.restore();
      c.save(); c.rotate(jaw * 0.9);
      ell(c, 6, 6, 14, 9, '#8e24aa', OUT);
      for (let i = 0; i < 3; i++) poly(c, [[14 + i * 4, 8], [17 + i * 4, 4], [13 + i * 4, 4]], '#fff', null);
      c.restore();
      circ(c, -2, -8, 2.5, '#fff', OUT, 1); circ(c, -1.5, -8, 1.2, '#183018', null);
      c.restore(); c.restore();
    },
    repeater(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 4 : 0;
      c.save(); c.translate(x + rec, y);
      stem(c, 0, 0, 0, -24);
      leaf(c, 0, -10, 15, -0.5, '#558b2f'); leaf(c, 0, -14, 15, 0.6, '#558b2f');
      c.save(); c.translate(0, -30); c.rotate(Math.sin(t * 2.4) * 0.05);
      circ(c, 0, 0, 13, '#689f38', OUT);
      rr(c, 8, -6, 12, 12, 5, '#689f38', OUT);
      circ(c, 19, 0, 4.5, '#33691e', OUT);
      circ(c, -3, -4, 2, '#1b5e20'); circ(c, 4, -4, 2, '#1b5e20');
      c.restore(); c.restore();
    },
    puffshroom(c, x, y, t, o) {
      const life = o ? o.lifeFrac : 1;
      c.save(); c.translate(x, y); c.globalAlpha = 0.55 + life * 0.45;
      const fade = life < 0.25 ? (Math.sin(t * 12) > 0 ? 1 : 0.4) : 1;
      c.globalAlpha = (0.55 + life * 0.45) * fade;
      rr(c, -4, -16, 8, 16, 3, '#bcaaa4', OUT, 1.5);
      const puff = 1 + Math.sin(t * 4) * 0.06;
      c.save(); c.translate(0, -18); c.scale(puff, puff);
      circ(c, 0, 0, 10, '#e1bee7', OUT, 1.5);
      circ(c, -3, -2, 1.5, '#4a148c'); circ(c, 3, -2, 1.5, '#4a148c');
      c.restore(); c.restore();
    },
    sunshroom(c, x, y, t, o) {
      const big = o && o.big;
      const s = big ? 1 : 0.55;
      c.save(); c.translate(x, y); c.scale(s, s);
      rr(c, -4, -16, 8, 16, 3, '#bcaaa4', OUT, 1.5);
      const bob = Math.sin(t * 3) * 1.5;
      circ(c, 0, -20 + bob, 11, '#fff59d', OUT, 1.5);
      circ(c, -3, -22 + bob, 1.5, '#f57f17'); circ(c, 3, -22 + bob, 1.5, '#f57f17');
      c.restore();
    },
    fumeshroom(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
      c.save(); c.translate(x + rec, y);
      rr(c, -5, -18, 10, 18, 3, '#90a4ae', OUT, 1.5);
      circ(c, 0, -22, 11, '#b0bec5', OUT, 1.5);
      rr(c, 6, -26, 12, 9, 4, '#78909c', OUT, 1.5);
      circ(c, 17, -21.5, 3.5, '#37474f', OUT, 1);
      circ(c, -3, -24, 1.5, '#263238'); circ(c, 3, -24, 1.5, '#263238');
      c.restore();
    },
    gravebuster(c, x, y, t, o) {
      const eating = o && o.eating;
      c.save(); c.translate(x, y);
      const chomp = eating ? Math.abs(Math.sin(t * 10)) * 3 : 0;
      rr(c, -5, -20, 10, 20, 4, '#6d4c41', OUT, 1.5);
      circ(c, 0, -24, 10, '#8d6e63', OUT, 1.5);
      rr(c, -6, -26 - chomp, 12, 5, 2, '#4e342e', OUT, 1);
      circ(c, -3, -22, 1.5, '#263238'); circ(c, 3, -22, 1.5, '#263238');
      c.restore();
    },
    hypnoshroom(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      const sw = Math.sin(t * 3) * 0.15;
      c.save(); c.translate(0, -18); c.rotate(sw);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t;
        circ(c, Math.cos(a) * 9, Math.sin(a) * 9, 4, i % 2 ? '#f48fb1' : '#fff176', OUT, 1);
      }
      circ(c, 0, 0, 8, '#ec407a', OUT, 1.5);
      c.restore();
      rr(c, -4, -16, 8, 16, 3, '#bcaaa4', OUT, 1.5);
      c.restore();
    },
    scaredyshroom(c, x, y, t, o) {
      const hide = o && o.hide;
      c.save(); c.translate(x, y);
      if (hide) {
        rr(c, -5, -12, 10, 12, 3, '#8d6e63', OUT, 1.5);
        circ(c, 0, -15, 9, '#a1887f', OUT, 1.5);
      } else {
        const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
        rr(c, -4, -16, 8, 16, 3, '#bcaaa4', OUT, 1.5);
        c.save(); c.translate(rec, -18);
        circ(c, 0, 0, 10, '#ce93d8', OUT, 1.5);
        rr(c, 6, -5, 10, 8, 4, '#ce93d8', OUT, 1.5);
        circ(c, 15, -1, 3, '#6a1b9a', OUT, 1);
        circ(c, -3, -2, 1.5, '#4a148c'); circ(c, 3, -2, 1.5, '#4a148c');
        c.restore();
      }
      c.restore();
    },
    iceshroom(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      const pulse = 1 + Math.sin(t * 6) * 0.08;
      c.save(); c.translate(0, -18); c.scale(pulse, pulse);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        poly(c, [[Math.cos(a) * 12, Math.sin(a) * 12], [Math.cos(a + 0.3) * 6, Math.sin(a + 0.3) * 6], [Math.cos(a - 0.3) * 6, Math.sin(a - 0.3) * 6]], '#b3e5fc', OUT, 1);
      }
      circ(c, 0, 0, 8, '#e1f5fe', OUT, 1.5);
      c.restore();
      rr(c, -4, -16, 8, 16, 3, '#bcaaa4', OUT, 1.5);
      c.restore();
    },
    doomshroom(c, x, y, t, o) {
      const fuse = o && o.fuse !== undefined ? o.fuse : 1;
      c.save(); c.translate(x, y);
      const s = 1 + (1 - fuse) * 0.3;
      c.save(); c.translate(0, -20); c.scale(s, s);
      circ(c, 0, 0, 16, '#4e342e', OUT, 2);
      circ(c, -5, -5, 3, '#ff7043'); circ(c, 5, -3, 3, '#ff7043');
      circ(c, -5, -5, 1.5, '#ffeb3b'); circ(c, 5, -3, 1.5, '#ffeb3b');
      c.beginPath(); c.arc(0, 4, 5, 0.3, Math.PI - 0.3); c.strokeStyle = '#1b1b1b'; c.lineWidth = 2; c.stroke();
      c.restore(); c.restore();
    },
    lilypad(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      const bob = Math.sin(t * 2) * 1;
      c.save(); c.translate(0, -2 + bob);
      c.beginPath(); c.ellipse(0, 0, 17, 7, 0, 0, Math.PI * 2);
      c.fillStyle = '#43a047'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(14, -4); c.lineTo(14, 4); c.closePath();
      c.fillStyle = '#43a047'; c.fill(); c.stroke();
      c.restore(); c.restore();
    },
    squash(c, x, y, t, o) {
      const jump = o && o.jumpT !== undefined ? o.jumpT : -1;
      c.save(); c.translate(x, y);
      if (jump >= 0) {
        const p = Math.min(1, jump);
        c.translate(p * 30, -Math.sin(p * Math.PI) * 40);
        c.scale(1 + p * 0.3, 1 - p * 0.2);
      }
      const sq = 1 + Math.sin(t * 2.5) * 0.04;
      c.save(); c.translate(0, -14); c.scale(1, sq);
      ell(c, 0, 0, 13, 14, '#9ccc65', OUT, 2);
      circ(c, -4, -4, 2, '#33691e'); circ(c, 4, -4, 2, '#33691e');
      c.beginPath(); c.arc(0, 2, 4, 0.3, Math.PI - 0.3); c.strokeStyle = '#33691e'; c.lineWidth = 2; c.stroke();
      c.restore(); c.restore();
    },
    threepeater(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
      c.save(); c.translate(x + rec, y);
      for (let i = -1; i <= 1; i++) {
        c.save(); c.translate(0, -20 + i * 12); c.rotate(Math.sin(t * 2 + i) * 0.05);
        circ(c, 0, 0, 9, '#7cb342', OUT, 1.5);
        rr(c, 5, -4, 9, 8, 4, '#7cb342', OUT, 1.5);
        circ(c, 13, 0, 3, '#33691e', OUT, 1);
        c.restore();
      }
      stem(c, 0, 0, 0, -14, 3);
      c.restore();
    },
    tanglekelp(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      const sw = Math.sin(t * 2.5) * 0.2;
      c.save(); c.translate(0, -4); c.rotate(sw);
      for (let i = 0; i < 4; i++) {
        c.save(); c.rotate((i / 4) * Math.PI * 2 + 0.4);
        leaf(c, 0, -8, 18, 0, '#00897b');
        c.restore();
      }
      circ(c, 0, -6, 6, '#00695c', OUT, 1.5);
      c.restore(); c.restore();
    },
    jalapeno(c, x, y, t, o) {
      const fuse = o && o.fuse !== undefined ? o.fuse : 1;
      c.save(); c.translate(x, y);
      const s = 1 + (1 - fuse) * 0.2;
      c.save(); c.translate(0, -16); c.scale(s, s);
      c.beginPath(); c.moveTo(-6, -10);
      c.quadraticCurveTo(-10, 4, -4, 12); c.quadraticCurveTo(0, 16, 4, 12);
      c.quadraticCurveTo(10, 4, 6, -10); c.closePath();
      c.fillStyle = '#d32f2f'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
      stem(c, 0, -10, 2, -18, 3);
      circ(c, -2, -2, 2, '#b71c1c'); circ(c, 3, 2, 2, '#b71c1c');
      c.beginPath(); c.arc(0, 4, 3.5, 0.3, Math.PI - 0.3); c.strokeStyle = '#b71c1c'; c.lineWidth = 2; c.stroke();
      c.restore(); c.restore();
    },
    spikewalk(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      ell(c, 0, -4, 16, 6, '#5d4037', OUT, 1.5);
      for (let i = 0; i < 5; i++) {
        poly(c, [[-12 + i * 6, -6], [-10 + i * 6, -14], [-8 + i * 6, -6]], '#90a4ae', OUT, 1);
      }
      c.restore();
    },
    torchwood(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      rr(c, -10, -30, 20, 30, 6, '#6d4c41', OUT, 2);
      rr(c, -7, -27, 14, 24, 4, '#8d6e63', null);
      const fl = 1 + Math.sin(t * 9) * 0.15;
      c.save(); c.translate(0, -34); c.scale(1, fl);
      poly(c, [[0, -14], [7, -4], [4, 2], [0, 0], [-4, 2], [-7, -4]], '#ff9800', OUT, 1.5);
      poly(c, [[0, -8], [4, -1], [0, 3], [-4, -1]], '#ffeb3b', null);
      c.restore(); c.restore();
    },
    tallnut(c, x, y, t, o) {
      const hp = o ? o.hpFrac : 1;
      c.save(); c.translate(x, y);
      rr(c, -13, -52, 26, 52, 10, '#d7a86e', OUT, 2.5);
      ell(c, -4, -44, 5, 12, '#e8c898', null);
      if (hp < 0.66) { c.beginPath(); c.moveTo(-6, -48); c.lineTo(0, -34); c.lineTo(-7, -20); c.strokeStyle = '#5d4037'; c.lineWidth = 2; c.stroke(); }
      if (hp < 0.33) { c.beginPath(); c.moveTo(6, -46); c.lineTo(1, -30); c.lineTo(8, -12); c.moveTo(1, -30); c.lineTo(-5, -14); c.stroke(); }
      circ(c, -5, -40, 2.5, '#3e2723'); circ(c, 5, -40, 2.5, '#3e2723');
      c.beginPath(); c.arc(0, -32, 6, 0.3, Math.PI - 0.3); c.strokeStyle = '#3e2723'; c.lineWidth = 2.5; c.stroke();
      c.restore();
    },
    seashroom(c, x, y, t, o) {
      const life = o ? o.lifeFrac : 1;
      c.save(); c.translate(x, y); c.globalAlpha = 0.55 + life * 0.45;
      rr(c, -4, -16, 8, 16, 3, '#b0bec5', OUT, 1.5);
      const puff = 1 + Math.sin(t * 4) * 0.06;
      c.save(); c.translate(0, -18); c.scale(puff, puff);
      circ(c, 0, 0, 10, '#e0f7fa', OUT, 1.5);
      circ(c, -3, -2, 1.5, '#006064'); circ(c, 3, -2, 1.5, '#006064');
      c.restore(); c.restore();
    },
    plantern(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      stem(c, 0, 0, 0, -20, 3);
      const glow = 0.7 + Math.sin(t * 3) * 0.3;
      c.save(); c.globalAlpha = glow * 0.35; circ(c, 0, -30, 22, '#fff9c4', null); c.restore();
      circ(c, 0, -30, 12, '#fff176', OUT, 2);
      circ(c, 0, -30, 7, '#ffffff', null);
      circ(c, -3, -32, 1.5, '#f57f17'); circ(c, 3, -32, 1.5, '#f57f17');
      c.restore();
    },
    cactus(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
      c.save(); c.translate(x + rec, y);
      rr(c, -7, -34, 14, 34, 7, '#4caf50', OUT, 2);
      rr(c, -16, -26, 8, 16, 4, '#4caf50', OUT, 2);
      rr(c, 8, -22, 8, 14, 4, '#4caf50', OUT, 2);
      for (let i = 0; i < 4; i++) poly(c, [[-4 + i * 3, -30], [-2.5 + i * 3, -36], [-1 + i * 3, -30]], '#c5e1a5', null);
      circ(c, 0, -38, 4, '#ec407a', OUT, 1.5);
      c.restore();
    },
    blover(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      stem(c, 0, 0, 0, -18, 3);
      const spin = o && o.attack ? o.attack * 20 : t * 1.5;
      c.save(); c.translate(0, -24); c.rotate(Math.sin(spin) * 0.3);
      for (let i = 0; i < 5; i++) {
        c.save(); c.rotate((i / 5) * Math.PI * 2);
        ell(c, 8, 0, 8, 4, '#4caf50', OUT, 1.5);
        c.restore();
      }
      circ(c, 0, 0, 5, '#ffeb3b', OUT, 1.5);
      c.restore(); c.restore();
    },
    splitpea(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
      c.save(); c.translate(x, y);
      stem(c, 0, 0, 0, -22, 3);
      leaf(c, 0, -10, 13, -0.5, '#558b2f'); leaf(c, 0, -14, 13, 0.6, '#558b2f');
      c.save(); c.translate(rec, -28); c.rotate(Math.sin(t * 2.2) * 0.05);
      circ(c, 0, 0, 11, '#7cb342', OUT);
      rr(c, 6, -5, 10, 10, 4, '#7cb342', OUT);
      circ(c, 15, 0, 3.5, '#33691e', OUT);
      c.restore();
      c.save(); c.translate(-rec, -28); c.rotate(Math.PI - Math.sin(t * 2.2) * 0.05);
      circ(c, 0, 0, 11, '#7cb342', OUT);
      rr(c, -16, -5, 10, 10, 4, '#7cb342', OUT);
      circ(c, -15, 0, 3.5, '#33691e', OUT);
      c.restore();
      c.restore();
    },
    starfruit(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
      c.save(); c.translate(x + rec, y);
      stem(c, 0, 0, 0, -18, 3);
      leaf(c, 0, -8, 13, -0.5, '#f9a825'); leaf(c, 0, -12, 13, 0.6, '#f9a825');
      c.save(); c.translate(0, -26); c.rotate(t * 0.8);
      for (let i = 0; i < 5; i++) {
        c.save(); c.rotate((i / 5) * Math.PI * 2);
        poly(c, [[0, -13], [4, -4], [0, 0], [-4, -4]], '#ffca28', OUT, 1.5);
        c.restore();
      }
      circ(c, 0, 0, 4, '#fff176', OUT, 1);
      c.restore(); c.restore();
    },
    pumpkin(c, x, y, t, o) {
      const hp = o ? o.hpFrac : 1;
      c.save(); c.translate(x, y);
      const sq = 1 + Math.sin(t * 1.5) * 0.02;
      c.save(); c.translate(0, -18); c.scale(1, sq);
      ell(c, 0, 0, 18, 16, '#fb8c00', OUT, 2.5);
      for (let i = -2; i <= 2; i++) {
        c.beginPath(); c.ellipse(i * 7, 0, 3.5, 15, 0, 0, Math.PI * 2);
        c.strokeStyle = '#e65100'; c.lineWidth = 1.5; c.stroke();
      }
      if (hp < 0.66) { c.beginPath(); c.moveTo(-8, -12); c.lineTo(-3, -2); c.lineTo(-9, 8); c.strokeStyle = '#4e342e'; c.lineWidth = 2; c.stroke(); }
      if (hp < 0.33) { c.beginPath(); c.moveTo(8, -10); c.lineTo(3, 0); c.lineTo(10, 10); c.moveTo(3, 0); c.lineTo(-4, 10); c.stroke(); }
      circ(c, -6, -4, 2.5, '#3e2723'); circ(c, 6, -4, 2.5, '#3e2723');
      poly(c, [[-5, 2], [0, 6], [5, 2], [0, -1]], '#3e2723', null);
      c.restore(); c.restore();
    },
    magnetshroom(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      rr(c, -4, -16, 8, 16, 3, '#bcaaa4', OUT, 1.5);
      const pulse = o && o.attack ? Math.sin(o.attack * Math.PI) : 0;
      c.save(); c.translate(0, -20); c.scale(1 + pulse * 0.2, 1 + pulse * 0.2);
      rr(c, -11, -10, 22, 12, 5, '#e53935', OUT, 2);
      rr(c, -11, -10, 22, 5, 2, '#f8f8f8', OUT, 1.5);
      rr(c, -11, 0, 22, 5, 2, '#f8f8f8', OUT, 1.5);
      circ(c, -4, -14, 1.5, '#b71c1c'); circ(c, 4, -14, 1.5, '#b71c1c');
      c.restore(); c.restore();
    },
    cabbagepult(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
      c.save(); c.translate(x + rec, y);
      stem(c, 0, 0, 0, -16, 3);
      leaf(c, -3, -8, 12, -0.5, '#558b2f'); leaf(c, 3, -10, 12, 0.6, '#558b2f');
      c.save(); c.translate(0, -22); c.rotate(-0.3 + (o && o.attack ? -o.attack * 0.5 : 0));
      rr(c, -9, -8, 18, 12, 4, '#7cb342', OUT, 2);
      circ(c, 0, -2, 6, '#aed581', OUT, 1.5);
      c.restore(); c.restore();
    },
    kernelpult(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
      c.save(); c.translate(x + rec, y);
      stem(c, 0, 0, 0, -16, 3);
      leaf(c, -3, -8, 12, -0.5, '#8d6e63'); leaf(c, 3, -10, 12, 0.6, '#8d6e63');
      c.save(); c.translate(0, -22); c.rotate(-0.3 + (o && o.attack ? -o.attack * 0.5 : 0));
      rr(c, -9, -8, 18, 12, 4, '#a1887f', OUT, 2);
      ell(c, 0, -2, 5, 6, '#ffcc80', OUT, 1.5);
      c.restore(); c.restore();
    },
    coffeebean(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      const bob = Math.sin(t * 4) * 2;
      c.save(); c.translate(0, -14 + bob);
      ell(c, 0, 0, 8, 10, '#6d4c41', OUT, 2);
      c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(3, 0, 0, 8);
      c.strokeStyle = '#4e342e'; c.lineWidth = 2; c.stroke();
      c.restore(); c.restore();
    },
    umbrellaleaf(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      stem(c, 0, 0, 0, -14, 3);
      const sw = Math.sin(t * 1.8) * 0.08;
      c.save(); c.translate(0, -20); c.rotate(sw);
      for (let i = 0; i < 6; i++) {
        c.save(); c.rotate((i / 6) * Math.PI * 2);
        c.beginPath(); c.ellipse(10, 0, 10, 5, 0, 0, Math.PI * 2);
        c.fillStyle = i % 2 ? '#ef5350' : '#e53935'; c.fill();
        c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
        c.restore();
      }
      circ(c, 0, 0, 4, '#ffeb3b', OUT, 1.5);
      c.restore(); c.restore();
    },
    marigold(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      const sw = Math.sin(t * 2) * 0.07;
      c.save(); c.translate(0, -16); c.rotate(sw);
      for (let i = 0; i < 8; i++) {
        c.save(); c.rotate((i / 8) * Math.PI * 2);
        ell(c, 8, 0, 7, 4, '#ffb300', OUT, 1);
        c.restore();
      }
      circ(c, 0, 0, 6, '#ff6f00', OUT, 1.5);
      circ(c, -2, -1, 1.2, '#4e342e'); circ(c, 2, -1, 1.2, '#4e342e');
      c.restore(); c.restore();
    },
    melonpult(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
      c.save(); c.translate(x + rec, y);
      stem(c, 0, 0, 0, -16, 3.5);
      leaf(c, -4, -8, 14, -0.5, '#2e7d32'); leaf(c, 4, -10, 14, 0.6, '#2e7d32');
      c.save(); c.translate(0, -24); c.rotate(-0.35 + (o && o.attack ? -o.attack * 0.5 : 0));
      rr(c, -11, -9, 22, 14, 5, '#388e3c', OUT, 2);
      ell(c, 0, -2, 7, 6, '#66bb6a', OUT, 1.5);
      c.restore(); c.restore();
    },
    gatlingpea(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 4 : 0;
      c.save(); c.translate(x + rec, y);
      stem(c, 0, 0, 0, -24);
      leaf(c, 0, -10, 15, -0.5, '#33691e'); leaf(c, 0, -14, 15, 0.6, '#33691e');
      c.save(); c.translate(0, -30); c.rotate(Math.sin(t * 2.6) * 0.05);
      circ(c, 0, 0, 13, '#558b2f', OUT);
      for (let i = 0; i < 4; i++) {
        rr(c, 8, -8 + i * 4.5, 13, 4, 2, '#558b2f', OUT, 1.5);
        circ(c, 20, -6 + i * 4.5, 2, '#1b5e20', OUT, 1);
      }
      circ(c, -3, -4, 2, '#1b5e20'); circ(c, 4, -4, 2, '#1b5e20');
      rr(c, -14, -6, 6, 12, 3, '#33691e', OUT, 1.5);
      c.restore(); c.restore();
    },
    twinsunflower(c, x, y, t, o) {
      const sway = Math.sin(t * 2) * 0.06;
      c.save(); c.translate(x, y); c.rotate(sway);
      stem(c, 0, 0, 0, -26, 3.5);
      leaf(c, 0, -12, 16, -0.6, '#43a047'); leaf(c, 0, -16, 16, 0.7, '#43a047');
      const bob = Math.sin(t * 3) * 1.5;
      for (const dx of [-8, 8]) {
        circ(c, dx, -32 + bob, 10, '#ffb300', OUT, 1.5);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + t * 0.2;
          ell(c, dx + Math.cos(a) * 13, -32 + bob + Math.sin(a) * 13, 4, 6, '#ffca28', null);
        }
        circ(c, dx, -32 + bob, 7.5, '#6d4c41', OUT, 1.5);
        circ(c, dx - 2.5, -34 + bob, 1.3, '#263238'); circ(c, dx + 2.5, -34 + bob, 1.3, '#263238');
      }
      c.restore();
    },
    wintermelon(c, x, y, t, o) {
      const rec = o && o.attack ? Math.max(0, 1 - o.attack * 4) * 3 : 0;
      c.save(); c.translate(x + rec, y);
      stem(c, 0, 0, 0, -16, 3.5);
      leaf(c, -4, -8, 14, -0.5, '#0277bd'); leaf(c, 4, -10, 14, 0.6, '#0277bd');
      c.save(); c.translate(0, -24); c.rotate(-0.35 + (o && o.attack ? -o.attack * 0.5 : 0));
      rr(c, -11, -9, 22, 14, 5, '#0277bd', OUT, 2);
      ell(c, 0, -2, 7, 6, '#4fc3f7', OUT, 1.5);
      for (let i = 0; i < 3; i++) ell(c, -4 + i * 4, -4, 1.5, 3, '#b3e5fc', null);
      c.restore(); c.restore();
    },
    goldmagnet(c, x, y, t, o) {
      c.save(); c.translate(x, y);
      rr(c, -4, -16, 8, 16, 3, '#bcaaa4', OUT, 1.5);
      const pulse = o && o.attack ? Math.sin(o.attack * Math.PI) : 0;
      c.save(); c.translate(0, -20); c.scale(1 + pulse * 0.2, 1 + pulse * 0.2);
      circ(c, 0, 0, 11, '#ffd54f', OUT, 2);
      circ(c, 0, 0, 6, '#ffecb3', null);
      circ(c, -3, -2, 1.5, '#5d4037'); circ(c, 3, -2, 1.5, '#5d4037');
      c.restore(); c.restore();
    },
    imitater(c, x, y, t, o) {
      const ghost = 0.6 + Math.sin(t * 3) * 0.1;
      c.save(); c.globalAlpha = ghost;
      if (o && o.copyDraw) o.copyDraw(c, x, y, t, o);
      c.restore();
      c.save(); c.translate(x, y);
      c.setLineDash([4, 4]);
      c.beginPath(); c.arc(0, -20, 24, 0, Math.PI * 2);
      c.strokeStyle = '#b39ddb'; c.lineWidth = 2; c.stroke();
      c.setLineDash([]);
      c.restore();
    },
  };

  const ZOMBIES = {
    basic(c, x, y, t, o = {}) {
      const walk = Math.sin(t * 6);
      const slow = o.slow ? 0.6 : 1;
      c.save(); c.translate(x, y);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      c.save(); c.scale(slow, 1);
      c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3, -18); c.lineTo(-3 + walk * 4, 0); c.stroke();
      c.beginPath(); c.moveTo(3, -18); c.lineTo(3 - walk * 4, 0); c.stroke();
      rr(c, -8, -38, 16, 22, 4, '#5d4037', OUT);
      rr(c, -7, -37, 14, 8, 3, '#8d6e63', null);
      poly(c, [[-2, -30], [2, -30], [0, -22]], '#c62828', OUT, 1);
      c.save(); c.translate(0, -44); c.rotate(Math.sin(t * 6) * 0.06);
      circ(c, 0, 0, 9, '#9e9d6e', OUT);
      circ(c, -3, -1, 1.5, '#1b1b1b'); circ(c, 3, -1, 1.5, '#1b1b1b');
      c.beginPath(); c.arc(0, 3, 3, 0.3, Math.PI - 0.3); c.strokeStyle = '#1b1b1b'; c.lineWidth = 1.5; c.stroke();
      if (o.eat) { const ch = Math.abs(Math.sin(t * 8)) * 3; c.beginPath(); c.arc(0, 4 + ch, 3.5, 0, Math.PI * 2); c.fillStyle = '#3e2723'; c.fill(); }
      c.restore();
      c.save(); c.rotate(walk * 0.15);
      rr(c, -16, -36, 8, 16, 3, '#5d4037', OUT);
      circ(c, -12, -20, 3.5, '#9e9d6e', OUT, 1.5);
      c.restore();
      c.save(); c.rotate(-walk * 0.15);
      rr(c, 8, -36, 8, 16, 3, '#5d4037', OUT);
      circ(c, 12, -20, 3.5, '#9e9d6e', OUT, 1.5);
      c.restore();
      c.restore();
      if (o.slow) { c.globalAlpha = 0.35; circ(c, 0, -24, 22, '#4fc3f7', null); c.globalAlpha = 1; }
      c.restore();
    },
    conehead(c, x, y, t, o = {}) {
      ZOMBIES.basic(c, x, y, t, o);
      if (o.armor > 0) {
        c.save(); c.translate(x, y);
        const wob = Math.sin(t * 6) * 0.05;
        c.save(); c.translate(0, -50); c.rotate(wob);
        poly(c, [[-9, 0], [9, 0], [0, -16]], '#fb8c00', OUT, 2);
        rr(c, -9, -3, 18, 4, 2, '#ff6f00', OUT, 1.5);
        c.restore(); c.restore();
      }
    },
    buckethead(c, x, y, t, o = {}) {
      ZOMBIES.basic(c, x, y, t, o);
      if (o.armor > 0) {
        c.save(); c.translate(x, y);
        const wob = Math.sin(t * 6) * 0.05;
        c.save(); c.translate(0, -50); c.rotate(wob);
        rr(c, -8, -16, 16, 16, 3, '#90a4ae', OUT, 2);
        rr(c, -8, -16, 16, 5, 2, '#cfd8dc', null);
        if (o.armor < 0.5) { c.beginPath(); c.moveTo(-4, -12); c.lineTo(2, -4); c.lineTo(-3, 0); c.strokeStyle = '#546e7a'; c.lineWidth = 1.5; c.stroke(); }
        c.restore(); c.restore();
      }
    },
    flag(c, x, y, t, o = {}) {
      ZOMBIES.basic(c, x, y, t, o);
      c.save(); c.translate(x, y);
      c.save(); c.translate(10, -20); c.rotate(Math.sin(t * 5) * 0.1);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -44); c.strokeStyle = '#6d4c41'; c.lineWidth = 3; c.stroke();
      poly(c, [[0, -44], [22, -38], [0, -30]], '#c62828', OUT, 1.5);
      circ(c, 12, -37, 4, '#f5c6b8', OUT, 1);
      c.restore(); c.restore();
    },
    polevault(c, x, y, t, o = {}) {
      ZOMBIES.basic(c, x, y, t, o);
      if (o.armor > 0) {
        c.save(); c.translate(x, y);
        c.save(); c.translate(0, -26); c.rotate(o.vault ? -0.9 : 0.5);
        c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.strokeStyle = '#8d6e63'; c.lineWidth = 3; c.stroke();
        c.restore(); c.restore();
      }
    },
    football(c, x, y, t, o = {}) {
      const run = Math.sin(t * 10);
      c.save(); c.translate(x, y);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3, -18); c.lineTo(-3 + run * 5, 0); c.stroke();
      c.beginPath(); c.moveTo(3, -18); c.lineTo(3 - run * 5, 0); c.stroke();
      rr(c, -9, -40, 18, 24, 5, '#b71c1c', OUT);
      rr(c, -9, -40, 18, 10, 4, '#d32f2f', null);
      c.save(); c.translate(0, -46);
      circ(c, 0, 0, 10, '#9e9d6e', OUT);
      if (o.armor > 0) {
        circ(c, 0, -3, 11, '#c62828', OUT, 2);
        rr(c, -11, -5, 22, 5, 2, '#8e0000', OUT, 1.5);
        if (o.armor < 0.5) { c.beginPath(); c.moveTo(-6, -10); c.lineTo(0, -3); c.lineTo(-5, 0); c.strokeStyle = '#5d0000'; c.lineWidth = 1.5; c.stroke(); }
      }
      circ(c, -3, -1, 1.5, '#1b1b1b'); circ(c, 3, -1, 1.5, '#1b1b1b');
      c.restore();
      c.save(); c.rotate(run * 0.2); rr(c, -18, -38, 9, 18, 3, '#b71c1c', OUT); circ(c, -13, -20, 4, '#9e9d6e', OUT, 1.5); c.restore();
      c.save(); c.rotate(-run * 0.2); rr(c, 9, -38, 9, 18, 3, '#b71c1c', OUT); circ(c, 13, -20, 4, '#9e9d6e', OUT, 1.5); c.restore();
      c.restore();
    },
    dancing(c, x, y, t, o = {}) {
      const d = Math.sin(t * 5);
      c.save(); c.translate(x, y); c.rotate(d * 0.12);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3, -18); c.lineTo(-3 + d * 5, 0); c.stroke();
      c.beginPath(); c.moveTo(3, -18); c.lineTo(3 - d * 5, 0); c.stroke();
      rr(c, -9, -40, 18, 24, 5, '#6a1b9a', OUT);
      poly(c, [[-2, -32], [2, -32], [0, -24]], '#ffee58', OUT, 1);
      c.save(); c.translate(0, -47); c.rotate(d * 0.15);
      circ(c, 0, 0, 10, '#9e9d6e', OUT);
      circ(c, -3, -1, 1.5, '#1b1b1b'); circ(c, 3, -1, 1.5, '#1b1b1b');
      c.beginPath(); c.arc(0, 3, 3.5, 0.3, Math.PI - 0.3); c.strokeStyle = '#1b1b1b'; c.lineWidth = 1.5; c.stroke();
      for (let i = -1; i <= 1; i += 2) { c.save(); c.translate(i * 8, -8); c.rotate(d * i * 0.4); circ(c, 0, 0, 3, '#e040fb', OUT, 1); c.restore(); }
      c.restore();
      c.save(); c.translate(-14, -34); c.rotate(d * 0.5); rr(c, -4, -4, 8, 16, 3, '#6a1b9a', OUT); circ(c, 0, 14, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
      c.save(); c.translate(14, -34); c.rotate(-d * 0.5); rr(c, -4, -4, 8, 16, 3, '#6a1b9a', OUT); circ(c, 0, 14, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
      c.restore();
    },
    backupdancer(c, x, y, t, o = {}) {
      const d = Math.sin(t * 5 + 2);
      c.save(); c.translate(x, y); c.rotate(d * 0.12);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3, -18); c.lineTo(-3 + d * 5, 0); c.stroke();
      c.beginPath(); c.moveTo(3, -18); c.lineTo(3 - d * 5, 0); c.stroke();
      rr(c, -8, -38, 16, 22, 4, '#8e24aa', OUT);
      c.save(); c.translate(0, -44); c.rotate(d * 0.15);
      circ(c, 0, 0, 9, '#9e9d6e', OUT);
      circ(c, -3, -1, 1.5, '#1b1b1b'); circ(c, 3, -1, 1.5, '#1b1b1b');
      c.restore();
      c.save(); c.translate(-13, -32); c.rotate(d * 0.5); rr(c, -4, -4, 8, 15, 3, '#8e24aa', OUT); circ(c, 0, 13, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
      c.save(); c.translate(13, -32); c.rotate(-d * 0.5); rr(c, -4, -4, 8, 15, 3, '#8e24aa', OUT); circ(c, 0, 13, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
      c.restore();
    },
    balloon(c, x, y, t, o = {}) {
      const bob = Math.sin(t * 2.5) * 4;
      c.save(); c.translate(x, y - 34 + bob);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      c.beginPath(); c.moveTo(0, 10); c.lineTo(0, 26); c.strokeStyle = '#5d4037'; c.lineWidth = 2; c.stroke();
      circ(c, 0, 0, 14, o.armor > 0 ? '#e53935' : '#9e9d6e', OUT, 2);
      poly(c, [[-4, 12], [4, 12], [0, 17]], '#b71c1c', OUT, 1);
      if (o.armor > 0) { circ(c, -4, -3, 1.5, '#1b1b1b'); circ(c, 4, -3, 1.5, '#1b1b1b'); c.beginPath(); c.arc(0, 1, 3, 0.3, Math.PI - 0.3); c.strokeStyle = '#1b1b1b'; c.lineWidth = 1.5; c.stroke(); }
      else {
        c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
        const walk = Math.sin(t * 6);
        c.beginPath(); c.moveTo(-3, 14); c.lineTo(-3 + walk * 3, 26); c.stroke();
        c.beginPath(); c.moveTo(3, 14); c.lineTo(3 - walk * 3, 26); c.stroke();
        rr(c, -7, 14, 14, 10, 3, '#5d4037', OUT);
        circ(c, -3, 18, 1.5, '#1b1b1b'); circ(c, 3, 18, 1.5, '#1b1b1b');
      }
      c.restore();
    },
    screendoor(c, x, y, t, o = {}) {
      ZOMBIES.basic(c, x, y, t, o);
      if (o.armor > 0) {
        c.save(); c.translate(x, y);
        c.save(); c.translate(14, -26); c.rotate(Math.sin(t * 6) * 0.08);
        rr(c, -4, -16, 8, 32, 2, '#a1887f', OUT, 2);
        for (let i = 0; i < 3; i++) rr(c, -2, -12 + i * 10, 4, 6, 1, '#d7ccc8', OUT, 1);
        c.restore(); c.restore();
      }
    },
    gargantuar(c, x, y, t, o = {}) {
      const walk = Math.sin(t * 4);
      c.save(); c.translate(x, y);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      c.strokeStyle = OUT; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-6, -30); c.lineTo(-6 + walk * 5, 0); c.stroke();
      c.beginPath(); c.moveTo(6, -30); c.lineTo(6 - walk * 5, 0); c.stroke();
      rr(c, -16, -62, 32, 34, 6, '#4e342e', OUT);
      rr(c, -14, -60, 28, 12, 4, '#6d4c41', null);
      c.save(); c.translate(0, -74); c.rotate(Math.sin(t * 4) * 0.05);
      circ(c, 0, 0, 15, '#8d8b5e', OUT);
      circ(c, -5, -2, 2.5, '#1b1b1b'); circ(c, 5, -2, 2.5, '#1b1b1b');
      c.beginPath(); c.moveTo(-5, 6); c.lineTo(5, 6); c.strokeStyle = '#1b1b1b'; c.lineWidth = 2; c.stroke();
      c.restore();
      c.save(); c.rotate(walk * 0.12);
      rr(c, -30, -58, 14, 30, 5, '#4e342e', OUT);
      circ(c, -23, -28, 7, '#8d8b5e', OUT, 2);
      c.restore();
      c.save(); c.rotate(-walk * 0.12);
      rr(c, 16, -58, 14, 30, 5, '#4e342e', OUT);
      circ(c, 23, -28, 7, '#8d8b5e', OUT, 2);
      c.restore();
      c.restore();
    },
    imp(c, x, y, t, o = {}) {
      const walk = Math.sin(t * 8);
      c.save(); c.translate(x, y);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      c.strokeStyle = OUT; c.lineWidth = 1.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-2, -10); c.lineTo(-2 + walk * 3, 0); c.stroke();
      c.beginPath(); c.moveTo(2, -10); c.lineTo(2 - walk * 3, 0); c.stroke();
      rr(c, -5, -20, 10, 11, 3, '#5d4037', OUT);
      circ(c, 0, -24, 6, '#9e9d6e', OUT);
      circ(c, -2, -25, 1.2, '#1b1b1b'); circ(c, 2, -25, 1.2, '#1b1b1b');
      c.restore();
    },
    bungee(c, x, y, t, o = {}) {
      c.save(); c.translate(x, y);
      const sway = Math.sin(t * 2) * 0.1;
      c.save(); c.translate(0, -70); c.rotate(sway);
      c.beginPath(); c.moveTo(0, -30); c.lineTo(0, 0); c.strokeStyle = '#8d6e63'; c.lineWidth = 2.5; c.stroke();
      circ(c, 0, 6, 9, '#9e9d6e', OUT);
      circ(c, -3, 5, 1.5, '#1b1b1b'); circ(c, 3, 5, 1.5, '#1b1b1b');
      rr(c, -7, 10, 14, 12, 3, '#37474f', OUT);
      circ(c, -8, 16, 3, '#9e9d6e', OUT, 1.5); circ(c, 8, 16, 3, '#9e9d6e', OUT, 1.5);
      c.restore(); c.restore();
    },
    catapult(c, x, y, t, o = {}) {
      c.save(); c.translate(x, y);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      const rock = o.attack || 0;
      rr(c, -20, -22, 40, 18, 4, '#5d4037', OUT, 2);
      circ(c, -12, -2, 6, '#3e2723', OUT, 2); circ(c, 12, -2, 6, '#3e2723', OUT, 2);
      c.save(); c.translate(0, -26); c.rotate(-rock * 0.8);
      rr(c, -3, -22, 6, 24, 2, '#8d6e63', OUT, 1.5);
      circ(c, 0, -24, 8, '#9e9d6e', OUT);
      circ(c, -2.5, -25, 1.5, '#1b1b1b'); circ(c, 2.5, -25, 1.5, '#1b1b1b');
      if (rock > 0.3) circ(c, 0, -34, 6, '#e53935', OUT, 1.5);
      c.restore();
      c.restore();
    },
    yeti(c, x, y, t, o = {}) {
      ZOMBIES.basic(c, x, y, t, o);
      c.save(); c.translate(x, y);
      rr(c, -9, -40, 18, 24, 5, '#eceff1', OUT);
      c.restore();
    },
    snorkel(c, x, y, t, o = {}) {
      c.save(); c.translate(x, y);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      const swim = o.swim;
      c.globalAlpha *= swim ? 0.85 : 1;
      c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
      const walk = Math.sin(t * 6);
      if (!swim) {
        c.beginPath(); c.moveTo(-3, -18); c.lineTo(-3 + walk * 4, 0); c.stroke();
        c.beginPath(); c.moveTo(3, -18); c.lineTo(3 - walk * 4, 0); c.stroke();
      }
      rr(c, -8, -38, 16, 22, 4, '#00695c', OUT);
      c.save(); c.translate(0, -44);
      circ(c, 0, 0, 9, '#9e9d6e', OUT);
      circ(c, -3, -1, 1.5, '#1b1b1b'); circ(c, 3, -1, 1.5, '#1b1b1b');
      rr(c, 4, -2, 10, 5, 2, '#f9a825', OUT, 1.5);
      circ(c, 13, 0.5, 2.5, '#f9a825', OUT, 1);
      c.restore();
      if (!swim) {
        c.save(); c.rotate(walk * 0.15); rr(c, -16, -36, 8, 16, 3, '#00695c', OUT); circ(c, -12, -20, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
        c.save(); c.rotate(-walk * 0.15); rr(c, 8, -36, 8, 16, 3, '#00695c', OUT); circ(c, 12, -20, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
      }
      c.restore();
    },
    zomboni(c, x, y, t, o = {}) {
      c.save(); c.translate(x, y);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      rr(c, -22, -26, 44, 20, 5, '#78909c', OUT, 2);
      rr(c, -18, -34, 20, 10, 3, '#b0bec5', OUT, 1.5);
      circ(c, -14, -2, 7, '#37474f', OUT, 2); circ(c, 14, -2, 7, '#37474f', OUT, 2);
      c.save(); c.translate(12, -30);
      circ(c, 0, 0, 8, '#9e9d6e', OUT);
      circ(c, -2.5, -1, 1.5, '#1b1b1b'); circ(c, 2.5, -1, 1.5, '#1b1b1b');
      rr(c, -6, 4, 12, 8, 2, '#5d4037', OUT, 1.5);
      c.restore();
      c.restore();
    },
    dolphinrider(c, x, y, t, o = {}) {
      const jump = o.jumpT !== undefined && o.jumpT >= 0 ? Math.sin(Math.min(1, o.jumpT) * Math.PI) : 0;
      c.save(); c.translate(x, y - jump * 30);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      c.save(); c.translate(0, 6); c.rotate(-0.3 + jump * 0.5);
      ell(c, 0, 0, 18, 8, '#4fc3f7', OUT, 2);
      poly(c, [[-16, 0], [-24, -6], [-22, 2]], '#4fc3f7', OUT, 1.5);
      poly(c, [[2, -8], [8, -14], [10, -6]], '#4fc3f7', OUT, 1.5);
      circ(c, 12, -2, 1.5, '#01579b');
      c.restore();
      if (o.armor > 0) {
        c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
        const walk = Math.sin(t * 7);
        c.beginPath(); c.moveTo(-3, -14); c.lineTo(-3 + walk * 4, 4); c.stroke();
        c.beginPath(); c.moveTo(3, -14); c.lineTo(3 - walk * 4, 4); c.stroke();
        rr(c, -8, -34, 16, 22, 4, '#00695c', OUT);
        c.save(); c.translate(0, -40);
        circ(c, 0, 0, 9, '#9e9d6e', OUT);
        circ(c, -3, -1, 1.5, '#1b1b1b'); circ(c, 3, -1, 1.5, '#1b1b1b');
        rr(c, 4, -2, 10, 5, 2, '#f9a825', OUT, 1.5);
        c.restore();
        c.save(); c.rotate(walk * 0.15); rr(c, -16, -32, 8, 16, 3, '#00695c', OUT); circ(c, -12, -16, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
        c.save(); c.rotate(-walk * 0.15); rr(c, 8, -32, 8, 16, 3, '#00695c', OUT); circ(c, 12, -16, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
      }
      c.restore();
    },
    jackinthebox(c, x, y, t, o = {}) {
      ZOMBIES.basic(c, x, y, t, o);
      c.save(); c.translate(x, y);
      const shake = Math.abs(Math.sin(t * 12)) * 2;
      c.save(); c.translate(12, -34 - shake);
      rr(c, -8, -10, 16, 14, 2, '#8e24aa', OUT, 2);
      circ(c, 0, -12, 3, '#ffeb3b', OUT, 1);
      c.save(); c.translate(0, -14); c.rotate(Math.sin(t * 12) * 0.8);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -8); c.strokeStyle = '#6d4c41'; c.lineWidth = 1.5; c.stroke();
      circ(c, 0, -10, 3.5, '#ffeb3b', OUT, 1);
      c.restore(); c.restore(); c.restore();
    },
    pogo(c, x, y, t, o = {}) {
      const bounce = o.jumpT !== undefined && o.jumpT >= 0 ? Math.abs(Math.sin(o.jumpT * Math.PI * 2)) : Math.abs(Math.sin(t * 4));
      c.save(); c.translate(x, y - bounce * 14);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3, -18); c.lineTo(-4, 0); c.stroke();
      c.beginPath(); c.moveTo(3, -18); c.lineTo(4, 0); c.stroke();
      rr(c, -8, -38, 16, 22, 4, '#f9a825', OUT);
      c.save(); c.translate(0, -44);
      circ(c, 0, 0, 9, '#9e9d6e', OUT);
      circ(c, -3, -1, 1.5, '#1b1b1b'); circ(c, 3, -1, 1.5, '#1b1b1b');
      c.restore();
      if (o.armor > 0) {
        c.beginPath(); c.moveTo(-4, 0); c.lineTo(-6, 14); c.strokeStyle = '#8d6e63'; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.moveTo(4, 0); c.lineTo(6, 14); c.stroke();
        rr(c, -8, 12, 16, 4, 2, '#5d4037', OUT, 1.5);
      }
      c.restore();
    },
    digger(c, x, y, t, o = {}) {
      c.save(); c.translate(x, y);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      if (o.underground) {
        c.globalAlpha *= 0.9;
        ell(c, 0, -2, 16, 5, '#4e342e', OUT, 1.5);
        c.save(); c.translate(0, -8); c.rotate(t * 3);
        for (let i = 0; i < 3; i++) {
          c.save(); c.rotate((i / 3) * Math.PI * 2);
          poly(c, [[0, 0], [10, -3], [10, 3]], '#90a4ae', OUT, 1);
          c.restore();
        }
        c.restore();
      } else {
        const walk = Math.sin(t * 7);
        c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-3, -18); c.lineTo(-3 + walk * 4, 0); c.stroke();
        c.beginPath(); c.moveTo(3, -18); c.lineTo(3 - walk * 4, 0); c.stroke();
        rr(c, -8, -38, 16, 22, 4, '#6d4c41', OUT);
        c.save(); c.translate(0, -44);
        circ(c, 0, 0, 9, '#9e9d6e', OUT);
        circ(c, -3, -1, 1.5, '#1b1b1b'); circ(c, 3, -1, 1.5, '#1b1b1b');
        rr(c, -8, -10, 16, 6, 3, '#37474f', OUT, 1.5);
        c.restore();
        c.save(); c.rotate(walk * 0.15); rr(c, -16, -36, 8, 16, 3, '#6d4c41', OUT); circ(c, -12, -20, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
        c.save(); c.rotate(-walk * 0.15); rr(c, 8, -36, 8, 16, 3, '#6d4c41', OUT); circ(c, 12, -20, 3.5, '#9e9d6e', OUT, 1.5); c.restore();
      }
      c.restore();
    },
    bobsled(c, x, y, t, o = {}) {
      c.save(); c.translate(x, y);
      if (o.fall > 0) { c.rotate(o.fall * 1.5); c.globalAlpha = 1 - o.fall; }
      rr(c, -24, -14, 48, 10, 4, '#c62828', OUT, 2);
      poly(c, [[-24, -14], [-30, -20], [-22, -20]], '#c62828', OUT, 1.5);
      for (let i = 0; i < 4; i++) {
        c.save(); c.translate(-18 + i * 12, -16 - (i % 2) * 2);
        circ(c, 0, 0, 6, '#9e9d6e', OUT, 1.5);
        circ(c, -2, -1, 1.2, '#1b1b1b'); circ(c, 2, -1, 1.2, '#1b1b1b');
        rr(c, -5, 4, 10, 8, 2, '#5d4037', OUT, 1.5);
        c.restore();
      }
      c.restore();
    },
  };

  function drawPlant(id, c, x, y, t, o) {
    const fn = PLANTS[id];
    if (fn) fn(c, x, y, t, o || {});
  }
  function drawZombie(id, c, x, y, t, o) {
    const fn = ZOMBIES[id];
    if (fn) fn(c, x, y, t, o || {});
  }

  return { PLANTS, ZOMBIES, drawPlant, drawZombie, ell, circ, rr, poly, leaf, stem, OUT };

})();
