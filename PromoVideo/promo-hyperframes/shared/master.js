/* =========================================================================
   CareData Promo — Master Sequencer
   Orchestrates the 16 scene iframes:
     • Scenes load lazily and pause until the master sends them postMessage('play')
     • Crossfades between scenes via opacity (CSS transition)
     • Scrubber + transport + scene chip all synced to a master clock
   ========================================================================= */

let SCENES = [];
let TOTAL_DUR = 0;

async function loadTimeline(){
  const res = await fetch('shared/timeline.json');
  if (!res.ok) throw new Error('failed to load timeline.json: ' + res.status);
  const tl  = await res.json();
  SCENES = tl.scenes.map(s => ({
    id:    s.id,
    name:  s.name,
    src:   `previews/scene-${String(s.id).padStart(2,'0')}-${s.slug}.html`,
    start: s.startSec,
    dur:   s.durSec
  }));
  TOTAL_DUR = tl.totalDurationSec;
}

const CROSSFADE = 0.30;                   /* seconds of opacity overlap */
const PRELOAD_LEAD = 1.20;                /* seconds — start loading the next iframe ahead */

/* ---------- Fit the 1920x1080 stage to viewport ---------- */
function fitStage(){
  const film = document.getElementById('film');
  const sx = window.innerWidth  / 1920;
  const sy = (window.innerHeight - 80) / 1080;   /* leave space for HUD */
  const s = Math.min(sx, sy);
  film.style.transform = `translate(-50%, -50%) scale(${s})`;
  film.style.position  = 'absolute';
  film.style.top       = '50%';
  film.style.left      = '50%';
}
window.addEventListener('resize', fitStage);

/* ---------- Build iframe row ---------- */
function buildIframes(){
  const film = document.getElementById('film');
  for (const s of SCENES){
    const f = document.createElement('iframe');
    f.className = 'scene-frame';
    f.dataset.id = s.id;
    f.dataset.name = s.name;
    f.dataset.start = s.start;
    f.dataset.dur = s.dur;
    /* src is set lazily during playback to avoid all 16 auto-playing at load */
    film.appendChild(f);
    s._iframe = f;
    s._loaded = false;
    s._played = false;
  }
}

/* ---------- Build scrubber scene markers ---------- */
function buildScrubberMarkers(){
  const sc = document.getElementById('scrubber');
  for (const s of SCENES){
    if (s.id === 1) continue;             /* skip first marker */
    const m = document.createElement('div');
    m.className = 'marker';
    m.style.left = `${(s.start / TOTAL_DUR) * 100}%`;
    sc.appendChild(m);
  }
}

/* ---------- Master clock ---------- */
let masterT0 = null;          /* performance.now() when the film started */
let pausedAt = 0;             /* accumulated playback time when paused */
let isPlaying = false;
let rafId = null;

function nowSec(){
  if (!isPlaying) return pausedAt;
  return pausedAt + (performance.now() - masterT0) / 1000;
}

function setNow(t){
  /* Jump master clock to time t */
  pausedAt = Math.max(0, Math.min(TOTAL_DUR, t));
  if (isPlaying) masterT0 = performance.now();

  /* Seek the master audio so it stays aligned with the visuals. */
  const audio = document.getElementById('masterAudio');
  if (audio) audio.currentTime = pausedAt;

  applyState(pausedAt);
}

/* ---------- Send a scene a postMessage ---------- */
function tellScene(scene, type){
  if (!scene._iframe || !scene._iframe.contentWindow) return;
  try{ scene._iframe.contentWindow.postMessage({ type }, '*'); } catch(_){}
}

/* ---------- Lazy-load + play a scene at its scheduled start ---------- */
function ensureLoaded(scene){
  if (scene._loaded || scene._iframe.src) return;
  scene._iframe.src = scene.src;
  scene._iframe.addEventListener('load', () => {
    scene._loaded = true;
    /* If by the time it loads we're already past its scheduled start, play */
    if (nowSec() >= scene.start && nowSec() < scene.start + scene.dur && isPlaying){
      tellScene(scene, 'play');
      scene._played = true;
    }
  }, { once: true });
}

function playScene(scene){
  if (scene._played) return;
  scene._played = true;
  if (scene._loaded){
    tellScene(scene, 'play');
  }
  /* Otherwise the load handler will fire 'play' itself once ready */
}

function resetScene(scene){
  scene._played = false;
  if (scene._loaded){
    tellScene(scene, 'reset');
  }
}

/* ---------- Per-frame state application ---------- */
function activeSceneAt(t){
  for (let i = SCENES.length - 1; i >= 0; i--){
    if (t >= SCENES[i].start) return SCENES[i];
  }
  return SCENES[0];
}

function applyState(t){
  /* Iframe visibility — current scene is opaque; the next one fades in
     during the last CROSSFADE seconds of the current scene. */
  for (const s of SCENES){
    const inWindow = (t >= s.start && t < s.start + s.dur);
    const fadeIn   = (t >= s.start - CROSSFADE && t < s.start);
    const isActive = inWindow || fadeIn;
    if (isActive){
      s._iframe.classList.add('is-active');
    } else {
      s._iframe.classList.remove('is-active');
    }

    /* Lazy preload anything within the lead window */
    if (t >= s.start - PRELOAD_LEAD){
      ensureLoaded(s);
    }
  }

  /* Scrubber */
  const pct = (t / TOTAL_DUR) * 100;
  document.getElementById('scrubberFill').style.width = pct + '%';

  /* Timer */
  document.getElementById('timeNow').textContent = formatTime(t);
  document.getElementById('timeTotal').textContent = formatTime(TOTAL_DUR);

  /* Scene chip + caption */
  const cur = activeSceneAt(t);
  const num = String(cur.id).padStart(2, '0');
  document.getElementById('sceneChipNum').textContent = num;
  document.getElementById('sceneChipName').textContent = cur.name;
  document.getElementById('capNum').textContent = `Scene ${num} of 16`;
  document.getElementById('capName').textContent = cur.name;
}

function formatTime(t){
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/* ---------- RAF loop ---------- */
function tick(){
  rafId = requestAnimationFrame(tick);
  const t = nowSec();

  /* Trigger play() once per scene when its start time arrives */
  for (const s of SCENES){
    if (!s._played && t >= s.start && t < s.start + s.dur){
      playScene(s);
    }
    if (s._played && t < s.start){
      /* user scrubbed back — reset */
      resetScene(s);
    }
  }

  applyState(t);

  if (t >= TOTAL_DUR){
    pause();
    setNow(TOTAL_DUR);
  }
}

/* ---------- Transport ---------- */
function play(){
  if (isPlaying) return;
  isPlaying = true;
  masterT0 = performance.now();
  document.getElementById('idle').classList.add('gone');
  document.getElementById('hud').classList.add('is-shown');
  document.getElementById('sceneCap').classList.add('is-shown');
  document.body.dataset.state = 'playing';

  /* Sync master audio with the master clock. Browser may reject autoplay
     without a user gesture; the .catch swallows that benign rejection. */
  const audio = document.getElementById('masterAudio');
  if (audio) {
    audio.currentTime = pausedAt;
    audio.play().catch(() => {});
  }

  if (!rafId) tick();
  updatePlayBtn();
}

function pause(){
  if (!isPlaying) return;
  pausedAt = nowSec();
  isPlaying = false;
  cancelAnimationFrame(rafId);
  rafId = null;

  /* Pause the master audio so it stays aligned on resume. */
  const audio = document.getElementById('masterAudio');
  if (audio) audio.pause();

  /* Tell scenes to pause their internal timelines too */
  for (const s of SCENES) tellScene(s, 'pause');
  updatePlayBtn();
}

function restart(){
  pause();
  setNow(0);
  for (const s of SCENES){
    s._played = false;
    if (s._loaded) tellScene(s, 'reset');
    s._iframe.classList.remove('is-active');
  }

  /* Rewind the master audio to the top so playback restarts in sync. */
  const audio = document.getElementById('masterAudio');
  if (audio) audio.currentTime = 0;

  setTimeout(play, 60);
}

function updatePlayBtn(){
  const btn = document.getElementById('playBtn');
  btn.innerHTML = isPlaying
    ? '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="1"/><rect x="9" y="3" width="3" height="10" rx="1"/></svg>'
    : '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3 L13 8 L5 13 Z"/></svg>';
}

/* ---------- Scrubber click + drag ---------- */
function bindScrubber(){
  const bar = document.getElementById('scrubber');
  let dragging = false;
  const seekFrom = (e) => {
    const r = bar.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const t = Math.max(0, Math.min(TOTAL_DUR, (x / r.width) * TOTAL_DUR));
    /* Reset all scenes — re-trigger play() for whichever is current */
    for (const s of SCENES){
      s._played = false;
      if (s._loaded) tellScene(s, 'reset');
    }
    setNow(t);
  };
  bar.addEventListener('mousedown', (e) => { dragging = true; seekFrom(e); });
  window.addEventListener('mousemove', (e) => { if (dragging) seekFrom(e); });
  window.addEventListener('mouseup', () => { dragging = false; });
  bar.addEventListener('touchstart', seekFrom, { passive: true });
  bar.addEventListener('touchmove',  seekFrom, { passive: true });
}

/* ---------- Wire up ---------- */
function bind(){
  document.getElementById('playBtn').addEventListener('click', () => isPlaying ? pause() : play());
  document.getElementById('idlePlay').addEventListener('click', play);
  document.getElementById('restartBtn').addEventListener('click', restart);
  bindScrubber();

  /* Spacebar = play/pause, R = restart */
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ')      { e.preventDefault(); isPlaying ? pause() : play(); }
    if (e.key === 'r' || e.key === 'R') restart();
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadTimeline();
  buildIframes();
  buildScrubberMarkers();
  bind();
  fitStage();
  applyState(0);                 /* initialise UI text */
  updatePlayBtn();
});
