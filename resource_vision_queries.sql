-- Resource Vision 2.0 | Azure SQL read-only diagnostic and planning queries
-- Run individual numbered batches in SSMS. No source data is modified.
-- IMPORTANT: Values labelled RAW or PROVISIONAL are not approved commitments.
USE [dbforresourcevision];
GO

-- Q01: Source row counts
SELECT 'Project Track' AS source_name, COUNT_BIG(*) AS row_count FROM dbo.project_track_proposals_table
UNION ALL SELECT 'Famstack Billable', COUNT_BIG(*) FROM dbo.famstack_billable
UNION ALL SELECT 'Famstack Non-Billable', COUNT_BIG(*) FROM dbo.famstack_non_billable;
GO

-- Q02: Project Track month coverage
SELECT DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 COUNT_BIG(*) AS source_rows, COUNT(DISTINCT employee_id) AS employees,
 COUNT(DISTINCT project_id) AS projects,
 SUM(COALESCE(effort_value,0)) AS raw_effort_sum,
 SUM(CASE WHEN effort_value=0 THEN 1 ELSE 0 END) AS zero_rows,
 SUM(CASE WHEN effort_value IS NULL THEN 1 ELSE 0 END) AS null_rows
FROM dbo.project_track_proposals_table WHERE month_key IS NOT NULL
GROUP BY DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
ORDER BY month_start;
GO

-- Q03: Employee ID completeness by source
SELECT 'Project Track' AS source_name, COUNT_BIG(*) AS rows_total,
 COUNT(DISTINCT employee_id) AS distinct_employees,
 SUM(CASE WHEN employee_id IS NULL OR LTRIM(RTRIM(employee_id))='' THEN 1 ELSE 0 END) AS missing_employee_rows
FROM dbo.project_track_proposals_table
UNION ALL
SELECT 'Famstack Billable',COUNT_BIG(*),COUNT(DISTINCT [Employee Code]),
 SUM(CASE WHEN [Employee Code] IS NULL OR LTRIM(RTRIM([Employee Code]))='' THEN 1 ELSE 0 END)
FROM dbo.famstack_billable
UNION ALL
SELECT 'Famstack Non-Billable',COUNT_BIG(*),COUNT(DISTINCT [Employee Code]),
 SUM(CASE WHEN [Employee Code] IS NULL OR LTRIM(RTRIM([Employee Code]))='' THEN 1 ELSE 0 END)
FROM dbo.famstack_non_billable;
GO

-- Q04: Project and proposal coverage
SELECT COUNT(DISTINCT project_id) AS project_ids,
 COUNT(DISTINCT proposal_number) AS proposal_numbers,
 SUM(CASE WHEN project_id IS NULL OR LTRIM(RTRIM(project_id))='' THEN 1 ELSE 0 END) AS missing_project_id_rows,
 SUM(CASE WHEN proposal_number IS NULL THEN 1 ELSE 0 END) AS missing_proposal_rows
FROM dbo.project_track_proposals_table;
GO

-- Q05: Effort fields equality (null-safe)
SELECT COUNT_BIG(*) AS source_rows,
 SUM(CASE WHEN effort_value=effort_value_mp OR (effort_value IS NULL AND effort_value_mp IS NULL) THEN 1 ELSE 0 END) AS matching_rows,
 SUM(CASE WHEN effort_value<>effort_value_mp OR (effort_value IS NULL AND effort_value_mp IS NOT NULL) OR (effort_value IS NOT NULL AND effort_value_mp IS NULL) THEN 1 ELSE 0 END) AS differing_rows,
 SUM(COALESCE(effort_value,0)) AS effort_value_sum,
 SUM(COALESCE(effort_value_mp,0)) AS effort_value_mp_sum
FROM dbo.project_track_proposals_table;
GO

-- Q06: Monthly zero/nonzero/null effort distribution
SELECT DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 COUNT_BIG(*) AS source_rows,
 SUM(CASE WHEN effort_value=0 THEN 1 ELSE 0 END) AS zero_rows,
 SUM(CASE WHEN effort_value>0 THEN 1 ELSE 0 END) AS positive_rows,
 SUM(CASE WHEN effort_value<0 THEN 1 ELSE 0 END) AS negative_rows,
 SUM(CASE WHEN effort_value IS NULL THEN 1 ELSE 0 END) AS null_rows
FROM dbo.project_track_proposals_table WHERE month_key IS NOT NULL
GROUP BY DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
ORDER BY month_start;
GO

-- Q07: Status and lifecycle distribution
SELECT project_status,lifecycle_stage,current_approval_stage,
 COUNT_BIG(*) AS source_rows,SUM(COALESCE(effort_value,0)) AS raw_effort_sum
FROM dbo.project_track_proposals_table
GROUP BY project_status,lifecycle_stage,current_approval_stage
ORDER BY source_rows DESC;
GO

-- Q08: Inclusion and tagging distribution
SELECT included_default,is_out_of_tenure,excluded_reason,source_type,is_manual_row,is_override,
 COUNT_BIG(*) AS source_rows,SUM(COALESCE(effort_value,0)) AS raw_effort_sum
FROM dbo.project_track_proposals_table
GROUP BY included_default,is_out_of_tenure,excluded_reason,source_type,is_manual_row,is_override
ORDER BY source_rows DESC;
GO

-- Q09: Repeated employee/project/month groups (do not deduplicate)
SELECT TOP (100) employee_id,project_id,proposal_number,
 DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 COUNT_BIG(*) AS source_rows,COUNT(DISTINCT row_id) AS distinct_row_ids,
 SUM(COALESCE(effort_value,0)) AS raw_effort_sum
FROM dbo.project_track_proposals_table WHERE month_key IS NOT NULL
GROUP BY employee_id,project_id,proposal_number,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
HAVING COUNT_BIG(*)>1 ORDER BY source_rows DESC;
GO

-- Q10: Employee tagging distribution
SELECT employee_tagging,employee_tagging_label,
 COUNT_BIG(*) AS source_rows,COUNT(DISTINCT employee_id) AS distinct_employees,
 SUM(COALESCE(effort_value,0)) AS raw_effort_sum
FROM dbo.project_track_proposals_table
GROUP BY employee_tagging,employee_tagging_label ORDER BY source_rows DESC;
GO

-- Q11: Allocations outside project dates
SELECT TOP (100) row_id,employee_id,project_id,proposal_number,project_name,
 month_key,start_date,end_date,effort_value
FROM dbo.project_track_proposals_table
WHERE month_key IS NOT NULL AND
 ((start_date IS NOT NULL AND month_key < DATEFROMPARTS(YEAR(start_date),MONTH(start_date),1))
 OR (end_date IS NOT NULL AND month_key > EOMONTH(end_date)))
ORDER BY month_key,employee_id;
GO

-- Q12: Famstack measure and activity summary
SELECT 'Billable' AS source_name,COUNT_BIG(*) AS source_rows,
 SUM(COALESCE([Total Hours],0)) AS total_hours,
 SUM(COALESCE([B-Hours],0)) AS b_hours,
 SUM(COALESCE([Non-Inv Hours],0)) AS non_inv_hours
FROM dbo.famstack_billable
UNION ALL
SELECT 'Non-Billable',COUNT_BIG(*),SUM(COALESCE([Total Hours],0)),NULL,NULL
FROM dbo.famstack_non_billable;
SELECT TOP (100) [task_act_category],[P_Type],[PP_Type],COUNT_BIG(*) AS source_rows,
 SUM(COALESCE([Total Hours],0)) AS raw_hours
FROM dbo.famstack_non_billable
GROUP BY [task_act_category],[P_Type],[PP_Type] ORDER BY raw_hours DESC;
GO

-- Q13: Provisional calendar capacity only (8 hours per weekday, no holidays, FTE assumed 1)
DECLARE @StartMonth13 date='2026-10-01',@EndMonth13 date='2027-03-01';
WITH months AS (
 SELECT @StartMonth13 AS month_start
 UNION ALL SELECT DATEADD(MONTH,1,month_start) FROM months WHERE month_start<@EndMonth13
), days AS (
 SELECT month_start,month_start AS d FROM months
 UNION ALL SELECT month_start,DATEADD(DAY,1,d) FROM days WHERE d<EOMONTH(month_start)
)
SELECT month_start,
 SUM(CASE WHEN DATEDIFF(DAY,CONVERT(date,'19000101'),d)%7 BETWEEN 0 AND 4 THEN 1 ELSE 0 END) AS weekday_count,
 8 AS assumed_hours_per_day,
 SUM(CASE WHEN DATEDIFF(DAY,CONVERT(date,'19000101'),d)%7 BETWEEN 0 AND 4 THEN 8 ELSE 0 END) AS provisional_full_time_capacity_hours
FROM days GROUP BY month_start ORDER BY month_start OPTION(MAXRECURSION 0);
GO

-- Q14: Historical billable raw monthly totals; Total Hours is NOT yet certified as billable measure
SELECT [Employee Code] AS employee_code,[Proposal No] AS proposal_number,[Project Name] AS project_name,
 DATEFROMPARTS(YEAR([Date]),MONTH([Date]),1) AS month_start,
 COUNT_BIG(*) AS source_rows,
 SUM(COALESCE([Total Hours],0)) AS raw_total_hours,
 SUM(COALESCE([B-Hours],0)) AS raw_b_hours,
 SUM(COALESCE([Non-Inv Hours],0)) AS raw_non_inv_hours
FROM dbo.famstack_billable WHERE [Date] IS NOT NULL
GROUP BY [Employee Code],[Proposal No],[Project Name],DATEFROMPARTS(YEAR([Date]),MONTH([Date]),1)
ORDER BY month_start,employee_code;
GO

-- Q15: Historical non-billable raw monthly totals; Month stored as NVARCHAR in initial schema
WITH parsed AS (
 SELECT [Employee Code] AS employee_code,[Proposal No] AS proposal_number,[Project Name] AS project_name,
 [task_act_category] AS activity_category,[Total Hours] AS total_hours,
 COALESCE(TRY_CONVERT(date,[Month],105),TRY_CONVERT(date,[Month],23)) AS activity_date
 FROM dbo.famstack_non_billable
)
SELECT employee_code,proposal_number,project_name,activity_category,
 DATEFROMPARTS(YEAR(activity_date),MONTH(activity_date),1) AS month_start,
 COUNT_BIG(*) AS source_rows,SUM(COALESCE(total_hours,0)) AS raw_non_billable_hours
FROM parsed WHERE activity_date IS NOT NULL
GROUP BY employee_code,proposal_number,project_name,activity_category,
 DATEFROMPARTS(YEAR(activity_date),MONTH(activity_date),1)
ORDER BY month_start,employee_code;
GO

-- Q16: Project Track provisional monthly effort per employee (unfiltered raw sum)
SELECT employee_id,MAX(employee_name) AS employee_name,
 DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 COUNT_BIG(*) AS source_rows,COUNT(DISTINCT project_id) AS distinct_projects,
 SUM(COALESCE(effort_value,0)) AS provisional_raw_effort_hours
FROM dbo.project_track_proposals_table WHERE month_key IS NOT NULL AND employee_id IS NOT NULL
GROUP BY employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
ORDER BY month_start,employee_id;
GO

-- Q17: Provisional employee-month capacity and remaining hours (illustrative, not authoritative)
DECLARE @StartMonth17 date='2026-10-01',@EndMonth17 date='2027-03-01';
WITH months AS (
 SELECT @StartMonth17 AS month_start
 UNION ALL SELECT DATEADD(MONTH,1,month_start) FROM months WHERE month_start<@EndMonth17
), days AS (
 SELECT month_start,month_start AS d FROM months
 UNION ALL SELECT month_start,DATEADD(DAY,1,d) FROM days WHERE d<EOMONTH(month_start)
), capacity AS (
 SELECT month_start,CAST(SUM(CASE WHEN DATEDIFF(DAY,CONVERT(date,'19000101'),d)%7 BETWEEN 0 AND 4 THEN 8 ELSE 0 END) AS decimal(18,4)) AS assumed_capacity
 FROM days GROUP BY month_start
), employees AS (
 SELECT employee_id,MAX(employee_name) AS employee_name
 FROM dbo.project_track_proposals_table WHERE employee_id IS NOT NULL GROUP BY employee_id
), allocations AS (
 SELECT employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 SUM(COALESCE(effort_value,0)) AS raw_effort_hours,COUNT_BIG(*) AS source_rows
 FROM dbo.project_track_proposals_table WHERE employee_id IS NOT NULL AND month_key IS NOT NULL
 GROUP BY employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
)
SELECT e.employee_id,e.employee_name,c.month_start,c.assumed_capacity,
 a.raw_effort_hours,a.source_rows,
 CASE WHEN a.source_rows IS NULL THEN NULL ELSE c.assumed_capacity-a.raw_effort_hours END AS provisional_available_hours,
 CASE WHEN a.source_rows IS NULL THEN 'NO ALLOCATION RECORDS - UNKNOWN'
 WHEN a.raw_effort_hours>c.assumed_capacity THEN 'PROVISIONAL OVER-ALLOCATED'
 WHEN a.raw_effort_hours=c.assumed_capacity THEN 'PROVISIONAL FULL'
 WHEN a.raw_effort_hours=0 THEN 'PROVISIONAL AVAILABLE'
 ELSE 'PROVISIONAL PARTIAL' END AS diagnostic_status
FROM employees e CROSS JOIN capacity c
LEFT JOIN allocations a ON a.employee_id=e.employee_id AND a.month_start=c.month_start
ORDER BY e.employee_id,c.month_start OPTION(MAXRECURSION 0);
GO

-- Q18: Multi-project employee-month raw breakdown
SELECT TOP (200) employee_id,employee_name,proposal_number,project_id,project_name,
 DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 SUM(COALESCE(effort_value,0)) AS raw_project_effort,COUNT_BIG(*) AS source_rows
FROM dbo.project_track_proposals_table
WHERE employee_id IS NOT NULL AND month_key IS NOT NULL
GROUP BY employee_id,employee_name,proposal_number,project_id,project_name,
 DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
ORDER BY employee_id,month_start,project_name;
GO

-- Q19: Availability dimensions in Project Track (not authoritative master)
SELECT primary_capability,secondary_capability,department,grade,location,country,
 COUNT(DISTINCT employee_id) AS employees_in_project_track,
 SUM(COALESCE(effort_value,0)) AS raw_effort_across_all_months
FROM dbo.project_track_proposals_table
WHERE employee_id IS NOT NULL
GROUP BY primary_capability,secondary_capability,department,grade,location,country
ORDER BY employees_in_project_track DESC;
GO

-- Q20: Monthly raw effort trend to March 2027
SELECT DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 COUNT(DISTINCT employee_id) AS tagged_employees,
 SUM(COALESCE(effort_value,0)) AS raw_planned_effort,
 COUNT_BIG(*) AS source_rows
FROM dbo.project_track_proposals_table
WHERE month_key>='2026-10-01' AND month_key<'2027-04-01'
GROUP BY DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
ORDER BY month_start;
GO

-- Q21: Data-quality status by employee-month
SELECT employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 COUNT_BIG(*) AS source_rows,
 SUM(CASE WHEN effort_value IS NULL THEN 1 ELSE 0 END) AS null_effort_rows,
 SUM(CASE WHEN project_id IS NULL THEN 1 ELSE 0 END) AS null_project_rows,
 COUNT(DISTINCT row_id) AS distinct_row_ids,
 CASE WHEN SUM(CASE WHEN effort_value IS NULL OR project_id IS NULL THEN 1 ELSE 0 END)>0
 THEN 'REQUIRES REVIEW' ELSE 'BASIC FIELDS PRESENT - BUSINESS RULES PENDING' END AS data_quality_status
FROM dbo.project_track_proposals_table
WHERE employee_id IS NOT NULL AND month_key IS NOT NULL
GROUP BY employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
ORDER BY employee_id,month_start;
GO

-- Q22: Raw employee-month effort changes; NOT verified release
WITH m AS (
 SELECT employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 SUM(COALESCE(effort_value,0)) AS raw_effort
 FROM dbo.project_track_proposals_table WHERE employee_id IS NOT NULL AND month_key IS NOT NULL
 GROUP BY employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
), changes AS (
 SELECT employee_id,month_start,raw_effort,
 LAG(raw_effort) OVER(PARTITION BY employee_id ORDER BY month_start) AS previous_raw_effort,
 LAG(month_start) OVER(PARTITION BY employee_id ORDER BY month_start) AS previous_month
 FROM m
)
SELECT employee_id,previous_month,month_start,previous_raw_effort,raw_effort,
 previous_raw_effort-raw_effort AS raw_effort_reduction,
 CASE WHEN previous_month=DATEADD(MONTH,-1,month_start) THEN 'CONSECUTIVE'
 ELSE 'MONTH GAP - DO NOT INTERPRET AS RELEASE' END AS continuity
FROM changes WHERE previous_month IS NOT NULL ORDER BY employee_id,month_start;
GO

-- Q23: Potential partial release candidates from lower effort, consecutive months only
WITH m AS (
 SELECT employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 SUM(COALESCE(effort_value,0)) AS raw_effort
 FROM dbo.project_track_proposals_table WHERE employee_id IS NOT NULL AND month_key IS NOT NULL
 GROUP BY employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
), d AS (
 SELECT employee_id,month_start,raw_effort,
 LAG(raw_effort) OVER(PARTITION BY employee_id ORDER BY month_start) AS previous_effort,
 LAG(month_start) OVER(PARTITION BY employee_id ORDER BY month_start) AS previous_month
 FROM m
)
SELECT employee_id,month_start,previous_effort,raw_effort,
 previous_effort-raw_effort AS provisional_hours_reduced
FROM d WHERE previous_month=DATEADD(MONTH,-1,month_start)
 AND previous_effort>raw_effort AND raw_effort>0
ORDER BY month_start,provisional_hours_reduced DESC;
GO

-- Q24: Potential full release candidates (zero reported effort in next consecutive month)
WITH m AS (
 SELECT employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 SUM(COALESCE(effort_value,0)) AS raw_effort
 FROM dbo.project_track_proposals_table WHERE employee_id IS NOT NULL AND month_key IS NOT NULL
 GROUP BY employee_id,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
), d AS (
 SELECT employee_id,month_start,raw_effort,
 LAG(raw_effort) OVER(PARTITION BY employee_id ORDER BY month_start) AS previous_effort,
 LAG(month_start) OVER(PARTITION BY employee_id ORDER BY month_start) AS previous_month
 FROM m
)
SELECT employee_id,month_start AS potential_release_month,previous_effort,raw_effort,
 'ZERO RAW EFFORT - NOT CONFIRMED AVAILABLE' AS interpretation
FROM d WHERE previous_month=DATEADD(MONTH,-1,month_start)
 AND previous_effort>0 AND raw_effort=0 ORDER BY potential_release_month,employee_id;
GO

-- Q25: Project effort roll-off by consecutive month
WITH p AS (
 SELECT project_id,proposal_number,project_name,
 DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 SUM(COALESCE(effort_value,0)) AS raw_project_effort
 FROM dbo.project_track_proposals_table WHERE month_key IS NOT NULL
 GROUP BY project_id,proposal_number,project_name,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
), d AS (
 SELECT *,LAG(raw_project_effort) OVER(PARTITION BY project_id,proposal_number,project_name ORDER BY month_start) AS previous_effort,
 LAG(month_start) OVER(PARTITION BY project_id,proposal_number,project_name ORDER BY month_start) AS previous_month
 FROM p
)
SELECT project_id,proposal_number,project_name,month_start,previous_effort,raw_project_effort,
 previous_effort-raw_project_effort AS effort_reduction
FROM d WHERE previous_month=DATEADD(MONTH,-1,month_start) AND previous_effort>raw_project_effort
ORDER BY month_start,effort_reduction DESC;
GO

-- Q26: Employee project effort changes (explanation candidates)
WITH p AS (
 SELECT employee_id,project_id,proposal_number,project_name,
 DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 SUM(COALESCE(effort_value,0)) AS raw_project_effort
 FROM dbo.project_track_proposals_table WHERE employee_id IS NOT NULL AND month_key IS NOT NULL
 GROUP BY employee_id,project_id,proposal_number,project_name,DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
), d AS (
 SELECT *,LAG(raw_project_effort) OVER(PARTITION BY employee_id,project_id,proposal_number,project_name ORDER BY month_start) AS previous_effort,
 LAG(month_start) OVER(PARTITION BY employee_id,project_id,proposal_number,project_name ORDER BY month_start) AS previous_month
 FROM p
)
SELECT employee_id,project_id,proposal_number,project_name,previous_month,month_start,
 previous_effort,raw_project_effort,previous_effort-raw_project_effort AS effort_reduction
FROM d WHERE previous_month=DATEADD(MONTH,-1,month_start) AND previous_effort>raw_project_effort
ORDER BY employee_id,month_start,effort_reduction DESC;
GO

-- Q27: Upcoming projects; deduplicated by project ID + proposal; conflicting dates shown as ranges
DECLARE @AsOfDate27 date=CONVERT(date,GETDATE());
SELECT project_id,proposal_number,MAX(project_name) AS sample_project_name,
 MIN(start_date) AS earliest_start_date,MAX(start_date) AS latest_start_date,
 MIN(end_date) AS earliest_end_date,MAX(end_date) AS latest_end_date,
 COUNT(DISTINCT project_status) AS distinct_statuses,
 COUNT_BIG(*) AS source_rows
FROM dbo.project_track_proposals_table
GROUP BY project_id,proposal_number
HAVING MAX(start_date)>=@AsOfDate27
ORDER BY earliest_start_date;
GO

-- Q28: 15-day project start priority; proxy ONLY, not requirement start priority
DECLARE @AsOfDate28 date=CONVERT(date,GETDATE()),@PriorityWindowDays28 int=15;
WITH projects AS (
 SELECT project_id,proposal_number,MAX(project_name) AS sample_project_name,
 MIN(start_date) AS earliest_start_date,MAX(start_date) AS latest_start_date
 FROM dbo.project_track_proposals_table GROUP BY project_id,proposal_number
)
SELECT project_id,proposal_number,sample_project_name,earliest_start_date,latest_start_date,
 DATEDIFF(DAY,@AsOfDate28,earliest_start_date) AS days_until_earliest_start,
 CASE WHEN earliest_start_date IS NULL THEN 'UNKNOWN'
 WHEN earliest_start_date<>latest_start_date THEN 'CONFLICTING SOURCE START DATES'
 WHEN earliest_start_date<@AsOfDate28 THEN 'ALREADY STARTED'
 WHEN earliest_start_date<DATEADD(DAY,@PriorityWindowDays28+1,@AsOfDate28) THEN 'URGENT PROJECT START - PROXY'
 ELSE 'FUTURE PROJECT START - PROXY' END AS priority_status
FROM projects ORDER BY earliest_start_date;
GO

-- Q29: Compare raw planned effort with a supplied monthly requirement; no capacity assumption
DECLARE @RequiredMonth29 date='2026-12-01',@RequiredHours29 decimal(18,4)=80;
SELECT employee_id,MAX(employee_name) AS employee_name,
 @RequiredMonth29 AS required_month,@RequiredHours29 AS required_hours,
 SUM(COALESCE(effort_value,0)) AS raw_existing_effort,
 'CANNOT CONFIRM AVAILABLE HOURS UNTIL CAPACITY AND COMMITMENT RULES ARE VALIDATED' AS assessment
FROM dbo.project_track_proposals_table
WHERE month_key>=@RequiredMonth29 AND month_key<DATEADD(MONTH,1,@RequiredMonth29)
 AND employee_id IS NOT NULL
GROUP BY employee_id ORDER BY raw_existing_effort,employee_id;
GO

-- Q30: Forward monthly source coverage including missing months through March 2027
DECLARE @StartMonth30 date='2026-10-01',@EndMonth30 date='2027-03-01';
WITH months AS (
 SELECT @StartMonth30 AS month_start
 UNION ALL SELECT DATEADD(MONTH,1,month_start) FROM months WHERE month_start<@EndMonth30
), raw AS (
 SELECT DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1) AS month_start,
 COUNT_BIG(*) AS source_rows,COUNT(DISTINCT employee_id) AS employees,
 SUM(COALESCE(effort_value,0)) AS raw_effort
 FROM dbo.project_track_proposals_table WHERE month_key IS NOT NULL
 GROUP BY DATEFROMPARTS(YEAR(month_key),MONTH(month_key),1)
)
SELECT m.month_start,r.source_rows,r.employees,r.raw_effort,
 CASE WHEN r.source_rows IS NULL THEN 'NO SOURCE RECORDS - UNKNOWN' ELSE 'SOURCE ROWS PRESENT - ELIGIBILITY PENDING' END AS coverage_status
FROM months m LEFT JOIN raw r ON r.month_start=m.month_start
ORDER BY m.month_start OPTION(MAXRECURSION 100);
GO

-- Supplement A: Famstack month parsing failures (Non-Billable initial schema uses NVARCHAR)
SELECT [Month],COUNT_BIG(*) AS source_rows
FROM dbo.famstack_non_billable
WHERE [Month] IS NOT NULL AND LTRIM(RTRIM([Month]))<>''
 AND COALESCE(TRY_CONVERT(date,[Month],105),TRY_CONVERT(date,[Month],23)) IS NULL
GROUP BY [Month] ORDER BY source_rows DESC;
GO

-- Supplement B: Project Track/Famstack employee key overlap (exact text match only)
WITH pt AS (SELECT DISTINCT employee_id AS employee_code FROM dbo.project_track_proposals_table WHERE employee_id IS NOT NULL),
 fs AS (SELECT DISTINCT [Employee Code] AS employee_code FROM dbo.famstack_billable WHERE [Employee Code] IS NOT NULL
 UNION SELECT DISTINCT [Employee Code] FROM dbo.famstack_non_billable WHERE [Employee Code] IS NOT NULL)
SELECT CASE WHEN pt.employee_code IS NOT NULL AND fs.employee_code IS NOT NULL THEN 'BOTH'
 WHEN pt.employee_code IS NOT NULL THEN 'PROJECT TRACK ONLY' ELSE 'FAMSTACK ONLY' END AS source_coverage,
 COUNT_BIG(*) AS employee_ids
FROM pt FULL OUTER JOIN fs ON pt.employee_code=fs.employee_code
GROUP BY CASE WHEN pt.employee_code IS NOT NULL AND fs.employee_code IS NOT NULL THEN 'BOTH'
 WHEN pt.employee_code IS NOT NULL THEN 'PROJECT TRACK ONLY' ELSE 'FAMSTACK ONLY' END;
GO

-- Supplement C: Proposal number overlap; cast to NVARCHAR for cross-source comparison
WITH pt AS (SELECT DISTINCT CONVERT(nvarchar(100),proposal_number) AS proposal FROM dbo.project_track_proposals_table WHERE proposal_number IS NOT NULL),
 fs AS (SELECT DISTINCT [Proposal No] AS proposal FROM dbo.famstack_billable WHERE [Proposal No] IS NOT NULL
 UNION SELECT DISTINCT [Proposal No] FROM dbo.famstack_non_billable WHERE [Proposal No] IS NOT NULL)
SELECT CASE WHEN pt.proposal IS NOT NULL AND fs.proposal IS NOT NULL THEN 'BOTH'
 WHEN pt.proposal IS NOT NULL THEN 'PROJECT TRACK ONLY' ELSE 'FAMSTACK ONLY' END AS source_coverage,
 COUNT_BIG(*) AS proposals
FROM pt FULL OUTER JOIN fs ON pt.proposal=fs.proposal
GROUP BY CASE WHEN pt.proposal IS NOT NULL AND fs.proposal IS NOT NULL THEN 'BOTH'
 WHEN pt.proposal IS NOT NULL THEN 'PROJECT TRACK ONLY' ELSE 'FAMSTACK ONLY' END;
GO
