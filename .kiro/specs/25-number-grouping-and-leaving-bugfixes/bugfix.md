# Spec 25: number grouping and leaving the page

Found by the reviewer on `f87164f` (G1 from [MS-IPFF2] and the 29 private templates; G2 from the
own samples; L1, L2 by checking the built app) and L3 by the test written for it.

## G1. A number format without `grouping` shows no digit grouping
- **Current behaviour:** WHEN a `number` or `percentage` format has no `grouping` item
  (`numDigits:2;negativeOrder:1;`, all 70 such formats in the private corpus), THE SYSTEM shows
  1472.13 as `1472.13`.
- **Expected behaviour:** THE SYSTEM SHALL group by 3 (en-US) when `grouping` is absent or `-1`,
  for number, percentage and currency, in `xd:datafmt` and `xdFormatting:formatString`
  ([MS-IPFF2] 2.4.2.11: "If unspecified, the grouping is determined based on the form server
  settings"). `-1` is read by analogy with `negativeOrder:-1`; not seen.
- **Unchanged behaviour:** `grouping:0` none; `1`–`9` group sizes (form 08: `4,3` [seen]); `32`;
  currency without `grouping` (`$1,423.94`, form 04 [seen]); raw values in the record, CSV, Excel.

## G2. The stored references still carry the own samples' `grouping:1;`
- **Current behaviour:** after the samples lost `grouping:1;` in 13 templates, 70 tests in four
  files compare against the old references.
- **Expected behaviour:** the references SHALL be regenerated once, after G1, and differ only in
  the missing item, the source columns it shifts and the text of numbers.

## L1. Typing not yet out of its field is lost without a question when the page is left
- **Current behaviour:** WHEN a person types in a Fill field and, without leaving it, reloads,
  closes the tab or leaves with Back, THE SYSTEM asks nothing (`beforeunload` follows
  `fill.res.dirty`, which only a committed change sets).
- **Expected behaviour:** THE SYSTEM SHALL ask as for a committed change whenever a field holds
  typing not yet committed.
- **Unchanged behaviour:** no question when nothing was typed, or the field was left as it was.

## L2. Back from the first form opened leaves the app
- **Current behaviour:** WHEN a person opens a sample or their files from the start page and
  presses Back, THE SYSTEM leaves the app: `visit()` replaced the page's own entry with the first
  place.
- **Expected behaviour:** the first place SHALL be an entry after the start page: Back returns to
  the start page (asking first when something is unsaved), Forward opens the form again.
- **Unchanged behaviour:** tasks (specs 21–23): one entry per task, Back to the start page,
  Forward to the task. This reverses spec 13 B2's sentence "the first place replaces the page's
  own entry, so Back from it leaves the page": since spec 21 the start page is a screen of its
  own, and Back to it is what a person choosing another sample expects.

## L3. A number typed as the box shows it is stored as text
- **Current behaviour:** WHEN a person types `1,200` in Qty (04), THE SYSTEM stores
  `<my:quantity>1,200</my:quantity>` and marks nothing.
- **Expected behaviour:** in a `number` or `currency` box, THE SYSTEM SHALL store a value typed
  with en-US grouping commas (and `$` in a currency box) as the number: `1200`.
- **Unchanged behaviour:** anything else is stored as typed.

## Properties
No new property; P17 (history) still holds with the first place pushed.

## Not fixed in this round
- **L3 for percentage boxes and negative amounts in parentheses** (`12%`, `($5.00)`): what the
  record should get (0.12 or 12) needs InfoPath's behaviour, which is not seen.
- **L3, why the check did not mark `1,200`:** the box's schema type was not looked at this
  round; budget.
- **`docs/corpus-facts.md` counts** were not taken again over the 71-form corpus; a note says
  which own patterns changed.
