"""
Azure SQL → Resource Vision frontend bundle.

Authoritative read patterns live in the repo root file:
  resource_vision_queries.sql  (Q14, Q15, Q18, Q19, Supplement B/C)

Design principles (Amit / Resource Vision 2.0 feasibility set):
  - Famstack historical rows are RAW aggregates (Q14, Q15); Total Hours is the
    POC actual-effort measure until finance certifies B-Hours alone.
  - Project Track rows are PROVISIONAL planning lines at source grain (Q18);
    do not deduplicate row_id groups in SQL (Q09).
  - Planned effort uses COALESCE(effort_value, 0) only (Q16–Q18), not MP/accrual
    fallbacks unless effort_value is redefined in production rules.
  - month_key on Project Track comes from the date column month_key via
    DATEFROMPARTS (Q02, Q16, Q18), emitted as yyyy-MM for the React app.
  - Proposal numbers are cast to nvarchar for cross-source joins (Supplement C).
  - included_default / is_out_of_tenure are diagnostic only (Q08); not applied
    as hard filters on the availability bundle (eligibility rules stay in app).
"""

# --- Shared expressions (keep in sync with resource_vision_queries.sql) ---

_PT_MONTH_START = (
    "DATEFROMPARTS(YEAR(pt.month_key), MONTH(pt.month_key), 1)"
)

_PT_MONTH_KEY = f"FORMAT({_PT_MONTH_START}, 'yyyy-MM')"

_PT_RAW_EFFORT = "COALESCE(TRY_CAST(pt.effort_value AS float), 0)"

# Q14 — historical billable monthly totals
FAMSTACK_BILLABLE_AGGREGATED = f"""
SELECT
    LTRIM(RTRIM(CAST(b.[Employee Code] AS nvarchar(64)))) AS employee_code,
    MAX(LTRIM(RTRIM(CAST(b.[Member Name] AS nvarchar(256))))) AS member_name,
    MAX(LTRIM(RTRIM(CAST(b.[Primary Practice] AS nvarchar(128))))) AS primary_practice,
    MAX(LTRIM(RTRIM(CAST(COALESCE(b.[Secondary Practice], '') AS nvarchar(128))))) AS secondary_practice,
    FORMAT(DATEFROMPARTS(YEAR(b.[Date]), MONTH(b.[Date]), 1), 'yyyy-MM') AS month_key,
    MAX(YEAR(b.[Date])) AS year,
    LTRIM(RTRIM(CAST(
        COALESCE(
            NULLIF(LTRIM(RTRIM(CAST(COALESCE(b.[Proposal No], '') AS nvarchar(128)))), ''),
            LTRIM(RTRIM(CAST(COALESCE(b.[Project Name], 'Unnamed Project') AS nvarchar(256))))
        ) AS nvarchar(128)
    ))) AS project_id,
    LTRIM(RTRIM(CAST(COALESCE(b.[Proposal No], '') AS nvarchar(128)))) AS proposal_number,
    LTRIM(RTRIM(CAST(COALESCE(b.[Project Name], 'Unnamed Project') AS nvarchar(256)))) AS project_name,
    SUM(COALESCE(TRY_CAST(b.[Total Hours] AS float), 0)) AS total_hours,
    SUM(COALESCE(TRY_CAST(b.[B-Hours] AS float), 0)) AS billable_hours,
    SUM(COALESCE(TRY_CAST(b.[Non-Inv Hours] AS float), 0)) AS non_inv_hours
FROM dbo.famstack_billable AS b
WHERE
    b.[Employee Code] IS NOT NULL
    AND LTRIM(RTRIM(CAST(b.[Employee Code] AS nvarchar(64)))) <> ''
    AND b.[Date] IS NOT NULL
GROUP BY
    LTRIM(RTRIM(CAST(b.[Employee Code] AS nvarchar(64)))),
    LTRIM(RTRIM(CAST(COALESCE(b.[Proposal No], '') AS nvarchar(128)))),
    LTRIM(RTRIM(CAST(COALESCE(b.[Project Name], 'Unnamed Project') AS nvarchar(256)))),
    DATEFROMPARTS(YEAR(b.[Date]), MONTH(b.[Date]), 1)
"""

# Q15 — historical non-billable (NVARCHAR Month + TRY_CONVERT styles 105/23)
FAMSTACK_NON_BILLABLE_AGGREGATED = """
WITH parsed AS (
    SELECT
        LTRIM(RTRIM(CAST(nb.[Employee Code] AS nvarchar(64)))) AS employee_code,
        LTRIM(RTRIM(CAST(COALESCE(nb.[Member Name], '') AS nvarchar(256)))) AS member_name,
        LTRIM(RTRIM(CAST(COALESCE(nb.[Primary Practice], '') AS nvarchar(128)))) AS primary_practice,
        LTRIM(RTRIM(CAST(COALESCE(nb.[Secondary Practice], '') AS nvarchar(128)))) AS secondary_practice,
        LTRIM(RTRIM(CAST(COALESCE(nb.[Proposal No], '') AS nvarchar(128)))) AS proposal_number,
        LTRIM(RTRIM(CAST(COALESCE(nb.[Project Name], '') AS nvarchar(256)))) AS project_name,
        LTRIM(RTRIM(CAST(COALESCE(nb.task_act_category, '') AS nvarchar(256)))) AS activity_category,
        COALESCE(
            TRY_CONVERT(date, nb.[Month], 105),
            TRY_CONVERT(date, nb.[Month], 23)
        ) AS activity_date,
        COALESCE(TRY_CAST(nb.[Total Hours] AS float), 0) AS total_hours
    FROM dbo.famstack_non_billable AS nb
    WHERE
        nb.[Employee Code] IS NOT NULL
        AND LTRIM(RTRIM(CAST(nb.[Employee Code] AS nvarchar(64)))) <> ''
)
SELECT
    employee_code,
    MAX(member_name) AS member_name,
    MAX(primary_practice) AS primary_practice,
    MAX(secondary_practice) AS secondary_practice,
    FORMAT(DATEFROMPARTS(YEAR(activity_date), MONTH(activity_date), 1), 'yyyy-MM') AS month_key,
    MAX(YEAR(activity_date)) AS year,
    LTRIM(RTRIM(CAST(
        COALESCE(
            NULLIF(proposal_number, ''),
            NULLIF(project_name, ''),
            NULLIF(activity_category, ''),
            'Non-Billable Activity'
        ) AS nvarchar(128)
    ))) AS project_id,
    proposal_number,
    LTRIM(RTRIM(CAST(
        COALESCE(
            NULLIF(project_name, ''),
            NULLIF(activity_category, ''),
            'Non-Billable Activity'
        ) AS nvarchar(256)
    ))) AS project_name,
    SUM(total_hours) AS total_hours
FROM parsed
WHERE activity_date IS NOT NULL
GROUP BY
    employee_code,
    proposal_number,
    project_name,
    activity_category,
    DATEFROMPARTS(YEAR(activity_date), MONTH(activity_date), 1)
"""

# Q18 grain — one bundle row per source planning line (row_id), not deduplicated
PROJECT_TRACK_RESOURCE_VISION = f"""
SELECT
    LTRIM(RTRIM(CAST(COALESCE(
        NULLIF(LTRIM(RTRIM(CAST(pt.proposal_number AS nvarchar(128)))), ''),
        NULLIF(LTRIM(RTRIM(CAST(pt.project_id AS nvarchar(128)))), ''),
        LTRIM(RTRIM(CAST(COALESCE(pt.force10_record_id, '') AS nvarchar(128)))),
        ''
    ) AS nvarchar(128)))) AS project_id,
    LTRIM(RTRIM(CAST(COALESCE(CAST(pt.proposal_number AS nvarchar(128)), '') AS nvarchar(128)))) AS proposal_number,
    LTRIM(RTRIM(CAST(COALESCE(pt.project_name, pt.sub_project_name, 'Unnamed Project') AS nvarchar(256)))) AS project_name,
    {_PT_MONTH_KEY} AS month_key,
    YEAR({_PT_MONTH_START}) AS year,
    LTRIM(RTRIM(CAST(COALESCE(pt.fiscal_year, '') AS nvarchar(32)))) AS fiscal_year,
    LTRIM(RTRIM(CAST(COALESCE(pt.fiscal_quarter, '') AS nvarchar(32)))) AS fiscal_quarter,
    {_PT_RAW_EFFORT} AS effort_value,
    LTRIM(RTRIM(CAST(COALESCE(pt.primary_capability, '') AS nvarchar(128)))) AS primary_capability,
    LTRIM(RTRIM(CAST(COALESCE(pt.secondary_capability, '') AS nvarchar(128)))) AS secondary_capability,
    LTRIM(RTRIM(CAST(COALESCE(pt.department, '') AS nvarchar(128)))) AS department,
    LTRIM(RTRIM(CAST(COALESCE(pt.grade, '') AS nvarchar(64)))) AS grade,
    LTRIM(RTRIM(CAST(COALESCE(pt.location, pt.c5i_billing_location, '') AS nvarchar(128)))) AS location,
    LTRIM(RTRIM(CAST(COALESCE(pt.country, '') AS nvarchar(128)))) AS country,
    LTRIM(RTRIM(CAST(COALESCE(pt.employee_id, '') AS nvarchar(64)))) AS employee_id,
    LTRIM(RTRIM(CAST(COALESCE(pt.employee_name, '') AS nvarchar(256)))) AS employee_name,
    CASE
        WHEN LTRIM(RTRIM(UPPER(COALESCE(pt.employee_tagging, '')))) LIKE '%UNASSIGNED%'
            OR LTRIM(RTRIM(UPPER(COALESCE(pt.employee_tagging_label, '')))) LIKE '%UNASSIGNED%'
            OR LTRIM(RTRIM(COALESCE(pt.employee_id, ''))) = ''
        THEN 'UNASSIGNED_GRADE_DEMAND'
        ELSE 'TAGGED'
    END AS employee_tagging,
    LTRIM(RTRIM(CAST(COALESCE(pt.project_status, 'Active') AS nvarchar(64)))) AS project_status,
    LTRIM(RTRIM(CAST(COALESCE(pt.lifecycle_stage, 'Delivery') AS nvarchar(64)))) AS lifecycle_stage,
    LTRIM(RTRIM(CAST(COALESCE(pt.contract_type, 'Time & Material') AS nvarchar(64)))) AS contract_type,
    CONVERT(varchar(10), TRY_CAST(pt.start_date AS date), 23) AS start_date,
    CONVERT(varchar(10), TRY_CAST(pt.end_date AS date), 23) AS end_date,
    LTRIM(RTRIM(CAST(COALESCE(pt.row_id, '') AS nvarchar(128)))) AS source_row_id
FROM dbo.project_track_proposals_table AS pt
WHERE pt.month_key IS NOT NULL
"""

# Q19 + Supplement B — provisional employee master (not authoritative ZingHR)
EMPLOYEE_MASTER_FROM_SOURCES = """
SELECT
    e.employee_id,
    MAX(e.employee_name) AS employee_name,
    MAX(e.primary_capability) AS primary_capability,
    MAX(e.secondary_capability) AS secondary_capability,
    MAX(e.department) AS department,
    MAX(e.grade) AS grade,
    MAX(e.location) AS location,
    MAX(e.country) AS country
FROM (
    SELECT
        LTRIM(RTRIM(CAST(pt.employee_id AS nvarchar(64)))) AS employee_id,
        LTRIM(RTRIM(CAST(COALESCE(pt.employee_name, '') AS nvarchar(256)))) AS employee_name,
        LTRIM(RTRIM(CAST(COALESCE(pt.primary_capability, '') AS nvarchar(128)))) AS primary_capability,
        LTRIM(RTRIM(CAST(COALESCE(pt.secondary_capability, '') AS nvarchar(128)))) AS secondary_capability,
        LTRIM(RTRIM(CAST(COALESCE(pt.department, '') AS nvarchar(128)))) AS department,
        LTRIM(RTRIM(CAST(COALESCE(pt.grade, '') AS nvarchar(64)))) AS grade,
        LTRIM(RTRIM(CAST(COALESCE(pt.location, pt.c5i_billing_location, '') AS nvarchar(128)))) AS location,
        LTRIM(RTRIM(CAST(COALESCE(pt.country, '') AS nvarchar(128)))) AS country
    FROM dbo.project_track_proposals_table AS pt
    WHERE LTRIM(RTRIM(COALESCE(pt.employee_id, ''))) <> ''

    UNION ALL

    SELECT
        LTRIM(RTRIM(CAST(b.[Employee Code] AS nvarchar(64)))) AS employee_id,
        LTRIM(RTRIM(CAST(COALESCE(b.[Member Name], '') AS nvarchar(256)))) AS employee_name,
        LTRIM(RTRIM(CAST(COALESCE(b.[Primary Practice], '') AS nvarchar(128)))) AS primary_capability,
        LTRIM(RTRIM(CAST(COALESCE(b.[Secondary Practice], '') AS nvarchar(128)))) AS secondary_capability,
        '' AS department,
        '' AS grade,
        '' AS location,
        '' AS country
    FROM dbo.famstack_billable AS b
    WHERE LTRIM(RTRIM(CAST(b.[Employee Code] AS nvarchar(64)))) <> ''

    UNION ALL

    SELECT
        LTRIM(RTRIM(CAST(nb.[Employee Code] AS nvarchar(64)))) AS employee_id,
        LTRIM(RTRIM(CAST(COALESCE(nb.[Member Name], '') AS nvarchar(256)))) AS employee_name,
        LTRIM(RTRIM(CAST(COALESCE(nb.[Primary Practice], '') AS nvarchar(128)))) AS primary_capability,
        LTRIM(RTRIM(CAST(COALESCE(nb.[Secondary Practice], '') AS nvarchar(128)))) AS secondary_capability,
        '' AS department,
        '' AS grade,
        '' AS location,
        '' AS country
    FROM dbo.famstack_non_billable AS nb
    WHERE LTRIM(RTRIM(CAST(nb.[Employee Code] AS nvarchar(64)))) <> ''
) AS e
WHERE e.employee_id <> ''
GROUP BY e.employee_id
"""
