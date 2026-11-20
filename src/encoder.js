// CCIR 493-4 HF Selcall ("Open Selcall") frame encoder.
//
// Frame layout follows Mark Jessop's reverse-engineered implementation, which is
// confirmed to ring Codan and Barrett radios:
// https://github.com/darksidelemm/alltheFSKs/blob/master/CCIR493-4.py
// The 4-digit individual call is verified there. 6-digit addressing (three
// two-digit symbols) is an extrapolation and must be verified on a real IC-F8101.

/** Symbol values (0-99 carry two decimal digits, 100-127 are commands). */
export const SYM = Object.freeze({
  FMT_SELECTIVE: 120, // Format specifier: selective (individual) call
  FMT_CHANNEL_TEST: 123, // Codan channel test (not used yet)
  CAT_ROUTINE: 100, // Category: routine
  EOS_ARQ: 117, // End of sequence: acknowledge request
  EOS_ROS: 127, // End of sequence: other
  PHASING_DX: 125,
  PHASING_RX: [109, 108, 107, 106, 105, 104], // RX-5 .. RX-0
});

/** Number of alternating dot-pattern bits sent before the frame by default (6 s at 100 Bd). */
export const DEFAULT_PREAMBLE_BITS = 600;

/**
 * Split a 4- or 6-digit ID into two-digit symbols, most significant first.
 * @param {string} id
 * @returns {number[]}
 */
export function idToSymbols(id) {
  if (typeof id !== 'string' || !/^(\d{4}|\d{6})$/.test(id)) {
    throw new RangeError(`ID must be 4 or 6 digits, got ${JSON.stringify(id)}`);
  }
  const out = [];
  for (let i = 0; i < id.length; i += 2) out.push(Number(id.slice(i, i + 2)));
  return out;
}

/**
 * Message part of an individual call (before DX/RX interleaving).
 * @param {{to: string, from: string}} ids
 * @returns {number[]}
 */
export function individualCallMessage({ to, from }) {
  return [
    SYM.FMT_SELECTIVE,
    ...idToSymbols(to),
    SYM.CAT_ROUTINE,
    ...idToSymbols(from),
    SYM.EOS_ARQ,
  ];
}

/**
 * Interleave phasing and message into transmit order (DX, RX, DX, RX, ...).
 * The RX stream lags DX by two symbols (time diversity). The format specifier
 * fills the first two RX slots; EOS is sent three times in DX and once in RX.
 * @param {number[]} message format specifier first, EOS last
 * @returns {number[]}
 */
export function frameSymbols(message) {
  const fmt = message[0];
  const eos = message[message.length - 1];
  const dx = [...message, eos, eos];
  const rx = [fmt, fmt, ...message];
  const out = [];
  for (const ph of SYM.PHASING_RX) out.push(SYM.PHASING_DX, ph);
  for (let i = 0; i < dx.length; i++) out.push(dx[i], rx[i]);
  return out;
}

/**
 * 10-bit word in transmit order: 7 data bits LSB first, then a 3-bit count of
 * zero data bits, MSB first.
 * @param {number} value 0-127
 * @returns {number[]}
 */
export function symbolBits(value) {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    throw new RangeError(`symbol out of range: ${value}`);
  }
  const bits = [];
  let zeros = 0;
  for (let i = 0; i < 7; i++) {
    const b = (value >> i) & 1;
    bits.push(b);
    if (!b) zeros++;
  }
  for (let i = 2; i >= 0; i--) bits.push((zeros >> i) & 1);
  return bits;
}

/**
 * Full bit stream for an individual call: dot pattern preamble, then frame.
 * @param {{to: string, from: string, preambleBits?: number}} opts
 * @returns {number[]}
 */
export function individualCallBits({ to, from, preambleBits = DEFAULT_PREAMBLE_BITS }) {
  const bits = [];
  for (let i = 0; i < preambleBits; i++) bits.push(i & 1);
  for (const s of frameSymbols(individualCallMessage({ to, from }))) bits.push(...symbolBits(s));
  return bits;
}
