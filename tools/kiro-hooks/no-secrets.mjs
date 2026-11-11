#!/usr/bin/env node
// preToolUse on `write` (the write and code tools): blocks content that holds a token or key.
// The message names the pattern, never the matched text.
import { hook, strings } from './lib.mjs';

export const PATTERNS = [
  ['an Atlassian API token (ATATT…)', /ATATT[A-Za-z0-9_\-=]{20,}/],
  ['a GitHub token (ghp_…)', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['a GitHub fine-grained token (github_pat_…)', /\bgithub_pat_[A-Za-z0-9_]{30,}/],
  ['an AWS access key id (AKIA…)', /\b(AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['a private key block', /-----BEGIN ([A-Z]+ )?PRIVATE KEY-----/],
  [
    'a Forge web trigger URL with its token',
    /https:\/\/[a-z0-9-]+\.hello\.atlassian-dev\.net\/x1\/[A-Za-z0-9_-]{10,}/i,
  ],
];

/** The names of the patterns found in a tool input. */
export function findSecrets(input) {
  const text = strings(input).join('\n');
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

if (import.meta.url === `file://${process.argv[1]}`)
  hook((e) => {
    const found = findSecrets(e.tool_input);
    if (found.length === 0) return 0;
    process.stderr.write(
      `Blocked by the no-secrets hook: the content holds ${found.join(' and ')}. Put secrets in Forge environment variables or a local .env that git ignores, never in a file in the repo.\n`,
    );
    return 2;
  });
