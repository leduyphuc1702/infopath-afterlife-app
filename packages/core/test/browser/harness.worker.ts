// Dedicated module Worker: reports which globals core relies on (design §7.1).
const report = {
  DecompressionStream: typeof DecompressionStream,
  TextDecoder: typeof TextDecoder,
  DOMParser: typeof (globalThis as { DOMParser?: unknown }).DOMParser,
};

postMessage(report);
