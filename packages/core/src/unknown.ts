// Locations and unknown entries (design §5), shared by the manifest walker and the schema loader.

/** Where a node is: the package file, its path (design §7.3), and its line and column. */
export interface Located {
  readonly file: string;
  readonly path: string;
  readonly line: number;
  readonly column: number;
}

/** A manifest or schema node the parser does not model (R13, R15.4). */
export interface UnknownEntry extends Located {
  readonly kind: 'element' | 'attribute' | 'text';
  /**
   * `unexpectedValue`: a modelled attribute whose value is outside its list (R13.4).
   * `repeated`: a later occurrence of an element that may occur only once there (R13.9); the
   * first occurrence is modelled.
   */
  readonly reason: 'notModelled' | 'unexpectedValue' | 'repeated';
  readonly namespace: string | null;
  /** Local name; `#text` for text. */
  readonly name: string;
  /** Outer XML, `name="value"`, or the text. */
  readonly raw: string;
  /** MS-IPFF2 (manifest) or XML Schema 1.0 (schemas) defines this node at this position (R13.8). */
  readonly documented: boolean;
}
