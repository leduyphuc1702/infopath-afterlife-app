// Our own fixed rules, appended after the view's scoped rules (spec 03 design §8.1 step 9). They
// apply to every render root, and are drawn with CSS only: no Microsoft asset.

/** `position: fixed` in a view cannot leave the root; the root is the containing block. */
const ROOT = '.afl-root{contain:layout paint;position:relative}';

/**
 * R6.6, design §9.2: InfoPath's required mark, a small red `*` a few pixels inside the right edge,
 * vertically centred, with no border change. `:where()` keeps the specificity at zero, so a
 * position the view sets still wins (absolute and fixed also contain the mark).
 */
const REQUIRED = [
  ':where(.afl-root .afl-required){position:relative}',
  '.afl-root .afl-required::after,.afl-root .afl-required-mark{content:"*";position:absolute;' +
    'right:3px;top:50%;width:8px;height:8px;margin-top:-4px;color:#FF0000;' +
    'font:bold 12px/12px Arial,sans-serif;text-align:center;overflow:visible;pointer-events:none}',
  '.afl-root .afl-required-mark{position:relative;display:inline-block;right:auto;top:auto;' +
    'margin:0 0 0 -11px;vertical-align:middle}',
];

/**
 * InfoPath laid views out in MSHTML quirks mode (no view has a DOCTYPE). The rules below give
 * the render root the quirks layout the screenshots show, inside a standards-mode page
 * (`Changed at review:`, design §8.1 step 9). Each has zero specificity unless noted, so the view's
 * own rules still win. Measured against the 16 InfoPath screenshots (row pitches, task 14).
 */
const QUIRKS = [
  // Quirks box model: `width` and `height` include padding and border, so a `WIDTH:100%` text
  // box (padding 1px, border 1pt) or `.xdSection` (padding 1px 1px 1px 5px) fits its cell.
  ':where(.afl-root,.afl-root *){box-sizing:border-box}',
  // MSHTML clips what does not fit a column of a `table-layout:fixed` table (MSDN tableLayout:
  // "the content is wrapped or, if wrapping is not possible, it is clipped"). The screenshots cut
  // the nested 640 px Employee table at the outer table's edge.
  ':where(.afl-root table[style*="table-layout:fixed" i]>:is(thead,tbody,tfoot)>tr>:is(td,th))' +
    '{overflow:hidden}',
  // IE kept a text box's text baseline. `overflow:hidden` on an inline-block moves its baseline to
  // the bottom margin edge (CSS 2.1 §10.8.1), adding the strut's descent below it: 6 px a row.
  // `clip` clips the same and keeps the baseline. Needs the view's specificity to win over its
  // `.xdTextBox{overflow:hidden}`.
  '.afl-root[data-afl-scope] .xdTextBox{overflow:clip}',
  // An empty text box has no line, so its baseline is its bottom edge too; IE gave it the line of
  // an empty field. A zero-width space (generated, not in the DOM) gives it one: 1 px a row.
  ':where(.afl-root span[data-afl-ctrl]:empty)::before{content:"\\200b"}',
  // IE's default body margin, 15px 10px; the view's `BODY{margin-left:…}` still wins.
  ':where(.afl-root){margin:15px 10px}',
  // Heading margins of 14pt above and below [VERIFY: IE's default style sheet is not published;
  // 14pt reproduces the 42 px Expenses row of forms 02 and 04]. Quirks mode ignores the default
  // top margin of the first element of a cell or the body (MS-CSS21 §7.2, "Default margins"),
  // also through the leading `div`s InfoPath wraps content in.
  ':where(.afl-root :is(h1,h2,h3,h4,h5,h6)){margin-top:14pt;margin-bottom:14pt}',
  ':where(:is(.afl-root,.afl-root td,.afl-root th)>:is(h1,h2,h3,h4,h5,h6):first-child,' +
    ':is(.afl-root,.afl-root td,.afl-root th)>div:first-child>:is(h1,h2,h3,h4,h5,h6):first-child,' +
    ':is(.afl-root,.afl-root td,.afl-root th)>div:first-child>div:first-child>' +
    ':is(h1,h2,h3,h4,h5,h6):first-child){margin-top:0}',
  // A drop-down is one line of its text plus 6 px, as in the screenshots' 30 px drop-down rows.
  ':where(.afl-root select:not([multiple]):is(:not([size]),[size="0"],[size="1"]))' +
    '{min-height:calc(1lh + 6px)}',
  // A picture control's image adds no descender gap below it (MS-CSS21 Appendix D, almost
  // standards mode): form 06's scene photo row is 129 px, not 131.
  ':where(.afl-root .xdInlinePicture>img){vertical-align:top}',
];

/**
 * R6.3, design §8.1 step 9: an empty bound control keeps at least one line of height and the
 * width the view gives it. InfoPath text boxes and date-picker text are `span`s, on which
 * `min-height` and `width` do nothing while they are inline. `:where()` has zero specificity, so
 * any `display` the view sets (`DISPLAY: none` on hidden sections) still wins.
 */
const CONTROL_SIZE = [
  ':where(.afl-root [data-afl-ctrl]){min-height:1lh}',
  ':where(.afl-root span[data-afl-ctrl]){display:inline-block}',
];

/**
 * R6.4: our own icons for InfoPath's `res://infopath.exe/` images, drawn with borders and
 * gradients only. `unknown` is a neutral box that keeps the image's place.
 */
const ICONS = [
  '.afl-root .afl-icon{display:inline-block;box-sizing:border-box;width:16px;height:16px;' +
    'vertical-align:middle;flex:none}',
  '.afl-root .afl-icon-calendar{border:1px solid #626f86;border-top-width:4px;border-radius:2px;' +
    'background:#fff linear-gradient(#626f86,#626f86) 3px 3px/2px 2px repeat-x;' +
    'background-clip:padding-box}',
  '.afl-root .afl-icon-picture{width:48px;height:36px;border:1px dashed #8590a2;' +
    'background:linear-gradient(135deg,transparent 55%,#c1c7d0 55%,#c1c7d0 70%,transparent 70%)}',
  '.afl-root .afl-icon-signature{width:20px;border-bottom:2px solid #44546f;' +
    'background:linear-gradient(150deg,transparent 45%,#44546f 45%,#44546f 55%,transparent 55%)}',
  '.afl-root .afl-icon-unknown{border:1px dotted #8590a2}',
  '.afl-root .afl-icon-file{width:22px;height:28px;border:1px solid #8590a2;' +
    'border-radius:0 6px 0 0;background:#fff repeating-linear-gradient(#fff 0 2px,#c1c7d0 2px 3px)' +
    ' 3px 6px/14px 18px no-repeat;vertical-align:top}',
];

/**
 * R6.7 (`Changed at review:` a block, as `02-expense-report-Claim-filled.png` shows it): a light
 * box 59 px tall, the 22×28 file icon 11 px in and centred, then name, type and size on three
 * 14 px lines. Text that does not fit is clipped by the cell, with no ellipsis. Unfilled, the
 * control shows the icon alone and no box, as InfoPath draws no box for an empty attachment.
 */
const ATTACHMENT = [
  '.afl-root .afl-attachment{display:inline-flex;align-items:center;vertical-align:top}',
  '.afl-root .afl-attachment-filled{box-sizing:border-box;min-width:100%;min-height:59px;' +
    'padding:5px 8px 10px 11px;gap:10px;border:1px solid #dcdcdc;white-space:nowrap}',
  '.afl-root .afl-attachment-text{display:flex;flex-direction:column;align-self:flex-start;' +
    'line-height:14px}',
];

/** R6.2: the grey placeholder box drawn for an ActiveX control. */
const PLACEHOLDER =
  '.afl-root .afl-unsupported{box-sizing:border-box;min-height:24px;padding:4px 6px;' +
  'border:1px solid #8590a2;background:#dcdfe4;color:#44546f;font:12px/16px sans-serif}';

/**
 * Date pickers (R6.3, design §8.1 step 9). IE honoured the legacy `nowrap` attribute on any
 * element, and InfoPath's DTPicker behaviour laid the picker out as one line: the text taking the
 * free width, the calendar button at the right. These rules recreate that; the second needs the
 * scope's specificity to override the view's `.xdDTPicker{display:inline}`.
 */
const DATE_PICKER = [
  ':where(.afl-root [nowrap]){white-space:nowrap}',
  '.afl-root[data-afl-scope] div.xdDTPicker{display:inline-flex;align-items:center;' +
    'box-sizing:border-box;max-width:calc(100% - 2px);vertical-align:middle}',
  '.afl-root[data-afl-scope] .xdDTPicker .xdDTText{flex:1 1 auto;min-width:0;width:auto;' +
    'margin-right:0}',
  '.afl-root[data-afl-scope] .xdDTPicker .xdDTButton{flex:none;display:inline-flex;' +
    'align-items:center;justify-content:center;margin:0;padding:0;border:0;background:none}',
];

export const OWN_CSS = [
  ROOT,
  ...REQUIRED,
  ...CONTROL_SIZE,
  // After CONTROL_SIZE: the drop-down `min-height` must win over its `1lh`.
  ...QUIRKS,
  ...ICONS,
  ...ATTACHMENT,
  PLACEHOLDER,
  ...DATE_PICKER,
].join('\n');
