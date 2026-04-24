#!/usr/bin/env python3
"""
Snappy Landscaping — Proposal PDF Generator
Called by the Node.js backend via: python3 generate_proposal.py <json_input_file> <output_pdf>
"""
import sys
import json
import os
import re
from pathlib import Path

# ── deps ─────────────────────────────────────────────────────────────────────
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus.flowables import HRFlowable
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage

# ── paths ─────────────────────────────────────────────────────────────────────
ASSETS = Path(__file__).parent / "assets"
LOGO_FULL   = str(ASSETS / "logo_transparent.png")
LOGO_WORD   = str(ASSETS / "wordmark_transparent.png")
IMG_CONCEPT = str(ASSETS / "concept_render.jpeg")
FONT_BOLD   = str(ASSETS / "WorkSans-Bold.ttf")
FONT_BODY   = str(ASSETS / "Inter.ttf")

# ── brand colors ──────────────────────────────────────────────────────────────
SNAPPY_YELLOW = HexColor("#F5C518")
SNAPPY_GREEN  = HexColor("#3CB33C")
SNAPPY_BLUE   = HexColor("#1E5BBD")
DARK          = HexColor("#0D1A10")
CHARCOAL      = HexColor("#1E2321")
MID_GREEN     = HexColor("#2E5E34")
LIGHT_GRAY    = HexColor("#F4F4F4")
TEXT_DARK     = HexColor("#1A1A1A")
TEXT_MID      = HexColor("#4A4A4A")
TEXT_LIGHT    = HexColor("#888888")

W, H = letter  # 8.5 x 11 inches

# ── font registration ─────────────────────────────────────────────────────────
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def register_fonts():
    try:
        pdfmetrics.registerFont(TTFont("WorkSans-Bold", FONT_BOLD))
        pdfmetrics.registerFont(TTFont("Inter", FONT_BODY))
    except Exception as e:
        print(f"Font warning: {e}", file=sys.stderr)

# ── helpers ───────────────────────────────────────────────────────────────────
def draw_brand_stripe(c):
    """Yellow top stripe on every page."""
    c.setFillColor(SNAPPY_YELLOW)
    c.rect(0, H - 5, W, 5, fill=1, stroke=0)

def draw_wordmark(c):
    """Wordmark top-right on every interior page."""
    try:
        wm_h = 0.45 * inch
        wm_img = PILImage.open(LOGO_WORD)
        ww, wh = wm_img.size
        wm_w = wm_h * (ww / wh)
        c.drawImage(LOGO_WORD, W - 0.45 * inch - wm_w, H - 0.38 * inch - wm_h,
                    wm_w, wm_h, preserveAspectRatio=True, mask='auto')
    except Exception as ex:
        c.setFillColor(SNAPPY_GREEN)
        c.setFont("WorkSans-Bold", 9)
        c.drawRightString(W - 0.5 * inch, H - 0.6 * inch, "SNAPPY LANDSCAPING")

def draw_footer(c, company_info):
    c.setFillColor(CHARCOAL)
    c.rect(0, 0, W, 0.55 * inch, fill=1, stroke=0)
    c.setFillColor(HexColor("#AAAAAA"))
    c.setFont("Inter", 7.5)
    c.drawString(0.6 * inch, 0.22 * inch,
        f"Snappy Landscaping  ·  {company_info['phone']}  ·  {company_info['email']}")
    c.setFillColor(SNAPPY_YELLOW)
    c.drawRightString(W - 0.6 * inch, 0.22 * inch, company_info['website'])

# ── cover page ────────────────────────────────────────────────────────────────
def draw_cover(c, doc, data, company):
    c.saveState()
    # Dark base
    c.setFillColor(DARK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # Concept image
    try:
        cover_img = data.get("cover_image", IMG_CONCEPT)
        if not cover_img or not os.path.exists(cover_img):
            cover_img = IMG_CONCEPT
        ir = ImageReader(cover_img)
        iw, ih = ir.getSize()
        scale = max(W / iw, H / ih)
        nw, nh = iw * scale, ih * scale
        c.drawImage(cover_img, (W - nw)/2, (H - nh)/2, nw, nh, preserveAspectRatio=False)
    except Exception as ex:
        pass
    # Overlays
    from reportlab.lib.colors import Color
    c.setFillColor(Color(0.05, 0.1, 0.07, alpha=0.50))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(Color(0.06, 0.09, 0.07, alpha=0.93))
    c.rect(0, 0, W, H * 0.42, fill=1, stroke=0)
    c.setFillColor(DARK)
    c.rect(0, 0, W, H * 0.30, fill=1, stroke=0)

    # Yellow stripe
    draw_brand_stripe(c)

    # Logo + contact row
    row_center_y = H - 0.75 * inch
    logo_h = 0.85 * inch
    logo_y = row_center_y - logo_h / 2
    logo_w_px = logo_h
    try:
        logo_img = PILImage.open(LOGO_FULL)
        lw, lh = logo_img.size
        logo_w_px = logo_h * (lw / lh)
        c.drawImage(LOGO_FULL, 0.45 * inch, logo_y,
                    logo_w_px, logo_h, preserveAspectRatio=True, mask='auto')
    except Exception:
        c.setFillColor(white)
        c.setFont("WorkSans-Bold", 10)
        c.drawString(0.6 * inch, row_center_y - 5, "SNAPPY LANDSCAPING")
    font_size = 8.5
    line_gap = font_size * 1.55
    contact_x = 0.45 * inch + logo_w_px + 0.18 * inch
    email_y = row_center_y + line_gap / 2 - 2
    phone_y = email_y - line_gap
    c.setFillColor(SNAPPY_YELLOW)
    c.setFont("Inter", font_size)
    c.drawString(contact_x, email_y, company['email'])
    c.drawString(contact_x, phone_y, company['phone'])

    # Proposal label
    c.setFillColor(SNAPPY_GREEN)
    c.setFont("WorkSans-Bold", 9)
    c.drawString(0.6 * inch, H * 0.53 + 0.15 * inch, "LANDSCAPE PROPOSAL")

    # Divider
    c.setStrokeColor(SNAPPY_YELLOW)
    c.setLineWidth(1.5)
    c.line(0.6 * inch, H * 0.53 + 0.08 * inch, W - 0.6 * inch, H * 0.53 + 0.08 * inch)

    # Title
    c.setFillColor(white)
    c.setFont("WorkSans-Bold", 26)
    c.drawString(0.6 * inch, H * 0.53 - 0.20 * inch, "Landscape Transformation")
    c.setFont("WorkSans-Bold", 18)
    c.setFillColor(SNAPPY_YELLOW)
    c.drawString(0.6 * inch, H * 0.53 - 0.48 * inch, "Decision Kit")

    # Client block
    client_y = H * 0.365
    c.setFillColor(SNAPPY_GREEN)
    c.setFont("WorkSans-Bold", 8)
    c.drawString(0.6 * inch, client_y, "PREPARED FOR")
    c.setFillColor(white)
    c.setFont("WorkSans-Bold", 16)
    c.drawString(0.6 * inch, client_y - 0.25 * inch, data['client_name'])
    c.setFillColor(HexColor("#BBBBBB"))
    c.setFont("Inter", 9)
    c.drawString(0.6 * inch, client_y - 0.45 * inch, data['client_address'])
    c.drawString(0.6 * inch, client_y - 0.6 * inch, data['client_phone'])

    # Est number + date bottom-right
    c.setFillColor(HexColor("#888888"))
    c.setFont("Inter", 7.5)
    c.drawRightString(W - 0.6 * inch, 0.75 * inch, f"Estimate #{data['estimate_number']}")
    import datetime
    c.drawRightString(W - 0.6 * inch, 0.62 * inch,
                      datetime.date.today().strftime("%B %d, %Y"))

    c.restoreState()

# ── later pages ───────────────────────────────────────────────────────────────
def later_page(c, doc, company):
    c.saveState()
    draw_brand_stripe(c)
    draw_wordmark(c)
    draw_footer(c, company)
    c.restoreState()

# ── styles ────────────────────────────────────────────────────────────────────
def make_styles():
    styles = getSampleStyleSheet()
    def s(name, **kw):
        return ParagraphStyle(name, **kw)

    body   = s("SnBody",   fontName="Inter", fontSize=9.5, leading=15, textColor=TEXT_DARK, spaceAfter=6)
    body_m = s("SnBodyM",  fontName="Inter", fontSize=9.5, leading=15, textColor=TEXT_MID, spaceAfter=4)
    h2     = s("SnH2",     fontName="WorkSans-Bold", fontSize=14, textColor=TEXT_DARK, spaceBefore=8, spaceAfter=4)
    h3     = s("SnH3",     fontName="WorkSans-Bold", fontSize=10.5, textColor=MID_GREEN, spaceBefore=6, spaceAfter=3)
    label  = s("SnLabel",  fontName="WorkSans-Bold", fontSize=7.5, textColor=TEXT_LIGHT, spaceAfter=2)
    bullet = s("SnBullet", fontName="Inter", fontSize=9, leading=14, textColor=TEXT_DARK,
                leftIndent=12, spaceAfter=3, bulletIndent=0)
    center = s("SnCenter", fontName="Inter", fontSize=9, leading=14, textColor=TEXT_MID,
                alignment=TA_CENTER, spaceAfter=4)
    return dict(body=body, body_m=body_m, h2=h2, h3=h3, label=label, bullet=bullet, center=center)

# ── section header ────────────────────────────────────────────────────────────
def section_header(title, st):
    elems = []
    elems.append(Paragraph(title, st['h2']))
    elems.append(HRFlowable(width="100%", thickness=2, color=SNAPPY_GREEN, spaceAfter=8))
    return elems

# ── image helper ─────────────────────────────────────────────────────────────
def img_flowable(path, max_w, max_h):
    from reportlab.platypus import Image as RLImage
    try:
        im = PILImage.open(path)
        iw, ih = im.size
        scale = min(max_w / iw, max_h / ih)
        return RLImage(path, width=iw * scale, height=ih * scale)
    except Exception:
        return Spacer(1, 0.1 * inch)

# ── build PDF ────────────────────────────────────────────────────────────────
def build_pdf(data: dict, output_path: str, company: dict):
    register_fonts()
    st = make_styles()

    # Flowables list
    story = []

    # ── 1. Cover (handled by onFirstPage) ──
    story.append(PageBreak())  # placeholder to trigger cover

    # ── 2. Project Vision ──
    story += section_header("Project Vision", st)
    story.append(Paragraph(
        data.get("project_vision",
            f"We are excited to present this comprehensive landscape transformation plan for "
            f"{data['client_name']}. Our team has carefully assessed the existing conditions at "
            f"{data['client_address']} and designed a solution that will dramatically enhance "
            f"the beauty, function, and long-term value of your property."),
        st['body']))
    story.append(Spacer(1, 0.15 * inch))

    # Vision goals checklist
    goals = data.get("vision_goals", [
        "Eliminate erosion and slope instability",
        "Create a safe, structured outdoor environment",
        "Install premium hardscape that lasts for decades",
        "Enhance curb appeal and property value",
        "Provide a low-maintenance, beautiful landscape",
    ])
    for g in goals:
        story.append(Paragraph(f"✓  {g}", st['bullet']))
    story.append(Spacer(1, 0.2 * inch))

    # ── 3. Existing Issues ──
    story += section_header("Existing Conditions", st)
    story.append(Paragraph(
        data.get("existing_issues_text",
            "The following before photos document the current site conditions that we will address "
            "through this project."),
        st['body_m']))
    story.append(Spacer(1, 0.1 * inch))

    before_photos = data.get("before_photos", [])
    if before_photos:
        # Display up to 2 before photos side by side
        max_photo_w = (W - 1.2 * inch - 0.2 * inch) / min(len(before_photos), 2)
        max_photo_h = 2.5 * inch
        cells = [img_flowable(p, max_photo_w, max_photo_h) for p in before_photos[:2]]
        if len(cells) == 2:
            t = Table([cells], colWidths=[max_photo_w + 0.1*inch] * 2)
            t.setStyle(TableStyle([
                ("ALIGN", (0,0), (-1,-1), "CENTER"),
                ("VALIGN", (0,0), (-1,-1), "TOP"),
                ("LEFTPADDING", (0,0), (-1,-1), 4),
                ("RIGHTPADDING", (0,0), (-1,-1), 4),
            ]))
            story.append(t)
        else:
            story.append(cells[0])
        # Additional before photos
        for ph in before_photos[2:]:
            story.append(img_flowable(ph, W - 1.2*inch, 2.5*inch))
        story.append(Spacer(1, 0.1 * inch))
        story.append(Paragraph("Before — Existing site conditions documented on-site.", st['center']))

    story.append(PageBreak())

    # ── 4. Concept / Design ──
    story += section_header("Concept & Design", st)
    story.append(Paragraph(
        data.get("concept_text",
            "Our design delivers a premium landscape solution tailored specifically to your property. "
            "The rendering below illustrates the finished result — a clean, structured, and beautiful "
            "outdoor space you'll be proud to call yours."),
        st['body']))
    story.append(Spacer(1, 0.1 * inch))

    concept_img = data.get("concept_image", IMG_CONCEPT if os.path.exists(IMG_CONCEPT) else None)
    if concept_img and os.path.exists(concept_img):
        story.append(img_flowable(concept_img, W - 1.2 * inch, 3.0 * inch))
        story.append(Spacer(1, 0.08 * inch))
        story.append(Paragraph("Design concept — your completed transformation.", st['center']))

    # After photos if provided
    after_photos = data.get("after_photos", [])
    if after_photos:
        story.append(Spacer(1, 0.15 * inch))
        story.append(Paragraph("Completed Work", st['h3']))
        max_aw = (W - 1.2 * inch - 0.2 * inch) / min(len(after_photos), 2)
        max_ah = 2.2 * inch
        cells = [img_flowable(p, max_aw, max_ah) for p in after_photos[:2]]
        if len(cells) == 2:
            t = Table([cells], colWidths=[max_aw + 0.1*inch]*2)
            t.setStyle(TableStyle([
                ("ALIGN", (0,0),(-1,-1),"CENTER"),
                ("VALIGN",(0,0),(-1,-1),"TOP"),
                ("LEFTPADDING",(0,0),(-1,-1),4),
                ("RIGHTPADDING",(0,0),(-1,-1),4),
            ]))
            story.append(t)
        else:
            story.append(cells[0])

    story.append(PageBreak())

    # ── 5. Scope of Work ──
    story += section_header("Scope of Work", st)
    story.append(Paragraph(
        "Every task below is included in your single all-inclusive investment.",
        st['body_m']))
    story.append(Spacer(1, 0.1 * inch))

    scope_items = data.get("scope_items", [])
    if isinstance(scope_items, str):
        scope_items = json.loads(scope_items)

    # Group by phase/category
    phases: dict = {}
    ungrouped = []
    for item in scope_items:
        phase = item.get("phase", item.get("category", ""))
        if phase:
            phases.setdefault(phase, []).append(item)
        else:
            ungrouped.append(item)

    def render_scope_group(title, items, cost=None):
        elems = []
        # Phase header bar
        header_data = [[Paragraph(f"  {title.upper()}", ParagraphStyle("ph",
            fontName="WorkSans-Bold", fontSize=9, textColor=SNAPPY_YELLOW, leading=12))]]
        if cost:
            header_data[0].append(Paragraph(cost, ParagraphStyle("pc",
                fontName="WorkSans-Bold", fontSize=9, textColor=SNAPPY_YELLOW,
                leading=12, alignment=TA_RIGHT)))
        col_widths = [W - 1.2*inch - (1.1*inch if cost else 0), 1.1*inch] if cost else [W - 1.2*inch]
        ht = Table(header_data, colWidths=col_widths)
        ht.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), MID_GREEN),
            ("TOPPADDING",  (0,0),(-1,-1), 5),
            ("BOTTOMPADDING",(0,0),(-1,-1), 5),
            ("LEFTPADDING", (0,0),(-1,-1), 6),
            ("RIGHTPADDING",(0,0),(-1,-1), 6),
            ("VALIGN",      (0,0),(-1,-1), "MIDDLE"),
        ]))
        elems.append(ht)
        # Items
        rows = []
        for it in items:
            desc = it.get("description", it.get("name", str(it)))
            qty  = it.get("quantity", "")
            price= it.get("price", it.get("unit_price", ""))
            rows.append([
                Paragraph(desc, ParagraphStyle("si", fontName="Inter", fontSize=8.5,
                    leading=13, textColor=TEXT_DARK)),
                Paragraph(str(qty),   ParagraphStyle("sq", fontName="Inter", fontSize=8.5,
                    leading=13, textColor=TEXT_MID, alignment=TA_CENTER)),
                Paragraph(str(price), ParagraphStyle("sp", fontName="Inter", fontSize=8.5,
                    leading=13, textColor=TEXT_MID, alignment=TA_RIGHT)),
            ])
        if rows:
            dt = Table(rows, colWidths=[W - 1.2*inch - 1.6*inch, 0.7*inch, 0.9*inch])
            dt.setStyle(TableStyle([
                ("BACKGROUND", (0,0),(-1,-1), white),
                ("ROWBACKGROUNDS",(0,0),(-1,-1),[white, LIGHT_GRAY]),
                ("TOPPADDING",(0,0),(-1,-1),4),
                ("BOTTOMPADDING",(0,0),(-1,-1),4),
                ("LEFTPADDING",(0,0),(0,-1),8),
                ("RIGHTPADDING",(0,0),(-1,-1),6),
                ("VALIGN",(0,0),(-1,-1),"TOP"),
                ("LINEBELOW",(0,0),(-1,-1),0.25,HexColor("#DDDDDD")),
            ]))
            elems.append(dt)
        elems.append(Spacer(1, 0.12 * inch))
        return elems

    if phases:
        for phase_name, items in phases.items():
            story += render_scope_group(phase_name, items)
    elif ungrouped:
        story += render_scope_group("Scope of Work", ungrouped)

    story.append(PageBreak())

    # ── 6. Materials ──
    story += section_header("Materials & Quality Standards", st)
    materials = data.get("materials", [
        ("Hardscape", "Premium retaining wall blocks, natural stone capstones, high-strength concrete — commercial grade for residential applications."),
        ("Drainage", "Perforated pipe, filter fabric, clean aggregate — engineered to handle maximum water flow."),
        ("Plantings", "Nursery-certified plants selected for your USDA zone, soil type, and sun exposure."),
        ("Mulch & Topsoil", "Premium double-shredded hardwood mulch, screened topsoil with appropriate amendment mix."),
    ])
    for mat_name, mat_desc in materials:
        story.append(Paragraph(mat_name, st['h3']))
        story.append(Paragraph(mat_desc, st['body_m']))
        story.append(Spacer(1, 0.06 * inch))

    story.append(PageBreak())

    # ── 7. Investment ──
    story += section_header("Your Investment", st)

    # Single investment box
    inv_total  = data['estimate_total']
    subtotal   = data.get('subtotal', '')
    tax        = data.get('tax', '')
    pay_sched  = data.get('payment_schedule', [])
    if isinstance(pay_sched, str):
        pay_sched = json.loads(pay_sched)

    # Dark investment card
    card_w = W - 1.2 * inch
    card_h_header = 0.55 * inch

    # Header row
    header_row = [[
        Paragraph("LANDSCAPE TRANSFORMATION", ParagraphStyle("ih",
            fontName="WorkSans-Bold", fontSize=11, textColor=white, leading=14)),
        Paragraph(inv_total, ParagraphStyle("ip",
            fontName="WorkSans-Bold", fontSize=18, textColor=SNAPPY_YELLOW,
            leading=20, alignment=TA_RIGHT)),
    ]]
    ht = Table(header_row, colWidths=[card_w * 0.55, card_w * 0.45])
    ht.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), CHARCOAL),
        ("TOPPADDING",(0,0),(-1,-1),12),
        ("BOTTOMPADDING",(0,0),(-1,-1),12),
        ("LEFTPADDING",(0,0),(0,0),14),
        ("RIGHTPADDING",(0,0),(-1,-1),14),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]))
    story.append(ht)

    # Body: checklist
    includes = data.get("investment_includes", [
        "Full scope of work as detailed above",
        "All materials, equipment, and labor",
        "Licensed and insured crew",
        "Site cleanup upon completion",
        "1-year workmanship warranty",
        "Project management & communication",
    ])
    body_rows = [[Paragraph(f"✓  {inc}", ParagraphStyle("inc",
        fontName="Inter", fontSize=9, leading=14, textColor=white))]
        for inc in includes]
    bt = Table(body_rows, colWidths=[card_w])
    bt.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), MID_GREEN),
        ("TOPPADDING",(0,0),(-1,-1),5),
        ("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),14),
        ("RIGHTPADDING",(0,0),(-1,-1),14),
        ("LINEBELOW",(0,0),(-1,-1),0.25,HexColor("#3E7A44")),
    ]))
    story.append(bt)

    # Sub/tax row
    if subtotal or tax:
        sub_row = [[
            Paragraph("Subtotal", ParagraphStyle("sl", fontName="Inter", fontSize=8.5, textColor=HexColor("#CCCCCC"), leading=12)),
            Paragraph(subtotal,   ParagraphStyle("sv", fontName="WorkSans-Bold", fontSize=8.5, textColor=white, leading=12, alignment=TA_RIGHT)),
        ],[
            Paragraph("PA Sales Tax", ParagraphStyle("tl", fontName="Inter", fontSize=8.5, textColor=HexColor("#CCCCCC"), leading=12)),
            Paragraph(tax,            ParagraphStyle("tv", fontName="WorkSans-Bold", fontSize=8.5, textColor=white, leading=12, alignment=TA_RIGHT)),
        ]]
        st2 = Table(sub_row, colWidths=[card_w*0.6, card_w*0.4])
        st2.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1), CHARCOAL),
            ("TOPPADDING",(0,0),(-1,-1),5),
            ("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),14),
            ("RIGHTPADDING",(0,0),(-1,-1),14),
        ]))
        story.append(st2)

    story.append(Spacer(1, 0.25 * inch))

    # Payment schedule
    if pay_sched:
        story.append(Paragraph("Payment Schedule", st['h3']))
        sched_rows = [["Milestone", "Amount", "Due"]]
        for p in pay_sched:
            sched_rows.append([
                p.get("name", p.get("description", "")),
                p.get("amount", ""),
                p.get("due", p.get("when", "")),
            ])
        sched_t = Table(sched_rows, colWidths=[card_w*0.5, card_w*0.25, card_w*0.25])
        sched_t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,0), CHARCOAL),
            ("TEXTCOLOR",(0,0),(-1,0), SNAPPY_YELLOW),
            ("FONTNAME",(0,0),(-1,0), "WorkSans-Bold"),
            ("FONTSIZE",(0,0),(-1,0), 8),
            ("FONTNAME",(0,1),(-1,-1), "Inter"),
            ("FONTSIZE",(0,1),(-1,-1), 8.5),
            ("TEXTCOLOR",(0,1),(-1,-1), TEXT_DARK),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),[white, LIGHT_GRAY]),
            ("TOPPADDING",(0,0),(-1,-1),5),
            ("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),8),
            ("RIGHTPADDING",(0,0),(-1,-1),8),
            ("GRID",(0,0),(-1,-1),0.3,HexColor("#DDDDDD")),
        ]))
        story.append(sched_t)

    story.append(PageBreak())

    # ── 8. Why Snappy + Next Steps ──
    story += section_header("Why Choose Snappy Landscaping", st)
    why_points = data.get("why_points", [
        ("Licensed & Insured", "Full liability coverage and workers' comp — protecting you and your property throughout the project."),
        ("Local Expertise", "Based in Lancaster County, we know the soil, climate, and code requirements that matter for your project."),
        ("Proven Results", "We've transformed hundreds of properties across Central PA with the same quality-first approach."),
        ("Transparent Pricing", "No hidden fees. No surprises. The price you see is the price you pay."),
        ("Warranty Included", "Every project comes with a 1-year workmanship warranty — we stand behind our work."),
    ])
    for title_w, desc_w in why_points:
        story.append(Paragraph(title_w, st['h3']))
        story.append(Paragraph(desc_w, st['body_m']))
        story.append(Spacer(1, 0.06 * inch))

    story.append(Spacer(1, 0.2 * inch))
    story += section_header("Next Steps", st)
    next_steps = data.get("next_steps", [
        "Review this proposal and ask any questions",
        "Approve and sign to reserve your spot on our schedule",
        "Submit the approval deposit to lock in your project start date",
        "We'll confirm your start date and project timeline",
        "Sit back — we handle everything from here",
    ])
    for i, step in enumerate(next_steps, 1):
        story.append(Paragraph(f"{i}.  {step}", st['bullet']))

    story.append(Spacer(1, 0.25 * inch))
    story.append(Paragraph(
        data.get("closing",
            f"Questions? Call or text us anytime: {company['phone']}  ·  {company['email']}"),
        ParagraphStyle("closing", fontName="WorkSans-Bold", fontSize=9.5,
                       textColor=SNAPPY_GREEN, leading=14, alignment=TA_CENTER)))

    # ── Build ─────────────────────────────────────────────────────────────────
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.7 * inch,
    )

    # Closures for page callbacks
    _data    = data
    _company = company

    def on_first_page(c, doc):
        draw_cover(c, doc, _data, _company)

    def on_later_pages(c, doc):
        later_page(c, doc, _company)

    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)
    print(f"Done: {output_path}")

# ── entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: generate_proposal.py <input.json> <output.pdf>", file=sys.stderr)
        sys.exit(1)

    input_file  = sys.argv[1]
    output_file = sys.argv[2]

    with open(input_file) as f:
        payload = json.load(f)

    data    = payload["data"]
    company = payload.get("company", {
        "email":   "admin@snappylandscaping.com",
        "phone":   "(717) 449-6660",
        "website": "snappylandscaping.com",
    })

    build_pdf(data, output_file, company)
