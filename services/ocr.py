"""Multi-provider OCR service for meter reading extraction.

Primary provider: Claude (Anthropic) with vision capabilities.
Additional providers: Tesseract, OpenAI, Google (stubs).
"""
import base64
import logging
import re

logger = logging.getLogger(__name__)


def _parse_numeric_value(text: str) -> float | None:
    """Extract a numeric meter reading from raw OCR text.

    Handles formats like:
      - "12345"
      - "12 345"
      - "12345.678"
      - "12345,678"
      - "A mérőállás: 12345 kWh"
    """
    if not text:
        return None

    cleaned = text.strip()

    # Look for the largest plausible number in the text.
    # Patterns ordered from most specific to least specific.
    patterns = [
        r"(\d[\d\s ]*\d[.,]\d+)",   # numbers with decimal part
        r"(\d[\d\s ]*\d)",             # integers (multi-digit)
        r"(\d+[.,]\d+)",                       # short decimal numbers
        r"(\d+)",                                # single digits as fallback
    ]

    candidates: list[float] = []
    for pattern in patterns:
        for match in re.finditer(pattern, cleaned):
            raw = match.group(1)
            # Remove spaces
            raw = raw.replace(" ", "").replace(" ", "")
            # Normalize decimal separator (Hungarian uses comma)
            raw = raw.replace(",", ".")
            try:
                candidates.append(float(raw))
            except ValueError:
                continue

    if not candidates:
        return None

    # Return the largest number found (meter readings are typically large)
    return max(candidates)


def _assess_confidence(value: float | None, raw_text: str) -> str:
    """Heuristically assess confidence based on the parsed result."""
    if value is None:
        return "low"

    cleaned = raw_text.strip()

    # If the raw text is basically just a number, high confidence
    numeric_only = re.sub(r"[\s.,]", "", cleaned)
    if numeric_only.isdigit():
        return "high"

    # If the text is short and contains the number, medium-to-high
    if len(cleaned) < 30:
        return "high"

    # Longer text means the model gave extra explanation
    if len(cleaned) < 100:
        return "medium"

    return "low"


# ---------------------------------------------------------------------------
# Provider: Claude (Anthropic) -- PRIMARY
# ---------------------------------------------------------------------------

def _build_ocr_prompt(utility_type: str = "") -> str:
    """Build a meter-type-aware OCR prompt for Claude Vision."""
    # Decimal digit counts per meter type (mechanical rollover meters)
    decimal_hints = {
        "villany": (
            "Ez egy VILLANYMERO (elektromos energia mero).\n"
            "Mechanikus merő eseten: az utolso 1 szamjegy tizedes (piros keretben).\n"
            "Pl: ha '0359076' latszik → 35907,6 kWh\n"
            "Ha '0035907,6' → 35907,6 kWh"
        ),
        "viz": (
            "Ez egy VIZMERŐ (vizfogyasztas mero).\n"
            "Mechanikus merő eseten: az utolso 3 szamjegy tizedes (piros keretben).\n"
            "Pl: ha '0008155' latszik → 8,155 m3\n"
            "Ha '0008,155' → 8,155 m3"
        ),
        "gaz": (
            "Ez egy GAZMERŐ (gazfogyasztas mero).\n"
            "Mechanikus merő eseten: az utolso 3 szamjegy tizedes (piros keretben).\n"
            "Pl: ha '5181907' latszik → 5181,907 m3\n"
            "Ha '1716,655' → 1716,655 m3"
        ),
    }

    type_hint = decimal_hints.get(utility_type, (
        "Ez egy kozmu merőora (villany/viz/gaz).\n"
        "Mechanikus merő eseten: a piros/szines keretu vagy hatteru szamok a tizedesek.\n"
        "Tipikusan: villanymerő 1 tizedes, viz/gazmerő 3 tizedes."
    ))

    return (
        f"{type_hint}\n\n"
        "DIGITALIS (LED/LCD kijelzo):\n"
        "- A kijelzon lathato . vagy , PONTOSAN jelzi a tizedest - hasznald!\n"
        "- Pl: '5588.3' → 5588.3, '4112,65' → 4112.65\n\n"
        "ANALOG/MECHANIKUS merő:\n"
        "- PIROS szamu vagy PIROS KERET/HATTER mogotti szamok = tizedes resz\n"
        "- Feher/fekete szamu szamok = egeszek\n"
        "- Ha nincs szinezes: hasznald a fenti merőtipus-szabalyt!\n\n"
        "SZABALYOK:\n"
        "- Vezeto nullakat hagyj el (0035907 → 35907)\n"
        "- Csak a szamot ird ki, semmi mast (nincs egyseg, nincs szo)\n"
        "- Tizedes elvalaszto: pontot hasznalj\n"
        "- Helyes valasz peldak: 35907.6 vagy 8.155 vagy 5181.907 vagy 5588.3"
    )


def _ocr_claude(image_data: bytes, mime_type: str = "image/jpeg", utility_type: str = "") -> dict:
    """Use Anthropic Claude with vision to extract meter reading.

    This is the primary, fully-implemented provider.
    """
    import anthropic
    from flask import current_app

    api_key = current_app.config.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY is not configured")
        return {"value": None, "confidence": "low", "raw_text": "", "error": "Missing ANTHROPIC_API_KEY"}

    b64_image = base64.b64encode(image_data).decode("utf-8")
    prompt = _build_ocr_prompt(utility_type)

    client = anthropic.Anthropic(api_key=api_key)

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=128,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": b64_image,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        )

        raw_text = message.content[0].text if message.content else ""
        value = _parse_numeric_value(raw_text)
        confidence = _assess_confidence(value, raw_text)

        logger.info(
            "Claude OCR result: value=%s, confidence=%s, raw=%r",
            value, confidence, raw_text[:200],
        )

        return {
            "value": value,
            "confidence": confidence,
            "raw_text": raw_text,
        }

    except anthropic.APIError as exc:
        logger.error("Claude API error during OCR: %s", exc)
        return {
            "value": None,
            "confidence": "low",
            "raw_text": "",
            "error": f"Claude API error: {exc}",
        }


# ---------------------------------------------------------------------------
# Provider: Tesseract (local OCR)
# ---------------------------------------------------------------------------

def _ocr_tesseract(image_data: bytes, mime_type: str = "image/jpeg") -> dict:
    """Use Tesseract OCR via pytesseract + Pillow.

    This is a basic stub -- logs a warning if pytesseract/PIL are not installed.
    """
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        logger.warning(
            "pytesseract or Pillow is not installed. "
            "Install them with: pip install pytesseract Pillow"
        )
        return {
            "value": None,
            "confidence": "low",
            "raw_text": "",
            "error": "pytesseract or Pillow not installed",
        }

    import io

    try:
        image = Image.open(io.BytesIO(image_data))
        # Use Hungarian language data if available, fall back to English
        try:
            raw_text = pytesseract.image_to_string(image, lang="hun")
        except pytesseract.TesseractError:
            raw_text = pytesseract.image_to_string(image)

        value = _parse_numeric_value(raw_text)
        confidence = _assess_confidence(value, raw_text)

        logger.info(
            "Tesseract OCR result: value=%s, confidence=%s, raw=%r",
            value, confidence, raw_text[:200],
        )

        return {
            "value": value,
            "confidence": confidence,
            "raw_text": raw_text,
        }

    except Exception as exc:
        logger.error("Tesseract OCR failed: %s", exc)
        return {
            "value": None,
            "confidence": "low",
            "raw_text": "",
            "error": f"Tesseract error: {exc}",
        }


# ---------------------------------------------------------------------------
# Provider: OpenAI (GPT-4o-mini with vision)
# ---------------------------------------------------------------------------

def _ocr_openai(image_data: bytes, mime_type: str = "image/jpeg", utility_type: str = "") -> dict:
    """Use OpenAI GPT-4o-mini with vision to extract meter reading."""
    from flask import current_app

    api_key = current_app.config.get("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning("OPENAI_API_KEY is not configured -- cannot use OpenAI OCR provider")
        return {
            "value": None,
            "confidence": "low",
            "raw_text": "",
            "error": "Missing OPENAI_API_KEY",
        }

    try:
        import openai
    except ImportError:
        logger.warning("openai package is not installed. Install with: pip install openai")
        return {
            "value": None,
            "confidence": "low",
            "raw_text": "",
            "error": "openai package not installed",
        }

    b64_image = base64.b64encode(image_data).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_image}"
    prompt = _build_ocr_prompt(utility_type)

    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=64,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        )

        raw_text = response.choices[0].message.content or ""
        value = _parse_numeric_value(raw_text)
        confidence = _assess_confidence(value, raw_text)

        logger.info(
            "OpenAI OCR result: value=%s, confidence=%s, raw=%r",
            value, confidence, raw_text[:200],
        )

        return {
            "value": value,
            "confidence": confidence,
            "raw_text": raw_text,
        }

    except Exception as exc:
        logger.error("OpenAI OCR failed: %s", exc)
        return {
            "value": None,
            "confidence": "low",
            "raw_text": "",
            "error": f"OpenAI error: {exc}",
        }


# ---------------------------------------------------------------------------
# Provider: Google Cloud Vision
# ---------------------------------------------------------------------------

def _ocr_google(image_data: bytes, mime_type: str = "image/jpeg") -> dict:
    """Use Google Cloud Vision API for meter reading OCR.

    TODO: Implement Google Cloud Vision integration.
    - Requires google-cloud-vision package
    - Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON
    - Use TEXT_DETECTION or DOCUMENT_TEXT_DETECTION feature
    """
    logger.warning("Google Cloud Vision OCR provider is not yet implemented")
    return {
        "value": None,
        "confidence": "low",
        "raw_text": "",
        "error": "Google Cloud Vision provider not yet implemented",
    }


# ---------------------------------------------------------------------------
# Provider registry & main entry point
# ---------------------------------------------------------------------------

_PROVIDERS = {
    "claude": _ocr_claude,
    "tesseract": _ocr_tesseract,
    "openai": _ocr_openai,
    "google": _ocr_google,
}


def _guess_mime_type(image_data: bytes) -> str:
    """Guess MIME type from image magic bytes."""
    if len(image_data) >= 4 and image_data[1:4] == b"PNG":
        return "image/png"
    if len(image_data) >= 2 and image_data[0] == 0xFF and image_data[1] == 0xD8:
        return "image/jpeg"
    if len(image_data) >= 4 and image_data[:4] == b"GIF8":
        return "image/gif"
    if len(image_data) > 12 and image_data[:4] == b"RIFF" and image_data[8:12] == b"WEBP":
        return "image/webp"
    # Default to JPEG
    return "image/jpeg"
    if image_data[:4] == b"GIF8":
        return "image/gif"
    if image_data[:4] == b"RIFF" and image_data[8:12] == b"WEBP":
        return "image/webp"
    # Default to JPEG
    return "image/jpeg"


def ocr_meter_reading(image_data: bytes, provider: str = "claude", utility_type: str = "") -> dict:
    """Extract a meter reading value from an image using the specified OCR provider.

    Args:
        image_data: Raw image bytes (JPEG, PNG, GIF, or WebP).
        provider: OCR provider to use. One of 'claude', 'tesseract', 'openai', 'google'.
                  Defaults to 'claude'.
        utility_type: Meter type hint: 'villany', 'viz', or 'gaz'. Used to guide decimal detection.

    Returns:
        dict with keys:
            - value: float or None -- the extracted meter reading
            - confidence: str -- 'high', 'medium', or 'low'
            - raw_text: str -- the raw text returned by the OCR provider
            - error: str (optional) -- error message if something went wrong
    """
    provider = provider.lower().strip()

    if provider not in _PROVIDERS:
        logger.error("Unknown OCR provider: %r. Available: %s", provider, list(_PROVIDERS.keys()))
        return {
            "value": None,
            "confidence": "low",
            "raw_text": "",
            "error": f"Unknown provider: {provider}. Available: {list(_PROVIDERS.keys())}",
        }

    if not image_data:
        return {
            "value": None,
            "confidence": "low",
            "raw_text": "",
            "error": "Empty image data",
        }

    mime_type = _guess_mime_type(image_data)
    logger.info("Running OCR with provider=%s, utility_type=%r, image_size=%d bytes, mime=%s",
                provider, utility_type, len(image_data), mime_type)

    fn = _PROVIDERS[provider]
    if provider in ("claude", "openai"):
        return fn(image_data, mime_type, utility_type=utility_type)
    return fn(image_data, mime_type)
