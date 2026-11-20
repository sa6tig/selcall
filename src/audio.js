// Web Audio playback of a mono sample buffer.

let ctx = null;

// Fade applied when playback is stopped early, so the cut does not click.
const STOP_FADE_S = 0.01;

/**
 * Create or resume the shared AudioContext. Call synchronously inside a user
 * gesture (autoplay policy); the returned promise may never settle if the
 * platform refuses audio.
 * @returns {Promise<void>}
 */
export function unlock() {
  ctx ??= new AudioContext();
  return ctx.state === 'running' ? Promise.resolve() : ctx.resume();
}

/**
 * Play samples. Call unlock() from the user gesture first.
 * `done` resolves when playback ends or `stop()` is called; after `stop()` the
 * audio fades out over a further 10 ms.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @returns {Promise<{done: Promise<void>, stop: () => void}>}
 */
export async function play(samples, sampleRate) {
  await unlock();
  const buf = ctx.createBuffer(1, samples.length, sampleRate);
  buf.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  src.connect(gain).connect(ctx.destination);
  let finish;
  const done = new Promise((resolve) => (finish = resolve));
  src.onended = () => finish();
  src.start();
  return {
    done,
    stop: () => {
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + STOP_FADE_S);
      try {
        src.stop(t + STOP_FADE_S);
      } catch {
        /* already stopped */
      }
      finish();
    },
  };
}
