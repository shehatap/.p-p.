#!/usr/bin/env python3
"""
Parse a Snappy Landscaping estimate PDF and extract structured data as JSON.
Usage: python3 parse_estimate.py <estimate.pdf>
Outputs JSON to stdout.
"""
import sys
import json
import re

try:
    import pdfplumber
    USE_PDFPLUMBER = True
except ImportError:
    USE_PDFPLUMBER = False

try:
    import pdfminer
    from pdfminer.high_level import extract_text as pdfminer_extract
    USE_PDFMINER = True
except ImportError:
    USE_PDFMINER = False


def extract_text(pdf_path: str) -> str:
    if USE_PDFPLUMBER:
        import pdfplumber
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
        return text
    elif USE_PDFMINER:
        return pdfminer_extract(pdf_path)
    else:
        # Fallback: pypdf
        try:
            from pypdf import PdfReader
            reader = PdfReader(pdf_path)
            return "\n".join(p.extract_text() or "" for p in reader.pages)
        except Exception:
            return ""


def parse_estimate(pdf_path: str) -> dict:
    text = extract_text(pdf_path)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    full  = text

    result = {
        "client_name": "",
        "client_address": "",
        "client_phone": "",
        "estimate_number": "",
        "estimate_total": "",
        "subtotal": "",
        "tax": "",
        "payment_schedule": [],
        "scope_items": [],
        "raw_text": full[:3000],  # for debugging
    }

    # ── Estimate number ───────────────────────────────────────────────────────
    m = re.search(r"EST[-\s]?(\d+)", full, re.IGNORECASE)
    if m:
        result["estimate_number"] = "EST-" + m.group(1)

    # ── Money patterns ────────────────────────────────────────────────────────
    money_re = re.compile(r"\$[\d,]+\.\d{2}")

    # ── Totals ────────────────────────────────────────────────────────────────
    for line in lines:
        ll = line.lower()
        if "subtotal" in ll:
            m = money_re.search(line)
            if m: result["subtotal"] = m.group(0)
        if ("tax" in ll or "sales tax" in ll) and "subtotal" not in ll:
            m = money_re.search(line)
            if m: result["tax"] = m.group(0)
        if re.search(r"\btotal\b", ll) and "subtotal" not in ll:
            m = money_re.search(line)
            if m and not result["estimate_total"]:
                result["estimate_total"] = m.group(0)

    # ── Payment schedule ──────────────────────────────────────────────────────
    pay_keywords = ["payment plan", "deposit", "spot on schedule", "completion",
                    "upon approval", "on approval", "on completion", "due on"]
    for line in lines:
        ll = line.lower()
        if any(kw in ll for kw in pay_keywords):
            m = money_re.search(line)
            if m:
                # Determine milestone name
                name = line[:line.index(m.group(0))].strip().rstrip(":")
                if not name:
                    name = "Payment"
                # Determine when
                if "approval" in ll or "on approval" in ll:
                    when = "On Approval"
                elif "completion" in ll:
                    when = "On Completion"
                else:
                    when = ""
                result["payment_schedule"].append({
                    "name": name,
                    "amount": m.group(0),
                    "due": when,
                })

    # ── Scope / line items ────────────────────────────────────────────────────
    # Look for numbered or dash-listed items, or lines with a dollar amount + description
    scope_items = []
    # Pattern: line like "Install retaining wall   1.00   $12,500.00"
    item_re = re.compile(r"^(.{10,80}?)\s+([\d.]+)\s+(\$[\d,]+\.\d{2})\s*$")
    current_phase = ""
    phase_keywords = ["phase", "section", "area", "zone", "mobilization", "demo",
                      "grading", "drainage", "wall", "paver", "planting", "cleanup",
                      "hardscape", "landscape", "mulch", "seeding", "lawn"]

    for line in lines:
        ll = line.lower()
        # Detect phase headers
        if any(kw in ll for kw in phase_keywords) and len(line) < 60 and not money_re.search(line):
            current_phase = line
            continue
        m = item_re.match(line)
        if m:
            scope_items.append({
                "description": m.group(1).strip(),
                "quantity": m.group(2),
                "price": m.group(3),
                "phase": current_phase,
            })
        elif money_re.search(line) and len(line) > 15:
            # Simpler: any line with a dollar amount might be a line item
            mon = money_re.search(line)
            desc = line[:mon.start()].strip().rstrip(" -")
            if desc and len(desc) > 3 and "subtotal" not in ll and "tax" not in ll and "total" not in ll:
                scope_items.append({
                    "description": desc,
                    "quantity": "",
                    "price": mon.group(0),
                    "phase": current_phase,
                })

    result["scope_items"] = scope_items

    # ── Client name, address, phone ───────────────────────────────────────────
    # Phone
    phone_re = re.compile(r"\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}")
    for line in lines:
        m = phone_re.search(line)
        if m:
            # Skip company phone (717-449-6660)
            if "449" not in m.group(0) and not result["client_phone"]:
                result["client_phone"] = m.group(0)

    # Address — look for lines with known PA patterns
    addr_re = re.compile(r"\d+\s+\w[\w\s]+(?:Dr|St|Ave|Rd|Ln|Blvd|Way|Ct|Pl|Circle|Trail)\b.*", re.IGNORECASE)
    for line in lines:
        m = addr_re.search(line)
        if m and not result["client_address"]:
            result["client_address"] = m.group(0)

    # Client name — try to find "Bill To" or "Customer" section
    for i, line in enumerate(lines):
        ll = line.lower()
        if "bill to" in ll or "customer" in ll or "client" in ll:
            # Next non-empty line might be the name
            for j in range(i+1, min(i+4, len(lines))):
                candidate = lines[j]
                # Skip if it looks like an address or phone
                if phone_re.search(candidate): continue
                if addr_re.search(candidate): continue
                if any(c.isdigit() for c in candidate[:3]): continue
                if len(candidate) > 3 and not any(kw in candidate.lower() for kw in
                    ["estimate", "date", "snappy", "landscaping", "email", "website"]):
                    result["client_name"] = candidate
                    break
            if result["client_name"]:
                break

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No PDF path provided"}))
        sys.exit(1)
    try:
        data = parse_estimate(sys.argv[1])
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
