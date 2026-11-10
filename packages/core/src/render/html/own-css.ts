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
  ...ICONS,
  PLACEHOLDER,
  ...DATE_PICKER,
].join('\n');
