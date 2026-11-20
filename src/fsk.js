// Continuous-phase binary FSK modulator.

/** Codan/Barrett-compatible tones: bit 0 = 1700 Hz, bit 1 = 1870 Hz, 100 baud. */
export const DEFAULT_FSK = Object.freeze({
  sampleRate: 48000,
  baud: 100,
  freq0: 1700,
  freq1: 1870,
  amplitude: 0.8,
  rampMs: 5, // raised-cosine fade in/out to avoid clicks
  leadMs: 30, // first bit's tone held before the frame; the fade-in happens here
  tailMs: 30, // last bit's tone held after the frame; the fade-out happens here
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
  const { sampleRate, baud, freq0, freq1, amplitude, rampMs, leadMs, tailMs } = { ...DEFAULT_FSK, ...opts };
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

  const lead = Math.round((leadMs * sampleRate) / 1000);
  const total = lead + Math.round((bits.length * sampleRate) / baud) + Math.round((tailMs * sampleRate) / 1000);
  const out = new Float32Array(total);
  let phase = 0;
  for (let n = 0; n < total; n++) {
    const k = Math.floor(((n - lead) * baud) / sampleRate);
    const bit = bits[Math.min(bits.length - 1, Math.max(0, k))];
    phase += (2 * Math.PI * (bit ? freq1 : freq0)) / sampleRate;
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
