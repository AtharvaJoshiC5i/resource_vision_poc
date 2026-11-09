# Resource Vision POC — Power BI Mock Data Replication Spec

This document is the **single source of truth** for rebuilding the Resource Vision web application as a **Power BI dashboard using only mock data** under `data/`. It describes every data file, transformation, calculation, filter, page, and UI behavior implemented in the React app so a downstream agent can implement **Power Query (M)**, **TMDL**, and **DAX** without asking the product owner for business logic.

**Out of scope for Power BI (do not implement):** Azure SQL / organization mode, FastAPI backend, `backend/`, live API bundle, authentication, resource blocking, and any logic that only exists for org-data normalization edge cases.

---

## Table of contents

1. [Application map](#1-application-map)
2. [Mock data files (load these only)](#2-mock-data-files-load-these-only)
3. [How mock data becomes facts in the app](#3-how-mock-data-becomes-facts-in-the-app)
4. [Planning horizon & month constants (mock)](#4-planning-horizon--month-constants-mock)
5. [Availability engine (canonical calculations)](#5-availability-engine-canonical-calculations)
6. [Source period: Famstack vs Project Track](#6-source-period-famstack-vs-project-track)
7. [Overview page logic](#7-overview-page-logic)
8. [Availability page logic](#8-availability-page-logic)
9. [Resources page logic](#9-resources-page-logic)
10. [Resource detail page logic](#10-resource-detail-page-logic)
11. [Projects & project detail logic](#11-projects--project-detail-logic)
12. [Shared resource filters](#12-shared-resource-filters)
13. [Dimension drill-down order](#13-dimension-drill-down-order)
14. [Upcoming availability & attention rules](#14-upcoming-availability--attention-rules)
15. [Resource release / outlook rules](#15-resource-release--outlook-rules)
16. [Recommended Power BI model](#16-recommended-power-bi-model)
17. [DAX / measure cheat sheet](#17-dax--measure-cheat-sheet)
18. [UI replication checklist](#18-ui-replication-checklist)
19. [Validation against the web app](#19-validation-against-the-web-app)
20. [Source code index](#20-source-code-index)

---

## 1. Application map

| Route | Page component | Primary facts used |
|-------|----------------|-------------------|
| `/` | `OverviewPage` | `resourceMonthlyRecords`, `unassignedDemand` |
| `/availability` | `AvailabilityPage` | `employeeMonthAvailability` via `availabilityQueryContext` |
| `/resources` | `ResourcesPage` | `employeeMonthAvailability` (matrix + release outlook) |
| `/resources/:id` | `ResourceDetailPage` | Per-employee availability, transitions, release |
| `/projects` | `ProjectsPage` | `projectTrack` → project list rows |
| `/projects/:id` | `ProjectDetailPage` | Project effort & allocations |
| `/data-sources` | `DataSourcesPage` | Informational (no analytics) |

Navigation labels: `src/components/config/navigation.ts`.

**Mock mode:** `ResourceDataContext` builds `mockResourceVisionBundle` from the four JSON files (`src/data/mockResourceVisionBundle.ts` → `buildResourceVisionData`).

---

## 2. Mock data files (load these only)

| File | Role | Grain / notes |
|------|------|----------------|
| `src/data/zinghr.json` | Employee master | One row per employee (`employee_id`) |
| `src/data/famstack.json` | Historical actuals | One row per **employee × month × project** (effort) |
| `src/data/projectTrack.json` | Planned allocations + demand | One row per **employee × month × project** (or unassigned demand row) |
| `src/data/capacityConfig.json` | Work calendar | One row per **country × location × month** |

Optional reference (pre-built in app, can be regenerated): `src/data/resourceMonthlyRecords.example.json` shows output shape of `resourceMonthlyRecords`.

### 2.1 `zinghr.json` columns (used)

| Column | Maps to domain `Employee` |
|--------|---------------------------|
| `employee_id` | `employeeId` |
| `employee_name` | `employeeName` |
| `employment_status` | `ACTIVE` if value is `"Active"`, else `INACTIVE` |
| `date_of_joining` | `dateOfJoining` (date part `YYYY-MM-DD`) |
| `date_of_leaving` | `lastWorkingDate` if non-empty |
| `primary_capability`, `secondary_capability`, `department`, `grade`, `location`, `country` | Same names (camelCase in domain) |
| `weekly_capacity_hours` | **Not used** in capacity math; FTE defaults to **1** |

Normalization: `src/services/normalization/employeeNormalizationService.ts` (`DEFAULT_FTE_PERCENTAGE = 1`).

### 2.2 `famstack.json` columns (used)

| Column | Usage |
|--------|--------|
| `employee_id`, `project_id`, `month_key` | Allocation keys |
| `actual_effort_hours` | **Allocated hours** for that month (`allocatedHours`), source `FAMSTACK` |
| Other hour columns | Not used in availability engine in this POC |

Normalization: `normalizeHistoricalAllocations` in `famstackNormalizationService.ts`.

### 2.3 `projectTrack.json` columns (used)

| Column | Usage |
|--------|--------|
| `employee_id`, `project_id`, `month_key` | Allocation keys when tagged |
| `effort_value` | **Planned allocated hours** for TAGGED rows |
| `employee_tagging` | `"TAGGED"` → allocation; `"UNASSIGNED_GRADE_DEMAND"` → unassigned demand only |
| `employee_name`, capabilities, geo, grade, department | Copied to demand rows |
| `project_name`, `proposal_number`, `project_status`, `start_date`, `end_date` | Project dimension |
| Rows with empty `employee_id` | Excluded from allocations |

Normalization: `projectTrackNormalizationService.ts`.

### 2.4 `capacityConfig.json` columns (used)

| Column | Usage |
|--------|--------|
| `country`, `location`, `month_key` | Calendar lookup key |
| `working_days`, `hours_per_day` | Capacity = `working_days * hours_per_day * ftePercentage` |
| `standard_capacity_hours` | Informational in JSON; engine uses `working_days * hours_per_day` |

Fallback if no calendar row: `DEFAULT_WORKING_DAYS_PER_MONTH = 22`, `DEFAULT_HOURS_PER_DAY = 8` (`src/constants/capacityFallback.ts`). Geo labels empty → `"Unspecified"`.

---

## 3. How mock data becomes facts in the app

Pipeline entry: `buildResourceVisionData` (`src/services/buildResourceVisionData.ts`).

```
zinghr + famstack + projectTrack + capacityConfig
  → normalize employees, projects, allocations, work calendar
  → availabilityQueryContext
  → buildEmployeeMonthAvailabilities()  // canonical fact: EmployeeMonthAvailability[]
  → buildResourceMonthlyRecords()       // legacy view: snake_case ResourceMonthlyRecord[]
  → getUnassignedDemand(projectTrack)   // unassigned demand rows
```

**For Power BI:** Either (A) replicate this pipeline in Power Query, or (B) export `employeeMonthAvailability` / `resourceMonthlyRecords` once from the app and load as static tables. **(A) is required** if you need project-level drill-through identical to the engine.

Canonical grain for almost all workforce analytics: **`employeeId` × `monthKey`** (`EmployeeMonthAvailability`).

Legacy Overview uses **`resourceMonthlyRecords`** (same numbers, snake_case). Mapping: `src/services/resourceNormalizationService.ts` → `buildResourceMonthlyRecords`.

---

## 4. Planning horizon & month constants (mock)

From `src/constants/poc.ts` (mock planning horizon when org mode is off):

| Constant | Value |
|----------|--------|
| `POC_YEAR` | 2026 |
| `POC_CURRENT_MONTH` | **`2026-09`** (planning cutover for **calculations**) |
| `FAMSTACK_MONTHS` | `2026-01` … `2026-08` |
| `PROJECT_TRACK_MONTHS` | `2026-09` … `2027-03` |
| Full horizon `monthKeys` | Jan 2026 – Mar 2027 (15 months) |

`getPlanningMonthKeys()` (`planningHorizonRuntime.ts` mock): concatenation of `FAMSTACK_MONTHS` + `PROJECT_TRACK_MONTHS`.

**Month key format:** `YYYY-MM` strings. Compare lexicographically by year then month (`compareMonthKeys` in `monthService.ts`).

**Add months:** `addMonths(monthKey, offset)` — handles year boundaries (e.g. `2026-12` + 1 → `2027-01`).

**Month range:** `getMonthRange(startMonth, count)` — consecutive months from `startMonth`.

---

## 5. Availability engine (canonical calculations)

Implemented in `calculateEmployeeMonthAvailability` (`availabilityService.ts`). Apply per **active** employee-month only.

### 5.1 Workforce state (`calendarService.getWorkforceState`)

For employee `E` and month `M` (calendar month bounds, UTC):

- `NOT_JOINED` if `dateOfJoining` > last day of `M`
- `EXITED` if `lastWorkingDate` < first day of `M`
- Else `ACTIVE`

Only `ACTIVE` rows get availability rows. Others are omitted from facts.

### 5.2 Allocations for month M

`getSourceForMonth(M)` → `FAMSTACK` or `PROJECT_TRACK` (see [§6](#6-source-period-famstack-vs-project-track)).

`getAllocationsForMonth(context, M)` returns **only** that source’s allocation table:

- Before cutover: sum **Famstack** `actual_effort_hours` by employee × month × project
- From cutover onward: sum **Project Track** `effort_value` for `employee_tagging = TAGGED`

**Important:** Famstack and Project Track are **not** combined in the same month. September 2026 uses **only** Project Track allocations in the engine when cutover is `2026-09`.

`allocatedHours` = SUM of `allocatedHours` on matching allocation rows.

### 5.3 Capacity

`totalCapacityHours` = `workCalendar.workingDays * workCalendar.hoursPerDay * employee.ftePercentage`

Work calendar resolved by country + location + month with fallbacks (`resolveWorkCalendar`).

### 5.4 Availability hours

```
blockedHours = 0   // not implemented in POC UI
availableHours = totalCapacityHours - allocatedHours
availableToPromiseHours = totalCapacityHours - allocatedHours - blockedHours
```

### 5.5 Percentages

```
availabilityPercentage = totalCapacityHours = 0 ? 0 : (availableHours / totalCapacityHours) * 100
utilizationPercentage  = totalCapacityHours = 0 ? 0 : (allocatedHours / totalCapacityHours) * 100
```

Round for display in aggregates: 2 decimal places (`aggregationService.roundPercentage`).

### 5.6 Availability status (`getAvailabilityStatus`)

Evaluate **after** computing `allocatedHours` and `availableHours`:

| Condition | Status |
|-----------|--------|
| `availableHours < 0` | `OVER_ALLOCATED` |
| `availableHours = 0` | `FULLY_ALLOCATED` |
| `allocatedHours = 0` AND `availableHours > 0` | `AVAILABLE` |
| Else | `PARTIALLY_AVAILABLE` |

### 5.7 Domain field names (`EmployeeMonthAvailability`)

Use these in DAX / renamed PQ columns:

`employeeId`, `employeeName`, `monthKey`, `workforceState`, `totalCapacityHours`, `allocatedHours`, `blockedHours`, `availableHours`, `availableToPromiseHours`, `availabilityPercentage`, `utilizationPercentage`, `status`, `source`, `primaryCapability`, `secondaryCapability`, `department`, `grade`, `location`, `country`, `projectAllocations[]` (project breakdown for that month).

---

## 6. Source period: Famstack vs Project Track

### 6.1 Calculation cutover (drives which allocations feed the engine)

`getPlanningCurrentMonth()` in **mock mode** = `2026-09` (`planningHorizonRuntime` → mock horizon `currentMonth`).

```
IF compareMonthKeys(monthKey, planningCurrentMonth) < 0 THEN "FAMSTACK" ELSE "PROJECT_TRACK"
```

(`sourcePeriodService.ts`)

### 6.2 Overview **display-only** cutover (tooltips & badges on trend chart)

**Does not change calculated hours.** Only changes labels on Overview trend tooltips and snapshot badge:

```
displaySource(monthKey) =
  IF monthKey < CalendarCurrentMonth (browser YYYY-MM from today) THEN "FAMSTACK"
  ELSE "PROJECT_TRACK"
```

(`getOverviewDisplaySourceForMonth` in `overviewService.ts`; chart divider uses `getCurrentMonthKey()`.)

Power BI: implement **two** columns if replicating Overview exactly:

- `Source_Calculation` (planning cutover `2026-09`)
- `Source_Display` (calendar cutover for trend UI)

---

## 7. Overview page logic

**File:** `OverviewPage.tsx`  
**Facts:** `resourceMonthlyRecords`, `unassignedDemand`

### 7.1 Snapshot month selector

- Options: `POC_MONTH_OPTIONS` = all months Jan 2026 – Mar 2027 (`overviewService.ts`)
- Default selected month: **calendar current month** (`getCurrentMonthKey()`), not `2026-09`
- Badge: `Actual · Famstack` if `getOverviewDisplaySourceForMonth(selectedMonth) = FAMSTACK`, else `Planned · Project Track`

### 7.2 KPI cards (`getOverviewSnapshot`)

For selected `monthKey`, filter `resourceMonthlyRecords` to that month, then:

| KPI | Calculation |
|-----|-------------|
| Total Capacity | SUM(`total_capacity`) |
| Utilized Capacity | SUM(`utilized_capacity`) |
| Available Capacity | SUM(`available_capacity`) |
| Utilization % | `aggregateResourceRecords` → `utilizationPercentage` |
| Availability % | `aggregateResourceRecords` → `availabilityPercentage` |
| Active resources | COUNT rows |
| Resources with capacity | COUNT where `available_capacity > 0` |
| Unassigned demand hours | SUM `effort_hours` on `unassignedDemand` for month |
| Unassigned demand count | COUNT demand rows for month |

Aggregate formulas: `aggregationService.aggregateResourceRecords` — org-level % uses **sum of capacities**, not average of row %.

### 7.3 Availability trend chart

`getMonthlyAvailabilityTrend(records)`:

- One point per month in `POC_MONTH_OPTIONS`
- Same aggregates as snapshot per month
- Line Y = `availabilityPercentage`
- Tooltip also shows available hours, total capacity, **display** source (§6.2)
- Vertical reference line at **calendar current month**
- Footer ranges: historical = first month through month before calendar current; planned = calendar current through last month in data

### 7.4 Capability availability list

`getCapabilityAvailability(records, monthKey)`:

- Group month rows by `primary_capability`
- Per group: same sums as aggregate + `resourceCount`
- Sort ascending by `availabilityPercentage` (tightest first)

### 7.5 Capacity outlook table

`getCapacityOutlook(records)`:

- Rows = distinct `primary_capability`
- Columns = each month in `PLANNING_MONTHS` only (`2026-09` … `2027-03`)
- Cell metrics per capability × month: total/utilized/available capacity and availability %

### 7.6 Unassigned demand table

`getMonthlyUnassignedDemand(demand, monthKey)` — filter demand fact to month.

---

## 8. Availability page logic

**File:** `AvailabilityPage.tsx`  
**Facts:** Recompute range from `availabilityQueryContext` via `getAvailabilityForRange` / filters on `EmployeeMonthAvailability`.

### 8.1 Planning horizon control

- `PLANNING_HORIZON_MONTHS = 7` consecutive months
- `startMonth` state (default `POC_CURRENT_MONTH` = `2026-09`)
- Prev/next month shifts `startMonth` by ±1 if calendar coverage exists (`hasCalendarCoverage`)
- `monthKeys = getMonthRange(startMonth, 7)`

### 8.2 Shared filters

See [§12](#12-shared-resource-filters). `focusMonth` defaults to `startMonth` and drives KPI “focus month”.

### 8.3 Workforce KPI cards (`AvailabilitySummaryCards`)

`getMonthlyAvailabilitySummary(filteredRecords, focusMonth)` (`availabilityAggregationService.ts`):

| Metric | Rule |
|--------|------|
| `totalResources` | COUNT active rows in focus month |
| `resourcesWithCapacity` | COUNT where `availableHours > 0` |
| Status counts | COUNT by `status` |
| `totalCapacityHours` | SUM `totalCapacityHours` |
| `totalAllocatedHours` | SUM `allocatedHours` |
| `totalAvailableHours` | SUM **MAX(availableHours, 0)** per employee — negatives do not reduce org total |
| `totalAvailableToPromiseHours` | SUM **MAX(availableToPromiseHours, 0)** |

### 8.4 Forward availability strip

Months in current horizon; highlights `focusMonth`; shows per-month summary metrics from summaries list.

### 8.5 Dimension summary

- Default group-by dimension: `primaryCapability`
- Drill order: [§13](#13-dimension-drill-down-order)
- `aggregateAvailabilityByDimension(records, dimension, focusMonth)` — per dimension value: resource counts, with capacity, available hours
- Country/Location: expandable employee roster for that group (`listEmployeesInDimensionGroup`)

### 8.6 Upcoming availability

**Month cards:** `getUpcomingAvailabilityMonthSummaries(filteredRecords)` — for each employee, compare consecutive months in data; if `capacityGain > 0`, attribute gain to **current** month in pair. Aggregates per `toMonth`:

- `resourcesGainingCapacity`, `additionalAvailableHours`, `resourcesBecomingFullyAvailable` (transition to `AVAILABLE` from non-AVAILABLE)

**Modal (click month):** `getUpcomingAvailabilityTransitions` + partition:

- Fully available: `BECAME_FULLY_AVAILABLE` in `transitionTypes`
- Partial: other positive gain transitions
- Show prior → new hours and gain hours

### 8.7 Attention

`getAvailabilityAttentionItems(filteredRecords)` — per employee, month-over-month:

1. Static: any month with `OVER_ALLOCATED` → item type `OVER_ALLOCATED`
2. Month-to-month decrease in `availableHours`:
   - If becomes over-allocated → `BECOMING_OVER_ALLOCATED` (skip generic reduction)
   - Else if becomes `FULLY_ALLOCATED` → `BECOMING_FULLY_ALLOCATED`
   - Else → `CAPACITY_REDUCTION` with `changeHours` negative

**Month cards:** group items by `monthKey`; click opens modal with partitions: over-allocated, becoming over-allocated, becoming fully allocated, capacity reductions.

### 8.8 Upcoming resource preview

List preview of filtered employees (existing component) — optional in Power BI.

---

## 9. Resources page logic

**File:** `ResourcesPage.tsx`

### 9.1 Month matrix controls

**Default view:** `PlanningHorizonControl` — 4 consecutive months from `planningStartMonth` (default `getPlanningCurrentMonth()` → **`2026-09`** in mock).

**Custom view (optional UI):** up to **4** non-consecutive months from full horizon; reset returns to planning window anchored at `getPlanningCurrentMonth()`.

Matrix data: `getAvailabilityForMonthKeys(context, selectedMonthKeys)` then filters.

### 9.2 Matrix rows (`buildResourceAvailabilityMatrixRows`)

Per employee:

- Columns: Resource (name, id, location), Projects (top 2 names + “+N more”), Until (`max(projectEndDate)`), one column per selected month with status cell
- Month cell: `availableHours`, status label (Available / Partial / Allocated / Over)
- Row hint: first month where status becomes `AVAILABLE` or first month-over-month capacity increase (if not first visible month)
- **Sort default:** `availableHours` in **focus month** descending
- **Pagination:** 10 rows per page default; page size options **10, 20** only

### 9.3 Row selection → release outlook panel

`getExpectedRelease(releaseRecords, employeeId, focusMonth)` on full planning horizon records (`POC_CURRENT_MONTH` + `RELEASE_HORIZON_MONTHS` = length of `PROJECT_TRACK_MONTHS`).

Panel sections:

- Header: focus month availability, status, capacity, allocated, `releaseContext` text
- Month strip: same months as matrix + up to 3 **beyond matrix** months if release events or full availability fall after last matrix month
- Milestones: `releaseEvents` (future capacity gains after focus month) from `getCapacityGains`
- Drivers: `allocatedUntil`, project list with end dates

**Release event types:** `PARTIAL_RELEASE` vs `FULL_RELEASE` (fully available: allocated = 0, status AVAILABLE).

---

## 10. Resource detail page logic

**File:** `ResourceDetailPage.tsx`

- Month timeline across `getPlanningMonthKeys()`
- Selected month breakdown (capacity, allocations, projects)
- `ResourceReleaseSummary` — same release events as outlook, with footer disclaimer (month-level timing)
- `ResourceUpcomingAvailability` — positive `AvailabilityTransition` list (`getUpcomingAvailabilityTransitions`)
- Project commitments grid by month

Power BI: single-employee slicer + bookmarks per section.

---

## 11. Projects & project detail logic

**Files:** `ProjectsPage.tsx`, `ProjectDetailPage.tsx`  
**Services:** `projectAvailabilityService.ts`, `projectFilterService.ts`, `projectPlanningPriorityService.ts`

### 11.1 Project list row

Built from **Project Track** TAGGED rows aggregated by `project_id`:

- Monthly effort totals, assigned headcount, capabilities (from rows)
- Planning priority from days until `start_date` vs `RESOURCE_PRIORITY_WINDOW_DAYS` (15 calendar days)

### 11.2 Project filters

Separate from resource filters (`ProjectFilters` — status, capability, search, etc.). See `projectFilterService.ts`.

### 11.3 Project detail

- Monthly effort chart / table for one project
- Resource allocation table by employee × month (from project track)

---

## 12. Shared resource filters

**Type:** `ResourceFilters` (`resourceFilters.ts`)

| Field | Behavior |
|-------|----------|
| `search` | Case-insensitive substring on `employeeName` OR `employeeId` |
| `primaryCapability`, `secondaryCapability`, `department`, `grade`, `country`, `location` | Multi-select; **empty = no filter**; employee must match **all** dimensions |
| `availabilityStatus` | Multi-select; applied on **`focusMonth` only** |
| `focusMonth` | `YYYY-MM`; drives status filter and many KPIs |

**Status filter values:**

| Value | Employee included if focus month… |
|-------|-----------------------------------|
| `WITH_CAPACITY` | `availableHours > 0` |
| `AVAILABLE` | `status = AVAILABLE` |
| `PARTIALLY_AVAILABLE` | `status = PARTIALLY_AVAILABLE` |
| `FULLY_ALLOCATED` | `status = FULLY_ALLOCATED` |
| `OVER_ALLOCATED` | `status = OVER_ALLOCATED` |

Pipeline: `filterEmployees` → `filterAvailabilityByEmployeePopulation` → `applyFocusMonthAvailabilityFilter` (`resourceFilterService.ts`).

Filter option counts: for each dimension value, count employees matching **other** active filters (faceted counts).

URL query params mirror filters in web app (`useResourceFilters.ts`) — optional in Power BI (slicers equivalent).

---

## 13. Dimension drill-down order

Fixed order (`resourceDimensions.ts`):

1. Primary Capability  
2. Secondary Capability  
3. Department  
4. Grade  
5. Country  
6. Location  

Drill applies one dimension value at a time to filters; breadcrumb resets deeper levels.

---

## 14. Upcoming availability & attention rules

### 14.1 Transitions (`upcomingAvailabilityService.ts`)

For each employee, sort months ascending. For each adjacent pair `(previous, current)`:

Emit transition if any of:

- `current.availableHours > previous.availableHours` → `GAINED_CAPACITY`
- `previous.status != AVAILABLE` AND `current.status = AVAILABLE` → `BECAME_FULLY_AVAILABLE`
- `FULLY_ALLOCATED` → `PARTIALLY_AVAILABLE` → `FULLY_ALLOCATED_TO_PARTIAL`
- `PARTIALLY_AVAILABLE` → `AVAILABLE` → `PARTIAL_TO_FULLY_AVAILABLE`

`additionalAvailableHours = current.availableHours - previous.availableHours`

### 14.2 Capacity gains / release (`resourceReleaseService.getCapacityGains`)

Similar month pairs; only **positive** `availableHours` delta. Classify `FULL_RELEASE` if previous not fully available and current **fully available** (`allocatedHours = 0`, `status = AVAILABLE`, capacity > 0).

`getExpectedRelease` filters events to months **after** `focusMonth`.

---

## 15. Resource release / outlook rules

Already covered in [§9.3](#93-row-selection--release-outlook-panel). Milestone list component: `ResourceReleaseMilestones.tsx`.

Display labels:

- `FULL_RELEASE` → “Fully available”
- `PARTIAL_RELEASE` → “Gaining capacity”

Show `allocationReductionHours` when > 0 on milestone row.

---

## 16. Recommended Power BI model

### 16.1 Tables

| Table | Type | Grain |
|-------|------|--------|
| `DimDate` | Calculated | Month (`month_key` first day) |
| `DimEmployee` | From zinghr | `employee_id` |
| `DimProject` | From projectTrack distinct | `project_id` |
| `DimGeo` | Optional | country, location |
| `FactEmployeeMonth` | Engine output | employee × month |
| `FactFamstack` | Staging | famstack rows |
| `FactProjectTrack` | Staging | projectTrack rows |
| `FactUnassignedDemand` | From demand service | demand rows |
| `DimMonthHorizon` | Helper | Flags famstack vs PT vs display source |

### 16.2 Relationships

- `FactEmployeeMonth[employee_id]` → `DimEmployee[employee_id]`
- `FactEmployeeMonth[month_key]` → `DimDate[month_key]`
- Bridge to projects via allocation breakdown table if needed

### 16.3 Power Query order

1. Load four JSON files  
2. Build `DimEmployee` (PQ functions mirroring `normalizeEmployees`)  
3. Build allocation tables (Famstack / PT rules)  
4. Build `DimWorkCalendar` from capacityConfig  
5. For each `(employee, month)` in horizon list, compute capacity, allocated, available, status (nested function or cross join then expand)  
6. Materialize `FactEmployeeMonth`  
7. Derive `resourceMonthlyRecords` columns as rename step for Overview parity  

**Do not** join Famstack and PT allocations for the same month — pick one source per month via cutover rule.

---

## 17. DAX / measure cheat sheet

```dax
// Org available hours (Availability KPI) — clip negatives
Total Available Hours :=
SUMX (
    VALUES ( FactEmployeeMonth[employee_id] ),
    VAR ah = CALCULATE ( MAX ( FactEmployeeMonth[available_hours] ) )
    RETURN MAX ( ah, 0 )
)

// Row-level availability % (already on fact)
// Org availability % from components:
Availability % :=
DIVIDE ( [Total Available Hours], SUM ( FactEmployeeMonth[total_capacity_hours] ), 0 )

// Status (row-level — use MAX if one row per employee-month)
// WITH_CAPACITY filter: available_hours > 0

// Planning source (calculations)
Source Calc :=
IF ( FactEmployeeMonth[month_key] < "2026-09", "FAMSTACK", "PROJECT_TRACK" )

// Overview display source (calendar — parameterize Today)
Display Source :=
IF (
    FactEmployeeMonth[month_key] < FORMAT ( TODAY (), "yyyy-MM" ),
    "FAMSTACK",
    "PROJECT_TRACK"
)
```

Use a **What-If parameter** for `PlanningCutoverMonth` default `2026-09` instead of hardcoding in production dataset.

Month-over-month DAX for attention/upcoming: use `PREVIOUSMONTH` on `DimDate` or self-join on `employee_id` with `month_key` ordered index.

---

## 18. UI replication checklist

| Visual | Page | Notes |
|--------|------|--------|
| 5 KPI cards | Overview | Snapshot month slicer |
| Line chart + plan divider | Overview | Y = availability %; display source in tooltip |
| Capability bar/list | Overview | Sorted tightest first |
| Heatmap/table | Overview | Capacity outlook Sep 2026–Mar 2027 |
| Demand table | Overview | Unassigned rows |
| 6 KPI cards | Availability | Focus month |
| 7-month forward strip | Availability | |
| Dimension table + drill | Availability | 6-level order |
| Upcoming month cards + modal | Availability | Max 4-custom N/A here — per-month aggregates |
| Attention month cards + modal | Availability | |
| Resource matrix | Resources | 4 months, status colors |
| Release outlook | Resources | On employee select |
| Employee timeline | Resource detail | |
| Project grid | Projects | Filters |
| Project detail charts | Project detail | |

**Status colors (matrix cells):**

| Status | Visual |
|--------|--------|
| AVAILABLE | Green tint |
| PARTIALLY_AVAILABLE | Amber tint |
| FULLY_ALLOCATED | Gray tint |
| OVER_ALLOCATED | Red tint |

---

## 19. Validation against the web app

1. Set app to **mock mode** (Data Sources page / localStorage `resource-vision:data-mode` = `mock`).
2. Compare Overview KPIs for `2026-09` and trend points month-by-month to DAX.
3. Availability focus month summaries must match `getMonthlyAvailabilitySummary` totals.
4. Pick employee `RV-E001` — matrix hours must match `FactEmployeeMonth` for selected months.
5. September 2026 allocated hours must equal **sum of Project Track** `effort_value` (TAGGED), not Famstack, when cutover is `2026-09`.

Optional: log `mockResourceVisionBundle.employeeMonthAvailability` in browser console from `useResourceData().bundle` and export CSV as golden file.

---

## 20. Source code index

| Topic | Primary files |
|-------|----------------|
| Mock bundle | `src/data/mockResourceVisionBundle.ts`, `src/data/*.json` |
| ETL / build | `src/services/buildResourceVisionData.ts` |
| Normalization | `src/services/normalization/*.ts` |
| Availability engine | `src/services/availabilityService.ts`, `availabilityQueryService.ts` |
| Source cutover | `src/services/sourcePeriodService.ts`, `planningHorizonRuntime.ts` |
| Overview | `src/services/overviewService.ts`, `aggregationService.ts`, `OverviewPage.tsx`, `AvailabilityTrendChart.tsx` |
| Availability page | `availabilityAggregationService.ts`, `availabilityDimensionService.ts`, `availabilityAttentionService.ts`, `upcomingAvailabilityService.ts`, `AvailabilityPage.tsx` |
| Resources matrix | `resourceAvailabilityMatrixService.ts`, `ResourcesPage.tsx`, `ResourceReleaseOutlookPanel.tsx` |
| Release | `resourceReleaseService.ts`, `allocationReleaseService.ts` |
| Filters | `resourceFilterService.ts`, `hooks/useResourceFilters.ts` |
| Projects | `projectAvailabilityService.ts`, `projectFilterService.ts` |
| Constants | `src/constants/poc.ts`, `capacityFallback.ts`, `resourceDimensions.ts` |
| Types | `src/types/domain.ts`, `resourceMonthly.ts`, `famstack.ts`, `projectTrack.ts`, `zinghr.ts`, `demand.ts` |

---

## Agent instructions (read first)

1. **Only** use the four JSON files under `src/data/` as inputs unless you export golden facts from the app.  
2. Reimplement **`calculateEmployeeMonthAvailability`** exactly before any visuals.  
3. Use planning cutover **`2026-09`** for calculated hours in mock; use **calendar month** only for Overview trend **display** labels and divider unless product owner changes spec.  
4. Org-level available hours **sum positive parts only** (§8.3).  
5. Do not merge Famstack and Project Track in the same month.  
6. Replicate **filters** before comparing to page screenshots.  
7. This POC has **30 employees** in mock zinghr; counts should match after filters.

*End of specification.*
