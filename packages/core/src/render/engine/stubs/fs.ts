// Worker and browser builds map `xsltjs`'s `require('fs')` here (spec 03 design §5.2). The adapter
// always passes its own loaders, so these are never called; if one is, the render stops loudly.
import { AfterlifeError } from '../../../errors';

const reached = (member: string): never => {
  throw new AfterlifeError('INTERNAL', { path: `fs.${member}`, reason: 'xsltjs reached fs' });
};

export function readFileSync(): never {
  return reached('readFileSync');
}

export const promises = {
  readFile(): Promise<never> {
    return Promise.reject(
      new AfterlifeError('INTERNAL', { path: 'fs.promises.readFile', reason: 'xsltjs reached fs' }),
    );
  },
};

export default { readFileSync, promises };
