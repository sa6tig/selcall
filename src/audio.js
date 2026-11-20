// Web Audio playback of a mono sample buffer.

let ctx = null;

/**
 * Play samples. Call from a user gesture (autoplay policy).
 * `done` resolves when playback ends or `stop()` is called.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @returns {Promise<{done: Promise<void>, stop: () => void}>}
 */
export async function play(samples, sampleRate) {
  ctx ??= new AudioContext();
  if (ctx.state !== 'running') await ctx.resume();
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
