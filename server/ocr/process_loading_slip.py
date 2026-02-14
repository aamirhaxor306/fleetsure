#!/usr/bin/env python3
"""
PaddleOCR-based Loading Slip Processor
──────────────────────────────────────
Reads a photo of a BPCL/IOCL/HPCL loading slip and extracts:
  - vehicleNumber
  - loadingSlipNumber
  - tripDate
  - originPlant (issuing plant)
  - destinationPlant (next loading location)
  - transporterName

Usage:
  python3 process_loading_slip.py /path/to/image.jpg

Output: JSON to stdout
"""

import sys
import os
import json
import re
import logging

# Suppress PaddleOCR's verbose logging
logging.disable(logging.WARNING)
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

from paddleocr import PaddleOCR


# ── Initialize PaddleOCR (lazy singleton) ─────────────────────────────────
_ocr = None

def get_ocr():
    global _ocr
    if _ocr is None:
        _ocr = PaddleOCR(
            lang='en',
            use_textline_orientation=True,
        )
    return _ocr


# ── OCR + Parse ──────────────────────────────────────────────────────────────

def process_image(image_path):
    """Run PaddleOCR on image and extract structured data."""
    ocr = get_ocr()

    results = ocr.predict(image_path)

    if not results:
        return {"error": "No text detected in image", "lines": []}

    # Extract text lines with their positions and scores
    lines_data = []
    for page in results:
        texts = page['rec_texts']
        scores = page['rec_scores']
        boxes = page['rec_boxes']

        for text, score, box in zip(texts, scores, boxes):
            y_pos = box[1]  # top Y of bounding box
            lines_data.append({
                "text": text.strip(),
                "confidence": round(float(score), 3),
                "y": float(y_pos),
            })

    # Sort by Y position (top to bottom)
    lines_data.sort(key=lambda d: d["y"])

    all_lines = [d["text"] for d in lines_data]
    full_text = "\n".join(all_lines)

    # ── Extract fields ───────────────────────────────────────────────────
    result = extract_fields(all_lines, full_text)
    result["rawLines"] = all_lines
    result["ocrConfidence"] = round(
        sum(d["confidence"] for d in lines_data) / max(len(lines_data), 1), 3
    )

    return result


# ── Field Extraction ─────────────────────────────────────────────────────────

def extract_fields(lines, full_text):
    """Extract structured fields from OCR lines using label-aware matching."""
    result = {
        "vehicleNumber": None,
        "loadingSlipNumber": None,
        "tripDate": None,
        "originPlant": None,
        "destinationPlant": None,
        "transporterName": None,
    }

    # ── 1. LOADING SLIP NUMBER ───────────────────────────────────────────
    for line in lines:
        match = re.search(
            r'loading\s*slip\s*no[.\s:]*(.+)',
            line, re.IGNORECASE
        )
        if match:
            slip = match.group(1).strip()
            # Clean OCR issues with slashes
            slip = re.sub(r'[|\\]', '/', slip)
            slip = re.sub(r'\s+', '', slip)
            if len(slip) > 5:
                result["loadingSlipNumber"] = slip
                break

    # Fallback: LPG/XXXX/XX/... pattern
    if not result["loadingSlipNumber"]:
        match = re.search(
            r'(LPG[/|\\]?\d{3,4}[/|\\]?[A-Z]{2}[/|\\]?\d{5,6}[/|\\]?\d{3,4})',
            full_text, re.IGNORECASE
        )
        if match:
            slip = re.sub(r'[|\\]', '/', match.group(1))
            slip = re.sub(r'\s+', '', slip)
            result["loadingSlipNumber"] = slip

    # ── 2. DATE ──────────────────────────────────────────────────────────
    # Priority: "Date:" label (top-right of slip, not "Date of Unloading")
    for line in lines:
        # Match "Date: DD/MM/YYYY" but NOT "Date of Unloading"
        match = re.search(
            r'^Date[:\s]+(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})\s*$',
            line.strip(), re.IGNORECASE
        )
        if match:
            parsed = parse_date(match.group(1))
            if parsed:
                result["tripDate"] = parsed
                break

    # Fallback: first standalone date in text
    if not result["tripDate"]:
        for line in lines:
            if re.search(r'date\s*of\s*unloading|last\s*invoice|STO', line, re.IGNORECASE):
                continue  # Skip unloading/invoice dates
            match = re.search(r'(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})', line)
            if match:
                parsed = parse_date(match.group(1))
                if parsed:
                    result["tripDate"] = parsed
                    break

    # ── 3. VEHICLE NUMBER ────────────────────────────────────────────────
    # Priority A: "Report your Vehicle No. XXXX"
    for line in lines:
        match = re.search(
            r'(?:report\s*your\s*)?vehicle\s*no[.\s:]*\s*([A-Z0-9]{6,12})',
            line, re.IGNORECASE
        )
        if match:
            cleaned = clean_vehicle_number(match.group(1))
            if is_valid_vehicle_number(cleaned):
                result["vehicleNumber"] = cleaned
                break

    # Priority B: standalone vehicle number line (from table row)
    if not result["vehicleNumber"]:
        found_label = False
        for line in lines:
            if re.search(r'vehicle\s*no', line, re.IGNORECASE):
                found_label = True
                continue
            if found_label:
                cleaned = clean_vehicle_number(line.strip())
                if is_valid_vehicle_number(cleaned):
                    result["vehicleNumber"] = cleaned
                break

    # Priority C: brute-force scan
    if not result["vehicleNumber"]:
        for line in lines:
            matches = re.findall(r'\b([A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4})\b', line.upper())
            for m in matches:
                if m[:2] not in ('LP', 'ST', 'DU', 'BP'):  # not a code
                    result["vehicleNumber"] = m
                    break
            if result["vehicleNumber"]:
                break

    # ── 4. ISSUING PLANT (Origin) ────────────────────────────────────────
    for i, line in enumerate(lines):
        match = re.search(r'issuing\s*plant[:\s]*(.+)', line, re.IGNORECASE)
        if match:
            val = match.group(1).strip()
            if len(val) > 2:
                result["originPlant"] = clean_plant_name(val)
                break
            # Value on next line
            if i + 1 < len(lines):
                result["originPlant"] = clean_plant_name(lines[i + 1].strip())
                break

    # ── 5. DESTINATION (Next Loading Location) ───────────────────────────
    # Value may appear BEFORE or AFTER the label (table layout varies)
    for i, line in enumerate(lines):
        if re.search(r'next\s*loading\s*location', line, re.IGNORECASE):
            dest_parts = []

            # Check line BEFORE label (value-above-label pattern)
            if i > 0:
                prev = lines[i - 1].strip()
                if not is_field_label(prev) and len(prev) > 2:
                    # Looks like "Mundra LPG DU (3444)" — a destination value
                    if re.search(r'(LPG|DU|plant|terminal|depot)', prev, re.IGNORECASE):
                        dest_parts.append(prev)

            # Collect multi-line value AFTER the label
            for j in range(1, 7):
                if i + j >= len(lines):
                    break
                next_line = lines[i + j].strip()
                # Stop if we hit another field label
                if is_field_label(next_line):
                    break
                # Stop if we hit a vehicle number (table value below destination)
                cleaned_check = clean_vehicle_number(next_line)
                if is_valid_vehicle_number(cleaned_check):
                    break
                if len(next_line) > 1:
                    dest_parts.append(next_line)

            if dest_parts:
                full_dest = " ".join(dest_parts)
                result["destinationPlant"] = clean_plant_name(full_dest)
            break

    # ── 6. TRANSPORTER NAME ──────────────────────────────────────────────
    # BPCL table layout: VALUES appear ABOVE their LABELS
    # So "HARDEEP ROADWAYS (225233)" comes BEFORE "Name of Transporter"
    for i, line in enumerate(lines):
        if re.search(r'name\s*of\s*transporter', line, re.IGNORECASE):
            # First check: same line (inline value)
            match = re.search(r'name\s*of\s*transporter[:\s]+(.{3,})', line, re.IGNORECASE)
            if match:
                result["transporterName"] = clean_name(match.group(1).strip())
                break
            # BPCL layout: value is on a line BEFORE the label
            # Walk backwards to find a non-label, non-separator line
            for k in range(1, 4):
                if i - k < 0:
                    break
                prev_line = lines[i - k].strip()
                # Skip separators like "-"
                if prev_line in ('-', '–', '—', ''):
                    continue
                # Skip vehicle numbers
                if is_valid_vehicle_number(clean_vehicle_number(prev_line)):
                    continue
                # Skip field labels
                if is_field_label(prev_line):
                    continue
                # This should be the transporter name
                if len(prev_line) > 2:
                    result["transporterName"] = clean_name(prev_line)
                    break
            break

    return result


# ── Helpers ──────────────────────────────────────────────────────────────────

def clean_vehicle_number(s):
    """Remove spaces, hyphens, dots and uppercase."""
    return re.sub(r'[\s\-.]', '', s).upper()


def is_valid_vehicle_number(s):
    """Check if string matches Indian vehicle registration format."""
    return bool(re.match(r'^[A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4}$', s))


def clean_plant_name(s):
    """Clean up plant name — remove codes, C/o, M/s, pin codes."""
    s = re.sub(r'\(\s*\d+\s*\)', '', s)   # Remove (3107), (3444) etc.
    s = re.sub(r'\b\d{6}\b', '', s)        # Remove 6-digit pin codes
    s = re.sub(r'C/[Oo]\s+', '', s)        # Remove C/o
    s = re.sub(r'M/[Ss]\s+', '', s)        # Remove M/s
    s = re.sub(r'\s*,\s*', ', ', s)        # Normalize commas
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def clean_name(s):
    """Clean transporter/company name — remove trailing codes."""
    s = re.sub(r'\(\s*\d+\s*\)', '', s)   # Remove (225233) etc.
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def is_field_label(line):
    """Check if a line is a known field label (not data)."""
    lower = line.lower().strip()
    labels = [
        'vehicle no', 'next loading', 'issuing plant', 'name of transporter',
        'date of unloading', 'last invoice', 'remarks', 'loading slip',
        'report your', 'driver', 'signature', 'check list',
    ]
    return any(l in lower for l in labels)


def parse_date(s):
    """Parse DD/MM/YYYY or DD.MM.YYYY into YYYY-MM-DD."""
    match = re.match(r'(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})', s)
    if not match:
        return None
    day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if year < 100:
        year += 2000
    if 1 <= day <= 31 and 1 <= month <= 12 and 2020 <= year <= 2030:
        return f"{year}-{month:02d}-{day:02d}"
    return None


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 process_loading_slip.py <image_path>"}))
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"File not found: {image_path}"}))
        sys.exit(1)

    try:
        result = process_image(image_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
