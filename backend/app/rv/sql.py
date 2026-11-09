"""Read-only extraction queries for the Resource Vision engine.

Only the two source tables are read: dbo.project_track_proposals_table and
dbo.zinghr_employee_master. Text is normalised with the existing dbo.rv_*
helper functions. All calculation happens in ``engine.py`` (unit tested).
"""

PROJECT_TRACK_ROWS = """
SELECT
    row_id                = dbo.rv_Blank(row_id),
    project_id            = dbo.rv_Blank(project_id),
    proposal_number       = proposal_number,
    sub_project_name      = sub_project_name,
    employee_key          = dbo.rv_Key(employee_id),
    employee_code         = dbo.rv_Clean(employee_id),
    month_key             = month_key,
    effort                = CAST(effort_value AS float),
    is_override           = is_override,
    contract_type         = dbo.rv_Clean(contract_type),
    project_name          = dbo.rv_Clean(project_name),
    parent_account        = dbo.rv_Clean(parent_account_name),
    account               = dbo.rv_Clean(account_name),
    bdu                   = dbo.rv_Clean(bdu_name),
    project_status        = dbo.rv_Clean(project_status),
    project_lead          = dbo.rv_Clean(project_lead_name),
    notes                 = dbo.rv_Clean(notes),
    start_date            = start_date,
    end_date              = end_date,
    employee_name         = dbo.rv_Clean(employee_name),
    primary_capability    = dbo.rv_Clean(primary_capability),
    secondary_capability  = dbo.rv_Clean(secondary_capability),
    department            = dbo.rv_Clean(department),
    grade                 = dbo.rv_Clean(grade),
    location              = dbo.rv_Clean(location),
    country               = dbo.rv_Clean(country)
FROM dbo.project_track_proposals_table
"""

HR_EMPLOYEES = """
SELECT
    employee_key          = dbo.rv_Key(EmployeeCode),
    employee_code         = dbo.rv_Clean(EmployeeCode),
    employee_name         = dbo.rv_Clean(EmployeeName),
    joining_date          = CAST(DateOfJoining AS date),
    exit_date             = CAST(ExitDate AS date),
    leaving_date          = CAST(DateOfLeaving AS date),
    resignation_date      = CAST(DateofResignation AS date),
    employee_status       = dbo.rv_Clean(EmployeeStatus),
    primary_capability    = dbo.rv_Clean([Primary Practice]),
    secondary_capability  = dbo.rv_Clean([Secondary Practice]),
    grade                 = dbo.rv_Clean([Grade Code]),
    country               = dbo.rv_Clean(COUNTRY),
    location              = dbo.rv_Clean(Location),
    division              = dbo.rv_Clean(Division),
    department            = dbo.rv_Clean(Department),
    email                 = dbo.rv_Clean(Email),
    manager_name          = dbo.rv_Clean(ReportingManagerName),
    manager_code          = dbo.rv_Clean(ReportingManagerCode),
    employment_type       = dbo.rv_Clean(EmploymentType)
FROM dbo.zinghr_employee_master
"""
