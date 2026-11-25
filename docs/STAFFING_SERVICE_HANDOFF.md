# Resource Vision: Confirmed Project Staffing Service, game plan and handoff

Audience: the engineer or agent building the **Confirmed Project Staffing service** as a **separate project**, starting from scratch, reusing what exists in this repository.

**Scope: confirmed projects only.** The **Unconfirmed** workflow (booking, stages 1 to 6, blocking at stage 6) is **deferred**. The product owner states it will use a **different dataset held by the project team**, so nothing in this plan is built for it, and nothing here should be shaped around it beyond keeping the components reusable (section 14).

Labels used throughout:
- **Owner decision**: stated by the product owner. Treat as fixed.
- **Verified**: checked against this repository's code, or read-only (aggregates only) against Azure on 2026-11-21.
- **Proposal**: not in any dataset today. Built behind configuration, marked for sign-off, never silently assumed.
- **Open**: unresolved, needs an owner.

---

## 1. The game plan (Owner decisions)

1. **Project Track is a different application.** The staffing service is a Resource Vision (RV) service that **starts when a user clicks "Select employee" inside Project Track**, for a **confirmed** project.
2. **The user sees the availability dashboard there.** The service exposes the RV availability dashboard (the logic and views built in this repository) to the lead, who picks primary and secondary capability, department, location, country and grade, types skills and levels, then chooses employees.
3. **Two datasets only are shared between RV and Project Track:** the **Project Track table** and the **ZingHR table**. The availability view is built from those two and nothing else.
4. **Skills come from a different dataset.** The Knowledge Benchmarking (KB) team will supply it. It will **not** be the skills view used in this repository today. Build against an adapter.
5. **Build with what exists, assume nothing else.** Use existing columns; their names are expected to stay the same when real data arrives. Where a column does not exist, **do not assume it and do not create it**.
6. **Build every confirmed-workflow function now, stubbed where data or systems are missing:** pool, ranking, skill ticks, direct select, send to KB, interview, rejection, MyNextHire (MNH), final check, reservation, Project Track write. They run end to end on stubs and switch to real systems later.
7. **Changes land in the source databases, then reach the dashboard.** The confirmed allocation is written to the **Project Track database**. The standard availability dashboard then shows it, because the dashboard is derived only from Project Track and ZingHR.
8. **ZingHR: define the workflow only** (section 7). Do not build a ZingHR integration.
9. **Unconfirmed projects: out of scope for now.** Separate dataset, separate effort.

---

## 2. Principles

| Principle | Consequence |
|---|---|
| Never invent a column | Everything read or written in Project Track or ZingHR is a column in section 4. A feature needing a missing column goes under "Do not build" |
| Missing data or systems become ports | Skills, KB, MNH, Project Track events, notifications, ZingHR each get an interface plus a stub |
| Do not guess rules | Every unresolved rule is configuration with a documented default, or an Open decision (section 12) |
| Reuse, never re-implement | Availability rules come from `engine.py` and the `rv2_*` SQL with their tests |
| Only confirmed reservations change availability | Interview bookings, KB Pending rows, expired holds and rejected rows never reduce hours |
| The dashboard stays read-only and standard | It is not modified. It sees only what lands in Project Track and ZingHR |

---

## 3. What exists in this repository (Verified)

| Piece | Where |
|---|---|
| Availability rules in Python (reference, pure functions) | `backend/app/rv/engine.py` |
| The same rules in SQL (production, writes `rv2_*`) | `backend/sql/rv2_schema.sql` (`dbo.rv2_Refresh`) |
| Parity check SQL against Python | `backend/scripts/check_facts.py` |
| Precomputed tables | `dbo.rv2_Meta`, `rv2_MonthInfo`, `rv2_Quality`, `rv2_Employee`, `rv2_Project`, `rv2_Allocation`, `rv2_EmployeeMonth` |
| Page read models (filters, matrix, Employee 360, accounts) | `backend/app/rv/views.py` |
| Snapshot loader and cache | `backend/app/rv/facts.py`, `service.py` |
| HTTP API (read-only) | `backend/app/rv/routes.py`, base `/api/rv` |
| Skills filtering (current view, a **placeholder** here) | `backend/app/rv/skills.py`, `skills_sql.py` |
| Tests | `backend/tests/` (76); fixtures `pt()`, `hr()`, `snap()` in `test_engine.py` |
| Written rules | `docs/CALCULATION_SPEC.md` |
| Frontend (filters, matrix, Employee 360) | `src/` (React) |

**Reuse strategy:** take `engine.py` and the `rv2_*` SQL as a pinned shared package with the tests; run `check_facts.py` in CI so the two copies cannot drift. Reuse the frontend components and filter patterns for the embedded popup.

---

## 4. Column inventory: build with these, nothing else

### 4.1 Project Track table `dbo.project_track_proposals_table` (Verified)

120 columns. Facts that shape the design:

- **No primary key, indexes, triggers, NOT NULL columns, or identity columns.** The database enforces nothing, so duplicates and partial rows are possible. The service must carry its own uniqueness and concurrency control (section 8.3).
- **`row_id` is a slot identifier, not a row identifier.** 450 distinct values across 7,335 rows (for example `Data_Science_Offshore_C2`, reading as capability, location, grade). The dashboard identifies an allocation by (employee, month, project, proposal, sub-project). Never use `row_id` as a row key.
- **No project in this table is confirmed today.** All 15 projects are `draft` (1,167 rows) or `in_approval` (5,905 rows), with 263 rows having no status. `final_approved_at` is empty on every row, `document_approval_status` is only `pending` or null, and `auto_approved` is null throughout. So **this table has nothing that looks like a confirmed project yet** (Open, D19 and D20).
- **Demand slots appear to exist as untagged rows.** `employee_tagging` is 1 ("Yes") on 4,694 rows and 0 ("No") on 2,641, while only 4,634 rows carry an employee. This looks like an open-position concept; the meaning is **not confirmed** (Open, D16).
- **Freshness warning.** `truth_refreshed_at` (latest 2026-09-20), `force10_refreshed_at` and `source_type` suggest a replicated or rebuilt table. Whether writing here is safe, or a rebuild would erase service writes, must be confirmed (Open, D13).
- A view `dbo.vw_famstack_employee_proposal_month_hours` exists. It was **not** inspected. Ask the Project Track team whether it is an official hours source.

**Columns the availability engine reads (the service may rely on these):**

| Group | Columns |
|---|---|
| Allocation | `row_id`, `project_id`, `proposal_number`, `sub_project_name`, `employee_id`, `month_key`, `effort_value`, `is_override`, `contract_type`, `start_date`, `end_date` |
| Project | `project_name`, `project_status`, `project_lead_name`, `parent_account_name`, `account_name`, `bdu_name`, `notes` |
| Employee attributes on the row | `employee_name`, `primary_capability`, `secondary_capability`, `department`, `grade`, `location`, `country` |
| Other columns that exist | `lifecycle_stage`, `current_approval_stage`, `final_approved_at`, `document_approval_status`, `employee_tagging`, `employee_tagging_label`, `is_manual_row`, `included_default` (ignored by rule), `row_updated_at`, `row_updated_by_name`, `hourly_rate` |

### 4.2 ZingHR table `dbo.zinghr_employee_master` (Verified)

117 employees, 67 columns. Read-only for the service.

| Group | Columns |
|---|---|
| Identity | `EmployeeCode`, `EmployeeName`, `Email` |
| Employment dates and status | `DateOfJoining`, `ExitDate`, `DateOfLeaving`, `DateofResignation`, `EmployeeStatus`, `EmploymentType`, `TYPE OF EMPLOYMENT` |
| Organisation | `[Business Vertical]`, `Division`, `Department`, `[Line of Business]`, `Location`, `WORKING LOCATION`, `COUNTRY` |
| Role | `[Primary Practice]`, `[Secondary Practice]`, `[Grade Code]` |
| Reporting | `ReportingManagerName`, `ReportingManagerCode` |

Employee keys are normalised with `dbo.rv_Key()` (match key) and `dbo.rv_Clean()` (text). Never join on raw strings. 156 employees exist across both tables; 39 have no HR record.

### 4.3 Filters the popup needs

| Filter in the workflow | Data exists | Filter exists in the dashboard |
|---|---|---|
| Primary capability | yes | yes |
| Secondary capability | yes (`SecondaryCapability`) | **no**, add |
| Department | yes (`Department`) | **no**, add |
| Location | yes | yes |
| Country | yes (`Country`) | **no**, add |
| Grade | yes | yes |
| Also available | Business vertical, Client, Tenure, Division, Skills | yes |

Adding the three missing filters is additive and uses columns already loaded.

### 4.4 Do not build (no source column or system today)

| Item | Reason |
|---|---|
| A "confirmed" flag derived from data | No row in the table is confirmed; the marker is unknown (D19, D20). Take it from Project Track at launch, and make the status mapping configuration |
| Skill family, category, platform | Not in the contract, and the KB dataset is unknown |
| Any column not in 4.1 or 4.2 | Do not assume |
| Writing any ZingHR column | Out of scope; workflow only (section 7) |

---

## 5. Availability logic to reuse (Verified)

Full text: `docs/CALCULATION_SPEC.md`. The service reproduces exactly this.

**Window and capacity.** The window is the current month plus 18. Capacity is **176 h per employed month**, read from `dbo.rv2_Meta.CapacityHours` (set by `RV_CAPACITY_HOURS`). Never hard-code it. Window bounds are `WindowStartKey` and `WindowEndKey`. A project whose dates run past the window needs the window extended or the request refused with a clear reason (D21).

**Row classification** (rows with a non-null employee key):

| Status | Rule |
|---|---|
| Unresolved | month missing or not the 1st; effort missing or negative; `is_override` NULL or true; or two or more positive rows in the same group (employee, month, project, proposal, sub-project) |
| Placeholder | effort = 0 and not unresolved |
| Valid | effort above 0 and not unresolved |

**Employee-month:**
- `Capacity` = 176 only if HR-matched **and** dates valid (joining present, exit not before joining); else NULL.
- A month in which an HR-matched, valid-dates employee was **not employed** is dropped.
- `VerifiedHours` = sum of valid effort; with no valid and no unresolved rows it is **0** (an explicit zero is real); with unresolved rows and no valid ones, NULL.
- `Planned` = VerifiedHours only if no unresolved rows and HR-matched; else NULL.
- `Remaining` = Capacity minus Planned when both are known.
- Status: **Unverified** if Capacity or Planned is NULL; else Remaining below 0 **Over-allocated**, 0 **Fully Committed**, Planned 0 **Fully Available**, otherwise **Partially Available**.
- A month with **no row** is "No record" and is treated as not available.

**The dashboard counts every row regardless of project status** (draft and in approval hours reduce remaining capacity today). Whether a confirmed-staffing check should do the same, or count only confirmed commitments, is Open (D19).

**Written rows must pass these rules.** Any row the service writes is re-read by the dashboard and judged by the table above. A NULL `is_override`, a month that is not the 1st, a duplicate positive row in the same group, or a missing effort turns the month Unverified and makes the employee un-bookable.

---

## 6. Skills: an adapter for the KB team's dataset

**Owner decision:** the real skills dataset comes from the KB team and differs from today's.

- Define a `SkillsProvider` port: `get_skills(employee_codes) -> list of {employee_code, skill_name, current_level}` and `get_options()`. Only these three fields are assumed, because they are what the current integration uses.
- **Ship a stub** backed by the current view (`dbo.vw_RV_EmployeeSkillsForDashboard`) for development and tests. It is not the production source.
- Do **not** add family, category, platform or last-used fields. If the KB data has them and the owner approves, add them through the same port later.
- **Level ordering is configuration.** Default from the workflow: Foundational < Applied < Advanced < Expert. At startup, fail loudly if the data holds a level outside the configured order, instead of mapping silently. (Today's development data holds Beginner, Intermediate, Expert and NULL; treat that as placeholder vocabulary.)
- A missing skill or NULL level is a **red X**, never a pass. Green tick means current level at least required level.
- Lead-typed skill names: matching rule (exact case-insensitive, or a controlled list from the KB dataset) is Open (D7).
- Freshness: the current code caches skills for 5 minutes. Make this configurable and add an explicit "refresh skills" call so a KB update shows green without waiting.
- When KB upgrades a skill, it updates the shared skills data; RV reads it through the port and the next read shows green.

Open with the KB team: delivery mechanism (view, API, file), refresh cadence, the level vocabulary, who owns the skill-name list, and the training-request contract (D1, D7, D11).

---

## 7. ZingHR: workflow definition only

**Owner decision:** define the workflow, do not build the integration.

**Role:** the HR master. Supplies identity, employment dates, status, organisation and role attributes. **Read-only** to the service (Verified: existing code only reads it).

**How a ZingHR change reaches the dashboard today (Verified):** `dbo.rv2_Refresh` reads `zinghr_employee_master`. A change in joining or exit dates changes capacity and which months count as employed; a new or removed employee changes who exists and who is HR-matched. The effect shows after the next refresh.

| Step | What happens | Status |
|---|---|---|
| 1 | The service reads HR attributes for eligibility, filters and capacity | Build (read-only, existing columns) |
| 2 | An HR change (exit date set or moved, leaver status, corrected join date) is seen by the refresh or an event | Define |
| 3 | The service revalidates that employee's holds and reservations for the affected months | Define; implement against a stub event |
| 4 | If employment or capacity breaks a reservation, the position is reopened and the lead notified (same flow as a Project Track change, workflow step J) | Define |
| 5 | If the business wants a work status such as "In Project" reflected in HR, the service emits an **intent event** to a `ZingHRStatusPort` | Define only; stub; **no write** |

Open (D17): whether anything is written back to ZingHR. The "work status" in the workflow (In Project and so on) has **no column in either dataset today**, so nothing is built for it. Workflow step I falls back to: record the status change in the service's own audit log and emit the intent event.

---

## 8. Architecture

### 8.1 Shape

```
Project Track (separate app), confirmed project
   |  "Select employee" click: project ID, dates, filters, user identity
   v
RV Confirmed Staffing Service (new repo)
   |-- Embedded popup UI ("Resource Vision Pools") --> availability dashboard view
   |-- Availability Engine (from this repo)        --> reads Project Track + ZingHR
   |-- Orchestrator + state machines
   |-- Reservation store, outbox, audit log         (service-owned storage)
   |-- Ports with stubs: ProjectTrackWriter / Events, SkillsProvider (KB team),
   |                     KBTraining, MNH, Notifications,
   |                     ZingHRStatusPort, IdentityProvider
   v
Confirmed allocation written to Project Track --> rv2_Refresh --> standard availability dashboard
```

The existing availability dashboard stays a separate, read-only application, unchanged.

### 8.2 Embedding and identity (Open, D15)

Decide: iframe, web component or redirect; how the user's identity and permissions reach the service (token, header); allowed origins (CORS and CSP); how the popup returns its result to Project Track. The audit log needs "who", so identity cannot be optional.

### 8.3 Concurrency

Project Track enforces nothing, so atomicity lives in the **service's reservation table**: a unique constraint on (employee, month, demand) and a transactional capacity check with an application lock per employee. The first valid confirmation wins. Test two leads confirming the same employee concurrently.

### 8.4 Final check

Re-read the latest allocations and confirmed reservations directly from Project Track and ZingHR (**fresh read**), not the cached snapshot (up to 5 seconds server-side plus 30 seconds browser cache). Check capacity, identity (HR match, valid dates, employed for the months) and contract (D6).

### 8.5 Keeping the dashboard in sync (Verified mechanism)

The dashboard is derived only from Project Track and ZingHR. Its update path: the confirmed row exists in Project Track, `rv2_Refresh` runs, the version increments, the API reloads within seconds.

- `rv2_Refresh` **deletes and rebuilds every `rv2_*` table** and runs only on demand (`scripts/refresh_facts.py`); there is no scheduler in the repository. One full rebuild per assignment will not scale: debounce and coalesce, or build an incremental refresh for the affected employees (D9).
- Expected latency: write time, plus refresh time, plus up to 5 seconds, plus 30 seconds of browser cache.
- **Outbox:** write an outbox row in the same transaction as a reservation change; a publisher triggers the refresh and marks it done. A **reconcile job** compares confirmed reservations with Project Track rows and the dashboard's `Planned` hours and catches drift.
- Inside the service only, a confirmed reservation not yet echoed in Project Track is subtracted when computing bookable hours, so a retry window cannot double book. This is **not** shown on the dashboard.

---

## 9. The Project Track write path (Open, D8)

No write code exists here and the table gives no guarantees. Before building the writer:

1. Confirm Project Track is the system of record for this table and that a refresh or rebuild will not erase service writes (see 4.1).
2. Confirm direct insert versus a Project Track API. Prefer an API if one exists.
3. Agree which columns a valid allocation row must populate beyond those the dashboard reads (all 120 are nullable). Ask what `employee_tagging`, `is_manual_row` and the `row_id` slot must be for a staffed slot, and whether staffing fills an existing untagged slot row or inserts a new row.
4. Agree who authorises the final allocation.

Every written row must satisfy section 5: first-of-month `month_key`, effort above 0, `is_override` false (not NULL), one row per (employee, month, project, proposal, sub-project), project dates consistent. Use a deterministic idempotency key per (reservation, month) so a retry cannot duplicate. **Do not link by `row_id`**; link by (employee, month, project, proposal, sub-project) and store the link in the service.

---

## 10. Definitions built on existing columns (Proposals, configurable)

Computations over existing data, not new columns. Build behind configuration with these defaults, and mark them for sign-off.

### 10.1 Bookable hours per project month

```
not employed in the month (HR matched, dates valid):  0
status Unverified, Over-allocated or Fully Committed: 0
month has a row, status Partially/Fully Available:    Remaining
no row, HR-matched and employed:                      Capacity   (D3: the dashboard calls this "No record")
minus confirmed reservations not yet echoed in Project Track
```

Interview bookings, KB Pending rows, expired holds and rejected rows subtract nothing.

### 10.2 Bench class (D2)

| Class | Draft rule |
|---|---|
| In Project | current month Fully Committed or Over-allocated |
| Partially Allocated | current month Partially Available |
| True Bench | current month Fully Available (planned 0) |
| Future Bench | not available now, but a later month inside a configurable horizon has Remaining above 0 |

### 10.3 Ranking (D4)

Eligibility first, then True Bench, skill match, bookable hours, evaluated for each project month. Open: how months combine, tie-breaks, partial-month matches.

### 10.4 Eligibility (D6)

Establishable from the data: HR match, valid dates, employed for the project months, not a leaver status. "Contract eligibility" has no employee-level field (contract is a property of an allocation). Until defined, flag it as **unimplemented**; do not pass it silently.

---

## 11. The confirmed workflow (specification)

### 11.1 Steps

**A.** Project Track opens a confirmed project (project ID, details, start date, end date).
**B.** The lead opens Resource Allocation and chooses primary and secondary capability, department, location, country, grade.
**C.** Project Track opens the "Resource Vision Pools" popup, passing project ID, dates and filters. The lead types skills manually, picks a level for each, and sets hours.
**D.** RV builds the candidate pool (True Bench, Future Bench, Partially Allocated; identity and contract eligibility), reads monthly commitments (Project Track allocations plus active RV reservations, **no double counting**), checks the skills data, and ranks: eligibility, then True Bench, skill match, bookable hours, per project month.
**E.** Show a skill match per employee: green tick if current level is at least the required level, red X if lower or missing. If no eligible employee exists, the lead revises filters and retries. If still none, send a request to MNH, then show "Hiring in progress" (the position stays unfilled until someone is staffed).
**F.** The lead selects one or more employees. Each runs its own workflow with **one action per employee**:

1. **Direct select.** The lead enters month-wise hours; RV validates every month. Invalid: revise or choose another employee. Valid: Final Check (G). Hours are assigned exactly as entered, and the employee appears as a normal project row.
2. **Send to KB for skill upgrading.** Create a candidate row (`KB Pending`, not an allocation). The lead enters month-wise hours; RV validates. Then:
   - No red skills: the lead chooses Direct select (Final Check) or Interview.
   - Red skills: collect gaps per employee and skill (current vs required level); count employees fully matched, with one gap, and with several gaps. Compute days from the click date to the project start, split **85% training and 15% buffer** (rounding and calendar-vs-working days configurable; default calendar days, round training days, buffer = total minus training). Send KB a request with employee details, lacking skills (current and target level), the three counts, training days, buffer days and project dates.
   - KB unavailable: keep the row pending and retry; never show a skill match while pending.
   - KB trains within the training days and keeps the buffer for delays. If targets are reached, KB updates the shared skills data and RV shows green. If not, mark "Training failed or delayed", release the provisional hold, and send the lead back to search.
   - After training, a post-training interview is optional or mandatory (configuration flag). If required, re-interview with the same booking, expiry and rejection rules (item 3). Otherwise Final Check.
3. **Interview.** Create an `Interview Pending` row (not an allocation). The lead enters month-wise hours; RV validates; then "Book for Interview". Booking an interview does **not** deduct hours. Show how many project leads plan to interview this employee. Interviews expire after **7 days** (configurable). On expiry run "Expire Hold" and notify the lead, who searches again. If completed: pass goes to Final Check. Reject requires a reason (technical or non-technical); show rejected candidates separately, release any hold, exclude them from fresh recommendations for the same requirement, keep the reason. Technical, skill-related rejections go to KB with project and employee IDs. Then check remaining viable options: if any, return to selection; if none, send an MNH request.

**G. Final check and reservation.** Re-read the latest Project Track allocations and confirmed reservations; check capacity, identity and contract. Conflict: show "Reservation conflict", keep the position open, let the lead retry. Pass: confirm the reservation **atomically**; the first valid confirmation wins (not the first interview hold). Replace any hold without double-subtracting hours.

**H.** Write the employee and hours to Project Track through the approved write path. If Project Track does not confirm the official allocation, retain the reservation and retry idempotently (no duplicate commitment). When confirmed, reconcile allocation and reservation, link IDs, and show the final subtracted hours.

**I. Status handling.** If the assignment start date is reached, set the work status to In Project (or the approved partial status); otherwise keep the current status, while future committed hours still reduce future bookable availability. Mark the position filled. If positions remain, return to the pool for the next position; when all are filled, set staffing complete and keep monitoring. (The work status has no column today; see section 7.)

**J. Events from Project Track** (project dates, hours or cancellation change): revalidate holds, reservations and status asynchronously. Project or demand cancelled: release the relevant holds and reservations, close the demand, notify stakeholders. Otherwise recalculate affected capacity; on conflict, reopen candidate search.

### 11.2 Candidate row state machine

Statuses: `KB Pending`, `Training`, `Training Failed/Delayed`, `Interview Pending`, `Interview Booked`, `Expired`, `Rejected`, `Skills Matched`, `Reserved`, `Confirmed`, `Released`.

| From | Event | To |
|---|---|---|
| (new) | Direct select, hours valid | `Skills Matched` then final check |
| (new) | Send to KB | `KB Pending` |
| `KB Pending` | KB accepts and starts | `Training` |
| `Training` | Targets reached | `Skills Matched` |
| `Training` | Not reached or late | `Training Failed/Delayed` then `Released` |
| (new) or `Skills Matched` | Interview | `Interview Pending` then `Interview Booked` |
| `Interview Booked` | 7 days elapse | `Expired` (notify lead) |
| `Interview Booked` | Pass | `Skills Matched` then final check |
| `Interview Booked` | Reject | `Rejected` (reason kept) |
| `Skills Matched` | Final check passes | `Reserved` |
| `Reserved` | Project Track confirms write | `Confirmed` |
| `Reserved` or `Confirmed` | Cancellation or release | `Released` |

**Only `Reserved` and `Confirmed` reduce availability.** Everything else subtracts nothing. Enforce this in code, not just in the UI.

### 11.3 Stubs (all functional end to end)

KB (accepts a training request, returns success or failure on demand), MNH (records the request, returns "Hiring in progress"), the Project Track event feed and writer, the notification channel, the skills provider, and the identity provider.

---

## 12. Decisions

| ID | Decision | Status |
|---|---|---|
| D1 | Skill level vocabulary and order | **Owned by the KB team**; configurable with a startup check |
| D2 | Bench classes and horizon | Open; draft in 10.2 |
| D3 | Is a No record month bookable at full capacity; are Unverified months bookable | Open; draft in 10.1 |
| D4 | Ranking: month combination, tie-breaks | Open |
| D5 | Overlapping reservations and interview holds; expiry extensions | Open |
| D6 | Contract eligibility definition | Open; no employee-level field |
| D7 | Skill-name matching for lead-typed text | Open |
| D8 | Project Track write path, system of record, who authorises | Open; critical (section 9) |
| D9 | Refresh strategy: debounce, schedule or incremental | Open |
| D11 | MNH fields; KB request and response contract; skills delivery mechanism | Open |
| D12 | Behaviour when identity or skill data cannot be verified | Open; suggested: exclude from ranking with a reason |
| D13 | Is the Project Track table rebuilt upstream, and would that erase service writes | Open; critical |
| D15 | Embedding and identity | Open |
| D16 | Meaning of `employee_tagging`, `is_manual_row`, `row_id` slots; are untagged rows open positions | Open |
| D17 | Anything written back to ZingHR; where "work status" lives | Open; none built |
| D18 | Where the service's own storage lives and who operates it | Open |
| D19 | **Which Project Track rows count as official commitments** (all rows as the dashboard does today, or only confirmed projects) | Open; critical for capacity |
| D20 | **How a project is identified as confirmed**, and which dataset holds confirmed projects (none is confirmed in the current table) | Open; critical |
| D21 | Project dates beyond the 19-month window: extend the window or refuse | Open |
| D10 | Project stage 1 to 6 | **Deferred** with the unconfirmed workflow |

---

## 13. Service-owned data, APIs and configuration

**Tables (the service's own storage, never in Project Track or ZingHR):** `Demand` (project, position, filters, required skills with levels, dates, hours, status), `Candidate`, `CandidateMonth`, `Reservation`, `Interview`, `TrainingRequest`, `RejectionLog`, `Outbox`, `AuditLog` (who, when, project, employee, hours, old and new status), `Config`. Location and operator are Open (D18).

**APIs (Proposal):** `POST /pools/search`, `POST /candidates`, `POST /candidates/{id}/hours`, `POST /candidates/{id}/actions/{direct|kb|interview}`, `POST /candidates/{id}/final-check`, `POST /interviews/{id}/outcome`, `POST /events/project-track`, `GET /availability/employee/{key}`, `POST /admin/reconcile`. Every rejection returns a structured reason, for example "Over capacity in 2027-03 by 24 h".

**Configuration (nothing hard-coded):** capacity (from `rv2_Meta`), skill level order, interview expiry (7 days), 85/15 split, day basis and rounding, post-training interview (optional or mandatory), bench horizon, ranking weights, minimum bookable hours, whether a No record month is bookable, which project statuses mean confirmed (D20), which statuses count as official commitments (D19), KB retry policy, snapshot freshness limits.

---

## 14. Delivery plan

**Phase 0: confirm the critical facts (D8, D13, D19, D20, D15, D16).** Meet the Project Track team. Get a write sandbox and, for testing, at least one confirmed project. Confirm the table is the system of record.

**Phase 1: availability engine as a package.** Extract `engine.py`, the `rv2_*` SQL, tests and `check_facts.py`. Add the three missing filters. Add bookable hours, bench class, eligibility and skill comparison as configurable modules. Parity tests.

**Phase 2: read path and popup.** `POST /pools/search`, `GET /availability/employee/{key}`, ranking, skill ticks via the stub. Embedded popup behind a feature flag, reusing the dashboard components.

**Phase 3: direct select to reservation.** Candidate states, hour validation, final check with a fresh read, atomic reservation, writer port, outbox, refresh trigger, audit log.

**Phase 4: KB, interview and MNH on stubs.** Training request with the 85/15 split, interview booking and expiry, rejection rules, MNH request, retries when a stub is down.

**Phase 5: events, reconcile, hardening, then swap stubs for real systems** one adapter at a time (KB skills data, Project Track writer and events).

**Deferred: unconfirmed workflow.** Keep these components generic so it can reuse them later: the availability engine, the skills comparison, the KB, interview and rejection flows, the final reservation and the outbox and sync. It will bring its own dataset and its own stage handling; none of that is designed here.

---

## 15. Test plan

| Test | Notes |
|---|---|
| Availability parity with the dashboard | Reuse `tests/test_engine.py` fixtures; compare with `rv2_*` output |
| Written rows classify as Valid | Property test over everything the writer produces |
| Skill ordinal comparison | NULL, unknown level (must fail loudly), case |
| 85/15 split | 0, 1, 2, 7 days; rounding variants; calendar vs working |
| Hold expiry | Exactly 7 days and just under; notification sent |
| Atomic reservation | Two leads, same employee and month, concurrently; exactly one wins |
| Idempotent sync retry | A retry after a write timeout creates no duplicate row |
| Cancellation release | Holds and reservations released; demand closed; notification |
| Interview bookings, KB Pending, expired and rejected rows | Never change bookable hours |
| Fresh-read final check | Fails when only the cached snapshot would pass |
| Rejection | Reason kept, excluded for the same requirement, technical ones sent to KB |
| Reconcile | An injected mismatch is detected |
| Stub swap | The same tests pass against the stub and a contract fake of the real adapter |

Because no confirmed project exists in the current data, tests must use fabricated fixtures (the `pt()`, `hr()` helpers) for confirmed projects.

---

## 16. Paste block for the next agent

> Build the **Confirmed Project Staffing** service only; the unconfirmed workflow is deferred and will use a different dataset. Reuse, do not re-implement, the availability rules in `engine.py` and `rv2_schema.sql` with their tests and `check_facts.py`; read `docs/CALCULATION_SPEC.md` first. The service starts from Project Track's "Select employee" click for a confirmed project and shows the availability dashboard view. Its data is only the Project Track table and the ZingHR table, using only the columns in section 4; never assume or create a column. No project in the current table is confirmed, so take the confirmed marker from Project Track at launch and make the status mapping configuration (D19, D20). Skills come from an adapter (the KB team supplies the real data); build and test against the stub. Build every function in section 11 end to end on stubs (KB, MNH, events, notifications). ZingHR is read-only; implement only the workflow in section 7. Only `Reserved` and `Confirmed` reservations change availability. The dashboard derives solely from Project Track and ZingHR, so a confirmed allocation reaches it by landing in Project Track and refreshing. Do not use `row_id` as a row key. The final check must use a fresh read. Every written row must be valid under section 5. Treat sections 10 and 12 as configuration or open decisions with documented defaults, and list the unresolved ones in your "assumptions and open decisions" deliverable. Output "What I found" before coding.
