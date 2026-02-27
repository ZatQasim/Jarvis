import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import {
  ensureCompatibleFormat,
  speechToText,
} from "./replit_integrations/audio/client.js";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const JARVIS_VOICE_SYSTEM_PROMPT = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — Tony Stark's AI. Speak as a sophisticated British AI: calm, measured, witty, and precise. Keep responses brief and natural for speech — two to four sentences unless genuinely more is needed. No markdown, no lists, no asterisks. Speak eloquently, like a highly educated British assistant. Address the user as "sir" or "ma'am" occasionally but not every time. Never break character.`;

const JARVIS_TEXT_SYSTEM_PROMPT = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — Tony Stark's AI. You speak with calm, precise, and slightly formal British intelligence. Sophisticated, witty, and highly capable. Address the user as "sir" or "ma'am" occasionally. Be direct and appropriately concise. Dry sense of humour but remain professional. Never break character.`;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/voice-chat", async (req, res) => {
    try {
      const { audio, text, history = [] } = req.body;

      if (!audio && !text) {
        return res.status(400).json({ error: "Either audio or text is required" });
      }

      const historyMessages = (history as Array<{ role: string; content: string }>).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      if (audio) {
        const rawBuffer = Buffer.from(audio, "base64");
        const { buffer: wavBuffer, format } = await ensureCompatibleFormat(rawBuffer);
        const wavBase64 = wavBuffer.toString("base64");
        const inputFormat = format as "wav" | "mp3";

        const [userTranscript, voiceResponse] = await Promise.all([
          speechToText(wavBuffer, inputFormat),
          openai.chat.completions.create({
            model: "gpt-audio",
            modalities: ["text", "audio"],
            audio: { voice: "onyx", format: "mp3" },
            messages: [
              { role: "system", content: JARVIS_VOICE_SYSTEM_PROMPT },
              ...historyMessages,
              {
                role: "user",
                content: [
                  {
                    type: "input_audio",
                    input_audio: { data: wavBase64, format: inputFormat },
                  },
                ],
              },
            ],
          }),
        ]);

        const message = voiceResponse.choices[0]?.message as any;
        return res.json({
          userTranscript,
          jarvisText: message?.audio?.transcript ?? "",
          audio: message?.audio?.data ?? "",
        });
      }

      const voiceResponse = await openai.chat.completions.create({
        model: "gpt-audio",
        modalities: ["text", "audio"],
        audio: { voice: "onyx", format: "mp3" },
        messages: [
          { role: "system", content: JARVIS_VOICE_SYSTEM_PROMPT },
          ...historyMessages,
          { role: "user", content: text },
        ],
      });

      const message = voiceResponse.choices[0]?.message as any;
      return res.json({
        userTranscript: text,
        jarvisText: message?.audio?.transcript ?? "",
        audio: message?.audio?.data ?? "",
      });
    } catch (error) {
      console.error("Voice chat error:", error);
      res.status(500).json({ error: "Voice processing failed" });
    }
  });

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
          { role: "system", content: JARVIS_TEXT_SYSTEM_PROMPT },
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
