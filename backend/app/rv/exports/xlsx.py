"""Employee availability workbook (.xlsx).

Six sheets, built from an EmployeeReport:

  Overview            headline figures, a month-by-month status strip, a chart and top projects
  Monthly availability one row per month with formulas in the totals row
  Project allocation  project by month matrix with a heat scale
  Allocation detail   one row per month, project and sub-project, filterable, SUBTOTAL totals
  Profile and skills  HR master data and skills by level
  Notes               report details, status definitions, column definitions, data quality

Colours are the dashboard's design tokens, resolved to hex because Excel has no colour-mix.
Every string is written as text (never parsed as a formula or URL), so a value that starts with
"=" in the source data cannot run as a formula.
"""

from __future__ import annotations

import io
from datetime import date
from typing import Any

import xlsxwriter
from xlsxwriter.utility import xl_col_to_name, xl_rowcol_to_cell

from app.rv import engine as e
from app.rv.exports.report import EmployeeReport, MonthLine

# --------------------------------------------------------------------------- design tokens
FONT = "Inter"

PRIMARY = "#6800E0"
INDIGO = "#420897"
LAVENDER = "#BC9BEC"
LAVENDER_MEDIUM = "#8C51E1"
INK = "#0C0C0C"
INK_SOFT = "#242424"
MUTED = "#6E6E6E"
FAINT = "#A3A3A8"
HAIRLINE = "#E6E6EB"
CANVAS = "#F3F3F6"
BAND = "#FAFAFC"
SURFACE = "#FFFFFF"
WARNING = "#EA792D"
WARNING_INK = "#8D4B1F"
WARNING_SOFT = "#FCEEE4"
ERROR_INK = "#A63535"
SUCCESS_INK = "#0B650D"
HEADER_TINT = "#E9DDFB"

STATUS_COLOURS: dict[str, tuple[str, str]] = {  # status: (fill, text)
    e.FULLY_AVAILABLE: ("#E4F5E4", SUCCESS_INK),
    e.PARTIALLY_AVAILABLE: ("#EEE3FC", PRIMARY),
    e.FULLY_COMMITTED: ("#EEE5FA", INDIGO),
    e.OVER_ALLOCATED: ("#FCEBEB", ERROR_INK),
    e.UNVERIFIED: (WARNING_SOFT, WARNING_INK),
}
STATUS_LETTER = {
    e.FULLY_AVAILABLE: "F",
    e.PARTIALLY_AVAILABLE: "P",
    e.FULLY_COMMITTED: "C",
    e.OVER_ALLOCATED: "O",
    e.UNVERIFIED: "U",
}
STATUS_MEANING = {
    e.FULLY_AVAILABLE: "No effort is planned. The full monthly capacity is free.",
    e.PARTIALLY_AVAILABLE: "Some hours are planned and some capacity is still free.",
    e.FULLY_COMMITTED: "Planned hours equal the monthly capacity.",
    e.OVER_ALLOCATED: "Planned hours exceed the monthly capacity.",
    e.UNVERIFIED: "Capacity or planned hours could not be established: no HR match, invalid employment dates, or rows that need review.",
}
SKILL_ORDER = {"Expert": 0, "Advanced": 0, "Intermediate": 1, "Beginner": 2, "Not documented": 4}
SKILL_COLOURS = {
    0: ("#EEE3FC", PRIMARY),
    1: ("#EEE5FA", INDIGO),
    2: (CANVAS, INK_SOFT),
    3: (CANVAS, INK_SOFT),
    4: (SURFACE, MUTED),
}

HOURS = "#,##0.0"
HOURS_SIGNED = "#,##0.0;-#,##0.0"
HOURS_HIDE_ZERO = '#,##0.0;-#,##0.0;""'
PERCENT = "0%"
MONTH_FMT = "mmm yyyy"
DATE_FMT = "d mmm yyyy"

BAR = "#DDCDF7"  # data bars: light enough that the figure on top stays readable


def _px(width: float) -> int:
    """Excel column width units to pixels at the default font."""
    return int(width * 7 + 5)


class _Formats:
    """Caches formats by their properties so the workbook carries each style once."""

    BASE = {"font_name": FONT, "font_size": 10, "font_color": INK_SOFT, "valign": "vcenter"}

    def __init__(self, workbook: xlsxwriter.Workbook):
        self._wb = workbook
        self._cache: dict[tuple, Any] = {}

    def __call__(self, *bases: dict, **props: Any):
        merged = dict(self.BASE)
        for base in bases:
            merged.update(base)
        merged.update(props)
        key = tuple(sorted(merged.items()))
        if key not in self._cache:
            self._cache[key] = self._wb.add_format(merged)
        return self._cache[key]


def _spans(start: int, count: int, weights: list[float]) -> list[tuple[int, int]]:
    """Splits `count` columns from `start` into len(weights) contiguous ranges, each at least 1 wide."""
    parts = len(weights)
    if count < parts:
        count = parts
    total = sum(weights)
    raw = [w / total * count for w in weights]
    widths = [max(1, int(x)) for x in raw]
    order = sorted(range(parts), key=lambda i: raw[i] - int(raw[i]), reverse=True)
    i = 0
    while sum(widths) < count:
        widths[order[i % parts]] += 1
        i += 1
    while sum(widths) > count:
        j = max(range(parts), key=lambda k: widths[k])
        widths[j] -= 1
    out, col = [], start
    for w in widths:
        out.append((col, col + w - 1))
        col += w
    return out


def _put(ws, row: int, c1: int, c2: int, value: Any, fmt) -> None:
    """Writes one value across a column range, merging only when the range is wider than one cell."""
    if c2 > c1:
        if value is None:
            ws.merge_range(row, c1, row, c2, "", fmt)
        else:
            ws.merge_range(row, c1, row, c2, value, fmt)
    elif value is None:
        ws.write_blank(row, c1, None, fmt)
    else:
        ws.write(row, c1, value, fmt)


def _num(ws, row: int, col: int, value: float | int | None, fmt) -> None:
    if value is None:
        ws.write_blank(row, col, None, fmt)
    else:
        ws.write_number(row, col, value, fmt)


def _text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return text


def _hours_label(value: float | None) -> str:
    if value is None:
        return "Not known"
    return f"{value:,.0f} h" if abs(value - round(value)) < 0.05 else f"{value:,.1f} h"


def _pct_label(value: float | None) -> str:
    return "Not known" if value is None else f"{value * 100:.0f}%"


def _basis(m: MonthLine) -> str:
    if not m.has_data:
        return "No Project Track data"
    if not m.present:
        return "No record"
    if m.estimated:
        return "Estimated"
    if m.status == e.UNVERIFIED:
        return "Unverified"
    return "Verified"


# --------------------------------------------------------------------------- shared page parts
def _page_setup(ws, *, landscape: bool = True, repeat_to: int | None = None, fit_width: bool = True) -> None:
    ws.hide_gridlines(2)
    ws.set_paper(9)  # A4
    if landscape:
        ws.set_landscape()
    ws.set_margins(left=0.4, right=0.4, top=0.55, bottom=0.6)
    ws.center_horizontally()
    if fit_width:
        ws.fit_to_pages(1, 0)
    if repeat_to is not None:
        ws.repeat_rows(0, repeat_to)
    ws.set_footer(f'&L&"{FONT},Regular"&8Resource Vision  |  &A&R&"{FONT},Regular"&8Page &P of &N')


def _sheet_title(ws, F: _Formats, report: EmployeeReport, title: str, subtitle: str, last_col: int) -> int:
    """Two-line title with a primary rule under it. Returns the next free row."""
    ws.set_row(0, 10)
    ws.set_row(1, 28)
    ws.set_row(2, 18)
    ws.set_row(3, 3)
    ws.set_row(4, 12)
    name = _text(report.profile.get("name"))
    code = _text(report.profile.get("code"))
    if last_col <= 4:  # narrow sheet: one wide title, the person named in the subtitle
        _put(ws, 1, 1, last_col, title, F(font_size=17, bold=True, font_color=INK))
        _put(ws, 2, 1, last_col, f"{subtitle}  |  {name} ({code})", F(font_size=9.5, font_color=MUTED))
        for c in range(1, last_col + 1):
            ws.write_blank(3, c, None, F(bg_color=PRIMARY))
        return 5
    right_c1 = last_col - 2
    _put(ws, 1, 1, right_c1 - 1, title, F(font_size=17, bold=True, font_color=INK))
    _put(ws, 2, 1, right_c1 - 1, subtitle, F(font_size=9.5, font_color=MUTED))
    right = F(font_size=9, font_color=MUTED, align="right")
    _put(ws, 1, right_c1, last_col, name, F(font_size=10, bold=True, font_color=INK, align="right"))
    _put(ws, 2, right_c1, last_col, code, right)
    for c in range(1, last_col + 1):
        ws.write_blank(3, c, None, F(bg_color=PRIMARY))
    return 5


def _header_row(ws, F: _Formats, row: int, headers: list[str], first_col: int, numeric: set[int]) -> None:
    ws.set_row(row, 30)
    for i, label in enumerate(headers):
        col = first_col + i
        align = "right" if i in numeric else "left"
        ws.write_string(
            row,
            col,
            label,
            F(bold=True, font_size=9, font_color=SURFACE, bg_color=INDIGO, align=align, text_wrap=True, indent=0 if align == "right" else 1, right=1 if align == "right" else 0, right_color=INDIGO),
        )


# --------------------------------------------------------------------------- overview
def _overview(wb, F: _Formats, report: EmployeeReport, chart_sheet: str) -> None:
    ws = wb.add_worksheet("Overview")
    ws.set_tab_color(PRIMARY)
    months = report.months
    n = max(len(months), 1)
    first_month_col = 2
    last_col = first_month_col + n - 1
    ws.set_column(0, 0, 2.5)
    ws.set_column(1, 1, 17)
    ws.set_column(first_month_col, last_col, 7.4)
    ws.set_column(last_col + 1, last_col + 1, 2.5)
    profile = report.profile

    # Header band
    band = F(bg_color=INDIGO)
    for r, h in ((0, 12), (1, 18), (2, 34), (3, 20), (4, 14)):
        ws.set_row(r, h)
        for c in range(0, last_col + 2):
            ws.write_blank(r, c, None, band)
    ws.set_row(5, 3)
    for c in range(0, last_col + 2):
        ws.write_blank(5, c, None, F(bg_color=PRIMARY))

    split = max(first_month_col, last_col - 5)
    _put(ws, 1, 1, split - 1, "Employee availability report", F(bg_color=INDIGO, font_color=LAVENDER, font_size=9.5))
    _put(ws, 1, split, last_col, "Internal  |  Confidential", F(bg_color=INDIGO, font_color=LAVENDER, font_size=9, align="right"))
    _put(ws, 2, 1, split - 1, _text(profile.get("name")), F(bg_color=INDIGO, font_color=SURFACE, font_size=22, bold=True))
    status = report.current.status if report.current and report.current.present else None
    if status:
        fill, ink = STATUS_COLOURS.get(status, (CANVAS, INK_SOFT))
        _put(ws, 2, split + 1, last_col, status, F(bg_color=fill, font_color=ink, bold=True, font_size=10, align="center", border=5, border_color=INDIGO))
    identity = [profile.get("code"), profile.get("grade"), profile.get("primary_capability"), profile.get("location"), profile.get("status")]
    _put(ws, 3, 1, last_col, "   |   ".join(_text(x) for x in identity if _text(x)), F(bg_color=INDIGO, font_color=HEADER_TINT, font_size=10))

    meta_bits = [
        f"Reporting window  {report.window_label}",
        f"Source  {report.source_label}",
        f"Generated  {report.generated_at:%d %b %Y, %H:%M}",
    ]
    ws.set_row(6, 10)
    ws.set_row(7, 18)
    _put(ws, 7, 1, last_col, "      ".join(meta_bits), F(font_size=9, font_color=MUTED))
    row = 8
    if report.sample_note:
        ws.set_row(row, 20)
        _put(ws, row, 1, last_col, report.sample_note, F(font_size=9, font_color=WARNING_INK, bg_color=WARNING_SOFT, indent=1))
        row += 1
    row += 1

    # KPI tiles
    current = report.current
    nxt = report.next_available
    peak = report.peak
    review = report.review_total
    tiles_top = [
        ("Current status", status or "No record", (current.label if current else ""), STATUS_COLOURS.get(status or "", (None, INK))[1]),
        ("Next available", nxt.label if nxt else "None in window", f"{_hours_label(nxt.free)} free that month" if nxt else "No free hours recorded", INK),
        ("Free hours", _hours_label(report.free_total), f"Across {len(report.records)} months with records", INK),
        ("Planned hours", _hours_label(report.planned_total), "Verified effort in the window", INK),
        ("Average utilisation", _pct_label(report.average_utilisation), f"Peak {_pct_label(peak.utilisation)} in {peak.label}" if peak else "No verified months", INK),
    ]
    tiles_bottom = [
        ("Projects", str(len(report.projects)), f"{report.project_months} project-months", INK),
        ("Months with records", f"{len(report.records)} of {len(months)}", f"{report.estimated_months} estimated" if report.estimated_months else "All from recorded data", INK),
        ("Fully available months", str(report.count_status(e.FULLY_AVAILABLE)), f"{report.count_status(e.PARTIALLY_AVAILABLE)} partially available", INK),
        ("Over-allocated months", str(report.count_status(e.OVER_ALLOCATED)), f"{report.count_status(e.FULLY_COMMITTED)} fully committed", ERROR_INK if report.count_status(e.OVER_ALLOCATED) else INK),
        ("Hours needing review", _hours_label(review) if review else "None", "Not counted as verified" if review else "Nothing to review", WARNING_INK if review else INK),
    ]
    spans = _spans(1, last_col, [1, 1, 1, 1, 1])
    for tiles in (tiles_top, tiles_bottom):
        ws.set_row(row, 18)
        ws.set_row(row + 1, 30)
        ws.set_row(row + 2, 18)
        for (c1, c2), (label, value, caption, ink) in zip(spans, tiles):
            edge = {"left": 5, "left_color": SURFACE, "right": 5, "right_color": SURFACE, "bg_color": CANVAS}
            _put(ws, row, c1, c2, label, F(font_size=8.5, font_color=MUTED, indent=1, top=2, top_color=PRIMARY, **edge))
            _put(ws, row + 1, c1, c2, value, F(font_size=17, bold=True, font_color=ink or INK, indent=1, **edge))
            _put(ws, row + 2, c1, c2, caption, F(font_size=8, font_color=MUTED, indent=1, **edge))
        row += 4

    # Month strip
    row += 1
    ws.set_row(row, 24)
    _put(ws, row, 1, last_col - 6, "Availability by month", F(font_size=13, bold=True, font_color=INK))
    _put(ws, row, last_col - 5, last_col, f"Free hours against {report.capacity_hours:,.0f} h capacity", F(font_size=8.5, font_color=MUTED, align="right"))
    row += 1
    label_fmt = F(font_size=8.5, font_color=MUTED, indent=1, bottom=1, bottom_color=HAIRLINE)
    strip_rows = ["Year", "Month", "Status", "Free h", "Planned h", "Utilisation", "Projects"]
    heights = [14, 18, 26, 20, 20, 20, 20]
    for i, (name, h) in enumerate(zip(strip_rows, heights)):
        ws.set_row(row + i, h)
        ws.write_string(row + i, 1, "" if name == "Year" else name, label_fmt if name != "Year" else F(font_size=8.5))
    cell = dict(align="center", font_size=9, bottom=1, bottom_color=HAIRLINE)
    for i, m in enumerate(months):
        col = first_month_col + i
        show_year = i == 0 or m.month % 100 == 1
        ws.write_string(row, col, str(m.month // 100) if show_year else "", F(align="center", font_size=8, font_color=FAINT))
        current_col = i == 0
        ws.write_string(row + 1, col, m.label.split(" ")[0], F(align="center", font_size=9.5, bold=True, font_color=PRIMARY if current_col else INK, bottom=1, bottom_color=HAIRLINE))
        if m.present and m.status:
            fill, ink = STATUS_COLOURS.get(m.status, (CANVAS, INK_SOFT))
            letter = STATUS_LETTER.get(m.status, "?") + ("*" if m.estimated else "")
            ws.write_string(row + 2, col, letter, F(align="center", bold=True, font_size=11, bg_color=fill, font_color=ink, left=5, left_color=SURFACE, right=5, right_color=SURFACE, top=1, top_color=SURFACE, bottom=1, bottom_color=SURFACE))
        else:
            ws.write_string(row + 2, col, "No data" if not m.has_data else "None", F(align="center", font_size=7.5, font_color=FAINT, bg_color=BAND, left=5, left_color=SURFACE, right=5, right_color=SURFACE))
        free_fmt = F(cell, num_format=HOURS_SIGNED, font_color=ERROR_INK if (m.free or 0) < 0 else INK, bold=True)
        _num(ws, row + 3, col, m.free, free_fmt)
        _num(ws, row + 4, col, m.planned, F(cell, num_format=HOURS, font_color=INK_SOFT))
        _num(ws, row + 5, col, m.utilisation, F(cell, num_format=PERCENT, font_color=INK_SOFT))
        _num(ws, row + 6, col, m.projects, F(cell, num_format="0", font_color=MUTED))
    util_range = (row + 5, first_month_col, row + 5, last_col)
    ws.conditional_format(*util_range, {"type": "data_bar", "bar_color": BAR, "bar_solid": True, "bar_no_border": True, "min_type": "num", "min_value": 0, "max_type": "num", "max_value": 1.25})
    row += len(strip_rows) + 1

    # Legend
    ws.set_row(row, 18)
    ws.write_string(row, 1, "Legend", F(font_size=8.5, font_color=MUTED, indent=1))
    col = first_month_col
    for s in e.STATUSES:
        if col + 2 > last_col:
            break
        fill, ink = STATUS_COLOURS[s]
        ws.write_string(row, col, STATUS_LETTER[s], F(align="center", bold=True, font_size=9, bg_color=fill, font_color=ink))
        _put(ws, row, col + 1, col + 2, s, F(font_size=8.5, font_color=INK_SOFT, indent=1))
        col += 3
    if col <= last_col:
        _put(ws, row, col, last_col, "* Estimated", F(font_size=8.5, font_color=MUTED, align="right"))
    row += 2

    # Chart and top projects start a fresh printed page
    ws.set_h_pagebreaks([row])
    ws.set_row(row, 24)
    _put(ws, row, 1, last_col, "Planned, review and free hours by month", F(font_size=13, bold=True, font_color=INK))
    row += 1
    chart = wb.add_chart({"type": "column", "subtype": "stacked"})
    count = len(months)
    cats = [chart_sheet, 1, 0, count, 0]
    series = [
        ("Planned", 1, PRIMARY),
        ("Needs review", 2, WARNING),
        ("Free", 3, LAVENDER),
    ]
    for name, col_idx, colour in series:
        chart.add_series({
            "name": name,
            "categories": cats,
            "values": [chart_sheet, 1, col_idx, count, col_idx],
            "fill": {"color": colour},
            "border": {"color": SURFACE, "width": 0.75},
            "gap": 55,
        })
    line = wb.add_chart({"type": "line"})
    line.add_series({
        "name": "Capacity",
        "categories": cats,
        "values": [chart_sheet, 1, 4, count, 4],
        "line": {"color": INK_SOFT, "width": 1.25, "dash_type": "dash"},
        "marker": {"type": "none"},
    })
    chart.combine(line)
    axis_font = {"name": FONT, "size": 8, "color": MUTED}
    chart.set_x_axis({"num_font": axis_font, "line": {"color": HAIRLINE}, "major_tick_mark": "none"})
    chart.set_y_axis({
        "num_font": axis_font,
        "num_format": "#,##0",
        "line": {"none": True},
        "major_gridlines": {"visible": True, "line": {"color": HAIRLINE, "width": 0.75}},
        "major_tick_mark": "none",
        "min": 0,
    })
    chart.set_legend({"position": "top", "font": {"name": FONT, "size": 8.5, "color": INK_SOFT}})
    chart.set_chartarea({"border": {"none": True}, "fill": {"color": SURFACE}})
    chart.set_plotarea({"fill": {"none": True}, "border": {"none": True}})
    width_px = _px(17) + _px(7.4) * n
    chart.set_size({"width": width_px, "height": 300})
    ws.insert_chart(row, 1, chart, {"object_position": 3})
    row += 16

    # Top projects
    ws.set_row(row, 24)
    _put(ws, row, 1, last_col, "Top projects in the window", F(font_size=13, bold=True, font_color=INK))
    row += 1
    cols = _spans(1, last_col, [1.3, 4.2, 3, 1.6, 1.6, 1.4, 1.3])
    heads = ["Project ID", "Project", "Client / BU", "Status", "Months", "Planned h", "Share"]
    numeric = {4, 5, 6}
    ws.set_row(row, 22)
    for idx, ((c1, c2), label) in enumerate(zip(cols, heads)):
        _put(ws, row, c1, c2, label, F(bold=True, font_size=8.5, font_color=MUTED, align="right" if idx in numeric else "left", indent=0 if idx in numeric else 1, bottom=1, bottom_color=INK_SOFT))
    row += 1
    total_planned = sum(p.planned for p in report.projects) or 0.0
    top = report.projects[:8]
    first_share = row
    if not top:
        _put(ws, row, 1, last_col, "No project allocations recorded in the reporting window.", F(font_size=9, font_color=MUTED, indent=1))
        row += 1
    for i, p in enumerate(top):
        ws.set_row(row, 20)
        zebra = {"bg_color": BAND} if i % 2 else {}
        line_fmt = dict(font_size=9, bottom=1, bottom_color=HAIRLINE, **zebra)
        values = [p.id, p.name, p.client_bu, p.status, len(p.months), p.planned, (p.planned / total_planned) if total_planned else None]
        for idx, ((c1, c2), value) in enumerate(zip(cols, values)):
            if idx == 4:
                _put(ws, row, c1, c2, value, F(line_fmt, align="right", num_format="0"))
            elif idx == 5:
                _put(ws, row, c1, c2, value, F(line_fmt, align="right", num_format=HOURS, bold=True, font_color=INK))
            elif idx == 6:
                _put(ws, row, c1, c2, value, F(line_fmt, align="right", num_format=PERCENT))
            else:
                _put(ws, row, c1, c2, _text(value), F(line_fmt, indent=1, font_color=INK if idx == 1 else INK_SOFT))
        row += 1
    if top:
        c1 = cols[6][0]
        ws.conditional_format(first_share, c1, row - 1, c1, {"type": "data_bar", "bar_color": BAR, "bar_solid": True, "bar_no_border": True, "min_type": "num", "min_value": 0, "max_type": "num", "max_value": 1})
    if len(report.projects) > len(top):
        _put(ws, row, 1, last_col, f"{len(report.projects) - len(top)} more on the Project allocation sheet.", F(font_size=8.5, font_color=MUTED, indent=1))
        row += 1

    # Notes
    row += 1
    notes = [
        "Hours are recorded effort from Project Track. A blank cell means unknown, not zero.",
        f"Free hours are capacity ({report.capacity_hours:,.0f} h a month) minus planned hours. A negative value means over-allocated.",
    ]
    if report.estimated_months:
        notes.append("* Estimated months assume the standard capacity and count every recorded hour, including rows that need review.")
    for note in notes:
        _put(ws, row, 1, last_col, note, F(font_size=8, font_color=MUTED, indent=1))
        row += 1

    _page_setup(ws)
    ws.print_area(0, 0, row, last_col + 1)
    ws.set_zoom(100)
    ws.activate()


# --------------------------------------------------------------------------- chart data
def _chart_data(wb, F: _Formats, report: EmployeeReport) -> str:
    name = "ChartData"
    ws = wb.add_worksheet(name)
    for c, h in enumerate(["Month", "Planned", "Needs review", "Free", "Capacity"]):
        ws.write_string(0, c, h)
    for i, m in enumerate(report.months, start=1):
        ws.write_string(i, 0, m.label.split(" ")[0] + (" " + str(m.month // 100)[2:] if (i == 1 or m.month % 100 == 1) else ""))
        _num(ws, i, 1, m.planned if m.present else None, None)
        _num(ws, i, 2, m.review if m.review else None, None)
        _num(ws, i, 3, max(m.free, 0.0) if m.free is not None else None, None)
        _num(ws, i, 4, m.capacity if m.present else None, None)
    ws.hide()
    return name


# --------------------------------------------------------------------------- monthly availability
def _monthly(wb, F: _Formats, report: EmployeeReport) -> None:
    ws = wb.add_worksheet("Monthly availability")
    ws.set_tab_color(INDIGO)
    headers = ["Month", "Status", "Basis", "Capacity h", "Planned h", "Needs review h", "Free h", "Utilisation", "Projects", "Contract category", "Status reason"]
    widths = [15, 20, 13, 11, 11, 13, 11, 13, 9, 22, 60]
    first = 1
    ws.set_column(0, 0, 2.5)
    for i, w in enumerate(widths):
        ws.set_column(first + i, first + i, w)
    last = first + len(headers) - 1
    top = _sheet_title(ws, F, report, "Monthly availability", f"{report.window_label}  |  capacity {report.capacity_hours:,.0f} h a month  |  source {report.source_label}", last)
    head = top
    numeric = {3, 4, 5, 6, 7, 8}
    _header_row(ws, F, head, headers, first, numeric)
    r = head + 1
    for i, m in enumerate(report.months):
        ws.set_row(r, 20)
        zebra = {"bg_color": BAND} if i % 2 else {"bg_color": SURFACE}
        base = dict(font_size=9.5, bottom=1, bottom_color=HAIRLINE, **zebra)
        muted = not m.present
        ink = FAINT if muted else INK_SOFT
        ws.write_datetime(r, first, m.first_day, F(base, num_format=MONTH_FMT, indent=1, font_color=PRIMARY if i == 0 else (FAINT if muted else INK), bold=i == 0))
        if m.present and m.status:
            fill, sink = STATUS_COLOURS.get(m.status, (CANVAS, INK_SOFT))
            ws.write_string(r, first + 1, m.status, F(font_size=9.5, bold=True, bg_color=fill, font_color=sink, indent=1, bottom=1, bottom_color=SURFACE, top=1, top_color=SURFACE))
        else:
            ws.write_string(r, first + 1, "No record" if m.has_data else "No data", F(base, font_color=FAINT, indent=1))
        basis = _basis(m)
        basis_ink = WARNING_INK if basis in ("Estimated", "Unverified") else ink
        ws.write_string(r, first + 2, basis, F(base, font_color=basis_ink, indent=1))
        _num(ws, r, first + 3, m.capacity, F(base, num_format=HOURS, font_color=ink))
        _num(ws, r, first + 4, m.planned, F(base, num_format=HOURS, font_color=INK, bold=True))
        _num(ws, r, first + 5, m.review if m.review else None, F(base, num_format=HOURS, font_color=WARNING_INK))
        _num(ws, r, first + 6, m.free, F(base, num_format=HOURS_SIGNED, font_color=ERROR_INK if (m.free or 0) < 0 else INK, bold=True))
        _num(ws, r, first + 7, m.utilisation, F(base, num_format=PERCENT, font_color=ink))
        _num(ws, r, first + 8, m.projects, F(base, num_format="0", font_color=ink))
        ws.write_string(r, first + 9, _text(m.contract_category), F(base, font_color=ink, indent=1))
        ws.write_string(r, first + 10, _text(m.reason) or ("No Project Track data for this month" if not m.has_data else "No record this month"), F(base, font_color=MUTED, indent=1))
        r += 1
    last_data = r - 1

    # Totals row with live formulas (cached values written for viewers that do not recalculate)
    ws.set_row(r, 24)
    tot = dict(bold=True, font_size=9.5, top=2, top_color=INK_SOFT, bg_color=CANVAS, font_color=INK)
    ws.write_string(r, first, "Window total", F(tot, indent=1))
    ws.write_string(r, first + 1, f"{len(report.records)} of {len(report.months)} months", F(tot, font_color=MUTED, indent=1))
    ws.write_blank(r, first + 2, None, F(tot))

    def col_range(offset: int) -> str:
        letter = xl_col_to_name(first + offset)
        return f"{letter}{head + 2}:{letter}{last_data + 1}"

    if last_data >= head + 1:
        cap_sum = sum(m.capacity for m in report.months if m.capacity is not None)
        ws.write_formula(r, first + 3, f"=SUM({col_range(3)})", F(tot, num_format=HOURS), cap_sum)
        ws.write_formula(r, first + 4, f"=SUM({col_range(4)})", F(tot, num_format=HOURS), report.planned_total or 0)
        ws.write_formula(r, first + 5, f"=SUM({col_range(5)})", F(tot, num_format=HOURS, font_color=WARNING_INK), report.review_total or 0)
        ws.write_formula(r, first + 6, f"=SUM({col_range(6)})", F(tot, num_format=HOURS_SIGNED), report.free_total or 0)
        ws.write_formula(
            r, first + 7,
            f'=IFERROR(SUMIFS({col_range(4)},{col_range(3)},"<>",{col_range(4)},"<>")/SUMIFS({col_range(3)},{col_range(4)},"<>"),"")',
            F(tot, num_format=PERCENT),
            report.average_utilisation if report.average_utilisation is not None else "",
        )
        ws.write_formula(r, first + 8, f"=SUM({col_range(8)})", F(tot, num_format="0"), report.project_months)
        ws.conditional_format(head + 1, first + 7, last_data, first + 7, {"type": "data_bar", "bar_color": BAR, "bar_solid": True, "bar_no_border": True, "min_type": "num", "min_value": 0, "max_type": "num", "max_value": 1.25})
    else:
        for c in range(first + 3, first + 9):
            ws.write_blank(r, c, None, F(tot))
    ws.write_string(r, first + 9, report.contract_category, F(tot, indent=1))
    ws.write_blank(r, first + 10, None, F(tot))

    r += 2
    for note in (
        "Basis: Verified means capacity and planned hours were both established. Estimated months assume standard capacity.",
        "Utilisation is planned hours divided by capacity. The bar is scaled to 125% so over-allocation stays visible.",
    ):
        _put(ws, r, first, last, note, F(font_size=8, font_color=MUTED, indent=1))
        r += 1

    ws.freeze_panes(head + 1, first + 1)
    ws.autofilter(head, first, last_data, last)
    _page_setup(ws, repeat_to=head)
    ws.print_area(0, 0, r, last)


# --------------------------------------------------------------------------- project matrix
def _projects(wb, F: _Formats, report: EmployeeReport) -> None:
    ws = wb.add_worksheet("Project allocation")
    ws.set_tab_color(LAVENDER_MEDIUM)
    months = report.months
    fixed = ["Project ID", "Project", "Client / BU", "Status", "Contract", "Start", "End"]
    widths = [13, 34, 28, 14, 21, 11, 11]
    first = 1
    ws.set_column(0, 0, 2.5)
    for i, w in enumerate(widths):
        ws.set_column(first + i, first + i, w)
    month_first = first + len(fixed)
    ws.set_column(month_first, month_first + len(months) - 1, 8.2)
    tail = ["Total h", "Share", "Months"]
    tail_first = month_first + len(months)
    ws.set_column(tail_first, tail_first, 11)
    ws.set_column(tail_first + 1, tail_first + 2, 10)
    last = tail_first + len(tail) - 1

    head = _sheet_title(ws, F, report, "Project allocation", f"Planned hours by project and month  |  {len(report.projects)} projects  |  {report.window_label}", last)
    headers = fixed + [m.label for m in months] + tail
    numeric = set(range(len(fixed), len(headers)))
    numeric.discard(5)
    numeric.discard(6)
    _header_row(ws, F, head, headers, first, numeric)
    for i, m in enumerate(months):
        if i == 0:
            ws.write_string(head, month_first, m.label, F(bold=True, font_size=9, font_color=SURFACE, bg_color=PRIMARY, align="right", text_wrap=True))
    r = head + 1
    total_planned = sum(p.planned for p in report.projects)
    if not report.projects:
        _put(ws, r, first, last, "No project allocations recorded in the reporting window.", F(font_size=9.5, font_color=MUTED, indent=1))
        r += 1
    for i, p in enumerate(report.projects):
        ws.set_row(r, 20)
        zebra = {"bg_color": BAND} if i % 2 else {"bg_color": SURFACE}
        base = dict(font_size=9.5, bottom=1, bottom_color=HAIRLINE, **zebra)
        ws.write_string(r, first, p.id, F(base, indent=1, font_color=MUTED))
        ws.write_string(r, first + 1, p.name, F(base, indent=1, font_color=INK, bold=True))
        ws.write_string(r, first + 2, p.client_bu, F(base, indent=1))
        ws.write_string(r, first + 3, p.status, F(base, indent=1))
        ws.write_string(r, first + 4, p.contract, F(base, indent=1))
        for j, d in enumerate((p.start, p.end)):
            if d:
                ws.write_datetime(r, first + 5 + j, d, F(base, num_format=DATE_FMT, font_color=MUTED))
            else:
                ws.write_blank(r, first + 5 + j, None, F(base))
        for j, m in enumerate(months):
            _num(ws, r, month_first + j, p.planned_by_month.get(m.month), F(base, num_format=HOURS))
        row_range = f"{xl_rowcol_to_cell(r, month_first)}:{xl_rowcol_to_cell(r, tail_first - 1)}"
        ws.write_formula(r, tail_first, f"=SUM({row_range})", F(base, num_format=HOURS, bold=True, font_color=INK), p.planned)
        ws.write_number(r, tail_first + 1, (p.planned / total_planned) if total_planned else 0, F(base, num_format=PERCENT))
        ws.write_number(r, tail_first + 2, len(p.months), F(base, num_format="0", font_color=MUTED))
        r += 1
    last_data = r - 1
    if report.projects:
        ws.conditional_format(head + 1, month_first, last_data, tail_first - 1, {"type": "2_color_scale", "min_color": "#F7F2FE", "max_color": LAVENDER})
        ws.conditional_format(head + 1, tail_first + 1, last_data, tail_first + 1, {"type": "data_bar", "bar_color": BAR, "bar_solid": True, "bar_no_border": True, "min_type": "num", "min_value": 0, "max_type": "num", "max_value": 1})
        # Totals
        ws.set_row(r, 24)
        tot = dict(bold=True, font_size=9.5, top=2, top_color=INK_SOFT, bg_color=CANVAS, font_color=INK)
        ws.write_string(r, first, "Total planned", F(tot, indent=1))
        for c in range(first + 1, month_first):
            ws.write_blank(r, c, None, F(tot))
        for j, m in enumerate(months):
            col = month_first + j
            letter = xl_col_to_name(col)
            value = sum(p.planned_by_month.get(m.month, 0.0) for p in report.projects)
            ws.write_formula(r, col, f"=SUM({letter}{head + 2}:{letter}{last_data + 1})", F(tot, num_format=HOURS if m.has_data else HOURS_HIDE_ZERO), value)
        letter = xl_col_to_name(tail_first)
        ws.write_formula(r, tail_first, f"=SUM({letter}{head + 2}:{letter}{last_data + 1})", F(tot, num_format=HOURS), total_planned)
        ws.write_number(r, tail_first + 1, 1 if total_planned else 0, F(tot, num_format=PERCENT))
        ws.write_blank(r, tail_first + 2, None, F(tot))
        r += 1
        # Free capacity row, aligned to the same months, so allocation and availability read together
        ws.set_row(r, 20)
        free_fmt = dict(font_size=9.5, bg_color=SURFACE, bottom=1, bottom_color=HAIRLINE)
        ws.write_string(r, first, "Free hours", F(free_fmt, indent=1, font_color=MUTED))
        for c in range(first + 1, month_first):
            ws.write_blank(r, c, None, F(free_fmt))
        for j, m in enumerate(months):
            _num(ws, r, month_first + j, m.free, F(free_fmt, num_format=HOURS_SIGNED, font_color=ERROR_INK if (m.free or 0) < 0 else MUTED))
        r += 1

    review_projects = [p for p in report.projects if p.review]
    if review_projects:
        r += 1
        ws.set_row(r, 22)
        _put(ws, r, first, last, "Hours needing review (not counted above)", F(font_size=11, bold=True, font_color=WARNING_INK))
        r += 1
        for p in review_projects:
            base = dict(font_size=9.5, bottom=1, bottom_color=HAIRLINE, bg_color=WARNING_SOFT)
            ws.write_string(r, first, p.id, F(base, indent=1, font_color=MUTED))
            ws.write_string(r, first + 1, p.name, F(base, indent=1, font_color=INK))
            for c in range(first + 2, month_first):
                ws.write_blank(r, c, None, F(base))
            for j, m in enumerate(months):
                _num(ws, r, month_first + j, p.review_by_month.get(m.month), F(base, num_format=HOURS, font_color=WARNING_INK))
            ws.write_number(r, tail_first, p.review, F(base, num_format=HOURS, bold=True, font_color=WARNING_INK))
            ws.write_blank(r, tail_first + 1, None, F(base))
            ws.write_blank(r, tail_first + 2, None, F(base))
            r += 1

    r += 1
    _put(ws, r, first, last, "Cells are shaded by hours: deeper lavender means more planned effort. Blank means no hours that month.", F(font_size=8, font_color=MUTED, indent=1))
    ws.freeze_panes(head + 1, first + 2)
    if report.projects:
        ws.autofilter(head, first, last_data, last)
    _page_setup(ws, repeat_to=head)
    ws.set_paper(8)  # A3: the month columns stay legible on paper
    ws.print_area(0, 0, r, last)


# --------------------------------------------------------------------------- allocation detail
def _details(wb, F: _Formats, report: EmployeeReport) -> None:
    ws = wb.add_worksheet("Allocation detail")
    ws.set_tab_color(LAVENDER)
    headers = ["Month", "Project ID", "Project", "Client / BU", "Project status", "Contract", "Sub-project", "Planned h", "Needs review h", "Start", "End"]
    widths = [12, 13, 34, 28, 15, 21, 28, 11, 13, 12, 12]
    first = 1
    ws.set_column(0, 0, 2.5)
    for i, w in enumerate(widths):
        ws.set_column(first + i, first + i, w)
    last = first + len(headers) - 1
    head = _sheet_title(ws, F, report, "Allocation detail", f"One line per month, project and sub-project  |  {len(report.details)} lines  |  filter any column, totals follow the filter", last)
    _header_row(ws, F, head, headers, first, {7, 8})
    r = head + 1
    prev_month = None
    for i, d in enumerate(report.details):
        ws.set_row(r, 19)
        new_month = d.month != prev_month
        prev_month = d.month
        base = dict(font_size=9.5, bottom=1, bottom_color=HAIRLINE, bg_color=SURFACE)
        if new_month and i:
            base.update(top=1, top_color=LAVENDER)
        ws.write_datetime(r, first, e.month_start(d.month), F(base, num_format=MONTH_FMT, indent=1, font_color=INK if new_month else FAINT, bold=new_month))
        ws.write_string(r, first + 1, d.project_id, F(base, indent=1, font_color=MUTED))
        ws.write_string(r, first + 2, d.project_name, F(base, indent=1, font_color=INK))
        ws.write_string(r, first + 3, d.client_bu, F(base, indent=1))
        ws.write_string(r, first + 4, d.project_status, F(base, indent=1))
        ws.write_string(r, first + 5, d.contract, F(base, indent=1))
        ws.write_string(r, first + 6, d.sub_project, F(base, indent=1, font_color=MUTED if d.sub_project == e.NO_SUB_PROJECT else INK_SOFT))
        _num(ws, r, first + 7, d.planned, F(base, num_format=HOURS, bold=True, font_color=INK))
        _num(ws, r, first + 8, d.review, F(base, num_format=HOURS, font_color=WARNING_INK))
        for j, value in enumerate((d.start, d.end)):
            if value:
                ws.write_datetime(r, first + 9 + j, value, F(base, num_format=DATE_FMT, font_color=MUTED))
            else:
                ws.write_blank(r, first + 9 + j, None, F(base))
        r += 1
    last_data = r - 1
    if not report.details:
        _put(ws, r, first, last, "No allocation lines in the reporting window.", F(font_size=9.5, font_color=MUTED, indent=1))
        r += 1
    else:
        ws.set_row(r, 24)
        tot = dict(bold=True, font_size=9.5, top=2, top_color=INK_SOFT, bg_color=CANVAS, font_color=INK)
        ws.write_string(r, first, "Total (visible rows)", F(tot, indent=1))
        for c in range(first + 1, first + 7):
            ws.write_blank(r, c, None, F(tot))
        for offset, value, ink in ((7, sum(d.planned or 0 for d in report.details), INK), (8, sum(d.review or 0 for d in report.details), WARNING_INK)):
            letter = xl_col_to_name(first + offset)
            ws.write_formula(r, first + offset, f"=SUBTOTAL(109,{letter}{head + 2}:{letter}{last_data + 1})", F(tot, num_format=HOURS, font_color=ink), value)
        ws.write_blank(r, first + 9, None, F(tot))
        ws.write_blank(r, first + 10, None, F(tot))
        ws.autofilter(head, first, last_data, last)
    ws.freeze_panes(head + 1, first + 3)
    _page_setup(ws, repeat_to=head)
    ws.print_area(0, 0, r, last)


# --------------------------------------------------------------------------- profile and skills
def _profile(wb, F: _Formats, report: EmployeeReport) -> None:
    ws = wb.add_worksheet("Profile and skills")
    ws.set_tab_color(INK_SOFT)
    ws.set_column(0, 0, 2.5)
    ws.set_column(1, 1, 24)
    ws.set_column(2, 2, 42)
    ws.set_column(3, 3, 4)
    ws.set_column(4, 4, 38)
    ws.set_column(5, 5, 16)
    last = 5
    p = report.profile
    head = _sheet_title(ws, F, report, "Profile and skills", "HR master data from ZingHR and skills from the skills register", last)

    def date_or_none(value: Any) -> date | None:
        if isinstance(value, date):
            return value
        if isinstance(value, str) and value:
            try:
                return date.fromisoformat(value[:10])
            except ValueError:
                return None
        return None

    tenure = p.get("tenure")
    months = p.get("tenure_months")
    tenure_text = _text(tenure)
    if months is not None:
        years, rem = divmod(int(months), 12)
        span = (f"{years} yr " if years else "") + f"{rem} mo"
        tenure_text = f"{tenure_text} ({span.strip()})" if tenure_text else span

    sections: list[tuple[str, list[tuple[str, Any]]]] = [
        ("Identity", [
            ("Name", p.get("name")),
            ("Employee code", p.get("code")),
            ("Employee status", p.get("status")),
            ("HR record", p.get("hr_match_status")),
        ]),
        ("Role and organisation", [
            ("Business vertical", p.get("business_vertical")),
            ("Grade", p.get("grade")),
            ("Primary capability", p.get("primary_capability")),
            ("Secondary capability", p.get("secondary_capability")),
            ("Division", p.get("division")),
            ("Department", p.get("department")),
        ]),
        ("Employment", [
            ("Employment type", p.get("employment_type")),
            ("Date of joining", date_or_none(p.get("joining_date"))),
            ("Exit date", report.exit_date),
            ("Tenure", tenure_text),
            ("Contract category", report.contract_category),
        ]),
        ("Contact and reporting", [
            ("Email", p.get("email")),
            ("Location", p.get("location")),
            ("Country", p.get("country")),
            ("Reporting manager", p.get("manager")),
            ("Manager code", report.manager_code),
        ]),
        ("Clients", [
            ("Current clients", ", ".join(p.get("current_clients") or [])),
        ]),
    ]

    r = head
    for title, fields in sections:
        ws.set_row(r, 22)
        _put(ws, r, 1, 2, title, F(font_size=11, bold=True, font_color=INK, bottom=2, bottom_color=PRIMARY))
        r += 1
        for label, value in fields:
            ws.set_row(r, 19)
            ws.write_string(r, 1, label, F(font_size=9.5, font_color=MUTED, indent=1, bottom=1, bottom_color=HAIRLINE))
            vfmt = dict(font_size=9.5, font_color=INK, bottom=1, bottom_color=HAIRLINE, text_wrap=True, indent=1)
            if isinstance(value, date):
                ws.write_datetime(r, 2, value, F(vfmt, num_format=DATE_FMT, align="left"))
            else:
                text = _text(value)
                ws.write_string(r, 2, text or "Not recorded", F(vfmt) if text else F(vfmt, font_color=FAINT))
            r += 1
        ws.set_row(r, 19)
        r += 1
    left_end = r

    # Skills
    r = head
    ws.set_row(r, 22)
    skills = report.skills
    count = f"  ({len(skills)})" if skills else ""
    _put(ws, r, 4, 5, f"Skills{count}", F(font_size=11, bold=True, font_color=INK, bottom=2, bottom_color=PRIMARY))
    r += 1
    if skills is None:
        _put(ws, r, 4, 5, "Skills not available for this employee.", F(font_size=9.5, font_color=MUTED, indent=1))
        r += 1
    elif not skills:
        _put(ws, r, 4, 5, "No skills recorded in HR.", F(font_size=9.5, font_color=MUTED, indent=1))
        r += 1
    else:
        ws.write_string(r, 4, "Skill", F(bold=True, font_size=8.5, font_color=MUTED, indent=1, bottom=1, bottom_color=INK_SOFT))
        ws.write_string(r, 5, "Level", F(bold=True, font_size=8.5, font_color=MUTED, indent=1, bottom=1, bottom_color=INK_SOFT))
        first_skill = r + 1
        r += 1
        ordered = sorted(skills, key=lambda s: (SKILL_ORDER.get(s["level"], 3), s["name"].casefold()))
        for s in ordered:
            if r >= left_end:
                ws.set_row(r, 19)
            rank = SKILL_ORDER.get(s["level"], 3)
            fill, ink = SKILL_COLOURS[rank]
            ws.write_string(r, 4, _text(s["name"]), F(font_size=9.5, font_color=INK if rank < 4 else MUTED, indent=1, bottom=1, bottom_color=HAIRLINE))
            ws.write_string(r, 5, _text(s["level"]), F(font_size=9, bold=rank < 4, bg_color=fill, font_color=ink, align="center", bottom=1, bottom_color=SURFACE, top=1, top_color=SURFACE))
            r += 1
        ws.autofilter(first_skill - 1, 4, r - 1, 5)
    end = max(left_end, r)
    _page_setup(ws, landscape=False)
    ws.print_area(0, 0, end, last)


# --------------------------------------------------------------------------- notes
def _notes(wb, F: _Formats, report: EmployeeReport) -> None:
    ws = wb.add_worksheet("Notes")
    ws.set_tab_color(FAINT)
    ws.set_column(0, 0, 2.5)
    ws.set_column(1, 1, 5)
    ws.set_column(2, 2, 24)
    ws.set_column(3, 3, 90)
    last = 3
    head = _sheet_title(ws, F, report, "Notes and definitions", "How the figures in this workbook are produced", last)
    r = head

    def heading(text: str) -> None:
        nonlocal r
        ws.set_row(r, 22)
        _put(ws, r, 1, last, text, F(font_size=11, bold=True, font_color=INK, bottom=2, bottom_color=PRIMARY))
        r += 1

    def line(label: str, value: str, ink: str = INK_SOFT) -> None:
        nonlocal r
        ws.set_row(r, 32 if len(value) > 95 else 19)
        _put(ws, r, 1, 2, label, F(font_size=9.5, font_color=MUTED, indent=1, bottom=1, bottom_color=HAIRLINE))
        ws.write_string(r, 3, value, F(font_size=9.5, font_color=ink, indent=1, text_wrap=True, bottom=1, bottom_color=HAIRLINE))
        r += 1

    heading("Report details")
    line("Employee", f"{_text(report.profile.get('name'))} ({_text(report.profile.get('code'))})")
    line("Generated", f"{report.generated_at:%d %B %Y, %H:%M} (server time)")
    line("Data source", report.source_label)
    line("Reporting window", f"{report.window_label} ({len(report.months)} months)")
    line("Standard capacity", f"{report.capacity_hours:,.0f} hours a month")
    if report.sample_note:
        line("Sample", report.sample_note, WARNING_INK)
    r += 1

    heading("Availability status")
    for s in e.STATUSES:
        ws.set_row(r, 30)
        fill, ink = STATUS_COLOURS[s]
        ws.write_string(r, 1, STATUS_LETTER[s], F(align="center", bold=True, font_size=10, bg_color=fill, font_color=ink, top=1, top_color=SURFACE, bottom=1, bottom_color=SURFACE))
        ws.write_string(r, 2, s, F(font_size=9.5, bold=True, font_color=INK, indent=1, bottom=1, bottom_color=HAIRLINE))
        ws.write_string(r, 3, STATUS_MEANING[s], F(font_size=9.5, font_color=INK_SOFT, indent=1, text_wrap=True, bottom=1, bottom_color=HAIRLINE))
        r += 1
    line("* Estimated", "Estimated: the month could not be verified, so capacity is assumed at the standard hours and every recorded hour is counted.")
    r += 1

    heading("Columns")
    for label, value in (
        ("Capacity h", "Working hours available in the month. Set only when the employee is matched to an HR record with valid employment dates."),
        ("Planned h", "Verified effort recorded in Project Track for the month."),
        ("Needs review h", "Effort on rows that could not be verified, such as duplicates or rows without a month. Not included in planned hours."),
        ("Free h", "Capacity minus planned hours. Negative values mean the employee is over-allocated."),
        ("Utilisation", "Planned hours divided by capacity."),
        ("Projects", "Distinct projects with a Project Track row for the employee that month."),
        ("Basis", "Verified, Estimated, Unverified, No record (data exists for the month but not for this employee) or No Project Track data."),
    ):
        line(label, value)
    r += 1

    heading("Data quality for this employee")
    line("HR record", _text(report.profile.get("hr_match_status")) or "Not recorded")
    line("Months with records", f"{len(report.records)} of {len(report.months)}")
    line("Estimated months", str(report.estimated_months))
    line("Unverified months", str(report.count_status(e.UNVERIFIED)))
    review_months = sum(1 for m in report.records if m.review)
    line("Months with review hours", str(review_months))
    r += 1

    ws.set_row(r, 32)
    _put(ws, r, 1, last, "Internal and confidential. This workbook contains employee records. Share it only with people who need it, and do not forward it outside the organisation.", F(font_size=9, font_color=WARNING_INK, bg_color=WARNING_SOFT, text_wrap=True, indent=1))
    _page_setup(ws, landscape=False)
    ws.print_area(0, 0, r, last)


# --------------------------------------------------------------------------- entry point
def build_workbook(report: EmployeeReport) -> bytes:
    buffer = io.BytesIO()
    wb = xlsxwriter.Workbook(
        buffer,
        {
            "in_memory": True,
            "strings_to_formulas": False,
            "strings_to_urls": False,
            "strings_to_numbers": False,
            "default_date_format": DATE_FMT,
        },
    )
    name = _text(report.profile.get("name")) or "Employee"
    wb.set_properties({
        "title": f"{name} availability report",
        "subject": f"Availability {report.window_label}",
        "author": "Resource Vision",
        "category": "Internal",
        "keywords": "availability, allocation, resource vision",
        "comments": f"Generated {report.generated_at:%Y-%m-%d %H:%M} from {report.source_label}.",
        "created": report.generated_at,
    })
    wb.set_size(1600, 1000)
    F = _Formats(wb)

    # ChartData must exist before the chart references it; it is hidden and placed last in the tab order
    # visually by being added after Overview's content refers to it by name.
    chart_name = "ChartData"
    _overview(wb, F, report, chart_name)
    _monthly(wb, F, report)
    _projects(wb, F, report)
    _details(wb, F, report)
    _profile(wb, F, report)
    _notes(wb, F, report)
    _chart_data(wb, F, report)
    wb.close()
    return buffer.getvalue()
