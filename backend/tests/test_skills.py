"""Unit tests for skills-based employee filtering (backend/app/rv/skills.py).

These never touch the database: SkillsSnapshot objects are built in-memory, exactly as
skills._rows_to_snapshot would build them from dbo.vw_RV_EmployeeSkillsForDashboard rows
(EmployeeCode, SkillName, CurrentSkillLevel). The point is to prove skill filtering only
changes which employees are shown, never the Planned / Remaining / Status figures that
engine.py and views.py compute: the same guarantee the Power BI bridge table gives.
"""

from __future__ import annotations

from app.rv import skills as s
from app.rv import views as v
from tests.test_engine import hr, pt, snap  # reuses the existing test row builders


def build_snapshot():
    """A small, deterministic snapshot with two employees, built the same way test_engine.py
    builds its fixtures, so skill filtering is tested against real engine.build_snapshot output."""
    return snap(
        [pt("E1", 2611, 80), pt("E2", 2611, 40)],
        [hr("E1"), hr("E2")],
    )


def _row(code, name, level=None):
    return {"employee_code": code, "skill_name": name, "skill_level": level}


def test_normalize_code_trims_and_upper_cases():
    assert s.normalize_code("  e123 ") == "E123"
    assert s.normalize_code(None) == ""


def test_null_level_becomes_not_documented():
    snap_ = s._rows_to_snapshot([_row("E1", "Python", None)])
    assert snap_.by_code["E1"][0].level == s.NOT_DOCUMENTED
    assert s.NOT_DOCUMENTED in snap_.levels


def test_matching_codes_is_match_any_across_selected_skill_names():
    snap_ = s._rows_to_snapshot(
        [
            _row("E1", "Python", "Advanced"),
            _row("E2", "SQL", "Intermediate"),
            _row("E3", "Java", "Beginner"),
        ]
    )
    either = s.matching_codes(snap_, {"Python", "SQL"}, set())
    assert either == {"E1", "E2"}


def test_matching_codes_name_and_level_apply_to_the_same_row():
    """'Python' + 'Advanced' means Python at Advanced, not Python plus something Advanced."""
    snap_ = s._rows_to_snapshot(
        [
            _row("E1", "Python", "Advanced"),
            _row("E2", "Python", "Beginner"),
            _row("E2", "SQL", "Advanced"),
        ]
    )
    matched = s.matching_codes(snap_, {"Python"}, {"Advanced"})
    assert matched == {"E1"}


def test_matching_codes_level_only_filter():
    snap_ = s._rows_to_snapshot([_row("E1", "Python", "Advanced"), _row("E2", "SQL", "Beginner")])
    assert s.matching_codes(snap_, set(), {"Advanced"}) == {"E1"}


def test_matching_codes_none_when_no_filter_is_set():
    snap_ = s._rows_to_snapshot([_row("E1", "Python")])
    assert s.matching_codes(snap_, set(), set()) is None


def test_employee_skills_sorted_and_not_documented_kept():
    snap_ = s._rows_to_snapshot([_row("e1", "SQL", "Advanced"), _row("E1", "Python", None)])
    assert s.employee_skills(snap_, "E1") == [
        {"name": "Python", "level": "Not documented"},
        {"name": "SQL", "level": "Advanced"},
    ]


def test_employee_skills_none_when_employee_has_no_record():
    snap_ = s._rows_to_snapshot([_row("E1", "Python")])
    assert s.employee_skills(snap_, "E2") is None


def test_skill_filter_narrows_employees_but_leaves_availability_figures_unchanged():
    """The central guarantee: selecting a skill changes who is listed, never the hours."""
    snap_ = build_snapshot()
    employee_keys = list(snap_.employees)
    assert employee_keys, "fixture must contain at least one employee"
    target = employee_keys[0]
    target_code = snap_.employees[target].code

    before = v.availability_matrix(snap_, v.Filters())
    before_row = next(r for r in before["rows"] if r["key"] == target)

    skill_codes = {s.normalize_code(target_code)}
    after = v.availability_matrix(snap_, v.Filters(skill_codes=skill_codes))
    after_row = next(r for r in after["rows"] if r["key"] == target)

    assert before_row["cells"] == after_row["cells"]
    assert all(r["key"] == target for r in after["rows"])


def test_skill_filter_with_no_matches_excludes_everyone():
    snap_ = build_snapshot()
    result = v.availability_matrix(snap_, v.Filters(skill_codes=set()))
    assert result["rows"] == []
    assert result["total"] == 0


def test_no_skill_filter_keeps_the_full_population():
    snap_ = build_snapshot()
    with_none = v.availability_matrix(snap_, v.Filters(skill_codes=None))
    without = v.availability_matrix(snap_, v.Filters())
    assert with_none["total"] == without["total"]
