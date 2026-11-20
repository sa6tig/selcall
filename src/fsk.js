// Continuous-phase binary FSK modulator.

/** Codan/Barrett-compatible tones: bit 0 = 1700 Hz, bit 1 = 1870 Hz, 100 baud. */
export const DEFAULT_FSK = Object.freeze({
  sampleRate: 48000,
  baud: 100,
  freq0: 1700,
  freq1: 1870,
  amplitude: 0.8,
  // Raised-cosine fade in/out. Slow enough that phone loudness limiters track the
  // rise instead of overshooting into a pop at tone onset.
  rampMs: 100,
  leadMs: 150, // first bit's tone held before the frame; the fade-in happens here
  tailMs: 100, // last bit's tone held after the frame; the fade-out happens here
  // Raised-cosine frequency transition centred on each bit boundary. Removes the
  // slope jump at tone switches, which clicks on phone speakers and splatters.
  smoothMs: 2,
});

const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const nonNegative = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function fail(name, value, rule) {
  throw new RangeError(`${name} must be ${rule}, got ${value}`);
}

/**
 * Modulate bits into audio samples.
 * @param {number[]} bits non-empty, each 0 or 1
 * @param {Partial<typeof DEFAULT_FSK>} [opts]
 * @returns {Float32Array}
 */
export function modulate(bits, opts = {}) {
  const { sampleRate, baud, freq0, freq1, amplitude, rampMs, leadMs, tailMs, smoothMs } = { ...DEFAULT_FSK, ...opts };
  if (!Array.isArray(bits) || bits.length === 0) fail('bits', bits, 'a non-empty array');
  bits.forEach((b, i) => b === 0 || b === 1 || fail(`bits[${i}]`, b, '0 or 1'));
  if (!positive(sampleRate)) fail('sampleRate', sampleRate, 'a positive number');
  if (!positive(baud) || baud > sampleRate / 2) fail('baud', baud, 'positive and at most sampleRate/2');
  for (const [name, f] of [['freq0', freq0], ['freq1', freq1]]) {
    if (!positive(f) || f >= sampleRate / 2) fail(name, f, 'positive and below sampleRate/2');
  }
  if (!positive(amplitude) || amplitude > 1) fail('amplitude', amplitude, 'in (0, 1]');
  if (!nonNegative(leadMs)) fail('leadMs', leadMs, 'a non-negative number');
  if (!nonNegative(tailMs)) fail('tailMs', tailMs, 'a non-negative number');
  // The fades must stay inside the lead and tail, or they attenuate the first/last data bit.
  const maxRamp = Math.min(leadMs, tailMs);
  if (!nonNegative(rampMs) || rampMs > maxRamp) fail('rampMs', rampMs, `non-negative and at most leadMs and tailMs (${maxRamp})`);
  const bitMs = 1000 / baud;
  if (!nonNegative(smoothMs) || smoothMs > bitMs) fail('smoothMs', smoothMs, `non-negative and at most one bit (${bitMs} ms)`);

  const lead = Math.round((leadMs * sampleRate) / 1000);
  const total = lead + Math.round((bits.length * sampleRate) / baud) + Math.round((tailMs * sampleRate) / 1000);
  const out = new Float32Array(total);
  const freqOf = (k) => (bits[Math.min(bits.length - 1, Math.max(0, k))] ? freq1 : freq0);
  const half = smoothMs / bitMs / 2; // half the transition width, in bits
  const blend = (fa, fb, x) => fa + (fb - fa) * (0.5 - 0.5 * Math.cos(Math.PI * x)); // x: 0 -> fa, 1 -> fb
  let phase = 0;
  for (let n = 0; n < total; n++) {
    const t = ((n - lead) * baud) / sampleRate; // position in bits
    const k = Math.floor(t);
    const frac = t - k;
    let f = freqOf(k);
    if (frac < half) f = blend(freqOf(k - 1), f, (frac + half) / (2 * half));
    else if (frac > 1 - half) f = blend(f, freqOf(k + 1), (frac - 1 + half) / (2 * half));
    phase += (2 * Math.PI * f) / sampleRate;
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    out[n] = amplitude * Math.sin(phase);
  }
  const ramp = Math.round((rampMs * sampleRate) / 1000);
  for (let i = 0; i < ramp; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / ramp);
    out[i] *= g;
    out[total - 1 - i] *= g;
  }
  return out;
}
