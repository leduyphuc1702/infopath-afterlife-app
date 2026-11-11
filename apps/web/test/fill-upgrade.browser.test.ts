// Spec 24 W4: a box bound to a secondary data source (a SharePoint workflow task form's
// `xdXDocument:GetDOM("ItemMetadata")/z:row/@ows_Name`) cannot be typed in, and says why.
import { expect, test } from 'vitest';
import { upgrade } from '../src/paper/fill';
import type { FilledRes } from '../src/worker/protocol';

test('W4: a box bound to another data source is read-only and says so', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<div class="afl-root"><span class="xdTextBox" title="Name" xd:xctname="PlainText" ' +
    'xd:binding=\'xdXDocument:GetDOM("ItemMetadata")/z:row/@ows_Name\' data-afl-ctrl="c1" ' +
    'data-afl-path="/z:row/@ows_Name">Task 1</span></div>';
  upgrade(root, { values: {}, calculated: [], invalid: [] } as unknown as FilledRes);
  const box = root.querySelector<HTMLElement>('[data-afl-ctrl]')!;
  expect(box.isContentEditable).toBe(false);
  expect(box.getAttribute('role')).toBe('textbox');
  expect(box.getAttribute('aria-readonly')).toBe('true');
  expect(box.getAttribute('aria-description')).toBe(
    'Shows a value from the data connection “ItemMetadata”, which is not part of the record, so it can’t be changed here.',
  );
});
