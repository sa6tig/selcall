import { individualCallBits, isValidId } from './src/encoder.js';
import { modulate, DEFAULT_FSK } from './src/fsk.js';
import { play, unlock } from './src/audio.js';

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

/** Stored recent IDs, dropping anything that is not a valid ID. */
function loadRecent() {
  const v = load(KEY_RECENT, []);
  return Array.isArray(v) ? v.filter(isValidId).slice(0, MAX_RECENT) : [];
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

/** Resolves after the browser has painted pending DOM changes. */
const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

let current = null; // { cancel: () => void } while a call is in progress

// Stop is handled on click, before submission runs constraint validation, so it
// works even if a field was edited to an invalid value during the call.
callBtn.addEventListener('click', (e) => {
  if (!current) return;
  e.preventDefault();
  current.cancel();
});

// Enter in a field would submit the form (and so press Stop) mid-call.
form.addEventListener('keydown', (e) => {
  if (current && e.key === 'Enter' && e.target !== callBtn) e.preventDefault();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (current) return;
  const to = toInput.value.trim();
  const from = fromInput.value.trim();
  const preambleBits = Number(form.elements.preamble.value);

  // Start the audio context now, while still inside the user gesture.
  unlock().catch(() => {}); // play() below reports any failure

  let cancelled = false;
  let onStop;
  const stopped = new Promise((resolve) => (onStop = resolve));
  current = { cancel: () => { cancelled = true; onStop(); } };
  callBtn.textContent = 'Stop';
  callBtn.classList.add('active');

  try {
    const bits = individualCallBits({ to, from, preambleBits });
    remember(to, from);
    status.textContent = `Calling ${to} from ${from}…`;
    // Show the Stop state before the (blocking) sample generation.
    await Promise.race([nextPaint(), stopped]);
    if (!cancelled) {
      const playing = play(modulate(bits), DEFAULT_FSK.sampleRate);
      // play() may never settle if the audio context cannot resume; Stop must still work.
      const player = await Promise.race([playing, stopped]);
      if (player) {
        await Promise.race([player.done, stopped]);
        player.stop();
      } else {
        playing.then((p) => p.stop(), () => {});
      }
    }
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
fromInput.value = isValidId(savedSelf) ? savedSelf : '';
renderRecent();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
