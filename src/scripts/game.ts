import { members, levelMsgs, levelThresholds, MAX_LEVEL, groupImg } from '../data/members';
import { icon, replayIcons } from '../data/icons';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('gameCanvas');
let ctx = canvas.getContext('2d')!;
ctx.imageSmoothingQuality = 'high';
const wrapper = $('game-wrapper');
const flash = $('damage-flash');

const screens = { pause: $('pause-screen'), start: $('start-screen'), over: $('game-over-screen'), level: $('level-up-screen'), hud: $('ui-hud') };
const panels = { level: $('level-up-panel'), over: $('game-over-panel') };
const hud = {
  score: $('hud-score'), scoreBox: $('score-container'), lives: $('hud-lives'), livesBox: $('lives-container'),
  level: $('hud-level'), combo: $('hud-combo'), comboBox: $('combo-container'), progress: $('hud-progress'),
};
const modal = { title: $('modal-title'), quote: $('modal-quote'), who: $('modal-who'), img: $<HTMLImageElement>('modal-img'), message: $('modal-message'), caption: $('modal-polaroid-text') };
const continueBtn = $<HTMLButtonElement>('continue-btn');
const muteBtn = $<HTMLButtonElement>('mute-btn');
const pauseBtn = $<HTMLButtonElement>('pause-btn');
const polaroid = $('modal-polaroid');
const credit = $('modal-credit');

/* ---------- Assets ---------- */
const faceImgs = members.map((m) => {
  const img = new Image();
  img.src = m.img;
  return img;
});
new Image().src = groupImg;
Object.values(levelMsgs).forEach((m) => { new Image().src = m.img; });

/* ---------- Persistence ---------- */
const BEST_KEY = 'armyBombRush.best';
const readBest = () => {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
};
const saveBest = (n: number) => {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
};
let best = readBest();
$('best-start').textContent = String(best);

/* ---------- Audio (tiny WebAudio blips) ---------- */
let audio: AudioContext | null = null;
let muted = false;
function blip(freq: number, dur = 0.12, type: OscillatorType = 'sine', slideTo?: number, vol = 0.12) {
  if (muted) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, audio.currentTime + dur);
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + dur);
  } catch { /* audio unavailable */ }
}
const sfx = {
  catch: (combo: number) => blip(520 + Math.min(combo, 12) * 40, 0.12, 'triangle', 900 + combo * 30),
  heart: () => { blip(660, 0.1, 'triangle', 1100); setTimeout(() => blip(990, 0.15, 'triangle', 1400), 80); },
  hurt: () => blip(220, 0.3, 'sawtooth', 70, 0.15),
  level: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle'), i * 110)),
  over: () => [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sawtooth', undefined, 0.1), i * 160)),
};
muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.innerHTML = icon(muted ? 'volume-off' : 'volume-on');
});

/* ---------- State ---------- */
let playing = false;
let paused = false; // level screen
let userPaused = false; // pause button
let score = 0;
let lives = 3;
let level = 1;
let combo = 0;
let frames = 0; // game time in 60fps frame units (float)
let last = 0;
let dt = 1; // elapsed frames since last tick, keeps motion identical on 60/120/144Hz screens
let spawnTimer = 0;
let dpr = 1;
let raf = 0;
let items: Item[] = [];
let texts: FloatingText[] = [];
let particles: Particle[] = [];

const W = () => canvas.clientWidth;
const H = () => canvas.clientHeight;

/* Background twinkling stars / mini hearts */
interface Star { x: number; y: number; r: number; s: number; t: number }
let stars: Star[] = [];
function makeStars() {
  stars = Array.from({ length: 45 }, () => ({
    x: Math.random() * W(), y: Math.random() * H(), r: 1 + Math.random() * 2.2, s: 0.2 + Math.random() * 0.6, t: Math.random() * 6.28,
  }));
}

/* ---------- Player (ARMY Bomb) ---------- */
const player = { x: 0, y: 0, r: 34, targetX: 0 };

/** Light color shifts with the combo multiplier, like the real lightstick. */
const bombColors = ['#a855f7', '#f472b6', '#fbbf24'];

function poly(points: [number, number][], x: number, y: number, s: number) {
  ctx.beginPath();
  points.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * s, y + py * s) : ctx.moveTo(x + px * s, y + py * s)));
  ctx.closePath();
}

/** ARMY Bomb: glass sphere with the BTS logo, black handle, red buttons and keyring. */
function paintBomb(x: number, y: number, r: number, color: string, pulse = 1) {
  const hw = r * 0.34; // handle half-width
  const handleTop = y + r * 0.85;
  const handleBottom = y + r * 3;

  ctx.save();

  // keyring
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x - hw * 0.4, handleBottom + r * 0.28, r * 0.28, 0, Math.PI * 2);
  ctx.stroke();

  // handle (black matte cylinder)
  const hg = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
  hg.addColorStop(0, '#0a0a0a');
  hg.addColorStop(0.35, '#3a3a3f');
  hg.addColorStop(1, '#050505');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.roundRect(x - hw, handleTop, hw * 2, handleBottom - handleTop, [4, 4, 10, 10]);
  ctx.fill();

  // red side button
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(x - hw - 2, handleTop + r * 0.35, 5, r * 0.3, 2);
  ctx.fill();

  // collar under the sphere
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.roundRect(x - hw * 1.25, y + r * 0.72, hw * 2.5, r * 0.28, 5);
  ctx.fill();

  // inner light
  ctx.shadowColor = color;
  ctx.shadowBlur = 34 * pulse;
  const glow = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  glow.addColorStop(0, color + 'cc');
  glow.addColorStop(0.7, color + '55');
  glow.addColorStop(1, color + '22');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // BTS logo: two trapezoids facing each other
  const s = r * 0.62;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 8;
  poly([[-0.62, -0.55], [-0.08, -0.82], [-0.08, 0.5], [-0.62, 0.78]], x, y, s);
  ctx.fill();
  ctx.fillStyle = '#e5e7eb';
  poly([[0.62, -0.78], [0.08, -0.5], [0.08, 0.82], [0.62, 0.52]], x, y, s);
  ctx.fill();
  ctx.shadowBlur = 0;

  // glass shell: rim, highlights
  ctx.strokeStyle = 'rgba(255,255,255,.65)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.45, y - r * 0.55, r * 0.22, r * 0.1, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.45, y + r * 0.45, r * 0.3, r * 0.12, -0.7, 0, Math.PI * 2);
  ctx.fill();

  // red cap button on the shell (top right)
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.66, y - r * 0.78, r * 0.28, r * 0.17, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.66, y - r * 0.8, r * 0.17, r * 0.09, 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Pre-rendered once per color; per-frame cost is a single drawImage plus a soft pulse. */
function drawBomb(x: number, y: number, r: number) {
  const color = bombColors[multiplier() - 1];
  const sp = (bombSprites[color] ??= makeSprite(-r - 50, -r - 50, r + 50, r * 3.7 + 50, () => paintBomb(0, 0, r, color)));
  blit(sp, x, y);
  const pulse = 0.18 + Math.abs(Math.sin(frames * 0.07)) * 0.2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pulse;
  const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.7);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function heartPath(cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.7, cy - s * 1.1, cx, cy - s * 0.4);
  ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
}

/* ---------- Sprite cache ---------- */
interface Sprite { cv: HTMLCanvasElement; w: number; h: number; ox: number; oy: number }
let bombSprites: Record<string, Sprite> = {};
let faceSprites: (Sprite | undefined)[] = [];
let heartSprite: Sprite | undefined;
let brokenSprite: Sprite | undefined;

/** Renders draw() once into an offscreen canvas covering [x0,x1]x[y0,y1] (css px, origin-relative). */
function makeSprite(x0: number, y0: number, x1: number, y1: number, draw: () => void): Sprite {
  const w = x1 - x0;
  const h = y1 - y0;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * dpr);
  cv.height = Math.ceil(h * dpr);
  const c = cv.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
  const prev = ctx;
  ctx = c;
  try { draw(); } finally { ctx = prev; }
  return { cv, w, h, ox: x0, oy: y0 };
}
const blit = (s: Sprite, x = 0, y = 0) => ctx.drawImage(s.cv, x + s.ox, y + s.oy, s.w, s.h);
const clearSprites = () => { bombSprites = {}; faceSprites = []; heartSprite = undefined; brokenSprite = undefined; };

const ITEM_R = 30;
function faceSprite(i: number): Sprite | undefined {
  if (faceSprites[i]) return faceSprites[i];
  const img = faceImgs[i];
  if (!img.complete || !img.naturalWidth) return undefined;
  const r = ITEM_R;
  return (faceSprites[i] = makeSprite(-r - 26, -r - 26, r + 26, r + 26, () => {
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#4c1d95';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.clip();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) * members[i].fy;
    ctx.drawImage(img, sx, sy, side, side, -r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#e9d5ff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }));
}
function getHeartSprite(): Sprite {
  return (heartSprite ??= makeSprite(-44, -44, 44, 44, () => {
    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#a855f7';
    heartPath(0, 0, 24);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.ellipse(-9, -10, 6, 3.5, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }));
}
function getBrokenSprite(): Sprite {
  return (brokenSprite ??= makeSprite(-44, -44, 44, 44, () => {
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 16;
    ctx.fillText('💔', 0, 0);
  }));
}

/* ---------- Entities ---------- */
class FloatingText {
  life = 1;
  constructor(public x: number, public y: number, public text: string, public color: string, public size = 28) {}
  update() { this.y -= 2.2 * dt; this.life -= 0.025 * dt; }
  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.font = `900 ${this.size}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(30,0,70,.7)';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class Particle {
  life = 1;
  vx: number;
  vy: number;
  constructor(public x: number, public y: number, public color: string, public heart = false) {
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 5;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp - 1.5;
  }
  update() { this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 0.15 * dt; this.life -= 0.03 * dt; }
  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    if (this.heart) { heartPath(this.x, this.y, 6 * this.life + 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(this.x, this.y, 3 * this.life + 1, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}

type ItemKind = 'member' | 'heart' | 'broken';

class Item {
  kind: ItemKind;
  r = ITEM_R;
  x: number;
  y = -40;
  speed: number;
  wobble = 0.02 + Math.random() * 0.04;
  amp = (1 + Math.random() * 2.5) * (1 + (level - 1) * 0.12);
  baseX: number;
  member = 0;

  constructor() {
    this.baseX = this.x = Math.random() * (W() - this.r * 3) + this.r * 1.5;
    const rand = Math.random();
    const brokenChance = Math.min(0.28 + (level - 1) * 0.02, 0.4);
    if (rand < brokenChance) this.kind = 'broken';
    else if (rand < brokenChance + 0.13) this.kind = 'heart';
    else {
      this.kind = 'member';
      this.member = Math.floor(Math.random() * members.length);
    }
    this.speed = (4 + Math.random() * 2.6) * (1 + (level - 1) * 0.3);
  }

  get points() { return this.kind === 'heart' ? 20 : this.kind === 'member' ? 10 : 0; }

  update() {
    this.y += this.speed * dt;
    this.x = this.baseX + Math.sin(frames * this.wobble) * this.amp * 8;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.kind === 'member') {
      ctx.rotate(Math.sin(frames * 0.05 + this.baseX) * 0.12);
      const sp = faceSprite(this.member);
      if (sp) blit(sp);
      else {
        ctx.fillStyle = '#4c1d95';
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.kind === 'heart') {
      const beat = 1 + Math.sin(frames * 0.2) * 0.12;
      ctx.scale(beat, beat);
      blit(getHeartSprite());
    } else {
      ctx.rotate(Math.sin(frames * 0.15 + this.baseX) * 0.25);
      blit(getBrokenSprite());
    }
    ctx.restore();
  }
}

/* ---------- Sizing & input ---------- */
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  clearSprites();
  canvas.width = W() * dpr;
  canvas.height = H() * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  player.y = H() - player.r * 3.6 - 12;
  if (!player.x || player.x > W()) player.x = player.targetX = W() / 2;
  makeStars();
}
window.addEventListener('resize', resize);

function moveTo(x: number) {
  if (!playing || paused || userPaused) return;
  player.targetX = Math.max(player.r, Math.min(W() - player.r, x));
}
canvas.addEventListener('pointermove', (e) => moveTo(e.clientX));
canvas.addEventListener('pointerdown', (e) => moveTo(e.clientX));
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveTo(e.touches[0].clientX); }, { passive: false });

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

/* ---------- HUD / effects ---------- */
const bump = (el: HTMLElement) => {
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 150);
};

function levelProgress() {
  const prev = level === 1 ? 0 : levelThresholds[level - 2];
  const next = levelThresholds[level - 1] ?? prev;
  return Math.max(0, Math.min(1, (score - prev) / (next - prev || 1)));
}

function multiplier() { return 1 + Math.min(Math.floor(combo / 8), 2); }

let renderedLives = -1;
function updateHud() {
  hud.score.textContent = String(score);
  hud.level.textContent = String(level);
  if (renderedLives !== lives) {
    renderedLives = lives;
    hud.lives.innerHTML = [0, 1, 2].map((i) => icon('heart', i < lives ? '' : 'lost')).join('');
  }
  hud.combo.textContent = `x${multiplier()}`;
  hud.comboBox.classList.toggle('hot', multiplier() > 1);
  hud.progress.style.width = `${levelProgress() * 100}%`;
}

function damageEffect() {
  wrapper.classList.remove('shake-active');
  void wrapper.offsetWidth;
  wrapper.classList.add('shake-active');
  flash.classList.add('flash-active');
  setTimeout(() => flash.classList.remove('flash-active'), 100);
  bump(hud.livesBox);
}

function burst(x: number, y: number, color: string, n = 14, heart = false) {
  for (let i = 0; i < n; i++) particles.push(new Particle(x, y, color, heart && i % 2 === 0));
}

/* ---------- Game flow ---------- */
function showPopIn(panel: HTMLElement) {
  panel.classList.remove('pop-in');
  void panel.offsetWidth;
  panel.classList.add('pop-in');
  replayIcons(panel);
}

function levelUp(newLevel: number) {
  paused = true;
  level = newLevel;
  updateHud();
  sfx.level();
  const data = levelMsgs[Math.min(newLevel, MAX_LEVEL)];
  modal.title.textContent = data.title;
  modal.quote.textContent = data.quote;
  modal.who.textContent = data.who;
  modal.caption.textContent = data.caption;
  modal.message.textContent = data.message;
  modal.img.src = data.img;
  continueBtn.innerHTML = newLevel >= MAX_LEVEL
    ? `${icon('refresh')}<span>Jugar de nuevo</span>`
    : `<span>Siguiente nivel</span>${icon('arrow-right')}`;
  const win = newLevel >= MAX_LEVEL;
  polaroid.classList.toggle('wide', !!data.wide);
  credit.textContent = data.credit ?? '';
  credit.classList.toggle('hide', !data.credit);
  screens.level.classList.toggle('win', win);
  if (win) screens.hud.classList.add('hide');
  pauseBtn.classList.add('hide');
  screens.level.classList.remove('hide');
  showPopIn(panels.level);
  if (win) { saveRecord(); startFireworks(); }
}

function newGame() {
  resize();
  items = []; texts = []; particles = [];
  score = 0; lives = 3; level = 1; combo = 0; frames = 0; spawnTimer = 0; renderedLives = -1;
  last = performance.now();
  paused = false;
  userPaused = false;
  stopFireworks();
  screens.level.classList.remove('win');
  screens.pause.classList.add('hide');
  pauseBtn.classList.remove('hide');
  player.x = player.targetX = W() / 2;
  updateHud();
  screens.start.classList.add('hide');
  screens.over.classList.add('hide');
  screens.level.classList.add('hide');
  screens.hud.classList.remove('hide');
  wrapper.classList.remove('shake-active');
  playing = true;
  cancelAnimationFrame(raf);
  loop();
}

function saveRecord() {
  const record = score > best;
  if (record) { best = score; saveBest(best); $('best-start').textContent = String(best); }
  return record;
}

function gameOver() {
  playing = false;
  pauseBtn.classList.add('hide');
  sfx.over();
  $('final-score').textContent = String(score);
  $('new-record').classList.toggle('hide', !saveRecord());
  screens.hud.classList.add('hide');
  screens.over.classList.remove('hide');
  showPopIn(panels.over);
}

function collide(item: Item, idx: number) {
  const dx = player.x - item.x;
  const dy = player.y - item.y;
  if (Math.hypot(dx, dy) >= player.r + item.r - 5) return;
  items.splice(idx, 1);

  if (item.kind === 'broken') {
    lives--;
    combo = 0;
    sfx.hurt();
    burst(item.x, item.y, '#ef4444', 18);
    texts.push(new FloatingText(item.x, item.y, '💔 -1', '#fca5a5'));
    updateHud();
    damageEffect();
    if (lives <= 0) gameOver();
    return;
  }

  combo++;
  const gained = item.points * multiplier();
  score += gained;
  if (item.kind === 'heart') {
    sfx.heart();
    burst(item.x, item.y, '#f0abfc', 18, true);
    texts.push(new FloatingText(item.x, item.y, `+${gained} Borahae 💜`, '#f5d0fe', 24));
  } else {
    sfx.catch(combo);
    burst(item.x, item.y, '#c4b5fd', 12);
    texts.push(new FloatingText(item.x, item.y, `+${gained}`, '#e9d5ff'));
  }
  if (combo > 0 && combo % 8 === 0) {
    texts.push(new FloatingText(W() / 2, H() * 0.35, `¡COMBO x${multiplier()}!`, '#f0abfc', 40));
  }
  updateHud();
  bump(hud.scoreBox);
  if (combo % 8 === 0) bump(hud.comboBox);

  const target = levelThresholds[level - 1];
  if (level < MAX_LEVEL && target !== undefined && score >= target) levelUp(level + 1);
}

function drawBackground() {
  for (const s of stars) {
    s.y += s.s * dt;
    if (s.y > H() + 5) { s.y = -5; s.x = Math.random() * W(); }
    ctx.globalAlpha = 0.25 + Math.abs(Math.sin(frames * 0.03 + s.t)) * 0.5;
    ctx.fillStyle = '#e9d5ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function loop() {
  if (!playing) return;
  raf = requestAnimationFrame(loop);
  const now = performance.now();
  dt = Math.min((now - last) / 16.667, 2.5);
  last = now;
  if (paused || userPaused) return;
  frames += dt;
  ctx.clearRect(0, 0, W(), H());
  drawBackground();

  // keyboard steering
  const step = 9 * dt;
  if (keys.has('arrowleft') || keys.has('a')) player.targetX = Math.max(player.r, player.targetX - step);
  if (keys.has('arrowright') || keys.has('d')) player.targetX = Math.min(W() - player.r, player.targetX + step);
  player.x += (player.targetX - player.x) * (1 - Math.pow(0.65, dt));

  // Items get faster each level, but spawn gaps shrink more slowly than speed grows,
  // so the number of falling items on screen stays steady (even drops slightly) instead of snowballing.
  const spawnEvery = 38 / Math.pow(1 + (level - 1) * 0.3, 0.7);
  spawnTimer += dt;
  if (spawnTimer >= spawnEvery) { spawnTimer -= spawnEvery; items.push(new Item()); }

  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.update();
    it.draw();
    collide(it, i);
    if (!playing || paused) return;
    if (items[i] === it && it.y > H() + 60) {
      items.splice(i, 1);
      // letting a member fall breaks the combo
      if (it.kind === 'member' && combo > 0) { combo = 0; updateHud(); }
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    texts[i].update();
    texts[i].draw();
    if (texts[i].life <= 0) texts.splice(i, 1);
  }

  drawBomb(player.x, player.y, player.r);
}

/* ---------- Pause ---------- */
function setPause(on: boolean) {
  if (!playing || paused || on === userPaused) return;
  userPaused = on;
  screens.pause.classList.toggle('hide', !on);
  if (on) showPopIn(screens.pause.firstElementChild as HTMLElement);
}
pauseBtn.addEventListener('click', () => setPause(!userPaused));
$('resume-btn').addEventListener('click', () => setPause(false));
$('pause-restart-btn').addEventListener('click', newGame);
window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') setPause(!userPaused);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });

/* ---------- Fireworks (win screen: how BTS says goodbye at the end of a concert) ---------- */
interface Spark { x: number; y: number; vx: number; vy: number; life: number; decay: number; color: string; size: number; g: number; drag: number }
type Shape = 'peony' | 'ring' | 'heart' | 'willow' | 'double' | 'star';
interface Rocket { x: number; y: number; vy: number; targetY: number; palette: string[]; shape: Shape }
let fwRaf = 0;
let rockets: Rocket[] = [];
let sparks: Spark[] = [];

const palettes: string[][] = [
  ['#c084fc', '#e879f9', '#f5d0fe'], // ARMY purple
  ['#fde68a', '#fbbf24', '#fff7ed'], // gold
  ['#f87171', '#fb923c', '#fde047'], // fire
  ['#38bdf8', '#818cf8', '#e0f2fe'], // ice blue
  ['#4ade80', '#a3e635', '#ecfccb'], // lime
  ['#f472b6', '#fb7185', '#ffe4e6'], // pink
  ['#f87171', '#fbbf24', '#4ade80', '#38bdf8', '#c084fc', '#f472b6'], // rainbow
];
const shapes: Shape[] = ['peony', 'peony', 'ring', 'heart', 'willow', 'double', 'star'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function addSpark(x: number, y: number, a: number, speed: number, color: string, o: Partial<Spark> = {}) {
  sparks.push({
    x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1, decay: 0.012 + Math.random() * 0.012,
    color, size: 1.5 + Math.random() * 1.8, g: 0.045, drag: 0.985, ...o,
  });
}

function explode(r: Rocket) {
  const { x, y, palette, shape } = r;
  const col = () => pick(palette);
  if (shape === 'peony') {
    const n = 60 + Math.floor(Math.random() * 30);
    for (let i = 0; i < n; i++) addSpark(x, y, Math.random() * Math.PI * 2, 1.2 + Math.random() * 4.4, Math.random() < 0.2 ? '#ffffff' : col());
  } else if (shape === 'ring') {
    const n = 48;
    const tilt = 0.35 + Math.random() * 0.65;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      sparks.push({ x, y, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2 * tilt, life: 1, decay: 0.014, color: palette[i % 2], size: 2.2, g: 0.03, drag: 0.98 });
    }
  } else if (shape === 'heart') {
    const n = 70;
    const color = palette[0];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      sparks.push({ x, y, vx: hx * 0.2, vy: hy * 0.2, life: 1, decay: 0.012, color: i % 7 === 0 ? '#ffffff' : color, size: 2.4, g: 0.02, drag: 0.98 });
    }
  } else if (shape === 'willow') {
    const n = 70;
    for (let i = 0; i < n; i++) addSpark(x, y, Math.random() * Math.PI * 2, 0.8 + Math.random() * 3.2, '#fbbf24', { decay: 0.006 + Math.random() * 0.005, g: 0.07, drag: 0.975, size: 1.6 });
  } else if (shape === 'double') {
    for (let i = 0; i < 36; i++) addSpark(x, y, (i / 36) * Math.PI * 2, 4.6, palette[0], { size: 2.2 });
    for (let i = 0; i < 28; i++) addSpark(x, y, (i / 28) * Math.PI * 2 + 0.1, 2.3, palette[1] ?? '#ffffff', { size: 2 });
  } else {
    // star: five bursts of spokes
    for (let k = 0; k < 5; k++) {
      const base = (k / 5) * Math.PI * 2 - Math.PI / 2;
      for (let j = 0; j < 9; j++) addSpark(x, y, base + (Math.random() - 0.5) * 0.12, 1 + j * 0.5, j % 2 ? palette[0] : '#ffffff', { size: 2 });
    }
  }
  blip(160 + Math.random() * 140, 0.25, 'sawtooth', 60, 0.05);
}

function launchRocket() {
  const palette = pick(palettes);
  rockets.push({
    x: W() * (0.1 + Math.random() * 0.8), y: H() + 10, vy: -(7 + Math.random() * 3),
    targetY: H() * (0.1 + Math.random() * 0.4), palette, shape: pick(shapes),
  });
}

function fireworksLoop() {
  fwRaf = requestAnimationFrame(fireworksLoop);
  const now = performance.now();
  dt = Math.min((now - last) / 16.667, 2.5);
  last = now;
  spawnTimer += dt;
  // fade previous frame to leave trails while keeping the canvas transparent
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.8, dt)})`;
  ctx.fillRect(0, 0, W(), H());
  ctx.globalCompositeOperation = 'lighter';
  if (spawnTimer >= 24) { spawnTimer -= 24; launchRocket(); if (Math.random() < 0.3) setTimeout(launchRocket, 120); }
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.y += r.vy * dt;
    r.vy *= Math.pow(0.985, dt);
    ctx.fillStyle = r.palette[0];
    ctx.beginPath();
    ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (r.y <= r.targetY || r.vy > -1.5) { explode(r); rockets.splice(i, 1); }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const sp = sparks[i];
    sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += sp.g * dt; sp.vx *= Math.pow(sp.drag, dt); sp.vy *= Math.pow(sp.drag, dt); sp.life -= sp.decay * dt;
    if (sp.life <= 0) { sparks.splice(i, 1); continue; }
    ctx.globalAlpha = sp.life * (0.75 + Math.random() * 0.25);
    ctx.fillStyle = sp.color;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size * (0.5 + sp.life * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function startFireworks() {
  stopFireworks();
  playing = false;
  cancelAnimationFrame(raf);
  ctx.clearRect(0, 0, W(), H());
  spawnTimer = 0;
  last = performance.now();
  for (let i = 0; i < 3; i++) setTimeout(launchRocket, i * 250);
  fireworksLoop();
}

function stopFireworks() {
  cancelAnimationFrame(fwRaf);
  rockets = [];
  sparks = [];
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

/* ---------- Wiring ---------- */
$('start-btn').addEventListener('click', newGame);
$('restart-btn').addEventListener('click', newGame);
continueBtn.addEventListener('click', () => {
  if (level >= MAX_LEVEL) { newGame(); return; }
  screens.level.classList.add('hide');
  items = [];
  texts = [];
  player.x = player.targetX = W() / 2;
  paused = false;
  pauseBtn.classList.remove('hide');
});

resize();

// dev-only helper to preview the level screens: __levelUp(4)
if (import.meta.env.DEV) (window as unknown as { __levelUp: (n: number) => void }).__levelUp = levelUp;
