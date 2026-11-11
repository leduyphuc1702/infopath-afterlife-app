// Public API of @afterlife/core (design §4). Apps import only from here (structure.md).
export { readCabinet } from './cab/reader';
export type { Cabinet, CabinetInfo, PackageFile } from './cab/reader';
export { AfterlifeError } from './errors';
export type { ErrorCode, Issue, IssueCode } from './errors';
export { DEFAULT_LIMITS, DEFAULT_RENDER_LIMITS } from './limits';
export type { Limits, ParseOptions, RenderLimits } from './limits';
export type { Located, UnknownEntry } from './unknown';
export type { FieldNode, FieldTree } from './xsd/types';
export type { Manifest } from './xsf/types';
export { countTemplate } from './xsn/counts';
export type { TemplateCounts } from './xsn/counts';
export { parsePackage, parseXsn } from './xsn/parse';
export type { ParsedTemplate } from './xsn/parse';
export { matchRecord } from './xsn/match';
export type { RecordMatch, TemplateKey } from './xsn/match';
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
export { classify, elementsOf, isBlankCheck } from './coverage/classify';
export type { Coverage, CoverageItem } from './coverage/classify';
export { CLASS_WORDS, COVERAGE_CLASSES, COVERAGE_TABLE, EMULATED_TOOLTIP } from './coverage/table';
export type { CoverageClass, CoverageEntry, ElementKind, RowRef } from './coverage/table';
export {
  ACTIVEX_SERVER_REPLACEMENT,
  CAUSE_IDS,
  CAUSES,
  MIXED_REPLACEMENT,
  SUBMIT_REPLACEMENT,
  WORKFLOW_LINE,
} from './triage/catalogue';
export type { CauseId, CauseInfo } from './triage/catalogue';
export { causesOf } from './triage/causes';
export type { Cause, Evidence } from './triage/causes';
export { recordEvidence } from './triage/record';
export { CSV_COLUMNS, csvCell, toCsv } from './triage/csv';
export { triage, triageFiles } from './triage/triage';
export type {
  TriageError,
  TriageFailure,
  TriageInput,
  TriageRecord,
  TriageResult,
  TriageRow,
  TriageTemplate,
  TriageTotals,
} from './triage/triage';
export { WAVE_RULES, waveOf } from './triage/wave';
export type { Wave } from './triage/wave';
export type { RecordEvidence } from './triage/record';
export { prepareView } from './render/prepare';
export type { PrepareOptions, PreparedView } from './render/prepare';
export { renderView } from './render/render';
export type { ControlMark, RenderInput, RenderResult } from './render/render';
export { readZip } from './zip/read';
export type { ReadZipOptions, ZipEntry } from './zip/read';
export { writeZip } from './zip/write';
export type { WriteZipOptions, ZipInput } from './zip/write';
export { embedded, safeSegment } from './legacy/attachment';
export type { Embedded } from './legacy/attachment';
export { RECORD_COLUMNS, plainText, recordTables } from './legacy/tables';
export type {
  Cell,
  ExtractedFile,
  NumberCell,
  RecordFile,
  RecordTables,
  Sheet,
} from './legacy/tables';
export { ATTACHMENT_NOTE, exportRecords, sheetCsv } from './legacy/export';
export type { ExportFormat, ExportOptions, RecordExport } from './legacy/export';
