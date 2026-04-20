require("dotenv").config();

const express = require("express");
const path = require("path");
const { chatWithDocuments } = require("./src/chat-service");
const { searchDocuments } = require("./src/search-service");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/search", async (req, res) => {
  const query = (req.body?.query || "").trim();

  if (!query) {
    return res.status(400).json({ error: "Query is required." });
  }

  try {
    const results = await searchDocuments(query);
    return res.json({ query, results });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({
      error: "Failed to run search.",
      details: error.message
    });
  }
});

app.post("/api/chat", async (req, res) => {
  const question = (req.body?.question || "").trim();
  const filters = {
    sourceType: req.body?.sourceType || "",
    startDate: req.body?.startDate || "",
    endDate: req.body?.endDate || ""
  };

  if (!question) {
    return res.status(400).json({ error: "Question is required." });
  }

  try {
    const result = await chatWithDocuments(question, filters);
    return res.json({ question, ...result });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({
      error: "Failed to run chat.",
      details: error.message
    });
  }
});

app.post("/api/chat/stream", async (req, res) => {
  const question = (req.body?.question || "").trim();
  const filters = {
    sourceType: req.body?.sourceType || "",
    startDate: req.body?.startDate || "",
    endDate: req.body?.endDate || ""
  };

  if (!question) {
    return res.status(400).json({ error: "Question is required." });
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const writeEvent = (payload) => {
    res.write(`${JSON.stringify(payload)}\n`);
  };

  try {
    writeEvent({ type: "status", stage: "start", message: "Memulai proses chat" });
    const result = await chatWithDocuments(question, filters, writeEvent);
    writeEvent({ type: "done", question, ...result });
    return res.end();
  } catch (error) {
    console.error("Chat stream error:", error);
    writeEvent({
      type: "error",
      error: "Failed to run chat.",
      details: error.message
    });
    return res.end();
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
