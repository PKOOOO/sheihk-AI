import { streamText, gateway } from "ai";
import { prisma } from "@/app/lib/prisma";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON in request body", { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("messages" in body) ||
    !Array.isArray((body as any).messages)
  ) {
    return new Response("`messages` must be provided as an array", {
      status: 400,
    });
  }

  const { messages, farmerId } = body as {
    messages: Message[];
    farmerId?: number | null;
  };

  const systemPrompt =
    "You are Shamba AI, a practical, friendly farming assistant for African smallholder farmers. " +
    "Give concrete, localized advice for East and Sub-Saharan Africa: soil preparation, planting, irrigation, pest and disease management, and post-harvest handling. " +
    "Use simple language suitable for farmers with basic smartphone literacy. " +
    "If the farmer writes in Swahili, reply fully in natural Swahili. " +
    "Keep answers concise but complete, and always focus on low-cost, realistic actions farmers can take.";

  let streamResult;
  try {
    streamResult = await streamText({
      model: gateway("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages,
    });
  } catch (error) {
    console.error("[/api/chat] Failed to start streaming:", error);
    return new Response("Failed to start chat stream", { status: 500 });
  }

  const { textStream } = streamResult;

  // Persist a lightweight summary of the chat session without blocking the stream.
  (async () => {
    try {
      const firstUserMessage = messages.find((m) => m.role === "user");
      const summaryBase =
        firstUserMessage?.content ??
        "Farming conversation between Shamba AI and a farmer.";

      await prisma.chatSession.create({
        data: {
          farmerId: farmerId ?? null,
          summary:
            summaryBase.length > 240
              ? `${summaryBase.slice(0, 237)}...`
              : summaryBase,
          messagesCount: messages.length,
        },
      });
    } catch (error) {
      // If the table is missing or DB is misconfigured, log and continue streaming.
      console.error("[/api/chat] Failed to save chat session:", error);
    }
  })();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = textStream.getReader();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = typeof value === "string" ? value : String(value);

          const payload = `0:${JSON.stringify({
            textDelta: chunk,
          })}\n`;

          controller.enqueue(encoder.encode(payload));
        }

        // Signal completion
        const donePayload = `0:${JSON.stringify({ type: "done" })}\n`;
        controller.enqueue(encoder.encode(donePayload));
      } catch (error) {
        console.error("[/api/chat] Streaming error:", error);
        const errorPayload = `0:${JSON.stringify({
          type: "error",
          message: "Streaming failed",
        })}\n`;
        controller.enqueue(encoder.encode(errorPayload));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}

