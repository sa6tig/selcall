import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modulate } from '../src/fsk.js';

/** Power of a single frequency over a sample window (Goertzel). */
function goertzel(samples, start, len, freq, sampleRate) {
  const k = (2 * Math.cos((2 * Math.PI * freq) / sampleRate));
  let s1 = 0, s2 = 0;
  for (let i = start; i < start + len; i++) {
    const s0 = samples[i] + k * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - k * s1 * s2;
}

test('length is bits / baud seconds', () => {
  assert.equal(modulate([0, 1, 0, 1], { sampleRate: 48000, baud: 100 }).length, 1920);
});

test('each bit carries the expected tone', () => {
  const sr = 48000;
  const bits = [0, 0, 1, 1, 0, 1];
  const s = modulate(bits, { sampleRate: sr, rampMs: 0 });
  const per = sr / 100;
  bits.forEach((bit, i) => {
    const p0 = goertzel(s, i * per, per, 1700, sr);
    const p1 = goertzel(s, i * per, per, 1870, sr);
    assert.ok(bit ? p1 > 10 * p0 : p0 > 10 * p1, `bit ${i}`);
  });
});

test('phase is continuous (no large sample jumps) and amplitude bounded', () => {
  const s = modulate([0, 1, 0, 1, 1, 0], { amplitude: 0.8 });
  let maxStep = 0;
  for (let i = 1; i < s.length; i++) maxStep = Math.max(maxStep, Math.abs(s[i] - s[i - 1]));
  // Max slope at 1870 Hz / 48 kHz: 2*pi*1870/48000*0.8 ~ 0.196
  assert.ok(maxStep < 0.2, `max step ${maxStep}`);
  assert.ok(s.every((v) => Math.abs(v) <= Math.fround(0.8)));
});
