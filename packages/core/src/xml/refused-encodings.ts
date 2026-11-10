// Canonical encoding names (`TextDecoder#encoding`) that only one of Node 22 and Chromium
// accepts (design D11, R5.3). Core refuses them everywhere so both runtimes give the same result.
//
// Measured 2026-11-10 over the 228 labels of the WHATWG Encoding Standard (task 2): Node 22.23.4
// accepts 220 labels, Chromium 158.0.8127.18 (dedicated Worker) accepts 222. The difference is
// exactly these two, which Chromium accepts and Node 22 rejects. Both reject the 6 `replacement`
// labels. Every other label maps to the same canonical name in both.
// Kept in step by test/xml/encoding-labels.test.ts and test/browser/encodings.browser.test.ts.
export const REFUSED_ENCODINGS: readonly string[] = ['iso-8859-16', 'x-user-defined'];
