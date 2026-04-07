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
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,
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
                text: `This is a photo of a utility meter (gas, water, or electricity).
Extract ONLY the numeric meter reading value.
Rules:
- Return ONLY the number, nothing else
- Use a dot as decimal separator if there are decimals
- Ignore any text, units, or labels
- If you see red/black digit wheels, read all digits including the decimal ones
- If you cannot read the meter, return "ERROR"

Example valid responses: "12345", "12345.678", "0.450"`,
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
