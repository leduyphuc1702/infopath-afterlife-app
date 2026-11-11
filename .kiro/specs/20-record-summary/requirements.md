# Spec 20: summarize the records

Pain N9 (`product.md`): reporting over form data. "How much did each department claim?" The
Records screen (spec 17) finds and sorts; it should also answer the question, for the records
found, without a workbook and a pivot table.

## Requirements

1. WHEN the person chooses "Summarize" on the Records screen, THE SYSTEM SHALL show a summary of
   the records Find has found, with "Group by", "Total of" (optional) and "Count" (records or the
   rows of one repeating group) controls.
2. THE SYSTEM SHALL group a text, choice, number or count column by its shown value, a date column
   by year or by month, and a Yes/No column by its two answers; an empty value is its own group,
   "No value".
3. WHEN a column has more than 50 different values, THE SYSTEM SHALL say how many and suggest
   another column (or a date by year or month) instead of drawing the groups.
4. WHEN a number column is chosen as "Total of", each group line SHALL show the count, the sum and
   the average, in the format the form's view gives that field, and a last line SHALL show the
   same for everything counted.
5. WHEN "Count" is a repeating group, THE SYSTEM SHALL count and total one unit per row of that
   group in the records found, and SHALL offer the group's columns beside the record's.
6. THE summary SHALL say in words what is counted ("30 records", "68 Expense rows in 30 records").
7. THE summary SHALL be a table with a caption, column and row header cells and `aria-sort`,
   sortable by each of its columns; the bar beside each count or sum is drawn in CSS and hidden
   from assistive technology.
8. WHEN the person chooses a group line, THE list SHALL show only the found records in that group,
   and the line beside Find SHALL say both conditions, with a way to show every group again.
9. WHEN the person chooses "Download CSV", THE SYSTEM SHALL save the summary, in the order shown,
   with the export's CSV writer and its formula guard.
10. THE summary SHALL be computed in the Worker; for 5,000 records it SHALL answer in under 1 s
    and the page SHALL stay usable meanwhile.
11. Values SHALL reach the page as text, never as markup.
12. (P22) For any records, group column and number column: the group counts SHALL add up to the
    number of units, the group sums SHALL add up to the total exactly, and the result SHALL not
    depend on the order of the records.
