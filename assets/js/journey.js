// A.R.E. — versión maestra (V3 híbrida + masters Higgsfield). Sin WebGL, sin dependencias.
// MOTOR: imágenes maestras + movimiento DOM (transform, opacity, filter) ligado al scroll, y TRES CLIPS DE TRANSICIÓN
// (03→04 entrada, 04→S02 vestíbulo, S02→S07 atrio) sincronizados por currentTime con el scroll (sin play()).
// Póster + clip opcional: los clips se precargan en segundo plano; solo si los TRES están listos se usan (modo «clip»);
// si falta alguno, hay error o pasan 20 s sin datos → modo «corte» (masters fijos con cortes disimulados). Movimiento
// reducido → siempre masters fijos. El cambio de modo solo se aplica fuera de los tramos afectados (sin saltos visibles).
// Todo es función pura de (p, modo): avanzar y retroceder dan exactamente el mismo plano.
// Parámetros de QA: ?hud=1 · ?auto=N · ?motion=full|reduced · ?review=1 · ?clips=off (fuerza el modo corte)

const q = new URLSearchParams(location.search);
// Herramientas de QA (?hud, ?auto, ?review, telemetría) solo en local o en la red de casa; en el dominio público quedan inertes
const QA = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '192.168.1.63';
const qaParam = (name) => QA ? q.get(name) : null;
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const bell = (p, c, w) => Math.exp(-Math.pow((p - c) / w, 2));

// ---------- guion (fracciones del scroll del recorrido) ----------
// Masters: s00 = 01 aérea · s01 = 02 plaza · s03 = 03 aproximación · s04 = 04 acceso · s02 = 06 vestíbulo · s07 = 07 atrio.
// REGLA: nunca hay dos planos visibles a la vez (ni dobles exposiciones). Empalmes:
//   A, B: corte en movimiento con desenfoque y luz breves (aérea → plaza → aproximación)
//   modo «clip»: 03→04, 04→S02 y S02→S07 son vídeo; el primer y el último fotograma de cada clip SON los masters, así que
//                el paso master ↔ clip es un corte invisible (misma escala a ambos lados del empalme)
//   modo «corte»: C oclusión por el vidrio oscuro de la puerta, D empalme por el jardín con luz, E giro rápido hacia arriba
const DOOR = { s00: 71, s01: 73, s03: 59 };
const MASTERS = ['s00', 's01', 's03', 's04', 's02', 's07'];
const CLIPKEYS = ['c34', 'c42', 'c27'];
const LAYERS = Object.fromEntries(MASTERS.map((k) => [k, { el: $(`[data-layer="${k}"]`) }]));
const CUT = { A: 0.12, B: 0.24, C: 0.40, D: 0.56, E: 0.78 };
const WIN = { c34: [0.33, 0.45], c42: [0.50, 0.60], c27: [0.70, 0.80] };
const SCENES = [
  { id: 's00', code: 'S00', name: 'Llegada', from: 0.00, to: CUT.A },
  { id: 's01', code: 'S01', name: 'La sede', from: CUT.A, to: CUT.C },
  { id: 't12', code: 'T12', name: 'Entrada', from: CUT.C, to: CUT.D },
  { id: 's02', code: 'S02', name: 'La sociedad', from: CUT.D, to: 1.01 },
];
const sceneAt = (p) => SCENES.find((s) => p < s.to) || SCENES[SCENES.length - 1];
const at = (k) => `50% ${DOOR[k]}%`;
const before = (p, c) => (p < c ? 1 : 0);
const within = (p, a, b) => (p >= a && p < b ? 1 : 0);
const still = (s, origin = '50% 50%', y = 0) => ({ s, x: 0, y, origin });

// Tramo común a los dos modos: S00 aérea → (A) plaza → (B) aproximación
function opening(f, p) {
  const { A, B } = CUT;
  f.s00 = { o: before(p, A), t: { s: lerp(1, 1.62, ease(seg(p, 0.03, A))), x: 0, y: 0, origin: at('s00') }, blur: bell(p, A, 0.012) * 3 };
  f.s01 = { o: within(p, A, B), t: { s: lerp(1.16, 1.46, seg(p, A, B)), x: 0, y: 0, origin: at('s01') }, blur: bell(p, A, 0.012) * 3 + bell(p, B, 0.01) * 2.5 };
  f.flash = bell(p, A, 0.012) * 0.38 + bell(p, B, 0.01) * 0.22;
}
// Fotograma del recorrido para (p, modo) (sin estado → bidireccional)
function frame(p, m = mode) {
  const f = { s00: {}, s01: {}, s03: {}, s04: {}, s02: {}, s07: {}, c34: { o: 0 }, c42: { o: 0 }, c27: { o: 0 }, flash: 0, dim: 0, heroScrim: 1 - ease(seg(p, 0.03, 0.10)) };
  const { B, C, D, E } = CUT;
  opening(f, p);
  if (m === 'clip') {
    const [a1, b1] = WIN.c34, [a2, b2] = WIN.c42, [a3, b3] = WIN.c27;
    f.s03 = { o: within(p, B, a1), t: still(lerp(1.0, 1.06, ease(seg(p, B, a1)))), blur: bell(p, B, 0.01) * 2.5 };
    f.c34 = { o: within(p, a1, b1), t: still(1.06), clipT: seg(p, a1, b1) };
    f.s04 = { o: within(p, b1, a2), t: still(lerp(1.06, 1.10, seg(p, b1, a2))) };
    f.c42 = { o: within(p, a2, b2), t: still(1.10), clipT: seg(p, a2, b2) };
    f.s02 = { o: within(p, b2, a3), t: still(lerp(1.10, 1.14, seg(p, b2, a3))) };
    f.c27 = { o: within(p, a3, b3), t: still(1.14), clipT: seg(p, a3, b3) };
    f.s07 = { o: p >= b3 ? 1 : 0, t: still(lerp(1.14, 1.22, ease(seg(p, b3, 1))), '50% 35%', lerp(0, 2.5, ease(seg(p, b3, 1)))) };
    f.dim = ease(seg(p, 0.95, 1)) * 0.55;
    return f;
  }
  // Modo corte (sin clips)
  f.s03 = { o: within(p, B, C), t: { s: lerp(1.0, 2.5, ease(seg(p, B, C))), x: 0, y: 0, origin: at('s03') }, blur: bell(p, B, 0.01) * 2.5 };
  const occl = p < C ? ease(seg(p, C - 0.035, C)) : 1 - ease(seg(p, C, C + 0.03));
  f.s04 = { o: within(p, C, D), t: { s: lerp(1.1, 1.0, ease(seg(p, C, C + 0.04))) * lerp(1, 1.55, ease(seg(p, C + 0.05, D))), x: 0, y: 0, origin: '50% 46%' } };
  f.s04.blur = bell(p, D, 0.01) * 3; f.s04.bright = 1 + seg(p, D - 0.04, D) * 0.35;
  f.flash += bell(p, D, 0.012) * 0.75;
  const up1 = ease(seg(p, E - 0.035, E)), up2 = 1 - ease(seg(p, E, E + 0.035));
  f.s02 = { o: within(p, D, E), t: { s: lerp(1.18, 1.06, ease(seg(p, D, D + 0.08))) * (1 + up1 * 0.08), x: 0, y: up1 * 7, origin: '50% 46%' }, blur: bell(p, D, 0.01) * 3 + up1 * 4, bright: 1 + (1 - ease(seg(p, D, D + 0.04))) * 0.25 };
  f.s07 = { o: before(p, E) ? 0 : 1, t: { s: (1 + up2 * 0.1) * lerp(1, 1.08, ease(seg(p, E + 0.04, 1))), x: 0, y: -up2 * 7 + lerp(0, 3, ease(seg(p, E + 0.04, 1))), origin: '50% 35%' }, blur: up2 * 4 };
  f.dim = Math.max(occl, ease(seg(p, 0.95, 1)) * 0.55);
  return f;
}
// Movimiento reducido: un plano fijo por tramo y paso por corte (nunca vídeo)
function frameReduced(p) {
  const f = { flash: 0, dim: 0, heroScrim: p < CUT.A ? 1 : 0, c34: { o: 0 }, c42: { o: 0 }, c27: { o: 0 } };
  for (const k of MASTERS) f[k] = { o: 0, t: still(1) };
  const k = p < CUT.A ? 's00' : p < CUT.B ? 's01' : p < CUT.C ? 's03' : p < CUT.D ? 's04' : p < CUT.E ? 's02' : 's07';
  f[k].o = 1;
  return f;
}

// ---------- pintado (solo transform, opacity y filter) ----------
const flash = $('[data-flash]'); const dim = $('[data-dim]'); const heroScrim = $('[data-hero-scrim]');
function style(el, st) {
  el.style.opacity = (st.o ?? 0).toFixed(3);
  el.style.visibility = st.o > 0.001 ? 'visible' : 'hidden';
  if (st.t) { el.style.transformOrigin = st.t.origin; el.style.transform = `translate3d(${st.t.x}%, ${st.t.y}%, 0) scale(${st.t.s.toFixed(4)})`; }
  el.style.filter = st.blur > 0.05 || (st.bright ?? 1) > 1.005 ? `blur(${(st.blur || 0).toFixed(2)}px) brightness(${(st.bright ?? 1).toFixed(3)})` : '';
}
function paint(f) {
  for (const k of MASTERS) { const el = LAYERS[k].el; if (el && f[k]) style(el, f[k]); }
  for (const k of CLIPKEYS) {
    const v = tclips.v[k]; if (!v) continue;
    style(v, f[k]);
    if (f[k].o > 0 && v.duration > 0) tclips.seek(k, f[k].clipT * (v.duration - 0.05));
  }
  flash.style.opacity = f.flash.toFixed(3);
  dim.style.opacity = (f.dim || 0).toFixed(3);
  if (heroScrim) heroScrim.style.opacity = (f.heroScrim ?? 0).toFixed(3);
}

// ---------- clips de transición (precarga + scrub; un seek en vuelo por clip) ----------
const TCLIPS = { c34: ['clips/c34-entrada', '50% 58%'], c42: ['clips/c42-vestibulo', '50% 54%'], c27: ['clips/c27-atrio', '50% 45%'] };
let mode = 'corte';
const tclips = {
  v: {}, ok: new Set(), failed: false, started: false, seeking: {}, seekAt: {}, want: {},
  load() {
    if (reduced || qaParam('clips') === 'off' || this.started) return;
    this.started = true;
    const small = Math.min(innerWidth, innerHeight) < 700;
    const anchor = $('[data-flash]');
    for (const [k, [src, pos]] of Object.entries(TCLIPS)) {
      const v = document.createElement('video');
      Object.assign(v, { muted: true, playsInline: true, preload: 'auto', disablePictureInPicture: true });
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
      v.className = 'layer layer--clip'; v.style.objectPosition = pos; v.style.visibility = 'hidden'; v.style.opacity = '0';
      v.addEventListener('canplaythrough', () => { this.ok.add(k); T.clips.push({ k, listo: +(performance.now() / 1000).toFixed(1) }); kick(); }, { once: true });
      v.addEventListener('error', () => this.fail(`error ${k}`), { once: true });
      v.addEventListener('seeked', () => { this.seeking[k] = false; if (this.want[k] != null) { const w = this.want[k]; this.want[k] = null; this.seek(k, w); } });
      v.src = `${src}${small ? '-720' : ''}.mp4`;
      anchor.before(v); this.v[k] = v;
    }
    setTimeout(() => { if (this.ok.size < 3) this.fail('timeout'); }, 20000);
  },
  fail(why) {
    if (this.failed) return;
    this.failed = true; T.clips.push({ fallo: why });
    for (const v of Object.values(this.v)) { v.removeAttribute('src'); v.load(); v.remove(); }
    this.v = {}; mode = 'corte'; kick();
  },
  stop() {
    for (const v of Object.values(this.v)) { v.removeAttribute('src'); v.load(); v.remove(); }
    this.v = {}; this.ok.clear(); this.started = false; mode = 'corte';
  },
  get ready() { return !this.failed && this.ok.size === 3; },
  seek(k, t) {
    const v = this.v[k]; if (!v || Math.abs(v.currentTime - t) < 0.02) return;
    if (this.seeking[k] && performance.now() - this.seekAt[k] < 250) { this.want[k] = t; return; }
    this.seeking[k] = true; this.seekAt[k] = performance.now(); this.want[k] = null; v.currentTime = t;
  },
};
// El modo solo cambia fuera de los tramos 03→S07 (antes de B o tras el final de c27) para no saltar a mitad de un plano
function updateMode() {
  const want = !reduced && tclips.ready ? 'clip' : 'corte';
  if (want !== mode && (p < CUT.B - 0.01 || p > WIN.c27[1] + 0.02 || want === 'corte')) mode = want;
}

// ---------- movimiento reducido: preferencia del sistema, silenciosa y respetada ----------
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = mq.matches;
function applyMotion() {
  document.documentElement.classList.toggle('is-reduced', reduced);
  render();
}
mq.addEventListener?.('change', () => { reduced = mq.matches; if (reduced) tclips.stop(); applyMotion(); });

// ---------- progreso, texto y raíl ----------
const journey = $('[data-journey]');
const panels = [...document.querySelectorAll('[data-in]')];
const rail = [...document.querySelectorAll('.rail__step')];
const maxScroll = () => Math.max(1, journey.offsetHeight - innerHeight);
let p = 0, running = false, lastTick = 0, lastScrollAt = 0, lastScene = null;
function readScroll() { p = clamp(-journey.getBoundingClientRect().top / maxScroll()); lastScrollAt = performance.now(); }
function render() {
  updateMode();
  paint(reduced ? frameReduced(p) : frame(p));
  const sc = sceneAt(p);
  for (const el of panels) {
    const on = p >= +el.dataset.in && p < +el.dataset.out;
    el.classList.toggle('is-on', on);
    el.classList.toggle('is-past', p >= +el.dataset.out);
  }
  if (sc !== lastScene) {
    lastScene = sc;
    $('[data-nav-scene]').textContent = `${sc.code} · ${sc.name}`;
    for (const b of rail) b.dataset.scene === sc.id ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current');
  }
  $('[data-rail-fill]').style.transform = `scaleY(${p.toFixed(4)})`;
  $('[data-cue]').classList.toggle('is-off', p > 0.02);
}
function tick(now) {
  const dt = now - lastTick; lastTick = now;
  const moving = now - lastScrollAt < 300;
  if (moving && dt > 0 && dt < 2000) { T.frames.push(+dt.toFixed(1)); if (dt > 50) T.gaps50++; if (dt > 100) T.gaps100++; }
  render();
  if (now - T._traceAt > 400 && T.trace.length < 600) { T._traceAt = now; T.trace.push([+p.toFixed(3), sceneAt(p).id, mode]); }
  if (hudOn && now - hudAt > 250) { hudAt = now; drawHud(); }
  if (moving) requestAnimationFrame(tick); else running = false;
}
function kick() { if (!running) { running = true; lastTick = performance.now(); requestAnimationFrame(tick); } }
addEventListener('scroll', () => { readScroll(); kick(); }, { passive: true });
addEventListener('resize', () => { readScroll(); kick(); });
const goTo = (frac) => scrollTo({ top: journey.offsetTop + frac * maxScroll(), behavior: reduced ? 'auto' : 'smooth' });
for (const el of document.querySelectorAll('[data-go]')) el.addEventListener('click', (e) => { e.preventDefault(); goTo(+el.dataset.go); });

// ---------- capítulos: índice activo y máscara de entrada de las imágenes ----------
const chapterLinks = [...document.querySelectorAll('[data-chapter]')];
const chaptersNav = $('[data-chapters]');
const chapterIO = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) for (const a of chapterLinks) a.toggleAttribute('aria-current', a.dataset.chapter === e.target.id);
}), { rootMargin: '-45% 0px -45% 0px' });
const sections = [...document.querySelectorAll('[data-chapter-section]')];
sections.forEach((s) => chapterIO.observe(s));
addEventListener('scroll', () => { const r1 = sections[0].getBoundingClientRect(); const rN = sections[sections.length - 1].getBoundingClientRect(); chaptersNav.classList.toggle('is-on', r1.top < innerHeight * 0.5 && rN.bottom > innerHeight * 0.5); }, { passive: true });
const maskIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-open'); maskIO.unobserve(e.target); } }), { rootMargin: '0px 0px -15% 0px' });
document.querySelectorAll('[data-mask]').forEach((el) => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('mask'); maskIO.observe(el); } });

// ---------- secciones editoriales: parallax ligero de las imágenes de detalle y entrada del texto ----------
const bands = [...document.querySelectorAll('[data-parallax]')];
const revealIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('[data-reveal]').forEach((el) => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('reveal'); revealIO.observe(el); } });
const visibleBands = new Set();
const bandIO = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting ? visibleBands.add(e.target) : visibleBands.delete(e.target)));
bands.forEach((b) => bandIO.observe(b));
function parallax() {
  if (!reduced) for (const b of visibleBands) {
    const r = b.getBoundingClientRect(); const k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    b.querySelector('img').style.transform = `translate3d(0, ${(k * -6).toFixed(2)}%, 0) scale(1.12)`;
  }
}
addEventListener('scroll', () => requestAnimationFrame(parallax), { passive: true });

// La etiqueta de escena de la cabecera solo tiene sentido dentro del recorrido
new IntersectionObserver(([e]) => document.documentElement.classList.toggle('is-past-journey', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(journey);

// ---------- revisión de textos (?review=1): marca FACT / COPY / REVIEW ----------
if (qaParam('review') === '1') document.documentElement.classList.add('is-review');

// ---------- telemetría y piloto automático (QA en Safari sin automatización) ----------
const T = { frame: (x, m) => frame(x, m || mode), mode: () => mode, clips: [], ua: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, reduced, frames: [], gaps50: 0, gaps100: 0, trace: [], _traceAt: 0, auto: null, started: performance.now() };
if (QA) window.__are = T;
const quant = (a, f) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(1); };
const stats = () => { const f = T.frames.slice(-2000); const m = f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0; return { fps: m ? +(1000 / m).toFixed(1) : 0, p50: quant(f, .5), p95: quant(f, .95), p99: quant(f, .99), max: quant(f, 1), n: f.length }; };
function sendTelemetry(reason) { if (!QA) return; const body = JSON.stringify({ ...T, reason, stats: stats(), at: new Date().toISOString(), mode, clipsReady: tclips.ready }); try { navigator.sendBeacon('/telemetry', new Blob([body], { type: 'application/json' })); } catch { } }
const hud = QA ? document.createElement('pre') : null; let hudOn = qaParam('hud') === '1', hudAt = 0;
if (hud) { hud.className = 'hud'; hud.hidden = true; hud.setAttribute('aria-hidden', 'true'); $('.stage').append(hud); }
function drawHud() { if (hud) { const s = stats(); hud.textContent = `p=${p.toFixed(3)} ${sceneAt(p).code}${reduced ? ' (reducido)' : ''} · n=${s.n} fps=${s.fps} p50=${s.p50} p95=${s.p95} p99=${s.p99} max=${s.max} · >50=${T.gaps50} >100=${T.gaps100}`; } }
if (hud) hud.hidden = !hudOn;
addEventListener('keydown', (e) => { if (e.key === 'h' && QA && q.has('hud')) { hudOn = !hudOn; if (hud) hud.hidden = !hudOn; } });
const AUTO = +qaParam('auto') || 0;
if (AUTO) {
  T.auto = { laps: AUTO, log: [] };
  const glide = (a, b, ms) => new Promise((res) => { const t0 = performance.now(); const st = () => { const k = Math.min(1, (performance.now() - t0) / ms); scrollTo(0, journey.offsetTop + (a + (b - a) * k) * maxScroll()); k < 1 ? requestAnimationFrame(st) : res(); }; st(); });
  (async () => {
    await new Promise((r) => setTimeout(r, 1500));
    for (let i = 1; i <= AUTO; i++) { const ms = i === 2 ? 1800 : 12000; await glide(0, 1, ms); await new Promise((r) => setTimeout(r, 800)); await glide(1, 0, ms); await new Promise((r) => setTimeout(r, 500)); T.auto.log.push({ lap: i, stats: stats(), gaps50: T.gaps50, gaps100: T.gaps100 }); }
    drawHud(); sendTelemetry('auto'); document.title = 'A.R.E. · piloto terminado';
  })();
}

// Arranque: la primera imagen ya está en el HTML (fetchpriority alta); se marca listo cuando ha decodificado
const first = LAYERS.s00.el;
const INTRO_MS = 1150; // S00: el trazo del logotipo necesita ≈ 1,1 s; si la imagen tarda más, la apertura espera a la imagen
const ready = () => {
  setTimeout(() => document.documentElement.classList.add('is-ready'), reduced ? 0 : Math.max(0, INTRO_MS - performance.now()));
  // Decodificar por adelantado las capas que entran más tarde: evita el tirón de la primera decodificación al hacerse visibles
  for (const k of ['s01', 's03', 's04', 's02', 's07']) LAYERS[k].el.decode?.().catch(() => { });
  // Clips de transición: se piden cuando la primera imagen ya está en pantalla (no compiten con ella)
  if (!reduced) setTimeout(() => tclips.load(), 700);
};
first.complete ? ready() : first.addEventListener('load', ready, { once: true });
applyMotion(); readScroll(); render();
