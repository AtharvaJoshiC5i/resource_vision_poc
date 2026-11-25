"""Client one-pager (.pptx): one 16:9 slide per employee.

Deliberately simple, because the team's own template will replace the styling later. It shows
only what is safe to send to a client: no hours, client or project names, email, manager, exit
dates or data-quality flags. Availability is rounded to whole percentages and estimated months
read "Tentative".
"""

from __future__ import annotations

import io

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

from app.rv import engine as e
from app.rv.exports.report import EmployeeReport, MonthLine

FONT = "Inter"
MONTHS_SHOWN = 6
SKILLS_SHOWN = 10


def _rgb(hex_colour: str) -> RGBColor:
    return RGBColor.from_string(hex_colour.lstrip("#"))


INDIGO = _rgb("#420897")
PRIMARY = _rgb("#6800E0")
LAVENDER = _rgb("#BC9BEC")
HEADER_TINT = _rgb("#E9DDFB")
INK = _rgb("#0C0C0C")
INK_SOFT = _rgb("#242424")
MUTED = _rgb("#6E6E6E")
HAIRLINE = _rgb("#E6E6EB")
CANVAS = _rgb("#F3F3F6")
WHITE = _rgb("#FFFFFF")

BANDS = {  # client-facing wording and colours (fill, text)
    "available": ("Available", _rgb("#E4F5E4"), _rgb("#0B650D")),
    "partial": ("Partially available", _rgb("#EEE3FC"), PRIMARY),
    "committed": ("Committed", _rgb("#EEE5FA"), INDIGO),
    "tentative": ("Tentative", _rgb("#FCEEE4"), _rgb("#8D4B1F")),
    "unknown": ("To be confirmed", CANVAS, MUTED),
}


def _band(m: MonthLine) -> tuple[str, int | None]:
    """Client band and rounded free percentage for one month."""
    if not m.present or m.free is None or not m.capacity:
        return "unknown", None
    pct = max(0, min(100, round(m.free / m.capacity * 100)))
    if m.estimated or m.status == e.UNVERIFIED:
        return "tentative", pct
    if m.status == e.FULLY_AVAILABLE or pct >= 95:
        return "available", pct
    if pct <= 0:
        return "committed", 0
    return "partial", pct


def _text(frame, text: str, *, size: float, colour: RGBColor, bold: bool = False, align=PP_ALIGN.LEFT, first: bool = True):
    para = frame.paragraphs[0] if first else frame.add_paragraph()
    para.alignment = align
    run = para.add_run()
    run.text = text
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = colour
    return para


def _box(slide, left, top, width, height, *, fill: RGBColor | None = None, line: RGBColor | None = None, shape=MSO_SHAPE.RECTANGLE, radius: float | None = None):
    shp = slide.shapes.add_shape(shape, left, top, width, height)
    if radius is not None and shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        shp.adjustments[0] = radius
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(0.75)
    shp.shadow.inherit = False
    tf = shp.text_frame
    tf.margin_left = tf.margin_right = Inches(0.12)
    tf.margin_top = tf.margin_bottom = Inches(0.06)
    tf.word_wrap = True
    return shp


def _label(slide, left, top, width, height, text: str, *, size: float, colour: RGBColor, bold: bool = False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = 0
    tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    _text(tf, text, size=size, colour=colour, bold=bold, align=align)
    return tb


def _years(months: int | None) -> str | None:
    if months is None:
        return None
    years, rem = divmod(int(months), 12)
    if years == 0:
        return f"{rem} months"
    return f"{years}.{rem * 10 // 12} years" if rem else f"{years} years"


def build_slide(report: EmployeeReport) -> bytes:
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
    p = report.profile
    W, H = prs.slide_width, prs.slide_height

    # ------------------------------------------------------------------ left panel: who
    panel_w = Inches(4.35)
    _box(slide, 0, 0, panel_w, H, fill=INDIGO)
    _box(slide, panel_w, 0, Inches(0.06), H, fill=PRIMARY)
    x = Inches(0.55)
    inner = panel_w - Inches(1.0)
    _label(slide, x, Inches(0.6), inner, Inches(0.3), "Consultant profile", size=11, colour=LAVENDER)
    _label(slide, x, Inches(0.95), inner, Inches(1.2), str(p.get("name") or "Employee"), size=30, colour=WHITE, bold=True)
    role = "  |  ".join(str(v) for v in (p.get("grade"), p.get("primary_capability")) if v)
    _label(slide, x, Inches(2.2), inner, Inches(0.6), role, size=13, colour=HEADER_TINT)

    facts = [
        ("Practice", " / ".join(str(v) for v in (p.get("primary_capability"), p.get("secondary_capability")) if v)),
        ("Business vertical", p.get("business_vertical")),
        ("Location", ", ".join(str(v) for v in (p.get("location"), p.get("country")) if v)),
        ("With the company", _years(p.get("tenure_months"))),
        ("Employment type", p.get("employment_type")),
    ]
    y = Inches(3.2)
    _box(slide, x, y - Inches(0.25), inner, Emu(9525), fill=PRIMARY)
    for label, value in facts:
        if not value:
            continue
        _label(slide, x, y, inner, Inches(0.25), label, size=9.5, colour=LAVENDER)
        _label(slide, x, y + Inches(0.24), inner, Inches(0.35), str(value), size=12.5, colour=WHITE)
        y += Inches(0.68)

    # ------------------------------------------------------------------ right: availability
    left = panel_w + Inches(0.6)
    right_w = W - left - Inches(0.55)
    _label(slide, left, Inches(0.6), right_w, Inches(0.45), "Availability outlook", size=22, colour=INK, bold=True)
    months = report.months[:MONTHS_SHOWN]
    span = f"{months[0].label} to {months[-1].label}" if months else ""
    _label(slide, left, Inches(1.08), right_w, Inches(0.3), f"Share of monthly capacity free  |  {span}", size=11, colour=MUTED)

    gap = Inches(0.14)
    count = max(len(months), 1)
    tile_w = int((right_w - gap * (count - 1)) / count)
    tile_h = Inches(1.55)
    top = Inches(1.6)
    for i, m in enumerate(months):
        band, pct = _band(m)
        name, fill, ink = BANDS[band]
        tx = left + i * (tile_w + gap)
        tile = _box(slide, tx, top, tile_w, tile_h, fill=fill, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08)
        tf = tile.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        _text(tf, m.label, size=10.5, colour=ink, align=PP_ALIGN.CENTER)
        _text(tf, f"{pct}%" if pct is not None else "TBC", size=26, colour=ink, bold=True, align=PP_ALIGN.CENTER, first=False)
        _text(tf, name, size=9.5, colour=ink, align=PP_ALIGN.CENTER, first=False)

    # Key facts
    nxt = report.next_available
    current = report.months[0] if report.months else None
    current_band, current_pct = _band(current) if current else ("unknown", None)
    allocation = f"{100 - current_pct}%" if current_pct is not None else "To be confirmed"
    ahead = [_band(m)[1] for m in report.months[:3]]
    known = [v for v in ahead if v is not None]
    outlook = f"{round(sum(known) / len(known))}%" if known else "To be confirmed"
    facts_row = [
        ("Next available", nxt.label if nxt else "To be confirmed"),
        ("Current allocation", allocation),
        ("Average free, next 3 months", outlook),
    ]
    fy = top + tile_h + Inches(0.45)
    col_w = int((right_w - gap * 2) / 3)
    for i, (label, value) in enumerate(facts_row):
        fx = left + i * (col_w + gap)
        _box(slide, fx, fy, col_w, Emu(19050), fill=PRIMARY)
        _label(slide, fx, fy + Inches(0.14), col_w, Inches(0.25), label, size=10, colour=MUTED)
        _label(slide, fx, fy + Inches(0.42), col_w, Inches(0.5), value, size=20, colour=INK, bold=True)

    # Skills
    sy = fy + Inches(1.25)
    _label(slide, left, sy, right_w, Inches(0.35), "Key skills", size=14, colour=INK, bold=True)
    rank = {"Expert": 0, "Advanced": 0, "Intermediate": 1, "Beginner": 2}
    skills = sorted(
        (s for s in (report.skills or []) if s.get("level") in rank),
        key=lambda s: (rank[s["level"]], s["name"].casefold()),
    )[:SKILLS_SHOWN]
    cx, cy = left, sy + Inches(0.48)
    chip_h = Inches(0.36)
    if not skills:
        _label(slide, left, cy, right_w, Inches(0.3), "Skills available on request", size=11, colour=MUTED)
    for s in skills:
        width = Inches(0.32 + 0.085 * len(s["name"]) + 0.09 * len(s["level"]))
        if cx + width > left + right_w:
            cx = left
            cy += chip_h + Inches(0.12)
        chip = _box(slide, cx, cy, width, chip_h, fill=CANVAS if rank[s["level"]] else _rgb("#EEE3FC"), shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
        tf = chip.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        para = _text(tf, s["name"], size=10.5, colour=INK_SOFT, bold=True, align=PP_ALIGN.CENTER)
        run = para.add_run()
        run.text = f"  {s['level']}"
        run.font.name = FONT
        run.font.size = Pt(9)
        run.font.color.rgb = MUTED
        cx += width + Inches(0.1)

    # Footer
    _box(slide, left, H - Inches(0.62), right_w, Emu(9525), fill=HAIRLINE)
    _label(
        slide, left, H - Inches(0.5), right_w, Inches(0.3),
        f"Prepared {report.generated_at:%d %B %Y}. Availability is indicative and subject to confirmation.",
        size=9, colour=MUTED,
    )

    props = prs.core_properties
    props.title = f"{p.get('name') or 'Employee'} profile"
    props.author = "Resource Vision"
    props.subject = "Consultant profile and availability"
    buffer = io.BytesIO()
    prs.save(buffer)
    return buffer.getvalue()
