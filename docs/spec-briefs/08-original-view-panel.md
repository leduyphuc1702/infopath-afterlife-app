# Spec brief 08: "Original view" panels (issue + portal)

## Summary
Agents, approvers and customers see the record rendered exactly as the form looked, in the template version it was created with. They can print, download the original XML, and check the seal.

## Acceptance criteria (EARS)
1. WHEN an issue has Afterlife data (from a Classic submit or a legacy import), THE SYSTEM SHALL show the "Original view" panel in issue view (`jira:issuePanel`) and on the portal request page (`portalRequestDetailPanel`).
2. THE SYSTEM SHALL render with the template version stored on the record, not the latest version.
3. THE SYSTEM SHALL offer:
   - a view selector, including print views;
   - Print, using print CSS;
   - Download XML;
   - a seal badge: "Intact" (green) or "Changed after approval" (red), with a tooltip showing the hash and the time.
4. IF the record came from a legacy import with a digital signature block, THE SYSTEM SHALL show signer names and times as text, labelled "Signature not re-verified".
5. THE panel SHALL load in under 1.5 s for records under 1 MB.
6. WHEN the request is waiting for approval, THE panel SHALL show a banner "You are approving this record" with the seal status, so the approver sees exactly what was submitted. Approvers are portal customers without an agent licence, so this SHALL work in the portal panel [VERIFY on day one that portal customers can see `portalRequestDetailPanel` content for requests they approve].
7. IF the record changed after submission, THE panel SHALL name the changed fields, not only show a red badge.
