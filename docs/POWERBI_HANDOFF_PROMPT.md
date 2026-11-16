# Power BI handoff prompt: bring the web dashboard's logic into the Power BI report

Copy everything below the line into the agent that owns the Power BI model and report.

---

## Role and goal

You are the Power BI developer for the Resource Vision report. A web dashboard (React + FastAPI over Azure SQL) has been extended well beyond the Power BI report. Your job is to bring the Power BI report to **parity with the web dashboard's logic and filters**, so that for the same filters both tools show **identical numbers**. Today the report only supports basic skill filtering.

The web dashboard is the reference implementation. Where this brief and the report disagree, this brief wins. Where this brief is silent or ambiguous, **stop and ask** instead of guessing.

## Ground rules (read first)

1. **Planned, not actual.** Every hour in this product is planned allocation from Project Track. Label measures and visuals "Planned", never "Utilization" alone, and never imply timesheet actuals. All Project Track rows are draft or in approval, so none of it is confirmed.
2. **Profile tags only narrow people.** Business Vertical, Tenure, Client and Skills decide *which employees are shown*. They must **never change** capacity, planned hours, remaining hours or status for an employee-month.
3. **Fonts and colours:** reuse the report's existing theme. Do not restyle.
4. **No dashes as punctuation** in any visible text, titles, tooltips or measure descriptions. Use commas, colons or full stops.
5. **Show every value.** Do not hide blanks: label them (`Not tagged`, `Unknown`, `No record`).
6. **Do not modify source tables** (`dbo.project_track_proposals_table`, `dbo.zinghr_employee_master`) or any `rv2_*` table. Read-only.
7. Do not invent business rules. Anything not specified here is a question for the owner.

## Source data

| Source | Use |
|---|---|
| `dbo.project_track_proposals_table` | Allocations: `employee_id`, `month_key`, `effort_value`, `is_override`, `project_id`, `proposal_number`, `sub_project_name`, `parent_account_name`, `account_name`, `bdu_name`, `contract_type`, `start_date`, `end_date`, `project_status` |
| `dbo.zinghr_employee_master` | HR: `EmployeeCode`, `DateOfJoining`, `ExitDate`, `DateOfLeaving`, `DateofResignation`, `EmployeeStatus`, `[Business Vertical]`, `Division`, `Location`, `[Primary Practice]`, `[Grade Code]`, and others |
| `dbo.vw_RV_EmployeeSkillsForDashboard` | Skills: `EmployeeCode`, `SkillName`, `CurrentSkillLevel` (already modelled; keep as is) |
| Optional: `dbo.rv2_*` tables | The web app's precomputed results (`rv2_Employee`, `rv2_EmployeeMonth`, `rv2_Allocation`, `rv2_Project`, `rv2_Meta`). Reading them is the **fastest route to parity** and the best oracle for validation |

Employee code normalisation: use the existing `dbo.rv_Key()` (match key) and `dbo.rv_Clean()` (display text) helpers. Never join on raw strings.

## Part A. Availability logic the report must match

Window: the current month plus 18 months (19 months). Capacity: **176 h** per employed month.

Row classification (Project Track rows with a non-null `rv_Key(employee_id)`):

| Row status | Rule |
|---|---|
| Unresolved | month missing or not the first day of a month, effort missing or negative, `is_override` NULL or true, or two or more positive-effort rows in the same group (employee, month, project, proposal, sub-project) |
| Placeholder | effort = 0 and not unresolved |
| Valid | effort > 0 and not unresolved |

Employee-month (one per employee with at least one named row in a window month; months with no row are **No record**):

- `Capacity` = 176 only if the employee is HR-matched with valid dates (joining date present and exit not before joining); otherwise NULL.
- Months where an HR-matched employee with valid dates was **not employed** are dropped.
- `VerifiedHours` = sum of valid effort; if there are no valid rows and no unresolved rows, **0** (explicit zero is a real value); if there are unresolved rows and no valid ones, NULL.
- `Planned` = VerifiedHours only when there are no unresolved rows **and** the employee is HR-matched; else NULL.
- `Remaining` = Capacity minus Planned when both are known.
- Status: Unverified if Capacity or Planned is NULL. Otherwise Remaining < 0 Over-allocated; = 0 Fully Committed; Planned = 0 Fully Available; else Partially Available.

Do not re-derive these differently. If the model already implements them, **verify rather than rewrite**.

## Part B. Features to add

### B1. Business Vertical filter
- Source: `zinghr_employee_master.[Business Vertical]`, cleaned with `rv_Clean`, one value per employee code. If an employee code is duplicated in HR, treat the employee as having **no** HR record (same as the HR match rule).
- Nine values exist today (for example HLS, RCM, TMT, RAI, Gen AI). Do not hard-code them.
- Employees with no HR record have no vertical. Show them as **Not tagged**. Selecting a vertical excludes them; a footnote says so.
- Slicer label: **Business vertical** (the owner chose this over Division). Division stays available as a separate, secondary slicer if it already exists.

### B2. Tenure filter (Fresher or Lateral)
- Tenure months = **completed months** between `DateOfJoining` and **today**: `(today.year - join.year) * 12 + (today.month - join.month)`, minus 1 if `today.day < join.day`, floored at 0.
- **Fresher** = 0 to 18 completed months. **Lateral** = more than 18. **Unknown** = no HR record, no joining date, or joining date in the future.
- Worked examples (today = 5 Nov 2026):

| Joined | Completed months | Band |
|---|---|---|
| 5 Nov 2026 | 0 | Fresher |
| 5 May 2025 | 18 | Fresher |
| 6 May 2025 | 17 | Fresher |
| 5 Apr 2025 | 19 | Lateral |
| 1 Jan 2020 | 82 | Lateral |
| (blank) | n/a | Unknown |
| 1 Jan 2027 | n/a | Unknown |

- This is **tenure at the company, not prior experience**. Put the tooltip "Based on date of joining" on the slicer. Do not call it experience.
- Compute with `TODAY()` in DAX (or a column refreshed on load) so it ages correctly. Make the 18 a **parameter** (a what-if or a single-row table), not a literal repeated across measures.

### B3. Client
- Project client = `COALESCE(rv_Clean(parent_account_name), rv_Clean(account_name))`, taken from the **first row by `row_id`** that has one, per `project_id`.
- **Current client(s)** of an employee = clients of that employee's allocation rows in the **current month** (they can have several).
- **Client slicer** keeps an employee if they have an allocation to that client in **any in-scope month of the window** (not only the current month). This difference is intentional; document it in the slicer tooltip.

### B4. Location
- Use `zinghr_employee_master.Location` (17 values) for HR-matched employees, falling back to the latest Project Track `location` for others. If a Location slicer exists, extend it; do not add a second one.

### B5. Utilization by account (new page or visual)
Per client, over the selected reporting months:

| Column | Definition |
|---|---|
| Account | Client as in B3 |
| Projects | Distinct `project_id` with any in-scope row for that client |
| Employees | Distinct employees with any in-scope row for that client |
| Planned hours | Sum of **Valid** row effort for that client |
| Share | Client planned hours divided by the table's total planned hours |

Rules:
- Only rows whose (employee, month) exists as an employee-month count, so employed-month dropping applies here too.
- Employee slicers (vertical, tenure, location, grade, capability, skills, search) narrow which people count. A client slicer narrows which accounts show.
- Total row: distinct employees across all accounts (not the sum of per-account employees), total planned hours, share = 100%.
- Sort by planned hours descending, then name.
- Include a month-by-month matrix or a drill-through to Employee 360 filtered to the client.
- Title it **Utilization by account**, subtitle "Planned hours, not actual timesheet hours".

### B6. Matrix and Employee 360 additions
- Availability matrix, person column: code, then Business Vertical as a quiet second line; a small **Fresher** badge only for freshers; the existing "no HR match" flag stays.
- New column **Current client** (first client plus "+N", full list in tooltip).
- Employee 360 profile: add Business vertical, Current clients, Tenure (for example "Fresher (9 months)"), and Date of joining beside the existing fields.

### B7. Skills
- The report's current skill filter (Match Any, name plus level on the same bridge row, `Not documented` for NULL levels) must keep working exactly as today and **combine with** all new slicers using AND.
- **Skill family is out of scope.** Do not load `SkillFamily`, `SkillCategory` or `SkillPlatform`. There is no approved classification.

### Explicitly out of scope
"Projects ending next quarter" (the quarter definition is undecided), bench ageing, projects explored, corporate versus BU bench, employee cost, Fresher/Lateral by prior experience.

## Part C. Filter semantics (how slicers combine)

- All slicers combine with **AND**. Within one slicer, multiple selections are **OR**.
- Employee-attribute slicers (vertical, tenure, client, location, grade, capability, division, skills) define *which employees exist* in every visual, including the KPI cards.
- The KPI cards use the **whole 19-month window** (reporting-month slicer does not change them); trend charts and the matrix respond to the reporting-month slicer.
- Month and status slicers affect the matrix only.
- Keep KPIs as employee-months by status (counts, no percentages) plus headcount: Total employees, With records, No record.

## Part D. Validation (you are not done until this passes)

1. **Oracle.** For at least these slicer combinations, compare Power BI against `dbo.rv2_*` (or the web app's `/api/rv/availability/overview`): none; Business vertical = one value; Tenure = Fresher; Tenure = Lateral; Tenure = Unknown; Client = each client; Vertical x Tenure; Location = one value; Skills = one skill.
2. Compare: Total employees, With records, No record, and the five employee-month status counts, plus per-client planned hours and employees in B5. **They must be equal, not close.**
3. Edge checks: an employee with no HR record shows tenure Unknown, vertical Not tagged and status Unverified; an HR employee with an explicit 0 effort row is Fully Available at 176 h remaining; a client filter keeps an employee whose client appears only in a future month.
4. Produce a short validation table (slicer combination, Power BI value, reference value, pass or fail). Attach it to your report.

## Part E. Deliverables

1. The updated model and report (`.pbix` or project folder), with new measures in a dedicated display folder per area.
2. A model change note: new tables, columns, relationships, parameters, and every DAX measure with a one-line description.
3. The validation table from Part D.
4. A list of anything that could not match the web dashboard and why.
5. Keep refresh cost low: no new row-level calculated columns over the allocation fact if a measure will do. Report the refresh time before and after.

## Working method

1. Inspect the existing model first. List what already matches Part A, then say what you will add.
2. Implement in this order: Business vertical, Tenure, Location, Client and current client, matrix and Employee 360 additions, Utilization by account, then validation.
3. Ask before changing any existing measure's result. Parity with the web app is the only reason to change one.
4. Final message: what changed, what you verified, what you did not, and any open question for the owner.
