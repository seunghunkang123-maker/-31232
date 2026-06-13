import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for AI Monster Generation
  app.post("/api/generate-monster", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Configuration missing" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt + "\n\nProvide the monster stats in JSON. It MUST strictly follow the D&D style statblock but in JSON. Include name (title), str, dex, con, int, wis, cha, hp, max_hp, and an HTML formatted 'content' string for traits and actions (using <b> tags for names and <br> for newlines, <hr> between sections). Format content exactly like: '<b>방어도</b> 15<br><b>이동 속도</b> 30ft<hr><b>특성</b><br><b>야수의 일격:</b> 설명<hr><b>행동</b><br><b>물기:</b> +5 명중...'",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hp: { type: Type.INTEGER },
              max_hp: { type: Type.INTEGER },
              stats: {
                type: Type.OBJECT,
                properties: {
                  str: { type: Type.INTEGER },
                  dex: { type: Type.INTEGER },
                  con: { type: Type.INTEGER },
                  int: { type: Type.INTEGER },
                  wis: { type: Type.INTEGER },
                  cha: { type: Type.INTEGER }
                },
                required: ["str", "dex", "con", "int", "wis", "cha"]
              },
              content: { type: Type.STRING }
            },
            required: ["title", "hp", "max_hp", "stats", "content"]
          }
        }
      });

      const text = response.text;
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("AI Gen error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
