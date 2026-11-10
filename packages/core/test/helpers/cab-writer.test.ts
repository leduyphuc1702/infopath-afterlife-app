import { describe, expect, test } from 'vitest';
import { walkCfData } from './cfdata';
import { msCabChecksum, writeCabinet } from './cab-writer';
import { readSample, sampleCabinets } from './samples';
import { zlibOracleFolder } from './zlib-oracle';

// The writer is test infrastructure; these checks keep it honest without using src/.

const text = (s: string) => new TextEncoder().encode(s);
const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;

describe('writeCabinet', () => {
  const files = [
    { name: 'manifest.xsf', bytes: text('<xDocumentClass/>'.repeat(300)) },
    { name: 'view1.xsl', bytes: text('<xsl:stylesheet/>'.repeat(200)), attributes: 0xa0 },
  ];

  test('the header has the fields asked for', () => {
    const { bytes, layout } = writeCabinet(files, { header: { setID: 0x4242, iCabinet: 3 } });
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('MSCF');
    expect(u32(bytes, 8)).toBe(bytes.length);
    expect(bytes[24]).toBe(3);
    expect(bytes[25]).toBe(1);
    expect(u16(bytes, 26)).toBe(1);
    expect(u16(bytes, 28)).toBe(2);
    expect(u16(bytes, 30)).toBe(0);
    expect(u16(bytes, 32)).toBe(0x4242);
    expect(u16(bytes, 34)).toBe(3);
    expect(u32(bytes, 16)).toBe(layout.files[0]);
    expect(u16(bytes, layout.files[1]! + 14)).toBe(0xa0);
  });

  test('raw overrides are written as given', () => {
    const { bytes, layout } = writeCabinet(files, {
      header: { signature: 0x12345678, cFiles: 2001, versionMajor: 9 },
      folderFields: { 0: { typeCompress: 0x1503 } },
      fileFields: { 1: { iFolder: 7 } },
    });
    expect(u32(bytes, 0)).toBe(0x12345678);
    expect(u16(bytes, 28)).toBe(2001);
    expect(bytes[25]).toBe(9);
    expect(u16(bytes, layout.folders[0]! + 6)).toBe(0x1503);
    expect(u16(bytes, layout.files[1]! + 8)).toBe(7);
  });

  test('the zlib oracle reads its data back, one block and many', () => {
    const all = new Uint8Array([...files[0]!.bytes, ...files[1]!.bytes]);
    for (const blockSize of [32_768, 1000, 333]) {
      const { bytes } = writeCabinet(files, { blockSize });
      const { blocks } = walkCfData(bytes);
      expect(blocks.length).toBe(Math.ceil(all.length / blockSize));
      expect(zlibOracleFolder(bytes)).toEqual(all);
    }
  });

  test('later blocks really use the history', () => {
    const { bytes } = writeCabinet(files, { blockSize: 1000 });
    const { blocks } = walkCfData(bytes);
    // A block compressed against the previous output is far smaller than the first one.
    expect(blocks[2]!.cbData).toBeLessThan(blocks[0]!.cbData / 2);
  });

  test('reserve areas are written and the oracle still reads the data', () => {
    const { bytes, layout } = writeCabinet(files, { reserve: { header: 6, folder: 3, data: 5 } });
    expect(u16(bytes, 30)).toBe(0x0004);
    expect(u16(bytes, 36)).toBe(6);
    expect(bytes[38]).toBe(3);
    expect(bytes[39]).toBe(5);
    expect(layout.headerEnd).toBe(46);
    expect(layout.folders[0]).toBe(46);
    expect(layout.files[0]).toBe(46 + 8 + 3);
    expect(zlibOracleFolder(bytes)).toEqual(
      new Uint8Array([...files[0]!.bytes, ...files[1]!.bytes]),
    );
  });

  test('several folders and stored folders are laid out in order', () => {
    const { bytes, layout } = writeCabinet(
      [
        { name: 'a', bytes: text('aaaa'), folder: 1 },
        { name: 'b', bytes: text('bbbb') },
      ],
      { folders: [{ compression: 'none' }, { compression: 'mszip' }] },
    );
    expect(u16(bytes, 26)).toBe(2);
    expect(u16(bytes, layout.folders[0]! + 6)).toBe(0);
    expect(u16(bytes, layout.folders[1]! + 6)).toBe(1);
    expect(u32(bytes, layout.folders[0]!)).toBe(layout.blocks[0]![0]);
    expect(u32(bytes, layout.folders[1]!)).toBe(layout.blocks[1]![0]);
    expect(bytes.subarray(layout.blocks[0]![0]! + 8, layout.blocks[0]![0]! + 12)).toEqual(
      text('bbbb'),
    );
  });

  test('checksums: valid by default, zero on request, overridable', () => {
    const valid = writeCabinet(files).bytes;
    const block = walkCfData(valid).blocks[0]!;
    const raw = valid.subarray(block.offset + 8, block.offset + 8 + block.cbData);
    const expected = msCabChecksum(
      valid.subarray(block.offset + 4, block.offset + 8),
      msCabChecksum(raw, 0),
    );
    expect(block.csum).toBe(expected);
    expect(walkCfData(writeCabinet(files, { checksums: 'zero' }).bytes).blocks[0]!.csum).toBe(0);
    const forced = writeCabinet(files, { blockFields: { '0:0': { csum: 0xdeadbeef } } }).bytes;
    expect(walkCfData(forced).blocks[0]!.csum).toBe(0xdeadbeef);
  });

  test('its checksum agrees with every non-zero checksum in the sample cabinets', () => {
    let checked = 0;
    for (const { path } of sampleCabinets()) {
      const cab = readSample(path);
      for (const b of walkCfData(cab).blocks) {
        if (b.csum === 0) continue;
        const raw = cab.subarray(b.offset + 8, b.offset + 8 + b.cbData);
        expect(msCabChecksum(cab.subarray(b.offset + 4, b.offset + 8), msCabChecksum(raw, 0))).toBe(
          b.csum,
        );
        checked++;
      }
    }
    expect(checked).toBe(64);
  });
});
