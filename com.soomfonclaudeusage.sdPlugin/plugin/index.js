const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { Plugins, Actions, log } = require('./utils/plugin');

// ~/.claude/statusline-command.sh already extracts rate_limits on every
// render and caches it here — read it instead of re-deriving anything.
const CACHE_FILE = path.join(os.homedir(), '.claude', 'rate-limit-cache.json');
const BASE_IMAGE = path.join(__dirname, '..', 'images', 'icon.png');
const RENDER_SCRIPT = path.join(__dirname, 'render.ps1');
const RENDER_OUT = path.join(__dirname, '..', 'images', 'rendered.png');
const ROTATE_MS = 5 * 60_000; // slide auto-advances every 5 minutes; press the key to jump sooner

function cache() {
  return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
}

// The cache is only rewritten when Claude Code itself renders its statusline
// (i.e. during an active session) — it never refreshes on its own. Past this
// age, treat its numbers as a last-known snapshot rather than live data, and
// say so instead of quietly showing a number that may be well out of date.
const STALE_AFTER_SEC = 15 * 60;

function isStale(c) {
  const gen = Number(c.generatedAt);
  if (!Number.isFinite(gen)) return true;
  return Math.floor(Date.now() / 1000) - gen > STALE_AFTER_SEC;
}

function formatCountdown(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const SLIDES = [
  {
    label: '5H LEFT',
    value() {
      const c = cache();
      const pct = Number(c.fiveHourLeftPct);
      if (!Number.isFinite(pct)) throw new Error('no fiveHourLeftPct');
      return `${pct.toFixed(0)}%${isStale(c) ? '*' : ''}`;
    },
  },
  {
    label: '7D LEFT',
    value() {
      const c = cache();
      const pct = Number(c.sevenDayLeftPct);
      if (!Number.isFinite(pct)) throw new Error('no sevenDayLeftPct');
      return `${pct.toFixed(0)}%${isStale(c) ? '*' : ''}`;
    },
  },
  {
    label: 'RESET IN',
    value() {
      const c = cache();
      const candidates = [c.fiveHourResetsAt, c.sevenDayResetsAt]
        .map(Number)
        .filter(Number.isFinite);
      if (!candidates.length) throw new Error('no reset timestamps');
      const soonest = Math.min(...candidates);
      const secs = soonest - Math.floor(Date.now() / 1000);
      if (secs <= 0) return isStale(c) ? 'stale' : 'now';
      return formatCountdown(secs);
    },
  },
];

// The device's native title overlay ignores per-action font size/position on
// this controller type, so render the text into the mascot image ourselves
// (same trick Krabs uses) and push the whole composite via setImage.
// Use an absolute path to powershell.exe: the host may spawn this process
// with a minimal PATH that doesn't resolve the bare command.
const POWERSHELL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

function renderImage(label, value) {
  // Delete any previous output first so a failed/silent render can never be
  // mistaken for a fresh one — readFileSync below will just throw instead.
  fs.rmSync(RENDER_OUT, { force: true });
  const result = spawnSync(POWERSHELL, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', RENDER_SCRIPT,
    '-Label', label, '-Value', value, '-BasePath', BASE_IMAGE, '-OutPath', RENDER_OUT,
  ], { windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(`render.ps1 failed: status=${result.status} error=${result.error} stderr=${result.stderr?.toString()}`);
  }
  const png = fs.readFileSync(RENDER_OUT);
  return 'data:image/png;base64,' + png.toString('base64');
}

const plugin = new Plugins();
const contexts = new Set();
let slideIndex = 0;
let rotateTimer = null;

function renderCurrentSlide() {
  const slide = SLIDES[slideIndex];
  let value;
  try {
    value = slide.value();
  } catch {
    value = 'n/a';
  }
  let dataUrl;
  try {
    dataUrl = renderImage(slide.label, value);
  } catch (err) {
    log('renderCurrentSlide: ' + err.message);
    return; // leave whatever image is already showing rather than guess
  }
  for (const context of contexts) plugin.setImage(context, dataUrl);
}

function startRotation() {
  if (rotateTimer) clearInterval(rotateTimer);
  rotateTimer = setInterval(() => {
    slideIndex = (slideIndex + 1) % SLIDES.length;
    renderCurrentSlide();
  }, ROTATE_MS);
}

function advanceManually() {
  slideIndex = (slideIndex + 1) % SLIDES.length;
  renderCurrentSlide();
  startRotation(); // restart the timer so auto-rotate waits a full interval after a manual press
}

plugin.weekly = new Actions({
  _willAppear({ context }) {
    contexts.add(context);
    renderCurrentSlide();
    startRotation();
  },
  _willDisappear({ context }) {
    contexts.delete(context);
  },
  keyDown() {
    advanceManually();
  },
});
