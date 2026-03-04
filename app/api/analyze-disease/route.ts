import { generateObject, gateway } from "ai";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "../../generated/prisma/client";

const diseaseDetectionSchema = z.object({
  isHealthy: z
    .boolean()
    .describe("Whether the plant appears healthy overall (true/false)."),
  diseaseName: z
    .string()
    .describe(
      "Likely disease name or 'Unknown' if not sure, tailored to African crops.",
    ),
  confidenceLevel: z
    .string()
    .describe("Confidence level such as low/medium/high with short context."),
  affectedPlantParts: z
    .array(z.string())
    .describe("Plant parts affected, e.g. leaves, stems, roots, fruits."),
  severity: z
    .string()
    .describe("Severity level (mild/moderate/severe) and short explanation."),
  causes: z
    .string()
    .describe(
      "Likely causes, including pathogen type and contributing environmental factors.",
    ),
  treatmentImmediate: z
    .string()
    .describe("Immediate actions the farmer can take today or this week."),
  treatmentChemical: z
    .string()
    .describe(
      "Chemical treatment plan with specific actives and safety notes, or 'Not recommended'.",
    ),
  treatmentOrganic: z
    .string()
    .describe(
      "Organic/low-cost treatment options realistic for smallholder farmers.",
    ),
  treatmentPreventive: z
    .string()
    .describe("Preventive measures for the next season and long term."),
  spreadRisk: z
    .string()
    .describe("Risk of spread (low/medium/high) and whether to isolate plants."),
  estimatedYieldLoss: z
    .string()
    .describe("Estimated yield loss percentage range with explanation."),
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

  const { imageBase64, mimeType, cropType, farmerId } = body as {
    imageBase64?: string;
    mimeType?: string;
    cropType?: string;
    farmerId?: number | null;
  };

  if (!imageBase64 || !mimeType) {
    return new Response("`imageBase64` and `mimeType` are required", {
      status: 400,
    });
  }

  const systemPrompt =
    "You are a senior plant pathologist with 20 years of field experience in East and Sub-Saharan Africa. " +
    "You are examining a real crop photo taken by a farmer on their phone. " +
    "Analyze the image carefully: look at leaf color, spots, lesions, wilting, mold, insect damage, and any visible symptoms. " +
    "When symptoms are clearly visible, report medium or high confidence — do not default to low confidence when evidence is present. " +
    "Only report low confidence if the image is genuinely unclear or symptoms are ambiguous. " +
    "Give practical, farmer-friendly advice focused on low-cost treatments available in rural Africa.";

  const cropContext = cropType
    ? `The farmer reports this is a ${cropType} crop.`
    : "The farmer did not specify the crop type. Identify it from the image if possible.";

  const { object } = await generateObject({
    model: gateway("claude-sonnet-4-20250514"),
    system: systemPrompt,
    schema: diseaseDetectionSchema,
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
            text: `Examine this crop photo and fill in the disease detection fields.\n${cropContext}\nBe specific about what you see in the image.`,
          },
        ],
      },
    ],
  });

  try {
    const imageUrl = `data:${mimeType};base64,${imageBase64}`;

    await prisma.diseaseDetection.create({
      data: {
        farmerId: farmerId ?? null,
        cropType: cropType ?? null,
        imageUrl,
        result: object as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error(
      "[/api/analyze-disease] Failed to save disease detection:",
      error,
    );
  }

  return Response.json(object);
}

