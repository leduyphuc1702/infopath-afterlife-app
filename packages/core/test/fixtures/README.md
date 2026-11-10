# Test fixtures

## `whatwg-encodings.json`

An unmodified copy of `encodings.json` from the WHATWG Encoding Standard: every encoding label
and the encoding it maps to (228 labels).

- Source: <https://encoding.spec.whatwg.org/encodings.json>
- Retrieved: 2026-11-10 (server `Last-Modified: Mon, 19 Oct 2026 23:30:10 GMT`)
- SHA-256: `078212b3697f60b81225b6671bd9da2604497abff0aa8e96e4d46605c02ac9e7`
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0),
  <https://creativecommons.org/licenses/by/4.0/>. Copyright © WHATWG (Apple, Google, Mozilla,
  Microsoft), as stated on <https://encoding.spec.whatwg.org/>.

Used by `test/xml/encoding-labels.test.ts` and `test/browser/encodings.browser.test.ts` to
measure which labels `TextDecoder` accepts in Node 22 and in a browser Worker (design D11).

## `synthetic/`

Hand-written manifests and schemas for constructs that no in-repo sample uses (design §13.1).
Written for this project, MIT like the rest of the repository; every host, GUID and name in them
is fictional.

- `sharepoint-adapters.xsf`: `sharepointListAdapter` and `sharepointListAdapterRW` with their
  fields and `xsf2` extensions, and the misspelling `sharePointListAdapterRW` (spec 01 task 14).
- `connectoid.xsf`: `xsf2:connectoid` on an `adoAdapter`, a `webServiceAdapter` and a
  `useHttpHandler`, and an extension whose `ref` names no adapter (spec 01 task 14).
