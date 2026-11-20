// Web Audio playback of a mono sample buffer.

let ctx = null;

/**
 * Play samples. Must be called from a user gesture the first time (autoplay policy).
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @returns {{done: Promise<void>, stop: () => void}}
 */
export function play(samples, sampleRate) {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  const buf = ctx.createBuffer(1, samples.length, sampleRate);
  buf.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  const done = new Promise((resolve) => (src.onended = () => resolve()));
  src.start();
  return { done, stop: () => src.stop() };
}
