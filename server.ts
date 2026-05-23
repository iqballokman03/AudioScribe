import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const upload = multer({ dest: "/tmp/uploads/" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON (increased limit for large summaries)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Routes
  const uploadsDir = path.join(process.cwd(), "tmp", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Handle traditional transcribe for small files
  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }
    const { model } = req.body;
    await handleTranscription(req.file.path, req.file.mimetype, req.file.originalname, model, res);
  });

  app.post("/api/upload/start", (req, res) => {
    const uploadId = Date.now().toString() + "-" + Math.random().toString(36).substring(7);
    res.json({ uploadId });
  });

  app.post("/api/upload/chunk", upload.single("chunk"), (req, res) => {
    const { uploadId } = req.body;
    if (!uploadId || !req.file) {
      return res.status(400).json({ error: "Missing uploadId or chunk" });
    }
    const chunkPath = path.join(uploadsDir, uploadId);
    fs.appendFileSync(chunkPath, fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path); // Clean up multer temp file
    res.json({ success: true });
  });

  app.post("/api/upload/finish", async (req, res) => {
    const { uploadId, mimetype, originalname, model } = req.body;
    if (!uploadId || !mimetype) {
      return res.status(400).json({ error: "Missing upload details" });
    }
    const finalPath = path.join(uploadsDir, uploadId);
    if (!fs.existsSync(finalPath)) {
      return res.status(404).json({ error: "Upload not found" });
    }
    await handleTranscription(finalPath, mimetype, originalname || "audio.webm", model, res);
  });

  async function handleTranscription(filePath: string, mimeType: string, originalName: string, model: string, res: express.Response) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set. Please configure a valid API key.");
      }
      
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });

      const stats = fs.statSync(filePath);
      const uploadResult = await ai.files.upload({
        file: filePath,
        config: { mimeType: mimeType },
      });
      console.log(`File uploaded successfully: ${uploadResult.uri}`);

      const promptText = `
        You are an expert audio transcription assistant.
        Process the provided audio file and generate a detailed transcription.
        
        Requirements:
        1. Identify distinct speakers (e.g., Speaker 1, Speaker 2, or names if context allows).
        2. Provide accurate timestamps for each segment (Format: MM:SS).
        3. Detect the primary language of each segment.
        4. If the segment is in a language different than English, also provide the English translation.
        5. Identify the primary emotion of the speaker in this segment. You MUST choose exactly one of the following: Happy, Sad, Angry, Neutral.
        
        Output Format: JSON object with the following structure:
        {
          "segments": [
            {
              "speaker": "Speaker 1",
              "timestamp": "00:00 - 00:15",
              "content": "Hello, how are you doing today?",
              "language": "English",
              "language_code": "en",
              "translation": "",
              "emotion": "Happy"
            }
          ]
        }
      `;

      console.log(`Generating content using model: ${model || 'gemini-3.1-pro-preview'}`);
      const response = await ai.models.generateContent({
        model: model || "gemini-3.1-pro-preview",
        contents: {
          parts: [
            {
              fileData: {
                fileUri: uploadResult.uri,
                mimeType: uploadResult.mimeType,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: "application/json",
        },
      });

      let responseText = response.text || "{}";
      responseText = responseText
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
        
      const data = JSON.parse(responseText);
      let markdown = "";

      if (data.segments && Array.isArray(data.segments)) {
        data.segments.forEach((segment: any) => {
          markdown += `**[${segment.timestamp}] ${segment.speaker}** `;
          if (segment.emotion) {
            markdown += `*(Emotion: ${segment.emotion})* `;
          }
          if (segment.language && segment.language.toLowerCase() !== "english") {
            markdown += `*[Language: ${segment.language}]* `;
          }
          markdown += `\n${segment.content}\n`;

          if (segment.translation) {
            markdown += `> **Translation:** ${segment.translation}\n`;
          }
          markdown += `\n`;
        });
      }

      res.json({ markdown: markdown.trim() || responseText, data });
    } catch (err: any) {
      console.error("Transcription error:", err);
      let errorMessage = "Transcription failed";
      if (err.message) {
        let msg = err.message;
        if (msg.startsWith("ApiError: ")) {
          msg = msg.substring(10).trim();
        }
        
        try {
          const parsed = JSON.parse(msg);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          } else if (parsed[0] && parsed[0].error && parsed[0].error.message) {
            errorMessage = parsed[0].error.message;
          } else {
            errorMessage = err.message;
          }
        } catch(e) {
          errorMessage = err.message;
        }

        if (errorMessage.includes("API key not valid")) {
          errorMessage = "Invalid Gemini API Key. Please update it in your environment settings (GEMINI_API_KEY).";
        }
      }
      res.status(500).json({ error: errorMessage });
    } finally {
      fs.unlink(filePath, () => {});
    }
  }

  app.post("/api/summarize", async (req, res) => {
    const { text, language, model } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set. Please configure a valid API key.");
      }
      
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });

      const response = await ai.models.generateContent({
        model: model || "gemini-3.1-pro-preview",
        contents: `Please provide a concise and well-structured summary of the following transcription in ${language || 'English'}:\n\n${text}`,
      });

      res.json({ text: response.text || "" });
    } catch (err: any) {
      console.error("Summarization error:", err);
      let errorMessage = "Summarization failed";
      if (err.message) {
        let msg = err.message;
        if (msg.startsWith("ApiError: ")) {
          msg = msg.substring(10).trim();
        }
        
        try {
          const parsed = JSON.parse(msg);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          } else if (parsed[0] && parsed[0].error && parsed[0].error.message) {
            errorMessage = parsed[0].error.message;
          } else {
            errorMessage = err.message;
          }
        } catch(e) {
          errorMessage = err.message;
        }

        if (errorMessage.includes("API key not valid")) {
          errorMessage = "Invalid Gemini API Key. Please update it in your environment settings (GEMINI_API_KEY).";
        }
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
