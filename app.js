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

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

function renderRecent() {
  const recent = load(KEY_RECENT, []);
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
  save(KEY_RECENT, [to, ...load(KEY_RECENT, []).filter((x) => x !== to)].slice(0, MAX_RECENT));
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
    remember(to, from);
    const samples = modulate(individualCallBits({ to, from, preambleBits }));
    status.textContent = `Calling ${to} from ${from}…`;
    player = play(samples, DEFAULT_FSK.sampleRate);
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

fromInput.value = load(KEY_SELF, '');
renderRecent();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
