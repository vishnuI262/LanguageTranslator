import express from "express";
import multer from "multer";
import fs from "fs";
import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";
import OpenAI from "openai";
import cors from "cors";
import dotenv from "dotenv";
import sharp from "sharp";
import { fromPath } from "pdf2pic";

dotenv.config();

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("✅ Backend is working! 🚀");
});

let uploadedKnowledge = "";

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded!" });

    console.log("--Uploaded file:", file.originalname);
    console.log("--MIME type:", file.mimetype);

    let extractedText = "";

    if (file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(file.path);
      const parsed = await pdfParse(dataBuffer);
      extractedText = parsed.text.trim();

      if (extractedText.length < 50) {
        console.log("--Not enough text from PDF, switching to OCR...");

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
      } else {
        console.log("Extracted text from PDF:", extractedText.slice(0, 500));
      }
    } else if (file.mimetype.startsWith("image/")) {
      console.log("--Running Tesseract OCR for image...");
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
      console.log("--Extracted text from image:", extractedText.slice(0, 500));
    } else if (file.mimetype === "text/plain") {
      extractedText = fs.readFileSync(file.path, "utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type!" });
    }

    const safeText = extractedText.slice(0, 4000);

    console.log("--Sending text to OpenAI for translation...");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional translator." },
        {
          role: "user",
          content: `This text may contain Arabic, Turkish, or both. Translate all parts to English accurately:\n\n${safeText}`,
        },
      ],
    });

    const translated = completion.choices[0].message.content;
    console.log("--Translation successful!");
    console.log("--Translated Preview:", translated.slice(0, 500));

    uploadedKnowledge = translated;

    res.json({
      original: extractedText,
      translated: translated,
    });
  } catch (error) {
    console.error("--Error in /upload route:", error);
    res.status(500).json({ error: "Translation failed!" });
  }
});

app.post("/ask", express.json(), async (req, res) => {
  const { question } = req.body;
  console.log("--User question received:", question);

  const contextText =
    uploadedKnowledge ||
    "No document has been uploaded. Answer based on general knowledge.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
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

app.listen(5000, () =>
  console.log("--Server running on http://localhost:5000")
);
