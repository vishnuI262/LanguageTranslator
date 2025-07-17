import express from "express";
import multer from "multer";
import fs from "fs";
import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";
import OpenAI from "openai";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import sharp from "sharp";
import { fromPath } from "pdf2pic";

import connectDB from "./db.js";
import Chat from "./models/Chat.js";
import Document from "./models/Document.js";

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Backend is working!");
});

// let uploadedKnowledge = "";

app.post("/upload", upload.single("file"), async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const file = req.file;
    if (!file) {
      res.write("data: [ERROR] No file uploaded!\n\n");
      return res.end();
    }

    console.log("--Uploaded file:", file.originalname);
    console.log("--MIME type:", file.mimetype);

    let extractedText = "";

    // 🧠 Handle PDF, image, or text file
    if (file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(file.path);
      const parsed = await pdfParse(dataBuffer);
      extractedText = parsed.text.trim();

      if (extractedText.length < 50) {
        console.log("--Fallback to OCR...");
        const convert = fromPath(file.path, {
          density: 300,
          saveFilename: "page",
          savePath: "./tempImages",
          format: "png",
        });

        await convert.bulk(-1);
        const images = fs.readdirSync("./tempImages");

        for (const image of images) {
          const processedImagePath = `./tempImages/processed_${image}`;
          await sharp(`./tempImages/${image}`)
            .resize(1600)
            .grayscale()
            .normalize()
            .toFile(processedImagePath);

          const {
            data: { text },
          } = await Tesseract.recognize(processedImagePath, "ara+tur", {
            langPath: "./tessdata",
            logger: (m) => console.log(m),
          });

          extractedText += text + "\n";
        }
      }
    } else if (file.mimetype.startsWith("image/")) {
      console.log("--Tesseract OCR for image...");
      const processedImagePath = `uploads/processed_${file.filename}.png`;

      await sharp(file.path)
        .resize(1600)
        .grayscale()
        .normalize()
        .toFile(processedImagePath);

      const {
        data: { text },
      } = await Tesseract.recognize(processedImagePath, "ara+tur", {
        langPath: "./tessdata",
        logger: (m) => console.log(m),
      });

      extractedText = text;
    } else if (file.mimetype === "text/plain") {
      extractedText = fs.readFileSync(file.path, "utf-8");
    } else {
      res.write("data: [ERROR] Unsupported file type!\n\n");
      return res.end();
    }

    const newDoc = new Document({
      name: file.originalname,
      content: extractedText,
      uploadedAt: new Date(),
    });

    await newDoc.save();
    console.log(`Saved document "${file.originalname}" to database.`);

    const safeText = extractedText.slice(0, 4000);

    console.log("--Starting streaming translation...");

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: "You are a professional translator." },
        {
          role: "user",
          content: `This text may contain Arabic, Turkish, or both. Translate all parts to English accurately:\n\n${safeText}`,
        },
      ],
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        res.write(`data: ${content}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("--Error in streaming /upload:", error);
    res.write("data: [ERROR] Translation failed!\n\n");
    res.end();
  }
});

app.post("/ask", express.json(), async (req, res) => {
  const { question } = req.body;
  console.log("--User question received:", question);
  const allDocs = await Document.find({});
  const contextText =
    allDocs.map((doc) => doc.content).join("\n") ||
    "No document has been uploaded. Answer based on general knowledge.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Answer questions using the provided document if available, otherwise use your general knowledge.",
        },
        { role: "user", content: `Document: ${contextText}` },
        { role: "user", content: `Question: ${question}` },
      ],
    });

    const answer = completion.choices[0].message.content;
    console.log("--Answer generated:", answer);
    res.json({ answer });
  } catch (error) {
    console.error("--Error in /ask route:", error);
    res.status(500).json({ error: "Question answering failed!" });
  }
});

app.post("/ask-stream", express.json(), async (req, res) => {
  const { question } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const allDocs = await Document.find({});
    const contextText =
      allDocs.map((doc) => doc.content).join("\n") ||
      "No document has been uploaded. Answer based on general knowledge.";

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: "You're a helpful assistant..." },
        { role: "user", content: `Document: ${contextText}` },
        { role: "user", content: `Question: ${question}` },
      ],
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        res.write(`data: ${content}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Streaming error:", err);
    res.write("data: [ERROR]\n\n");
    res.end();
  }
});

// Example: Express.js route

app.post("/generate-title", async (req, res) => {
  if (!req.body || !Array.isArray(req.body.messages)) {
    return res.status(400).json({ error: "Invalid or missing messages array" });
  }

  const { messages } = req.body;

  const prompt = `
    Based on the following conversation messages, generate a short and clear chat title in 5 words or less.

    Messages:
    ${messages
      .map((m) => `${m.type === "user" ? "User" : "AI"}: ${m.text}`)
      .join("\n")}

    Title:
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    const title =
      response.choices?.[0]?.message?.content?.trim().replace(/^"|"$/g, "") ||
      "Untitled Chat";
    res.json({ title });
  } catch (err) {
    console.error("Title generation failed:", err);
    res.status(500).json({ error: "Failed to generate title" });
  }
});

// Fetch all documents
app.get("/documents", async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadedAt: -1 });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

app.post("/api/save-chat", async (req, res) => {
  try {
    const { messages, title } = req.body;

    const newChat = new Chat({
      title,
      messages,
    });

    const saved = await newChat.save();
    res.json({ success: true, chat: saved });
  } catch (err) {
    console.error("Failed to save chat:", err);
    res.status(500).json({ error: "Failed to save chat" });
  }
});

app.get("/api/chats", async (req, res) => {
  try {
    const chats = await Chat.find().sort({ createdAt: -1 });
    res.json(chats);
  } catch (err) {
    console.error("Failed to fetch chats:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.listen(5000, () =>
  console.log("--Server running on http://localhost:5000")
);
