// What InfoPath showed that the XSL does not (spec 03 design §8.1 steps 2–4; R6.1, R6.2, R6.4):
// the ActiveX placeholder, our own icons for `res://infopath.exe/` images, and package images as
// data URLs. The sanitiser calls these before its allowlist, on the result tree.

import type { HElement } from './serialise';

/** What the resource steps need from the render. */
export interface Resources {
  /** A package file by name, compared ignoring case (spec 01 R6.2). */
  readonly file: (name: string) => Uint8Array | undefined;
  /** The FormIR ActiveX control id of a result element, when it is one. */
  readonly activeXId: (origin: object) => string | undefined;
  /** Package images count towards `outputBytes` (design §6). */
  readonly chargeOutput: (chars: number) => void;
}

export const NO_RESOURCES: Resources = {
  file: () => undefined,
  activeXId: () => undefined,
  chargeOutput: () => {},
};

/** `res://infopath.exe/<file>` images with an icon of our own; the rest get a neutral box. */
const ICONS: ReadonlyMap<string, string> = new Map([
  ['calendar.gif', 'calendar'],
  ['pictureclick.gif', 'picture'],
  ['signaturevalid.gif', 'signature'],
  ['addsignaturebutton.gif', 'signature'],
  ['signatureerror.gif', 'signature'],
]);

const RES = /^res:\/\/infopath\.exe\/([^/?#]+)$/;

/**
 * Step 3: an `img` whose `src` (in URL form: whitespace and controls removed, lowercased) is an
 * InfoPath resource becomes an icon span. `unknown` names a resource with no icon of ours.
 */
export function resourceIcon(
  src: string,
  size: readonly [string, string][],
): { icon: HElement; unknown?: string } | undefined {
  const file = RES.exec(src)?.[1];
  if (file === undefined) return undefined;
  const kind = ICONS.get(file);
  const icon: HElement = {
    kind: 'element',
    name: 'span',
    attrs: [
      ['class', `afl-icon afl-icon-${kind ?? 'unknown'}`],
      ['aria-hidden', 'true'],
      ...(kind === undefined ? size : []),
    ],
    children: [],
  };
  return kind === undefined ? { icon, unknown: file } : { icon };
}

/** Step 2: `Custom control {GUID}: not supported`, in a grey box of the object's size. */
export function activeXPlaceholder(
  classid: string,
  size: readonly [string, string][],
  origin: object,
): HElement {
  const guid = classid
    .trim()
    .replace(/^clsid:/i, '')
    .replace(/^\{|\}$/g, '');
  return {
    kind: 'element',
    name: 'div',
    attrs: [['class', 'afl-unsupported'], ...size],
    children: [{ kind: 'text', text: `Custom control {${guid}}: not supported` }],
    origin,
  };
}

const MAGIC: readonly [string, readonly number[]][] = [
  ['png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['gif', [0x47, 0x49, 0x46, 0x38]],
  ['jpeg', [0xff, 0xd8, 0xff]],
  ['bmp', [0x42, 0x4d]],
];

/** PNG, GIF, JPEG or BMP by magic bytes, as used in a data URL; undefined for anything else. */
export function imageType(bytes: Uint8Array): string | undefined {
  return MAGIC.find(([, m]) => m.every((b, i) => bytes[i] === b))?.[0];
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Base64 text (ASCII whitespace ignored) whose magic bytes say PNG, GIF, JPEG or BMP, as a data
 * URL; undefined for anything else. Shared by `xdImage:getImageUrl` and inline pictures.
 */
export function base64Image(text: string): string | undefined {
  const b64 = text.replace(/[\t\n\r ]+/g, '');
  if (b64.length < 12 || b64.length % 4 !== 0 || !BASE64.test(b64)) return undefined;
  const type = imageType(Uint8Array.from(atob(b64.slice(0, 12)), (c) => c.charCodeAt(0)));
  return type === undefined ? undefined : `data:image/${type};base64,${b64}`;
}

const INLINE_PICTURE = 'msoxd:;inline;';

/**
 * Step 4 (`Changed at task 9:`): InfoPath's picture control writes its picture as
 * `msoxd:;inline;` followed by the record's base64 (form 06). A raster image becomes a data URL;
 * anything else gives undefined, and step 5 removes the `src`.
 */
export function inlinePicture(src: string): string | undefined {
  return src.slice(0, INLINE_PICTURE.length).toLowerCase() === INLINE_PICTURE
    ? base64Image(src.slice(INLINE_PICTURE.length))
    : undefined;
}

/**
 * Step 4: a relative `src` naming a package file whose magic bytes say PNG, GIF, JPEG or BMP
 * becomes a base64 data URL; anything else gives undefined.
 */
export function packageImage(src: string, r: Resources): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return undefined;
  let name: string;
  try {
    name = decodeURIComponent(src.replace(/^\.\//, '').replace(/[?#].*$/, ''));
  } catch {
    return undefined;
  }
  if (name === '' || /[\\/]/.test(name)) return undefined;
  const bytes = r.file(name);
  const type = bytes && imageType(bytes);
  if (!bytes || type === undefined) return undefined;
  const url = `data:image/${type};base64,${base64(bytes)}`;
  r.chargeOutput(url.length);
  return url;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
