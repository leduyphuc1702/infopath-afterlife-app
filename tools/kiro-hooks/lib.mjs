// Shared by the Kiro CLI hooks (docs/kiro/hooks.md). Plain Node, no dependencies.
// A hook never breaks a turn: any error ends in exit 0; only a guard that blocks exits 2.

/** The hook event from STDIN, or {} after `ms` or on bad JSON. */
export function readEvent(ms = 2000) {
  return new Promise((resolve) => {
    let text = '';
    const done = () => {
      try {
        resolve(JSON.parse(text || '{}'));
      } catch {
        resolve({});
      }
    };
    const timer = setTimeout(done, ms);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (text += d));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      done();
    });
    process.stdin.on('error', done);
  });
}

/** Runs `main(event)`; exit code is what it returns (2 blocks), 0 on any error or after `ms`. */
export function hook(main, ms = 4000) {
  const kill = setTimeout(() => process.exit(0), ms);
  kill.unref();
  readEvent()
    .then((e) => main(e))
    .then(
      (code) => process.exit(code === 2 ? 2 : 0),
      () => process.exit(0),
    );
}

/** Every string inside a value, for scanning tool inputs of any shape. */
export function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}
