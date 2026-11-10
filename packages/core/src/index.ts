// Public API of @afterlife/core (design §4). Apps import only from here (structure.md).
export { readCabinet } from './cab/reader';
export type { Cabinet, CabinetInfo, PackageFile } from './cab/reader';
export { AfterlifeError } from './errors';
export type { ErrorCode, Issue, IssueCode } from './errors';
export { DEFAULT_LIMITS } from './limits';
export type { Limits, ParseOptions } from './limits';
export type { Located, UnknownEntry } from './unknown';
export type { FieldNode, FieldTree } from './xsd/types';
export type { Manifest } from './xsf/types';
export { countTemplate } from './xsn/counts';
export type { TemplateCounts } from './xsn/counts';
export { parsePackage, parseXsn } from './xsn/parse';
export type { ParsedTemplate } from './xsn/parse';
export { buildFormIR } from './ir/build';
export type { FormIROptions } from './ir/build';
export { FORMIR_VERSION, parseFormIR, serialiseFormIR } from './ir/json';
export type {
  ActiveX,
  ActiveXControl,
  Attrs,
  BoundControl,
  ChoicesFrom,
  CodeBehind,
  CodeHandler,
  DataSource,
  DepRef,
  DepRole,
  Endpoint,
  FormIR,
  Generation,
  IrAction,
  IrCalculation,
  IrConnection,
  IrField,
  IrGroup,
  IrRule,
  IrValidation,
  IrView,
  LabelEvidence,
  LabelSource,
  LivenessReason,
  Meta,
  Reference,
  SignedBlock,
  Signatures,
  Trigger,
  UnresolvedRef,
} from './ir/types';
