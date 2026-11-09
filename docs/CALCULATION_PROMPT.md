# Prompt: implement the Resource Vision calculations

Copy everything below the line into your AI assistant or hand it to a developer. It describes the rules in
`docs/CALCULATION_SPEC.md` in a self-contained form. Where this file and the spec differ, the spec wins.

---

You are implementing a workforce availability model on SQL Server / Azure SQL. Use ONLY two source tables:
`dbo.project_track_proposals_table` (PT: one row per employee, month, project allocation) and
`dbo.zinghr_employee_master` (HR: one row per employee). Normalise text with the existing helpers
`dbo.rv_Blank`, `rv_Clean`, `rv_Key` (upper-cased key), `rv_Trim`. Do NOT use the `included_default` column anywhere.
Do NOT use `employee_tagging` to reject rows.

## 1. Constants
- Capacity = 176 hours per employed employee-month (partial months also 176).
- Reporting window = current month plus the next 18 months (19 months), from the server date.
- A window month with no PT rows at all is "no data" and must show blank, never zero.

## 2. Classify each named PT row (employee key not null) inside the window
First matching rule wins:
1. month_key is not the 1st of a month -> Unresolved.
2. effort_value is null or negative -> Unresolved.
3. is_override is null or 1 -> Unresolved.
4. Duplicate group = same employee key, month, project_id, proposal_number, sub_project_name (case-sensitive).
   If the group has 2 or more rows with effort > 0 -> every row of the group is Unresolved.
5. effort = 0 -> Placeholder (counts as a record, contributes 0 hours, is not verified).
6. effort > 0 -> Valid.
Sub-project name null/blank/'null' displays as "(No sub-project)".

## 3. Employees
- An HR employee is valid when the key is present and unique. Name and attributes come from the latest PT row with
  a real name, otherwise from HR.
- A PT employee with no valid HR record is "Missing HR match" (name "(Missing HR match)" if none): capacity unknown.
- Effective exit date = ExitDate, else DateOfLeaving, else DateofResignation when EmployeeStatus starts with "FnF".
- Employed in a month = joining <= month end AND (exit is null OR exit >= month start).
  Employee-months where a matched employee is not employed are out of scope: not shown, not counted.
- Invalid employment dates (no joining date, or exit before joining) mean capacity is unknown for the month.

## 4. Employee-month facts (one row per employee with at least one named PT row in a window month)
- Capacity = 176 if HR-matched, dates valid and employed, else NULL.
- NamedRows, ValidRows, PlaceholderRows, UnresolvedRows; ProjectCount = distinct project_id over all named rows.
- VerifiedHours = sum of effort of Valid rows. UnresolvedHours = sum of effort of Unresolved rows.
- Planned = VerifiedHours only if UnresolvedRows = 0 AND ValidRows > 0 AND HR-matched, else NULL.
- Remaining = Capacity - Planned when both exist, else NULL.
- Status, first match wins:
  1. Capacity or Planned is NULL -> Unverified (this includes placeholder-only months).
  2. ROUND(Remaining, 6) < 0 -> Over-allocated.
  3. ROUND(Remaining, 6) = 0 -> Fully Committed.
  4. ROUND(Planned, 6) = 0 -> Fully Available (only a verified zero-hour month).
  5. otherwise -> Partially Available.
- Contract category, over ALL named rows of the employee-month, from the contract text lower-cased with spaces
  removed and en/em dashes turned into "-": `t&m-fte` = FTE; `t&m-hrs`, `output-effortbased`,
  `output-fixedspread` = Program; anything else unclassified. Any FTE -> "FTE-Based"; else any Program ->
  "Program-Based"; else "Contract Not Specified".
- An employee with no row in a month that has data shows "—" (no record, not counted). A month with no data is blank.
- The matrix, filter lists and employee search cover the whole employee dimension (all valid HR employees plus Project Track-only ids); KPIs and charts count only employee-months with rows.

## 5. Availability page
- Filters (multi-select, empty = all): month, contract category, division, primary capability, grade, location.
- KPI "Employees with Project Records" = distinct employees in the filtered grid.
- Each status KPI = distinct employees with at least one filtered employee-month in that status
  (counts can overlap across months and need not add up).
- Charts: per month, distinct employees by status (stacked) and by contract category.
- Matrix: one row per employee, one column per month, letters F (Fully Available), P (Partially Available),
  C (Fully Committed), O (Over-allocated), U (Unverified), "—" no record, blank no data.

## 6. Employee 360
Monthly table over all 19 months: project count, contract category, planned hours (VerifiedHours), recorded-needs-review
hours (UnresolvedHours), potential remaining hours (Remaining), status. NULL shows "—". Project allocations grouped by
month and project with sub-project detail, valid hours and unresolved hours shown separately.

## 7. Projects page
- One project per project_id. Each attribute is the first non-blank value ordered by row_id. Client/BU = client or
  account, then " / ", then BDU. Contract category: one category, else "Mixed Contracts", none = "Contract Not Specified".
- Assigned employees = distinct employees with any named row in the filtered months.
- Visible = project dates overlap the filtered months (a project with no dates is visible only if it has assigned
  employees) AND the coverage filter matches (All / With / Without allocations) AND category and search match.
- KPIs: total = visible projects; active = visible with start <= today <= end; projects with employees = visible
  with at least one assigned employee; employees assigned = distinct employees across the filtered months.
- Planned hours = sum of effort of Valid rows. Search label = "ProjectID: ProjectName".

## 8. Verify
Recompute independently and check that status counts add up, project totals equal the sum of their rows, and
NamedAllocationRows, RawPlannedHours, ProjectCount and ContractCategory match the existing `tb_FactEmployeeMonthCapacity`.
