import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modulate } from '../src/fsk.js';
import { goertzel } from './helpers.js';

test('length is lead plus bits / baud seconds plus tail', () => {
  const opts = { sampleRate: 48000, baud: 100 };
  assert.equal(modulate([0, 1, 0, 1], { ...opts, leadMs: 0, tailMs: 0, rampMs: 0 }).length, 1920);
  assert.equal(modulate([0, 1, 0, 1], { ...opts, leadMs: 20, tailMs: 30, rampMs: 5 }).length, 960 + 1920 + 1440);
});

const peakOf = (s, from, to) => {
  let peak = 0;
  for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(s[i]));
  return peak;
};

test('fade-in stays in the lead: start of first bit keeps full amplitude', () => {
  // First 5 ms of the first bit: a fade placed on the bit instead of the lead would attenuate exactly this span.
  const s = modulate([0, 1], { sampleRate: 48000, rampMs: 5, leadMs: 30 });
  const peak = peakOf(s, 1440, 1440 + 240);
  assert.ok(peak > 0.79, `start-of-first-bit peak ${peak}`);
  assert.ok(Math.abs(s[0]) < 0.01, 'output fades in from silence');
});

test('fade-out stays in the tail: end of last bit keeps full amplitude', () => {
  // Last 5 ms of the final bit: a fade placed on the bit instead of the tail would attenuate exactly this span.
  const s = modulate([0, 1], { sampleRate: 48000, rampMs: 5, leadMs: 30, tailMs: 30 });
  const peak = peakOf(s, 1440 + 720, 1440 + 960);
  assert.ok(peak > 0.79, `end-of-last-bit peak ${peak}`);
  assert.ok(Math.abs(s[s.length - 1]) < 0.01, 'output fades to silence');
});

test('each bit carries the expected tone', () => {
  const sr = 48000;
  const bits = [0, 0, 1, 1, 0, 1];
  const s = modulate(bits, { sampleRate: sr, rampMs: 0, leadMs: 0 });
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

test('smoothed tone switches cut splatter far from the tones', () => {
  // A slope jump at each switch spreads energy well outside 1700-1870 Hz (heard as clicks).
  const sr = 48000;
  const opts = { sampleRate: sr, rampMs: 20, leadMs: 20, tailMs: 20 };
  let seed = 12345; // fixed pseudo-random bits: a periodic pattern has a line spectrum that single bins miss
  const bits = Array.from({ length: 200 }, () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 16) & 1);
  const band = (s, from, to) => {
    let e = 0;
    for (let f = from; f < to; f += 10) e += goertzel(s, 0, s.length, f, sr);
    return e;
  };
  const splatterDb = (s) => 10 * Math.log10(band(s, 3500, 6000) / band(s, 1600, 1970));
  const hard = splatterDb(modulate(bits, { ...opts, smoothMs: 0 }));
  const soft = splatterDb(modulate(bits, { ...opts, smoothMs: 2 }));
  assert.ok(soft < hard - 20, `3.5-6 kHz splatter: smoothed ${soft.toFixed(1)} dB vs hard ${hard.toFixed(1)} dB`);
});

test('bad bits and options fail loudly', () => {
  const bad = [
    [[], {}],
    [[0, 2], {}],
    [[0, 1], { baud: NaN }],
    [[0, 1], { baud: 0 }],
    [[0, 1], { sampleRate: -1 }],
    [[0, 1], { freq1: 30000 }],
    [[0, 1], { freq0: 0 }],
    [[0, 1], { amplitude: 1.5 }],
    [[0, 1], { amplitude: 0 }],
    [[0, 1], { tailMs: -1 }],
    [[0, 1], { leadMs: -1 }],
    [[0, 1], { rampMs: 40, leadMs: 50, tailMs: 30 }],
    [[0, 1], { rampMs: 40, leadMs: 30, tailMs: 50 }],
    [[0, 1], { smoothMs: -1 }],
    [[0, 1], { smoothMs: 11 }],
  ];
  for (const [bits, opts] of bad) {
    assert.throws(() => modulate(bits, opts), RangeError, JSON.stringify({ bits, opts }));
  }
});
