# What the corpus actually contains

Ghi tự động bằng `python3 facts.py`. Mỗi số đếm từ tên tag, tên thuộc tính và chuỗi XPath mà định dạng InfoPath cố định, nên app chạy trên trình duyệt đếm lại được đúng như vậy.

## Tổng

| Thứ | Số |
|---|---|
| Form | 71 |
| Trường trong schema | 1170 |
| View | 83 |
| Chuỗi XPath | 3369 |
| Luật | 38 |
| Phép tính | 52 |
| Điều kiện kiểm tra | 51 |
| Chỗ khai báo lặp | 59 |
| Chỗ khai báo optional | 4 |

## Control, theo số lần xuất hiện trong view XSL

| Control | Số |
|---|---|
| `Text` | 602 |
| `DatePicker` | 117 |
| `Dropdown` | 112 |
| `OptionButton` | 104 |
| `Checkbox` | 72 |
| `Section` | 59 |
| `RepeatingTable` | 48 |
| `RichText` | 45 |
| `Button` | 42 |
| `ExpressionBox` | 30 |
| `RepeatingSection` | 16 |
| `ActiveX` | 7 |
| `FileAttachment` | 5 |
| `Combobox` | 3 |
| `ChoiceSection` | 2 |
| `ChoiceGroup` | 1 |
| `Picture` | 1 |

Tổng 1266 control trên 71 form.

## Hành động của rule

| Action | Số |
|---|---|
| `ruleSetAction` | 37 |
| `assignmentAction` | 20 |
| `closeDocumentAction` | 16 |
| `submitAction` | 12 |
| `switchViewAction` | 7 |
| `queryAction` | 1 |
| `dialogBoxExpressionAction` | 1 |
| `containmentAction` | 1 |

## Hàm XPath dùng trong biểu thức

| Hàm | Số |
|---|---|
| `node` | 51 |
| `not` | 47 |
| `string` | 31 |
| `sum` | 12 |
| `translate` | 12 |
| `false` | 12 |
| `concat` | 9 |
| `position` | 6 |
| `count` | 6 |
| `and` | 6 |
| `substring` | 3 |
| `or` | 3 |
| `round` | 1 |

## Thông báo lỗi mà người dùng thật sẽ thấy

Tổng 51 điều kiện kiểm tra, 13 thông báo khác nhau. Đây là chữ hiện ra khi trường sai, nên app phải giữ nguyên văn, không tự viết lại.

| Thông báo | Số lần |
|---|---|
| This field is required. | 25 |
| Select a different departure or return date. | 6 |
| The last day of leave cannot be before the first day. | 2 |
| Working days must be between 1 and 30. | 2 |
| Amount must be greater than zero. | 2 |
| Values for this control must be greater than the current date and time. | 1 |
| Return date cannot be before the departure date. | 1 |
| Quantity must be at least 1. | 1 |
| A day cannot exceed 24 hours. | 1 |
| Return date cannot be before the loan date. | 1 |
| End reading must be at least the start reading. | 1 |
| Likelihood must be between 1 and 5. | 1 |
| Score must be between 1 and 10. | 1 |

## Mẫu định dạng dùng trong form

| Kiểu | Tham số | Số lần |
|---|---|---|
| `date` | `dateFormat:Short Date;` | 123 |
| `currency` | `numDigits:2;negativeOrder:0;positiveOrder:0;currencyLocale:1033;` | 59 |
| `number` | `numDigits:0;negativeOrder:0;grouping:1;` | 31 |
| `number` | `numDigits:2;negativeOrder:1;` | 15 |
| `number` | `numDigits:auto;negativeOrder:1;` | 9 |
| `number` | `numDigits:2;negativeOrder:0;grouping:1;` | 8 |
| `string` | `plainMultiline` | 7 |
| `time` | `` | 6 |
| `percentage` | `numDigits:0;negativeOrder:1;` | 6 |
| `number` | `numDigits:0;negativeOrder:1;` | 5 |
| `datetime` | `dateFormat:Short Date;timeFormat:h:mm:ss tt;` | 5 |
| `datetime` | `dateFormat:Short Date;timeFormat:none;` | 4 |

## Hàm mở rộng của InfoPath

| Hàm | Số |
|---|---|
| `xdFormatting:formatString` | 556 |
| `xdXDocument:GetDOM` | 68 |
| `xdMath:Nz` | 38 |
| `xdDate:Today` | 30 |
| `xdXDocument:GetNamedNodeProperty` | 27 |
| `xdMath:Eval` | 12 |
| `xdMath:Avg` | 6 |
| `xdMath:Min` | 3 |
| `xdMath:Max` | 3 |
| `xdDate:AddSeconds` | 3 |
| `xdDate:AddDays` | 3 |
| `xdDate:Now` | 2 |
