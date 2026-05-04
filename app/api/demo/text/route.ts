import { NextRequest } from "next/server";
import { groq, GROQ_MODEL, buildSystemPrompt, buildAdultSystemPrompt, DEMO_SYSTEM_PROMPT, type PersonaConfig } from "@/lib/ai/groq";

export const runtime = "nodejs";

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  let messages: Message[];
  let persona: PersonaConfig | undefined;
  let allowAdult = false;

  try {
    const body = await req.json();
    messages = body.messages;
    persona = body.persona;
    allowAdult = body.allowAdult === true;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400 });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  // Sanitize persona fields to prevent prompt injection
  let systemPrompt = DEMO_SYSTEM_PROMPT;
  if (persona) {
    const safeName = typeof persona.name === "string" ? persona.name.slice(0, 30) : "Alex";
    const safeAge =
      typeof persona.age === "number" && persona.age >= 18 && persona.age <= 99
        ? persona.age
        : 25;
    const safeCountry =
      typeof persona.country === "string" ? persona.country.slice(0, 60) : "Unknown";
    const safePersonality =
      typeof persona.personality === "string" ? persona.personality.slice(0, 600) : "";

    const safePersona: PersonaConfig = { name: safeName, age: safeAge, country: safeCountry, personality: safePersonality };
    systemPrompt = allowAdult ? buildAdultSystemPrompt(safePersona) : buildSystemPrompt(safePersona);
  }

  const trimmed = messages.slice(-20);

  const stream = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...trimmed],
    stream: true,
    max_tokens: 80,
    temperature: 1.1,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Simulate reading + thinking before typing starts (1–5 s)
        const thinkMs = 1000 + Math.floor(Math.random() * 4000);
        await new Promise((resolve) => setTimeout(resolve, thinkMs));

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            controller.enqueue(encoder.encode(text));
            // Simulate typing speed: ~5–15 ms per token chunk
            const typeMs = 5 + Math.floor(Math.random() * 10);
            await new Promise((resolve) => setTimeout(resolve, typeMs));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
