/** Power of a single frequency over a sample window (Goertzel). */
export function goertzel(samples, start, len, freq, sampleRate) {
  const k = 2 * Math.cos((2 * Math.PI * freq) / sampleRate);
  let s1 = 0;
  let s2 = 0;
  for (let i = start; i < start + len; i++) {
    const s0 = samples[i] + k * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - k * s1 * s2;
}

/**
 * Non-coherent FSK demodulator: per bit window, pick the stronger tone.
 * @returns {{bits: number[], minRatio: number}} minRatio = weakest winner/loser power ratio
 */
export function demodulate(samples, nBits, { sampleRate, baud, freq0, freq1 }) {
  const per = sampleRate / baud;
  const bits = [];
  let minRatio = Infinity;
  for (let i = 0; i < nBits; i++) {
    const p0 = goertzel(samples, Math.round(i * per), Math.round(per), freq0, sampleRate);
    const p1 = goertzel(samples, Math.round(i * per), Math.round(per), freq1, sampleRate);
    bits.push(p1 > p0 ? 1 : 0);
    minRatio = Math.min(minRatio, Math.max(p0, p1) / Math.min(p0, p1));
  }
  return { bits, minRatio };
}
