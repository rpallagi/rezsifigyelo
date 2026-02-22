"""Claude API integration for PDF data extraction and meter reading OCR."""
import base64
import json
import os

import pdfplumber
from flask import current_app


def get_claude_client():
    """Lazy-initialize Anthropic client."""
    import anthropic
    api_key = current_app.config.get('ANTHROPIC_API_KEY')
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY nincs beállítva. Add meg a docker-compose.yml-ben.")
    return anthropic.Anthropic(api_key=api_key)


def _parse_json_response(text: str) -> dict:
    """Extract JSON from Claude response, handling markdown code blocks."""
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except (json.JSONDecodeError, IndexError):
        return {"error": "Nem sikerült feldolgozni a választ", "raw": text}


def _extract_pdf_text(filepath: str) -> str:
    """Extract text from PDF using pdfplumber."""
    text = ""
    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
    except Exception:
        text = ""
    return text.strip()


def extract_property_tax_from_pdf(filepath: str) -> dict:
    """
    Extract property tax (ingatlanadó határozat) data from a PDF.

    Returns dict with:
    - bank_account: str (bankszámlaszám)
    - recipient: str (kedvezményezett neve)
    - amount: float (éves összeg Ft)
    - installment_amount: float (féléves részlet)
    - payment_memo: str (közlemény)
    - year: int
    """
    text = _extract_pdf_text(filepath)
    client = get_claude_client()
    model = current_app.config.get('CLAUDE_MODEL', 'claude-sonnet-4-20250514')

    prompt = """Kinyered az ingatlanadó határozat adatait ebből a magyar dokumentumból.
Válaszolj KIZÁRÓLAG érvényes JSON-nal, ezekkel a mezőkkel:
- bank_account (bankszámlaszám, pl. "11111111-22222222-33333333")
- recipient (kedvezményezett neve, pl. önkormányzat)
- amount (éves összeg forintban, szám)
- installment_amount (féléves részlet forintban, szám, ha nincs: amount/2)
- payment_memo (közlemény szövege)
- year (évszám, szám)

Ha egy mezőt nem találsz, adj null értéket."""

    if text:
        # Text-based extraction (cheaper)
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": f"{prompt}\n\nDokumentum szövege:\n{text[:8000]}"
            }]
        )
    else:
        # Vision-based extraction for scanned PDFs
        with open(filepath, "rb") as f:
            pdf_bytes = base64.b64encode(f.read()).decode("utf-8")

        message = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_bytes,
                        }
                    },
                    {"type": "text", "text": prompt}
                ]
            }]
        )

    data = _parse_json_response(message.content[0].text)
    data["raw_text"] = text[:2000] if text else ""
    return data


def extract_common_fee_from_pdf(filepath: str) -> dict:
    """
    Extract common fee (közös költség határozat) data from a PDF.

    Returns dict with:
    - bank_account: str
    - recipient: str
    - monthly_amount: float (havi összeg Ft)
    - payment_memo: str (közlemény)
    - frequency: str ('monthly' or 'quarterly')
    - payment_day: int (fizetési határnap, pl. 15)
    """
    text = _extract_pdf_text(filepath)
    client = get_claude_client()
    model = current_app.config.get('CLAUDE_MODEL', 'claude-sonnet-4-20250514')

    prompt = """Kinyered a közös költség határozat adatait ebből a magyar dokumentumból.
Válaszolj KIZÁRÓLAG érvényes JSON-nal, ezekkel a mezőkkel:
- bank_account (bankszámlaszám)
- recipient (kedvezményezett neve, pl. társasház)
- monthly_amount (havi összeg forintban, szám)
- payment_memo (közlemény szövege)
- frequency ("monthly" ha havi, "quarterly" ha negyedéves)
- payment_day (fizetési határnap, szám, pl. 15)

Ha egy mezőt nem találsz, adj null értéket."""

    if text:
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": f"{prompt}\n\nDokumentum szövege:\n{text[:8000]}"
            }]
        )
    else:
        with open(filepath, "rb") as f:
            pdf_bytes = base64.b64encode(f.read()).decode("utf-8")

        message = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_bytes,
                        }
                    },
                    {"type": "text", "text": prompt}
                ]
            }]
        )

    data = _parse_json_response(message.content[0].text)
    data["raw_text"] = text[:2000] if text else ""
    return data


def ocr_meter_reading(filepath: str) -> dict:
    """
    Use Claude Vision to read a meter value from a photo.

    Returns dict with:
    - value: float or None
    - confidence: str ('high'|'medium'|'low')
    """
    with open(filepath, "rb") as f:
        img_bytes = base64.b64encode(f.read()).decode("utf-8")

    ext = filepath.rsplit('.', 1)[-1].lower()
    mime_map = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp'
    }
    mime_type = mime_map.get(ext, 'image/jpeg')

    client = get_claude_client()
    model = current_app.config.get('CLAUDE_MODEL', 'claude-sonnet-4-20250514')

    message = client.messages.create(
        model=model,
        max_tokens=256,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": mime_type,
                        "data": img_bytes,
                    }
                },
                {
                    "type": "text",
                    "text": (
                        "Olvasd le a mérőóra állást erről a fotóról. "
                        "Válaszolj KIZÁRÓLAG érvényes JSON-nal: "
                        '{"value": <szám>, "confidence": "high"|"medium"|"low"}. '
                        'Ha nem tudod leolvasni: {"value": null, "confidence": "low"}.'
                    )
                }
            ]
        }]
    )

    data = _parse_json_response(message.content[0].text)
    if "value" not in data:
        data = {"value": None, "confidence": "low"}
    data["raw_response"] = message.content[0].text
    return data
