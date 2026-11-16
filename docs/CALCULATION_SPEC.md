# Resource Vision — Calculation Spec (v1, for sign-off)

Source of truth: the Power BI v21 catalog, adjusted by the decisions below.
Data sources: ONLY `dbo.project_track_proposals_table` (PT) and `dbo.zinghr_employee_master` (HR),
using the existing helper functions `dbo.rv_Blank / rv_Clean / rv_Key / rv_Trim`.
All values are computed live by parameterised, read-only SQL. No derived tb_* table is read.

## 0. Decisions already made
| # | Decision |
|---|----------|
| D1 | Capacity is **176 h** for every employed employee-month (config constant; `rv_CapacityRule` is empty). Partial months also get 176. |
| D2 | **Window** = current month + next 18 months (19 months), computed from the server date. Months with no PT rows at all render **blank** and fill in when data arrives. |
| D3 | (v2) Explicit zero effort is a valid value. An employee-month whose PT rows are all zero (none unresolved) has 0 planned hours and is **Fully Available** with 176 h remaining, if identity is reliable. A month with no PT row stays **No record**. |
| D4 | `included_default` is **not used anywhere**. |
| D5 | "Active Projects" is **date-based**: project start <= today <= end. |
| D6 | Slicers are multi-select; default = everything in the window. |

## 1. Row preparation (named PT rows: `rv_Key(employee_id)` is not null)
* `Month` = `month_key` (date). Must be the 1st of a month, else the row is **Unresolved: month**.
* `Effort` = `effort_value` (decimal 28,10 -> float). Null or negative -> **Unresolved: effort**.
* `is_override` NULL or 1 -> **Unresolved: override flag** (catalog rule kept).
* Duplicate group = same (employee key, month, project_id, proposal_number, sub_project_name, case-sensitive).
  If a group has **2 or more rows with Effort > 0**, all rows of that group are **Unresolved: duplicate hours conflict**
  (4 groups today). Otherwise one positive row is used as-is.
* Remaining rows: `Effort = 0` -> **Placeholder** (not valid, not unresolved, contributes 0 h);
  `Effort > 0` -> **Valid**.
* `employee_tagging` ('1.0'/'0.0') is **not** used to reject rows (the catalog's check never matched these
  values, so Power BI ignored it). 272 inconsistent rows are only counted in a data-quality note.
* SubProjectName: null / blank / 'null' -> `(No sub-project)`.

## 2. Employee scope (DimEmployee)
* HR employee valid if `rv_Key(EmployeeCode)` is present and unique. Name/attributes: latest PT row with a real
  name first (catalog `EmployeeLookup`), HR otherwise.
* PT employee ids with no valid HR record -> "Missing HR match" (name from PT or `(Missing HR match)`).
* Effective exit date = `ExitDate`, else `DateOfLeaving`, else (if `EmployeeStatus LIKE 'FnF%'`) `DateofResignation`.
* **Employed in month** = joining <= month end AND (exit is null OR exit >= month start).
  Employee-months where the employee is **not employed are out of scope** (not shown, not counted).
  (All 51 FnF employees left before the window, so this changes no real hours.)

## 3. Employee-month fact (grid = employees with >= 1 named PT row in the window month)
Per (employee, month): `Capacity = 176` if HR-matched and employed, else NULL.
* `NamedRows` = all named rows; `ProjectCount` = distinct project_id over all named rows (catalog).
* `ValidRows`, `PlaceholderRows`, `UnresolvedRows`.
* `VerifiedHours` = SUM(Effort of Valid rows). `UnresolvedHours` = SUM(Effort of Unresolved rows).
* `Planned` = `VerifiedHours` if `UnresolvedRows = 0` AND HR-matched, else NULL. An explicit zero is valid: months whose rows are all zero-effort (none unresolved) have `VerifiedHours = 0`, not NULL.
* `Remaining` = `Capacity - Planned` when both non-null, else NULL.
* **Status** (first match):
  1. Capacity NULL or Planned NULL (no HR match, invalid HR dates, or unresolved rows) -> **Unverified**
  2. ROUND(Remaining,6) < 0 -> **Over-allocated**
  3. ROUND(Remaining,6) = 0 -> **Fully Committed**
  4. ROUND(Planned,6) = 0 -> **Fully Available** (an explicit zero-effort month, or placeholders only)
  5. else **Partially Available**
* **Contract category** over ALL named rows of the employee-month, from the normalised contract text
  (lower-case, remove spaces, en/em dash -> '-'): `t&m-fte` = FTE; `t&m-hrs`, `output-effortbased`,
  `output-fixedspread` = Program; else Unclassified. Result: any FTE -> **FTE-Based**; else any Program ->
  **Program-Based**; else **Contract Not Specified**.
* No named row for an employee in a month that has PT data -> cell **"—"** (no record, not counted in any category).
* **Employee scope of the Availability matrix (matches Power BI):** the matrix, the filter lists and the Employee 360
  search use the whole employee dimension (every valid HR employee plus Project Track-only ids), not just employees
  with rows in the window. Employees without a record show "—" (month has data) or blank (month has no data).
  KPIs, charts and statuses still count only employee-months that have Project Track rows. Dimension filters
  (division, capability, grade, location) apply to the dimension; a contract-category filter narrows the matrix to
  employees with matching records. People who left before the window are included, with "—" cells.
  Month with no PT data at all -> **blank**.

## 4. Availability page
Filters (multi-select, empty = all): Reporting Month, Contract Category, Division, Primary Capability, Grade, Location.
* KPI "Employees with Project Records" = DISTINCT employee codes in the filtered grid.
* Fully Available / Partially Available / Fully Committed / Over-allocated / Unverified = DISTINCT employees with
  >= 1 filtered employee-month in that status (these can overlap across months; they do not have to add up).
* Charts: per month, DISTINCT employees by status (stacked; Fully Committed added as a fifth series so stacks equal
  the month total) and by contract category. Chart totals use the same filters.
* Matrix: one row per employee (code ascending, server-paginated), one column per filtered month,
  cell letters F, P, C, O, U, "—", or blank; colours from the catalog.

## 5. Employee 360
* Header: name, initials, `Employee Code | EmployeeStatus`, Primary Capability, Grade, Division, Department,
  Location, Reporting Manager.
* Monthly table (all 19 window months): Project Count, Contract Category, Planned Hours (= VerifiedHours),
  Recorded - needs review (= UnresolvedHours), Potential Remaining (= Remaining), Availability category.
  NULL values display as "—". Total row: sums of counts/hours; contract category by the precedence in section 3.
* Project allocations: grouped Month | "ID - Project name"; expandable to sub-project rows; columns Client/BU,
  Status pill, Contract type (raw), Start, End, Planned Hours (valid rows), Unresolved Hours.
  Status pill: contains "APPROV" but not "APPROVED" = amber; ACTIVE/APPROVED = green; otherwise grey.
  Status text: `in_approval` -> "In Approval".
* Key information: Secondary Capability, Department, Employment Type, Date of Joining, Location, Email.

## 6. Projects page
* DimProject per catalog (first non-blank by `row_id`; Client/BU = client or account, " / ", BDU;
  ContractCategory = one category, else "Mixed Contracts", none = "Contract Not Specified").
* `Assigned employees` of a project = DISTINCT employee codes with any named row in the filtered months.
* **Visible** = project dates overlap the filtered months (a project without dates is visible only if it has
  assigned employees) AND Coverage matches (All / With / Without allocations) AND contract category/search match.
* KPIs: Total = visible projects; Active = visible projects with start <= today <= end;
  Projects with Employees = visible projects with assigned employees > 0;
  Employees Assigned = DISTINCT employees across the filtered months (0 when coverage = "Without Allocations").
* Planned hours = SUM(Effort of Valid rows). Employee matrix cell: hours if the employee has a valid row;
  "–" if only placeholder/unresolved rows; blank if no row.
* Search label: `ProjectID: ProjectName`.

## 7. Data quality notes surfaced in the UI (not hidden)
Unresolved rows by reason, Missing HR match employees, rows before joining month, tagging inconsistencies.

## 8. Validation plan
Independent recomputation in Python on a snapshot and invariants (status counts add up; project totals equal
sum of rows); parity with `tb_FactEmployeeMonthCapacity` for the fields that do not depend on D1, D3 or D4:
`NamedAllocationRows`, `RawPlannedHours`, `ProjectCount`, `ContractCategory`.

## Profile tags and filters (Business Vertical, tenure, client)

These tags only narrow which employees are shown. They never change capacity, planned hours, remaining hours or status.

- **Business Vertical**: ZingHR `Business Vertical`, matched on the cleaned employee code (duplicate HR codes are dropped, like the HR match). Employees without an HR record have no vertical and drop out when the filter is set.
- **Tenure**: completed months between ZingHR `DateOfJoining` and today. 0 to 18 months is **Fresher**, more than 18 is **Lateral**. No HR record, no joining date, or a joining date in the future is **Unknown**. Example: joined 10 Jan 2026, today 5 Nov 2026, so 9 months, Fresher. This is tenure at the company, not prior experience.
- **Client**: per project, `parent_account_name`, else `account_name`, from the first row (by row id) that has one. An employee's *current* clients are the clients of their allocation rows in the current month. The client filter keeps employees allocated to that client in any in-scope month of the window.
- **Utilization by account** (Projects page): verified planned hours per client over the selected months, the distinct employees with any row for that client, and each client's share of the table's planned hours. Rows count only in months that are in scope for the employee (as the matrix does). Planned, not actual, hours.

In the precomputed (`azure`) mode the vertical and client are read straight from the two source tables at each snapshot reload, so no `rv2_*` schema change or refresh is needed.
