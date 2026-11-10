# Spec brief 03: view renderer (XSLT 1.0 without the browser)

## Summary
Render any InfoPath view (`viewN.xsl` + XML data) to safe HTML. Use a pure-JS XSLT engine and shims for InfoPath's extension functions. Chrome's removal of XSLT does not affect us.

## User stories
- As an auditor, I want an old record to look exactly as it did when it was signed.
- As Tim, I want to see my original form next to the converted version.

## Acceptance criteria (EARS)
1. WHEN given a view XSL and an XML document, THE SYSTEM SHALL return HTML within 100 ms (p95) for every view in `samples/own/` and `samples/public/`.
2. THE SYSTEM SHALL implement these functions, so that no sample in `samples/own/`, `samples/public/` or `AFTERLIFE_PRIVATE_SAMPLES` calls an unknown function:
   - `xdFormatting:formatString` (number, currency, percent, date, time, datetime; en-US by default, locale configurable);
   - `xdXDocument:GetDOM`;
   - `xdXDocument:GetNamedNodeProperty`;
   - `xdImage:getImageUrl`;
   - `xdDate:Today` and `xdDate:Now`;
   - `xdMath:Avg`, `xdMath:Nz` and `xdMath:Eval`;
   - `xdUser:get-UserName`.
3. THE SYSTEM SHALL sanitise output:
   - remove scripts, event-handler attributes, `javascript:` URLs, `<object>`, `<embed>` and ActiveX;
   - keep `style`, `class`, `xd:*` attributes and inline images (data URLs).
4. THE SYSTEM SHALL inline images packaged in the .xsn as data URLs.
5. WHEN an unsupported control appears (an ActiveX GUID), THE SYSTEM SHALL render a grey placeholder box: "Custom control {GUID}: not supported".
6. THE SYSTEM SHALL keep empty fields visible as empty input-like boxes, not collapsed lines (a known gap seen with xsltproc).
7. THE SYSTEM SHALL render date fields with a calendar icon placeholder, matching InfoPath.

## Correctness properties
- **P4:** rendering is deterministic.
- **P5:** sanitised output never contains executable content (checked against a generator of hostile XSL and XML inputs).

## Visual acceptance
Playwright compares renders of the 11 views of forms 01–08 in `samples/own/` (with the empty and a filled record) against reference PNGs made by `xsltproc` from the same inputs. The difference must be below a threshold agreed after the first measurement, and recorded in the spec. The 22 InfoPath Filler 2013 screenshots in `samples/own/screenshots/` are the human reference for fidelity review.
