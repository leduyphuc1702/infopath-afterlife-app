// Test-only walker over the CFDATA blocks of a single-folder cabinet (MS-CAB), enough for the
// inflate spike (task 2). It uses only Uint8Array and DataView so the browser Worker can import
// it. The real reader is src/cab/ (tasks 4 and 5).

export interface CfDataBlock {
  /** Offset of the CFDATA header in the cabinet. */
  offset: number;
  csum: number;
  cbData: number;
  cbUncomp: number;
  /** Block bytes; for MSZIP, after the `CK` signature. */
  data: Uint8Array;
}

export interface SingleFolder {
  typeCompress: number;
  blocks: CfDataBlock[];
}

export function walkCfData(cab: Uint8Array): SingleFolder {
  const view = new DataView(cab.buffer, cab.byteOffset, cab.byteLength);
  const sig = String.fromCharCode(...cab.subarray(0, 4));
  if (sig !== 'MSCF') throw new Error('not a cabinet');
  const cFolders = view.getUint16(26, true);
  const flags = view.getUint16(30, true);
  if (cFolders !== 1) throw new Error(`expected 1 folder, found ${cFolders}`);
  if (flags & 0x0003) throw new Error('spanned cabinets are not handled by this helper');

  // One folder, so its own reserve area (cbCFFolder) never has to be skipped.
  let at = 36;
  let cbCFData = 0;
  if (flags & 0x0004) {
    const cbCFHeader = view.getUint16(36, true);
    cbCFData = view.getUint8(39);
    at = 40 + cbCFHeader;
  }

  const coffCabStart = view.getUint32(at, true);
  const cCFData = view.getUint16(at + 4, true);
  const typeCompress = view.getUint16(at + 6, true) & 0x000f;

  const blocks: CfDataBlock[] = [];
  let p = coffCabStart;
  for (let i = 0; i < cCFData; i++) {
    const csum = view.getUint32(p, true);
    const cbData = view.getUint16(p + 4, true);
    const cbUncomp = view.getUint16(p + 6, true);
    const start = p + 8 + cbCFData;
    const raw = cab.subarray(start, start + cbData);
    if (raw.length !== cbData) throw new Error(`block ${i} truncated`);
    let data = raw;
    if (typeCompress === 1) {
      if (raw[0] !== 0x43 || raw[1] !== 0x4b) throw new Error(`block ${i} has no CK`);
      data = raw.subarray(2);
    }
    blocks.push({ offset: p, csum, cbData, cbUncomp, data });
    p = start + cbData;
  }
  return { typeCompress, blocks };
}
