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
- `roles.xsf`: `xsf:roles` with roles and every kind of `xsf:membership` entry (spec 01 task 15).
- `allowed-control.xsf`: `xsf:permissions/xsf:allowedControl` (spec 01 task 15).
- `signature-lines.xsf`: `xsf3:signatureLines` on a view extension, with every text child
  (spec 01 task 15).
- `xsd/`: schemas for the schema set (spec 01 task 17): `include/` (an include by relative path
  and a chameleon include, matched case-insensitively by last segment), `remote-location.xsd`
  (URL, drive-letter, absolute and missing locations, none fetched), `import-no-location/`
  (import resolved by namespace), and one file per construct that stays unknown (`key`, `keyref`,
  `unique`, `redefine`, `notation`, `substitutionGroup`, `abstract`, `block`, `final`).
- `xsd/extension.xsd`, `xsd/recursion.xsd`, `xsd/kinds.xsd`: derivation order and facets,
  recursion, and one element per row of the kind table (spec 01 task 18).
- `xsd/group.xsd`, `xsd/attribute-group.xsd`, `xsd/list.xsd`, `xsd/union.xsd`: model groups,
  attribute groups, lists and unions (spec 01 task 19).
- `xsd/restriction.xsd`: attributes in derived types (XML Schema 1.0 Part 1 §3.4.2): inherited,
  redeclared with a narrower type, and prohibited in complex and simple content restrictions, and
  a prohibited attribute outside any derivation.
- `views/`: view XSL for the static view scan (spec 02 task 7), with a shared main schema
  (`myschema.xsd`, root `my:order`) and a secondary source `Depots` (`rows.xsd`, `rows.xml`);
  `test/helpers/view-package.ts` generates the manifest around them. One file per shape: a mode
  called twice, a mode never called, `call-template`, a view that is not well-formed, an unbound
  `object`, ExpressionBoxes (a repeating average and a string literal), a `GetDOM` binding and a
  filtered `GetDOM` list, `DropDown` next to `dropdown`, an ActiveX person picker (`{{…}}` in
  `xd:xctname`, a group binding, `xd:server` on a single-label host), a dynamic `title`, and
  (spec 02 task 10) `button-row.xsl`, a button in a repeating row whose rule writes `../x`. The
  shapes follow counts recorded from the private corpus; the wording, names and GUIDs are ours.
