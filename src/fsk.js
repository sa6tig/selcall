// Continuous-phase binary FSK modulator.

/** Codan/Barrett-compatible tones: bit 0 = 1700 Hz, bit 1 = 1870 Hz, 100 baud. */
export const DEFAULT_FSK = Object.freeze({
  sampleRate: 48000,
  baud: 100,
  freq0: 1700,
  freq1: 1870,
  amplitude: 0.8,
  rampMs: 5, // raised-cosine fade in/out to avoid clicks
  tailMs: 30, // last bit's tone held after the frame; the fade-out happens here
});

/**
 * Modulate bits into audio samples.
 * @param {number[]} bits
 * @param {Partial<typeof DEFAULT_FSK>} [opts]
 * @returns {Float32Array}
 */
export function modulate(bits, opts = {}) {
  const { sampleRate, baud, freq0, freq1, amplitude, rampMs, tailMs } = { ...DEFAULT_FSK, ...opts };
  const total = Math.round((bits.length * sampleRate) / baud) + Math.round((tailMs * sampleRate) / 1000);
  const out = new Float32Array(total);
  let phase = 0;
  for (let n = 0; n < total; n++) {
    const bit = bits[Math.min(bits.length - 1, Math.floor((n * baud) / sampleRate))];
    phase += (2 * Math.PI * (bit ? freq1 : freq0)) / sampleRate;
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    out[n] = amplitude * Math.sin(phase);
  }
  const ramp = Math.min(Math.round((rampMs * sampleRate) / 1000), Math.floor(total / 2));
  for (let i = 0; i < ramp; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / ramp);
    out[i] *= g;
    out[total - 1 - i] *= g;
  }
  return out;
}
