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

export const OWN_CSS = [ROOT, ...REQUIRED, ...CONTROL_SIZE].join('\n');
