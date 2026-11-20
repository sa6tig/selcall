import { individualCallBits } from './src/encoder.js';
import { modulate, DEFAULT_FSK } from './src/fsk.js';
import { play } from './src/audio.js';

const KEY_SELF = 'selcall.self';
const KEY_RECENT = 'selcall.recent';
const MAX_RECENT = 5;

const $ = (id) => document.getElementById(id);
const form = $('call-form');
const toInput = $('to');
const fromInput = $('from');
const callBtn = $('call');
const status = $('status');

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

const isId = (v) => typeof v === 'string' && /^(\d{4}|\d{6})$/.test(v);

/** Stored recent IDs, dropping anything that is not a valid ID. */
function loadRecent() {
  const v = load(KEY_RECENT, []);
  return Array.isArray(v) ? v.filter(isId).slice(0, MAX_RECENT) : [];
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

function renderRecent() {
  const recent = loadRecent();
  $('recent').replaceChildren(...recent.map((id) => Object.assign(document.createElement('option'), { value: id })));
  $('recent-buttons').replaceChildren(
    ...recent.map((id) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: id });
      b.addEventListener('click', () => (toInput.value = id));
      return b;
    }),
  );
}

function remember(to, from) {
  save(KEY_SELF, from);
  save(KEY_RECENT, [to, ...loadRecent().filter((x) => x !== to)].slice(0, MAX_RECENT));
  renderRecent();
}

let current = null; // { cancel: () => void }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (current) {
    current.cancel();
    return;
  }
  const to = toInput.value.trim();
  const from = fromInput.value.trim();
  const preambleBits = Number(form.elements.preamble.value);

  let cancelled = false;
  let player = null;
  current = { cancel: () => { cancelled = true; player?.stop(); } };
  callBtn.textContent = 'Stop';
  callBtn.classList.add('active');

  try {
    const samples = modulate(individualCallBits({ to, from, preambleBits }));
    remember(to, from);
    status.textContent = `Calling ${to} from ${from}…`;
    player = await play(samples, DEFAULT_FSK.sampleRate);
    if (cancelled) player.stop();
    await player.done;
    status.textContent = cancelled ? 'Stopped.' : 'Done. Release PTT.';
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  } finally {
    current = null;
    callBtn.textContent = 'Call';
    callBtn.classList.remove('active');
  }
});

const savedSelf = load(KEY_SELF, '');
fromInput.value = isId(savedSelf) ? savedSelf : '';
renderRecent();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
