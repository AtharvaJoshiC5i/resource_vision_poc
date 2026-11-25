# Database brief for the Confirmed Staffing service agent

Paste this block into the agent prompt. It covers only the databases. All other instructions come from the product owner.

---

## Databases and tables you will work with

All data is in one Azure SQL database (schema `dbo`). Connection details are held in the environment of the existing Resource Vision backend (`backend/.env`, `RV_*` settings). **Do not copy secrets into code, docs or logs; ask the owner for access to a service account.** The two **source** datasets are the only business data the availability view is built from. Everything prefixed `rv2_` is derived.

### 1. Source A: Project Track, `dbo.project_track_proposals_table` (system of record for allocations)

- 120 columns, about 7,335 rows, 15 projects, months 2024-01 to 2027-06.
- **No primary key, no indexes, no triggers, no NOT NULL columns, no identity column.** The database enforces nothing. Duplicates and partial rows are possible. Your service must provide its own uniqueness and concurrency control.
- **`row_id` is a slot identifier, not a row identifier** (450 distinct values over 7,335 rows, for example `Data_Science_Offshore_C2`). Never use it as a key. An allocation is identified by (employee, month, project, proposal, sub-project).
- Today **no project is confirmed**: all are `draft` or `in_approval`; `final_approved_at` is empty everywhere; `document_approval_status` is only `pending` or null; `auto_approved` is null. How a project is marked confirmed, and where those rows live, is unresolved and must come from the Project Track team.
- `employee_tagging` is 1 on 4,694 rows and 0 on 2,641, while only 4,634 rows carry an employee, so untagged rows may be open demand slots. Unconfirmed meaning.
- `truth_refreshed_at`, `force10_refreshed_at`, `source_type` suggest the table is replicated or rebuilt upstream. Confirm whether writes would be erased.
- A view `dbo.vw_famstack_employee_proposal_month_hours` exists and has **not** been inspected.

Columns the availability logic reads (use only these, never assume others):

| Group | Columns |
|---|---|
| Allocation | `row_id`, `project_id`, `proposal_number`, `sub_project_name`, `employee_id`, `month_key`, `effort_value`, `is_override`, `contract_type`, `start_date`, `end_date` |
| Project | `project_name`, `project_status`, `project_lead_name`, `parent_account_name`, `account_name`, `bdu_name`, `notes` |
| Employee attributes on the row | `employee_name`, `primary_capability`, `secondary_capability`, `department`, `grade`, `location`, `country` |
| Other existing columns | `lifecycle_stage`, `current_approval_stage`, `final_approved_at`, `document_approval_status`, `employee_tagging`, `employee_tagging_label`, `is_manual_row`, `included_default` (ignored by rule), `row_updated_at`, `row_updated_by_name`, `hourly_rate` |

### 2. Source B: ZingHR, `dbo.zinghr_employee_master` (HR master, read-only)

117 employees, 67 columns. Columns used: `EmployeeCode`, `EmployeeName`, `Email`, `DateOfJoining`, `ExitDate`, `DateOfLeaving`, `DateofResignation`, `EmployeeStatus`, `EmploymentType`, `TYPE OF EMPLOYMENT`, `[Business Vertical]`, `Division`, `Department`, `[Line of Business]`, `Location`, `WORKING LOCATION`, `COUNTRY`, `[Primary Practice]`, `[Secondary Practice]`, `[Grade Code]`, `ReportingManagerName`, `ReportingManagerCode`.

- 156 employees exist across both sources; 39 have no HR record (they cannot be bookable: capacity is unknown).
- Duplicate HR keys exist and are dropped by the existing queries.
- **Never write to ZingHR.**

### 3. Key normalisation (mandatory)

Join employees only with the helper functions `dbo.rv_Key()` (match key) and `dbo.rv_Clean()` (text clean). Never join on raw strings.

### 4. Derived tables, written only by `dbo.rv2_Refresh` (read-only for you)

`dbo.rv2_Refresh` **deletes and rebuilds every `rv2_*` table** (full rebuild, on demand via `backend/scripts/refresh_facts.py`, no scheduler exists). Do not write to these tables, and do not run a refresh without the owner's approval, because it writes to Azure.

| Table | Contents |
|---|---|
| `rv2_Meta` | `MetaId`, `Version`, `RefreshedUtc`, `TodayDate`, `CapacityHours` (176), `WindowStartKey`, `WindowEndKey`. The API reloads when `Version` changes (checked every 5 s; browser cache 30 s) |
| `rv2_MonthInfo` | `MonthKey`, `MonthStart`, `MonthEnd`, `HasData` |
| `rv2_Quality` | `Name`, `Value` (data quality counters) |
| `rv2_Employee` | `EmployeeKey`, `EmployeeCode`, `Name`, `NameSource`, `HrMatched`, `DatesValid`, `JoiningDate`, `ExitDate`, `EmployeeStatus`, `PrimaryCapability`, `SecondaryCapability`, `Grade`, `Country`, `Location`, `Division`, `Department`, `Email`, `ManagerName`, `ManagerCode`, `EmploymentType` |
| `rv2_Project` | `ProjectId`, `ProjectName`, `ClientBU`, `ProjectStatus`, `ProjectLead`, `ContractType`, `ContractCategory`, `StartDate`, `EndDate`, `Description` |
| `rv2_Allocation` | `SourceRowId`, `EmployeeKey`, `MonthKey`, `ProjectId`, `SubProject`, `Effort`, `RowStatus` (valid, placeholder, unresolved), `Reason`, `ContractType`, `StartDate`, `EndDate` |
| `rv2_EmployeeMonth` | `EmployeeKey`, `MonthKey`, `Capacity`, `NamedRows`, `ValidRows`, `PlaceholderRows`, `UnresolvedRows`, `ProjectCount`, `RawHours`, `VerifiedHours`, `UnresolvedHours`, `Planned`, `Remaining`, `Status`, `StatusReason`, `ContractCategory` |

The exact definitions are in `backend/sql/rv2_schema.sql`. Profile tags (business vertical, tenure, client) are not stored in `rv2_*`; the backend reads them live from the sources when it reloads a snapshot.

### 5. Skills dataset (placeholder, stub only)

Current development view: `dbo.vw_RV_EmployeeSkillsForDashboard`, used as a stub. Only `employee_code`, `skill_name` and `current_level` are assumed. Its levels today (Beginner, Intermediate, Expert, NULL) are placeholders. The **production skills dataset will come from the KB team** and is different. Access it only through a `SkillsProvider` adapter, and never assume family, category, platform or last-used fields.

### 6. Availability rules the data must satisfy

Full text: `docs/CALCULATION_SPEC.md`. Short form:

- Window = current month plus 18. Capacity = 176 h per employed month, taken from `rv2_Meta.CapacityHours`, never hard-coded. Capacity exists only if the employee is HR-matched with valid dates.
- A row is **unresolved** if the month is missing or not the 1st, effort is missing or negative, `is_override` is NULL or true, or there are two or more positive rows in the same group (employee, month, project, proposal, sub-project). Effort 0 is a placeholder. Effort above 0 is valid.
- Planned = sum of valid effort, but NULL if any unresolved row exists or the employee is not HR-matched. Remaining = Capacity minus Planned. Status: Unverified (capacity or planned unknown), Over-allocated (remaining below 0), Fully Committed (0), Fully Available (planned 0), else Partially Available. A month with no row is "No record".
- The dashboard counts rows of every project status, draft and in approval included.
- **Any row you write must classify as valid under these rules**, otherwise the employee's month turns Unverified and they cannot be booked.

### 7. What you may do with these databases

| Action | Allowed |
|---|---|
| Read Project Track, ZingHR and `rv2_*` | Yes |
| Write to ZingHR | **No** |
| Write to `rv2_*` | **No** (only `dbo.rv2_Refresh` does) |
| Write to Project Track | Only through the write path the owner approves (open decision; currently none exists) |
| Create service-owned tables (reservations, candidates, outbox, audit) | Only in a database location the owner designates, never inside the two source tables |
| Run `refresh_facts.py` | Only with the owner's approval |
| Add or assume a column that does not exist | **No** |

When data or a system is missing, build a stub behind an interface and document it; do not invent columns.
