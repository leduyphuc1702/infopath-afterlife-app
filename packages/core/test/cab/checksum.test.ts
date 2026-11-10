import { describe, expect, test } from 'vitest';
import { cabChecksum, cfDataChecksum } from '../../src/cab/checksum';
import { msCabChecksum } from '../helpers/cab-writer';
import { walkCfData } from '../helpers/cfdata';
import { readSample, sampleCabinets } from '../helpers/samples';

// R3.4: the MS-CAB checksum.

describe('cfDataChecksum', () => {
  test('all 64 non-zero CFDATA checksums in the 48 sample cabinets match', () => {
    let nonZero = 0;
    for (const { slug, path } of sampleCabinets()) {
      const cab = readSample(path);
      for (const b of walkCfData(cab).blocks) {
        if (b.csum === 0) continue;
        nonZero++;
        const header = cab.subarray(b.offset + 4, b.offset + 8);
        const data = cab.subarray(b.offset + 8, b.offset + 8 + b.cbData);
        expect(cfDataChecksum(header, data), `${slug} block at ${b.offset}`).toBe(b.csum);
      }
    }
    expect(nonZero).toBe(64);
  });
});

describe('cabChecksum', () => {
  test('empty input returns the seed', () => {
    expect(cabChecksum(new Uint8Array(0))).toBe(0);
    expect(cabChecksum(new Uint8Array(0), 0xdeadbeef)).toBe(0xdeadbeef);
  });

  test('whole words XOR little-endian; trailing bytes pack first-highest', () => {
    expect(cabChecksum(new Uint8Array([1, 2, 3, 4]))).toBe(0x04030201);
    expect(cabChecksum(new Uint8Array([1]))).toBe(0x01);
    expect(cabChecksum(new Uint8Array([1, 2]))).toBe(0x0102);
    expect(cabChecksum(new Uint8Array([1, 2, 3]))).toBe(0x010203);
    expect(cabChecksum(new Uint8Array([0xff, 0xff, 0xff, 0xff, 1]))).toBe(0xfffffffe);
  });

  test('agrees with the cab-writer implementation on every length 0–64', () => {
    for (let n = 0; n <= 64; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 0xff);
      expect(cabChecksum(bytes, 0x9e3779b9), `length ${n}`).toBe(msCabChecksum(bytes, 0x9e3779b9));
    }
  });
});
