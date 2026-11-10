# Spec brief 05: converter to JSM Forms + Coverage Report

## Summary
Turn FormIR into a JSM Forms template (`FormTemplateRequest` JSON). Produce a Coverage Report that classifies every InfoPath element as Native, App (emulated), Manual or Unsupported, with a reason.

## User stories
- As Mai, I want to know before publishing exactly what will and will not carry over.
- As Tim, I want my form to become a native JSM form, so it keeps working even without this app.

## API surface (verified 2026-11-04)

Nguồn: `samples/atlassian-forms-openapi.json` — "ProForma Forms RESTful API", `0.0.0-alpha`, 27 endpoint.

- Gốc: `https://api.atlassian.com/ex/jira/{cloudId}/forms` (trùng gốc sản phẩm của Forge) và
  `https://api.atlassian.com/jira/forms/cloud/{cloudId}`.
- Đọc template của project: `GET /forms/project/{projectIdOrKey}/form` — `read:jira-work`.
- Tạo template: `POST /forms/project/{projectIdOrKey}/form` — `manage:jira-project`. Body là
  `FormTemplateRequest { design, publish }`; `design` bắt buộc đủ `questions`, `sections`,
  `conditions`, `layout`, `settings`.
- Form của request type: `GET /forms/servicedesk/{serviceDeskId}/requesttype/{requestTypeId}/form`
  — `read:servicedesk-request`.
- Gắn form vào issue/request, nộp, xuất: `/forms/issue/{key}/form`,
  `/forms/request/{key}/form/{formId}/action/submit`, `.../format/answers|pdf|xlsx`.
- `settings` bắt buộc có `name` và `submit`; `submit` bắt buộc đủ hai cờ `lock` và `pdf`.
  Điều kiện hiện/ẩn dùng `sh`/`hide`.
- Publish: `publish.portal.portalRequestTypeIds` (mảng id request type) là cách đưa form ra portal;
  `publish.jira.issueCreateIssueTypeIds` là cách đưa vào hộp tạo issue. Đây chính là "publish lên
  portal" trong PLAN §7, không cần gọi thêm API nào.
- Chính tài liệu của API này trỏ tới `product-fetch-api/#requestjira` của Forge, tức Atlassian
  thiết kế cho app Forge gọi bằng `requestJira`.

Đã kiểm trên site thật (2026-11-04): `requestJira('/forms/...')` trả 200 cho cả đọc, tạo và xoá
template; `requestAtlassian` trả 400 INVALID_TARGET_URL nên không dùng. Shapes quan sát được:
`questions` là map khoá chuỗi số; mỗi câu `{label, type, choices[], description, questionKey,
validation}`; `choices` là `[{id, label, other}]`; `validation` ví dụ `{rq: true}`; template đã
publish có `publish.portalRequestTypeIds: [129]`.

## Acceptance criteria (EARS)
1. THE SYSTEM SHALL map field and control types to Forms question types:
   - text → `ts` or `tl`;
   - rich text → `rt`;
   - dropdown → `cd`;
   - combo box → `cd` with an "other" choice;
   - multi-select → `cl` or `cm`;
   - boolean checkbox → `cm` with a single choice;
   - option buttons → `cs`;
   - date → `da`;
   - dateTime → `dt`;
   - time → `ti`;
   - numbers → `no`;
   - email pattern → `te`;
   - URL → `tu`;
   - people → `us` or `um`;
   - attachment → `at`.
2. THE SYSTEM SHALL map:
   - required to `rq`;
   - XSD length facets to `mnc`/`mxc`;
   - numeric bounds to `mnn`/`mxn`;
   - date bounds to `mnd`/`mxd`;
   - simple pattern errorConditions to `rgx` with the original message.
3. THE SYSTEM SHALL map sections to Forms sections. Optional sections and choice groups SHALL become sections with conditions on a generated choice question. Show and hide formatting rules whose condition depends on a single choice field SHALL become section conditions.
4. THE SYSTEM SHALL map two-level filtered dropdowns to `cc` (cascading) when the filter matches the parent field.
5. THE SYSTEM SHALL classify repeating tables and sections, calculations, assignment rules, buttons and multi-field validations as App. The reason SHALL name the app feature that handles them (Repeating table field, Classic runtime).
6. THE SYSTEM SHALL classify data connections, submit adapters, code-behind, signatures and user roles as Manual. Each SHALL carry a suggested replacement (Assets, Automation, JSM approvals, project roles).
7. THE SYSTEM SHALL classify ActiveX controls, ink and offline features as Unsupported.
8. THE SYSTEM SHALL output JSON that validates against the `FormTemplateRequest` schema from the official Forms OpenAPI file, including `settings.submit` with both `lock` and `pdf`, and SHALL fill `publish.portal.portalRequestTypeIds` when the user picks the portal target.
9. THE SYSTEM SHALL link promoted fields (`listProperties`) to existing Jira fields when the names match, and SHALL warn before suggesting a duplicate field.
10. (C phase) WHEN a rule routes or blocks the form on a value threshold or a role (for example "Total > 1000 needs Finance"), THE SYSTEM SHALL suggest a JSM approval step and an Automation outline in the Coverage Report: trigger, condition, approvers. Suggestion only; nothing is created.

## Correctness properties
- **P2:** every FormIR element gets exactly one state and a non-empty reason. The four state counts sum to the element total.
- Converter output validates against the OpenAPI schema for every FormIR from the generator.

## Out of scope
- Creating Automation rules automatically (suggest only in MVP).
- Creating workflows.
