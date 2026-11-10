// Worker and browser builds map `xsltjs`'s `require('path')` here (spec 03 design §5.2). With an
// `xsn:///` base URI, `Stylesheet.resolve` uses `new URL()`, so these are never called.
import { AfterlifeError } from '../../../errors';

const reached = (member: string): never => {
  throw new AfterlifeError('INTERNAL', { path: `path.${member}`, reason: 'xsltjs reached path' });
};

export function resolve(): never {
  return reached('resolve');
}

export function dirname(): never {
  return reached('dirname');
}

export default { resolve, dirname };
