// Web Audio playback of a mono sample buffer.

let ctx = null;

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
 * `done` resolves when playback ends or `stop()` is called.
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
  src.connect(ctx.destination);
  let finish;
  const done = new Promise((resolve) => (finish = resolve));
  src.onended = () => finish();
  src.start();
  return {
    done,
    stop: () => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      finish();
    },
  };
}
