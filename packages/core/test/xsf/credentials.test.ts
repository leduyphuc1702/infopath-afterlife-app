import { describe, expect, test } from 'vitest';
import { buildFormIR, parseFormIR, parsePackage, serialiseFormIR } from '../../src/index';
import { redactSecrets } from '../../src/xsf/credentials';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { packageFile } from '../helpers/package';
import { manifestBytes } from '../helpers/synthetic-manifest';

// One table for spec 01 R11.5 (`containsCredential`) and spec 02 R8.4 (redaction): the flag is
// true exactly when the redaction changes something. All secrets here are fictional.

const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** [connection string, redacted string, or null when nothing is a secret]. */
const CASES: readonly (readonly [string, string | null])[] = [
  ['Password=secret', 'Password=***'],
  ['Data Source=x;Password=secret', 'Data Source=x;Password=***'],
  ['Data Source=x; pwd = secret', 'Data Source=x; pwd = ***'],
  ['PWD = xyz', 'PWD = ***'],
  ['PWD = xyz ;Server=a', 'PWD = *** ;Server=a'],
  ['PASSWORD=secret;Data Source=x', 'PASSWORD=***;Data Source=x'],
  ['User ID=a;PwD=b', 'User ID=a;PwD=***'],
  [
    'Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\db\\a.mdb;Jet OLEDB:Database Password=xyz',
    'Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\db\\a.mdb;Jet OLEDB:Database Password=***',
  ],
  [
    'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\\db\\a.accdb;Jet OLEDB:Database Password="xyz"',
    'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\\db\\a.accdb;Jet OLEDB:Database Password=***',
  ],
  [
    'Jet OLEDB:New Database Password = xyz;Mode=Share Deny None',
    'Jet OLEDB:New Database Password = ***;Mode=Share Deny None',
  ],
  ['Jet OLEDB:Password=xyz', 'Jet OLEDB:Password=***'],
  ['http://alice:xyz@intranet/svc.asmx?WSDL', 'http://alice:***@intranet/svc.asmx?WSDL'],
  [
    'HTTPS://Alice:x%40y@Intranet:8080/a/../b?q=1#f',
    'HTTPS://Alice:***@Intranet:8080/a/../b?q=1#f',
  ],
  ['Data Source=http://bob:xyz@forms-legacy/list', 'Data Source=http://bob:***@forms-legacy/list'],
  ['Data Source=sql-legacy01;Integrated Security=SSPI', null],
  ['PasswordHint=none', null],
  ['MyPassword=x', null],
  ['Jet OLEDB:Database Password Hint=x', null],
  ['Data Source=x;Persist Security Info=True', null],
  ['http://alice@intranet/svc.asmx', null],
  ['http://alice:@intranet/svc.asmx', null],
  ['mailto:alice@contoso-fictional.example', null],
  ['', null],
];

const spec01Flag = (cs: string) =>
  parseManifest(
    manifestBytes(
      `<xsf:dataAdapters><xsf:adoAdapter name="a" connectionString="${attr(cs)}"/></xsf:dataAdapters>`,
    ),
  ).manifest.dataAdapters[0]!.containsCredential;

describe('credentials: spec 01 R11.5 and spec 02 R8.4 agree', () => {
  test.each(CASES)('%s', (input, output) => {
    expect(redactSecrets(input)).toEqual({ value: output ?? input, redacted: output !== null });
    expect(spec01Flag(input)).toBe(output !== null);
  });
});

describe('R8.4 serialise and search: the secret appears nowhere in the FormIR JSON', () => {
  const build = (inner: string) =>
    serialiseFormIR(buildFormIR(parsePackage([packageFile('manifest.xsf', manifestBytes(inner))])));

  test('an ADO adapter with a Jet database password', () => {
    const cs =
      'Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\db\\a.mdb;Jet OLEDB:Database Password=QxJetSecret7';
    const json = build(
      `<xsf:dataAdapters><xsf:adoAdapter name="Access" connectionString="${attr(cs)}" queryAllowed="yes"/></xsf:dataAdapters>`,
    );
    expect(json).not.toContain('QxJetSecret7');
    expect(json).toContain('Jet OLEDB:Database Password=***');
    expect(parseFormIR(json).dataConnections[0]!.credentialRedacted).toBe(true);
  });

  test('a web service whose wsdlUrl carries a userinfo password', () => {
    const json = build(
      `<xsf:dataAdapters><xsf:webServiceAdapter name="Svc" wsdlUrl="http://alice:QxUrlSecret7@intranet/svc.asmx?WSDL" queryAllowed="yes"><xsf:operation name="Get" soapAction="urn:get" serviceUrl="http://alice:QxUrlSecret7@intranet/svc.asmx"/></xsf:webServiceAdapter></xsf:dataAdapters>`,
    );
    expect(json).not.toContain('QxUrlSecret7');
    const c = parseFormIR(json).dataConnections[0]!;
    expect(c.credentialRedacted).toBe(true);
    expect(c.attrs.wsdlUrl).toBe('http://alice:***@intranet/svc.asmx?WSDL');
    expect(c.endpoints.map((e) => [e.value, e.host, e.reason])).toEqual([
      ['http://alice:***@intranet/svc.asmx?WSDL', 'intranet', 'singleLabel'],
      ['http://alice:***@intranet/svc.asmx', 'intranet', 'singleLabel'],
    ]);
  });
});
