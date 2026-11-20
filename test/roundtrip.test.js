import { test } from 'node:test';
import assert from 'node:assert/strict';
import { individualCallBits, DEFAULT_PREAMBLE_BITS } from '../src/encoder.js';
import { modulate, DEFAULT_FSK } from '../src/fsk.js';
import { demodulate } from './helpers.js';

// End to end: the audio of a full default call (6 s preamble, ~9 s, ~435k samples)
// must demodulate back to exactly the encoded bits, with every bit at full level.
for (const [to, from] of [['1881', '1882'], ['123456', '654321']]) {
  test(`full call ${from} -> ${to} demodulates to the encoded bits`, () => {
    const bits = individualCallBits({ to, from });
    assert.ok(bits.length > DEFAULT_PREAMBLE_BITS);
    const s = modulate(bits);
    const per = DEFAULT_FSK.sampleRate / DEFAULT_FSK.baud;
    const ms = DEFAULT_FSK.sampleRate / 1000;
    const lead = DEFAULT_FSK.leadMs * ms;
    assert.equal(s.length, lead + bits.length * per + DEFAULT_FSK.tailMs * ms);

    const { bits: decoded, minRatio } = demodulate(s, bits.length, DEFAULT_FSK, lead);
    assert.deepEqual(decoded, bits);
    assert.ok(minRatio > 10, `weakest bit tone ratio ${minRatio}`);

    // Every bit, including the first (the fade-in is in the lead), reaches full
    // amplitude, and no sample is NaN or out of range over the whole call.
    for (let i = 0; i < bits.length; i++) {
      let peak = 0;
      for (let n = lead + i * per; n < lead + (i + 1) * per; n++) peak = Math.max(peak, Math.abs(s[n]));
      assert.ok(peak > 0.79, `bit ${i} peak ${peak}`);
    }
    assert.ok(s.every((v) => Number.isFinite(v) && Math.abs(v) <= Math.fround(DEFAULT_FSK.amplitude)));
  });
}
