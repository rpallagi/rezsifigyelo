import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  // Convert to base64
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = file.type || "image/jpeg";

  // Use Anthropic API directly for OCR
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OCR not configured (missing ANTHROPIC_API_KEY)" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 128,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: base64,
                },
              },
              {
                type: "text",
                text: `You are reading a utility meter (electricity / gas / water) from a photo.

CRITICAL: Return ONLY the meter value, nothing else. No explanation, no unit, no prefix.

Rules:
1. Read ALL visible digits on the main counter display (left to right).
2. If the meter has mechanical wheels with RED digits at the end, those are DECIMAL digits — include them after a dot.
   Example: black "12345" + red "678" → "12345.678"
3. If digits are LCD/digital, read them as shown. A decimal point on the display is a dot.
4. Ignore any prefix zeros only if the meter is clearly showing less than full width (keep them if uncertain).
5. Ignore tariff indicators (T1/T2/HT/NT), serial numbers, barcodes, QR codes, power indicators.
6. If the photo is blurry, obstructed, or no meter is visible: return ONLY the word: ERROR

Examples of valid output:
12345
12345.678
0.450
987654.3

Your output:`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json(
        { error: "OCR failed" },
        { status: 500 },
      );
    }

    const data = await response.json();
    const text =
      data.content?.[0]?.type === "text" ? data.content[0].text.trim() : "";

    // Parse the number
    const value = parseFloat(text);
    if (isNaN(value) || text === "ERROR") {
      return NextResponse.json({
        success: false,
        raw: text,
        error: "Nem sikerült leolvasni a mérőállást",
      });
    }

    return NextResponse.json({
      success: true,
      value,
      raw: text,
    });
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json({ error: "OCR failed" }, { status: 500 });
  }
}
