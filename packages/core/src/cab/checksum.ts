// MS-CAB CFDATA checksum (R3.4): XOR of the little-endian 32-bit words, then the 1–3 trailing
// bytes packed with the first of them highest. A CFDATA checksum is this over the block data,
// seeded into the same function over the header bytes from `cbData` to the end of the reserve.

export function cabChecksum(bytes: Uint8Array, seed = 0): number {
  let sum = seed;
  const words = bytes.length >>> 2;
  let i = 0;
  for (let w = 0; w < words; w++, i += 4) {
    sum ^= bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24);
  }
  let tail = 0;
  const rest = bytes.length & 3;
  if (rest === 3) tail = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
  else if (rest === 2) tail = (bytes[i]! << 8) | bytes[i + 1]!;
  else if (rest === 1) tail = bytes[i]!;
  return (sum ^ tail) >>> 0;
}

/** The checksum a CFDATA block should carry: `data`, then `header` (cbData, cbUncomp, reserve). */
export function cfDataChecksum(header: Uint8Array, data: Uint8Array): number {
  return cabChecksum(header, cabChecksum(data));
}
