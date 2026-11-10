// Public API of @afterlife/core. Apps import only from here (structure.md).
export { readCabinet } from './cab/reader';
export type { Cabinet, CabinetInfo, PackageFile } from './cab/reader';
export { AfterlifeError } from './errors';
export type { ErrorCode, Issue, IssueCode } from './errors';
export { DEFAULT_LIMITS } from './limits';
export type { Limits, ParseOptions } from './limits';
