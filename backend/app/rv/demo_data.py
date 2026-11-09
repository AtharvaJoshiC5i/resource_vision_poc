"""Deterministic synthetic data (same row shape as sql.py) for demos and tests.

Contains every case the engine must handle: verified rows, zero-effort
placeholders, conflicting duplicates, Project Track-only employees, leavers.
"""

from __future__ import annotations

import random
from datetime import date

from app.rv import engine as e

FIRST = ["Alex", "Brooke", "Daniel", "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia",
         "Mason", "Isla", "Lucas", "Mia", "Henry", "Zoe", "Owen", "Ruby", "Jack", "Nora"]
LAST = ["Carter", "Davis", "Wilson", "Parker", "Bennett", "Mitchell", "Collins", "Rogers", "Reed", "Grant"]
DIVISIONS = ["Technology Solutions", "Digital Services", "Consulting"]
CAPS = ["Data Engineering", "Cloud Engineering", "Data Analytics", "AI & Analytics"]
GRADES = ["C1", "C2", "C3", "C4"]
LOCS = ["Onshore", "Offshore"]
CONTRACTS = ["T&M - FTE", "T&M - Hrs", "Output - Effort based", "Output - Fixed spread"]
PROJECT_NAMES = [
    "Data Platform Upgrade", "Customer Insights Program", "Cloud Migration Phase 2",
    "Core Modernization", "Analytics Hub", "Mobile Banking Revamp", "Risk Engine",
    "ERP Integration", "Data Lake", "API Gateway", "Reporting Suite", "Security Uplift",
]
CLIENTS = ["Northwind Bank", "Zenith Retail", "Orion Energy", "Maple Insurance"]
BUS = ["BU - Data", "BU - Analytics", "BU - Cloud", "BU - Core"]


def build_demo(today: date) -> tuple[list[dict], list[dict]]:
    rnd = random.Random(7)
    start_month = e.add_months(e.month_int(today), -1)
    months = [e.add_months(start_month, i) for i in range(9)]  # data stops before the window end

    projects = []
    for i in range(1, 13):
        projects.append(
            {
                "id": f"P{3000 + i}",
                "name": PROJECT_NAMES[i - 1],
                "client": CLIENTS[i % 4],
                "bdu": BUS[i % 4],
                "status": "in_approval" if i % 3 else "draft",
                "contract": CONTRACTS[(i - 1) % 4],
                "start": e.month_start(e.add_months(start_month, -(i % 3))),
                "end": e.month_end(e.add_months(start_month, 6 + i % 4)),
            }
        )

    hr_rows: list[dict] = []
    pt_rows: list[dict] = []
    counter = 0

    def add_row(emp_key, emp_code, name, month, project, effort, sub="Build"):
        nonlocal counter
        counter += 1
        pt_rows.append(
            {
                "row_id": f"R{counter:06d}",
                "project_id": project["id"],
                "proposal_number": 1,
                "sub_project_name": sub,
                "employee_key": emp_key,
                "employee_code": emp_code,
                "month_key": e.month_start(month),
                "effort": effort,
                "is_override": False,
                "contract_type": project["contract"],
                "project_name": project["name"],
                "parent_account": project["client"],
                "account": None,
                "bdu": project["bdu"],
                "project_status": project["status"],
                "project_lead": "Project Lead",
                "notes": "Demo project",
                "start_date": project["start"],
                "end_date": project["end"],
                "employee_name": name,
                "primary_capability": None,
                "secondary_capability": None,
                "department": None,
                "grade": None,
                "location": None,
                "country": None,
            }
        )

    for n in range(1, 41):
        code = f"E{1000 + n}"
        name = f"{FIRST[n % len(FIRST)]} {LAST[n % len(LAST)]}"
        status = "FnF Locked" if n in (38, 39, 40) else "Existing"
        hr_rows.append(
            {
                "employee_key": code,
                "employee_code": code,
                "employee_name": name,
                "joining_date": date(2022, 1, 3),
                "exit_date": None,
                "leaving_date": None,
                "resignation_date": date(today.year, 1, 15) if status != "Existing" else None,
                "employee_status": status,
                "primary_capability": CAPS[n % 4],
                "secondary_capability": CAPS[(n + 1) % 4],
                "grade": GRADES[n % 4],
                "country": "India",
                "location": LOCS[n % 2],
                "division": DIVISIONS[n % 3],
                "department": "Engineering",
                "email": f"{name.split()[0].lower()}@example.com",
                "manager_name": "Michael Grant",
                "manager_code": "E0001",
                "employment_type": "Full Time",
            }
        )
        if status != "Existing":
            continue
        for m in months:
            if rnd.random() < 0.12:
                continue  # no record this month
            project = projects[(n + m) % len(projects)]
            kind = rnd.random()
            if kind < 0.18:  # zero-effort placeholders only
                add_row(code, code, name, m, project, 0.0)
            elif kind < 0.26:  # conflicting duplicate positive rows
                add_row(code, code, name, m, project, 80.0)
                add_row(code, code, name, m, project, 40.0)
            else:
                hours = float(rnd.choice([40, 60, 80, 120, 176, 100]))
                add_row(code, code, name, m, project, hours)
                add_row(code, code, name, m, project, 0.0, sub="Support")
                if rnd.random() < 0.3:
                    add_row(code, code, name, m, projects[(n + m + 3) % len(projects)], 20.0)

    for n in range(1, 4):  # Project Track-only employees (no ZingHR record)
        code = f"X{900 + n}"
        for m in months[:5]:
            add_row(code, code, f"Contractor {n}", m, projects[n], 40.0)

    for j, m in enumerate(months):  # untagged demand rows
        add_row(None, None, None, m, projects[j % len(projects)], 120.0)
    return pt_rows, hr_rows
