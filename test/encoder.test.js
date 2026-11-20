import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYM,
  idToSymbols,
  individualCallMessage,
  frameSymbols,
  symbolBits,
  individualCallBits,
  MAX_PREAMBLE_BITS,
} from '../src/encoder.js';

test('frameSymbols rejects a message without format specifier or EOS', () => {
  assert.throws(() => frameSymbols([18, 81, 100, 18, 82, 117]), RangeError);
  assert.throws(() => frameSymbols([120, 18, 81, 100, 18, 82]), RangeError);
  assert.throws(() => frameSymbols([120, 117]), RangeError);
});

test('individualCallBits rejects bad preamble lengths', () => {
  for (const preambleBits of [NaN, -1, 1.5, MAX_PREAMBLE_BITS + 1, '600']) {
    assert.throws(() => individualCallBits({ to: '1881', from: '1882', preambleBits }), RangeError, String(preambleBits));
  }
  assert.doesNotThrow(() => individualCallBits({ to: '1881', from: '1882', preambleBits: 0 }));
});

test('idToSymbols splits into two-digit symbols and keeps leading zeros', () => {
  assert.deepEqual(idToSymbols('1881'), [18, 81]);
  assert.deepEqual(idToSymbols('0102'), [1, 2]);
  assert.deepEqual(idToSymbols('114934'), [11, 49, 34]);
});

test('idToSymbols rejects bad IDs', () => {
  for (const bad of ['123', '12345', '1234567', '12a4', '', 1234]) {
    assert.throws(() => idToSymbols(bad), RangeError);
  }
});

test('4-digit individual call matches the reverse-engineered reference sequence', () => {
  // Reference: darksidelemm/alltheFSKs CCIR493-4.py selcall_call(source=1882, dest=1881),
  // phasing excluded. Pairs are (DX, RX).
  const [A1, A2, B1, B2] = [18, 82, 18, 81];
  const S = 120, R = 100, Q = 117;
  const reference = [S, S, B1, S, B2, S, R, B1, A1, B2, A2, R, Q, A1, Q, A2, Q, Q];
  const frame = frameSymbols(individualCallMessage({ to: '1881', from: '1882' }));
  assert.deepEqual(frame.slice(12), reference);
  assert.deepEqual(frame.slice(0, 12), [125, 109, 125, 108, 125, 107, 125, 106, 125, 105, 125, 104]);
});

test('RX stream repeats each DX symbol two symbol pairs later', () => {
  const frame = frameSymbols(individualCallMessage({ to: '123456', from: '654321' }));
  const body = frame.slice(12);
  const dx = body.filter((_, i) => i % 2 === 0);
  const rx = body.filter((_, i) => i % 2 === 1);
  assert.deepEqual(rx.slice(2), dx.slice(0, -2));
  assert.equal(dx.filter((s) => s === SYM.EOS_ARQ).length, 3);
});

test('symbolBits: 7 data bits LSB first, then zero count MSB first', () => {
  assert.deepEqual(symbolBits(0), [0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);
  assert.deepEqual(symbolBits(127), [1, 1, 1, 1, 1, 1, 1, 0, 0, 0]);
  // 120 = 0b1111000: data LSB first 0001111, zeros = 3 = 011
  assert.deepEqual(symbolBits(120), [0, 0, 0, 1, 1, 1, 1, 0, 1, 1]);
});

test('symbolBits matches the reference lookup-table word encoding', () => {
  const table = [0x0000, 0x0200, 0x0100, 0x0300, 0x0080, 0x0280, 0x0180, 0x0380];
  for (let v = 0; v < 128; v++) {
    let zeros = 0;
    for (let i = 0; i < 7; i++) if (!((v >> i) & 1)) zeros++;
    const word = v | table[zeros];
    const expected = Array.from({ length: 10 }, (_, i) => (word >> i) & 1);
    assert.deepEqual(symbolBits(v), expected, `value ${v}`);
  }
});

test('individualCallBits: alternating preamble then 10 bits per frame symbol', () => {
  const bits = individualCallBits({ to: '1881', from: '1882', preambleBits: 8 });
  assert.deepEqual(bits.slice(0, 8), [0, 1, 0, 1, 0, 1, 0, 1]);
  assert.equal(bits.length, 8 + 30 * 10);
});
