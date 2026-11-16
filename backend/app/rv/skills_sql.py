"""Read-only extraction query for the Skills Details integration.

Separate from sql.py (the Project Track / HR facts used for availability calculations).
Mirrors the SQL side of the Power BI skills handoff (dbo.vwl_DimEmployeeSkill): only
EmployeeCode, SkillName and CurrentSkillLevel are read from the approved dashboard view.
SkillFamily/SkillCategory/SkillPlatform and the Last Used fields exist on the view but are
deliberately not loaded here (no approved classification, no validated dates). Nothing here
is joined against project allocation or capacity rows; matching against Project Track
employees happens in Python, on normalized employee codes only, in skills.py.
"""

EMPLOYEE_SKILLS_VIEW = """
SELECT
    employee_code = EmployeeCode,
    skill_name    = SkillName,
    skill_level   = CurrentSkillLevel
FROM dbo.vw_RV_EmployeeSkillsForDashboard
"""
