// Dedicated module Worker: inflates the single folder of a cabinet block by block with core's
// inflateBlock and replies with the SHA-256 of the folder output (task 2, design D2).
import { inflateBlock } from '../../src/cab/inflate';
import { walkCfData } from '../helpers/cfdata';

export interface InflateReply {
  sha256?: string;
  blocks?: number;
  error?: string;
}

async function inflateFolder(cab: Uint8Array): Promise<InflateReply> {
  const { blocks } = walkCfData(cab);
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.cbUncomp, 0));
  let at = 0;
  for (const block of blocks) {
    const history = out.subarray(Math.max(0, at - 32_768), at);
    out.set(await inflateBlock(block.data, history, block.cbUncomp), at);
    at += block.cbUncomp;
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', out));
  const sha256 = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { sha256, blocks: blocks.length };
}

onmessage = (event: MessageEvent<Uint8Array>) => {
  inflateFolder(event.data).then(
    (reply) => postMessage(reply),
    (e: unknown) => postMessage({ error: String(e) }),
  );
};
