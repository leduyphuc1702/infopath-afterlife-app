import { describe, expect, test } from 'vitest';
import { classifyEndpoint, connectionPairs, redactSecrets } from '../../src/ir/endpoints';

// Spec 02 R8.2–R8.4, design §8.

const at = { file: 'manifest.xsf', path: '/xsf:xDocumentClass[1]', line: 1, column: 1 };
const files = new Set(['locations.xml']);
const ep = (attribute: string, value: string) => classifyEndpoint(attribute, value, at, files);
const verdict = (attribute: string, value: string) => {
  const e = ep(attribute, value);
  return [e.liveness, e.reason, e.host];
};

describe('liveness, one case per row', () => {
  test.each([
    ['wsdlUrl', 'C:\\forms\\a.xsn', ['internal', 'filePath', undefined]],
    ['publishUrl', 'D:\\svn\\a.xsn', ['internal', 'filePath', undefined]],
    ['fileUrl', '\\\\files-legacy\\share\\a.xml', ['internal', 'filePath', undefined]],
    ['fileUrl', 'file:///C:/a.xml', ['internal', 'filePath', undefined]],
    ['fileUrl', 'locations.xml', ['package', 'packageFile', undefined]],
    ['fileUrl', 'sub/Locations.XML', ['package', 'packageFile', undefined]],
    ['fileUrl', 'missing.xml', ['unknown', 'unparsed', undefined]],
    [
      'connectionString',
      'Data Source=(local);Initial Catalog=x',
      ['internal', 'localServer', '(local)'],
    ],
    ['connectionString', 'Server=.;Database=x', ['internal', 'localServer', '.']],
    ['serviceUrl', 'http://localhost:8080/x', ['internal', 'localhost', 'localhost']],
    ['serviceUrl', 'http://forms.localhost/x', ['internal', 'reservedSuffix', 'forms.localhost']],
    ['serviceUrl', 'http://forms.local/x', ['internal', 'reservedSuffix', 'forms.local']],
    ['serviceUrl', 'http://nas.home.arpa/x', ['internal', 'reservedSuffix', 'nas.home.arpa']],
    [
      'serviceUrl',
      'http://Forms.Corp.Internal./x',
      ['internal', 'reservedSuffix', 'forms.corp.internal'],
    ],
    ['serviceUrl', 'http://127.0.0.1/x', ['internal', 'loopbackIp', '127.0.0.1']],
    ['serviceUrl', 'http://[::1]/x', ['internal', 'loopbackIp', '[::1]']],
    ['serviceUrl', 'http://10.2.3.4/x', ['internal', 'privateIp', '10.2.3.4']],
    ['serviceUrl', 'http://172.16.0.1/x', ['internal', 'privateIp', '172.16.0.1']],
    ['serviceUrl', 'http://172.31.255.255/x', ['internal', 'privateIp', '172.31.255.255']],
    ['serviceUrl', 'http://192.168.1.1/x', ['internal', 'privateIp', '192.168.1.1']],
    ['serviceUrl', 'http://[fd12::1]/x', ['internal', 'privateIp', '[fd12::1]']],
    ['serviceUrl', 'http://169.254.1.1/x', ['internal', 'linkLocalIp', '169.254.1.1']],
    ['serviceUrl', 'http://[fe80::1]/x', ['internal', 'linkLocalIp', '[fe80::1]']],
    [
      'wsdlUrl',
      'http://forms-legacy/budget/BudgetService.asmx?WSDL',
      ['internal', 'singleLabel', 'forms-legacy'],
    ],
    ['xd:server', 'http://chiron:8080', ['internal', 'singleLabel', 'chiron']],
    [
      'siteUrl',
      'https://intranet.contoso-fictional.example/sites/hr',
      ['unknown', 'public', 'intranet.contoso-fictional.example'],
    ],
    ['serviceUrl', 'http://8.8.8.8/x', ['unknown', 'public', '8.8.8.8']],
    ['serviceUrl', 'http://[2001:db8::1]/x', ['unknown', 'public', '[2001:db8::1]']],
    ['serviceUrl', 'http:// bad host', ['unknown', 'unparsed', undefined]],
  ])('%s %s', (attribute, value, expected) => {
    expect(verdict(attribute, value)).toEqual(expected);
  });

  test.each([['172.15.0.1'], ['172.32.0.1'], ['192.169.0.1']])('boundary %s is public', (ip) => {
    expect(verdict('serviceUrl', `http://${ip}/`)).toEqual(['unknown', 'public', ip]);
  });
});

describe('connection strings', () => {
  test.each([
    ['Provider=SQLOLEDB.1;Data Source=sql-legacy01;Initial Catalog=P', 'sql-legacy01'],
    ['Server=tcp:SQL-LEGACY01,1433;Database=x', 'sql-legacy01'],
    ['Data Source=sql-legacy01\\FORMS;Initial Catalog=P', 'sql-legacy01'],
    ['Address="db01.corp.example";Database=x', 'db01.corp.example'],
    ['Network Address=10.0.0.5', '10.0.0.5'],
  ])('host of %s', (s, host) => {
    expect(ep('connectionString', s).host).toBe(host);
  });

  test('Data Source as a file path is filePath', () => {
    expect(
      verdict('connectionString', 'Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\db\\a.mdb'),
    ).toEqual(['internal', 'filePath', undefined]);
  });

  test('no host key is unparsed', () => {
    expect(verdict('connectionString', 'Provider=x;Initial Catalog=y')).toEqual([
      'unknown',
      'unparsed',
      undefined,
    ]);
  });

  test('quoted values keep their ; and =', () => {
    expect(connectionPairs('A="x;y=z";B=2').map((p) => [p.key, p.value])).toEqual([
      ['a', '"x;y=z"'],
      ['b', '2'],
    ]);
  });
});

describe('redaction (R8.4)', () => {
  test.each([
    [
      'Provider=SQLOLEDB.1;Data Source=sql-legacy01;User ID=forms;Password=fictional;Packet Size=4096',
      'Provider=SQLOLEDB.1;Data Source=sql-legacy01;User ID=forms;Password=***;Packet Size=4096',
    ],
    ['Server=a; pwd = s3cr;et? ;x=1', 'Server=a; pwd =***;et? ;x=1'],
    ['Server=a;PASSWORD="se;cret";Pwd={a;b}', 'Server=a;PASSWORD=***;Pwd=***'],
    ['Server=a;Password=last', 'Server=a;Password=***'],
  ])('%s', (input, output) => {
    expect(redactSecrets(input)).toEqual({ value: output, redacted: true });
  });

  test('no secret: unchanged byte for byte, not redacted', () => {
    const s = 'Provider=SQLOLEDB.1;Integrated Security=SSPI;Data Source=sql-legacy01';
    expect(redactSecrets(s)).toEqual({ value: s, redacted: false });
  });

  test('an endpoint built from a connection string stores the redacted value', () => {
    expect(ep('connectionString', 'Data Source=sql-legacy01;Password=fictional').value).toBe(
      'Data Source=sql-legacy01;Password=***',
    );
  });
});
