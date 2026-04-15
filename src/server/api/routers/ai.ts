import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { tariffs, tariffGroups, appSettings } from "@/server/db/schema";

const TARIFF_RESULT_SCHEMA = z.object({
  villany_rezsis: z.number(),
  villany_piaci: z.number(),
  viz: z.number(),
  csatorna: z.number(),
  gaz_rezsis: z.number(),
  gaz_piaci: z.number(),
  datum: z.string().optional(),
  megjegyzes: z.string().optional(),
});

type AiProvider = "claude" | "gemini" | "openai";

async function getAiApiKey(provider: AiProvider): Promise<string | null> {
  switch (provider) {
    case "claude":
      return process.env.ANTHROPIC_API_KEY ?? null;
    case "gemini":
      return process.env.GOOGLE_AI_KEY ?? null;
    case "openai":
      return process.env.OPENAI_API_KEY ?? null;
    default:
      return null;
  }
}

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = (await res.json()) as { content: Array<{ text: string }> };
  return data.content[0]?.text ?? "";
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = (await res.json()) as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates[0]?.content.parts[0]?.text ?? "";
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content ?? "";
}

export const aiRouter = createTRPCRouter({
  /** Check which AI providers are available */
  availableProviders: landlordProcedure.query(async () => {
    return {
      claude: !!process.env.ANTHROPIC_API_KEY,
      gemini: !!process.env.GOOGLE_AI_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    };
  }),

  /** Research tariffs using AI */
  researchTariffs: landlordProcedure
    .input(
      z.object({
        provider: z.enum(["claude", "gemini", "openai"]).default("claude"),
        city: z.string().default("Budapest"),
      }),
    )
    .mutation(async ({ input }) => {
      const apiKey = await getAiApiKey(input.provider);
      if (!apiKey) {
        throw new Error(`Nincs ${input.provider} API kulcs beállítva. Adj meg ANTHROPIC_API_KEY, GOOGLE_AI_KEY, vagy OPENAI_API_KEY env var-t a Vercel-en.`);
      }

      // Load prompt from docs
      let prompt: string;
      try {
        prompt = await readFile(
          path.join(process.cwd(), "docs", "tariff-research-prompt.md"),
          "utf-8",
        );
        // Extract just the prompt section (after ## Prompt)
        const promptStart = prompt.indexOf("## Prompt");
        if (promptStart > 0) prompt = prompt.slice(promptStart + 10);
      } catch {
        prompt = `Keresd meg a jelenlegi ${input.city}-i lakossági közüzemi árakat (bruttó, ÁFA-val). Válaszolj JSON formátumban: {"villany_rezsis":0,"villany_piaci":0,"viz":0,"csatorna":0,"gaz_rezsis":0,"gaz_piaci":0,"datum":"","megjegyzes":""}`;
      }

      // Replace city placeholder if any
      prompt = prompt.replace(/Budapest/g, input.city);

      let rawResponse: string;
      switch (input.provider) {
        case "claude":
          rawResponse = await callClaude(prompt, apiKey);
          break;
        case "gemini":
          rawResponse = await callGemini(prompt, apiKey);
          break;
        case "openai":
          rawResponse = await callOpenAI(prompt, apiKey);
          break;
      }

      // Parse JSON from response (might be wrapped in markdown code blocks)
      const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error("Az AI nem adott JSON választ. Próbáld újra.");
      }

      const parsed = TARIFF_RESULT_SCHEMA.safeParse(JSON.parse(jsonMatch[0]));
      if (!parsed.success) {
        throw new Error("Az AI válasz nem a várt formátumban van. Próbáld újra.");
      }

      return {
        provider: input.provider,
        result: parsed.data,
        rawResponse,
      };
    }),

  /** Apply researched tariffs to a tariff group */
  applyTariffs: landlordProcedure
    .input(
      z.object({
        tariffGroupId: z.number(),
        rates: z.object({
          villany: z.number().optional(),
          viz: z.number().optional(),
          csatorna: z.number().optional(),
          gaz: z.number().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify group belongs to user
      const group = await ctx.db.query.tariffGroups.findFirst({
        where: and(
          eq(tariffGroups.id, input.tariffGroupId),
          eq(tariffGroups.landlordId, ctx.dbUser.id),
        ),
      });
      if (!group) throw new Error("Tarifa csoport nem található");

      const today = new Date().toISOString().split("T")[0]!;
      let updated = 0;

      for (const [utilityType, rate] of Object.entries(input.rates)) {
        if (rate == null || rate <= 0) continue;

        // Check if tariff exists for this utility type
        type UT = "villany" | "viz" | "gaz" | "csatorna" | "internet" | "kozos_koltseg" | "egyeb";
        const ut = utilityType as UT;
        const existing = await ctx.db.query.tariffs.findFirst({
          where: and(
            eq(tariffs.tariffGroupId, input.tariffGroupId),
            eq(tariffs.utilityType, ut),
          ),
        });

        if (existing) {
          await ctx.db
            .update(tariffs)
            .set({ rateHuf: rate, validFrom: today })
            .where(eq(tariffs.id, existing.id));
        } else {
          await ctx.db.insert(tariffs).values({
            tariffGroupId: input.tariffGroupId,
            utilityType: ut,
            rateHuf: rate,
            unit: utilityType === "villany" ? "kWh" : "m³",
            validFrom: today,
          });
        }
        updated++;
      }

      return { updated };
    }),
});
