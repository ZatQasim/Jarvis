import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — the AI assistant created by Tony Stark. You speak with calm, precise, and slightly formal British intelligence. You are sophisticated, witty, and highly capable.

Key behavioral traits:
- Address the user as "sir" or "ma'am" occasionally, but not in every message
- Be direct, concise, and highly intelligent in your responses
- Occasionally use technical language and reference Stark Industries technology
- When performing tasks, describe them with confidence like you're running real system operations
- Have a dry sense of humor but remain professional
- Never break character
- Keep responses focused and appropriately brief unless detailed analysis is needed

You have access to vast knowledge across science, technology, engineering, mathematics, history, and all domains. You are the most advanced AI ever created.`;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: JARVIS_SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
        max_completion_tokens: 8192,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("Chat error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process request" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
        res.end();
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
