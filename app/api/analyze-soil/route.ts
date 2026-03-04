import { generateObject, gateway } from "ai";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "../../generated/prisma/client";

const soilAnalysisSchema = z.object({
  soilType: z.string().describe("Overall soil type, e.g. loam, sandy loam."),
  estimatedPhRange: z
    .string()
    .describe("Estimated pH range, e.g. 5.5-6.5, in text form."),
  texture: z.string().describe("Texture description such as crumbly, compacted."),
  color: z.string().describe("Dominant soil colour in plain language."),
  organicMatterLevel: z
    .string()
    .describe("Organic matter level (low/medium/high) with short justification."),
  nitrogenStatus: z
    .string()
    .describe("Nitrogen status (e.g. deficient/balanced/excess) with context."),
  phosphorusStatus: z
    .string()
    .describe("Phosphorus status (e.g. low/adequate/high) with context."),
  potassiumStatus: z
    .string()
    .describe("Potassium status (e.g. low/adequate/high) with context."),
  suitableCrops: z
    .array(z.string())
    .max(5)
    .describe("Top 5 crops that fit this soil and likely African conditions."),
  recommendations: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("3-5 concrete, numbered action recommendations for the farmer."),
  fertilizerAdvice: z
    .string()
    .describe("Fertilizer advice including type, rate, and timing in simple terms."),
  irrigationNeeds: z
    .string()
    .describe("Irrigation and moisture management needs for this soil."),
});

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON in request body", { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return new Response("Invalid request body", { status: 400 });
  }

  const { imageBase64, mimeType, farmerId } = body as {
    imageBase64?: string;
    mimeType?: string;
    farmerId?: number | null;
  };

  if (!imageBase64 || !mimeType) {
    return new Response("`imageBase64` and `mimeType` are required", {
      status: 400,
    });
  }

  const systemPrompt =
    "You are a senior soil scientist with 20 years of field experience in East and Sub-Saharan Africa. " +
    "You are examining a real soil photo taken by a farmer on their phone. " +
    "Analyze the image carefully: look at soil color, texture, moisture, structure, organic debris, and any visible characteristics. " +
    "Give practical, farmer-friendly advice focused on low-cost improvements available in rural Africa.";

  const { object } = await generateObject({
    model: gateway("claude-sonnet-4-20250514"),
    system: systemPrompt,
    schema: soilAnalysisSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: `data:${mimeType};base64,${imageBase64}`,
          },
          {
            type: "text",
            text: "Examine this soil photo and fill in the soil analysis fields. Be specific about what you observe in the image — color, texture, moisture level, and any visible organic matter.",
          },
        ],
      },
    ],
  });

  try {
    const imageUrl = `data:${mimeType};base64,${imageBase64}`;

    await prisma.soilAnalysis.create({
      data: {
        farmerId: farmerId ?? null,
        imageUrl,
        result: object as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[/api/analyze-soil] Failed to save soil analysis:", error);
  }

  return Response.json(object);
}

