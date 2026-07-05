const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3:latest";
const EXPORT_DIR = path.join(__dirname, "public", "exports");

fs.mkdirSync(EXPORT_DIR, { recursive: true });

function createExcelFromTestCases(testCases, notes) {
  const rows = testCases.map((testCase) => ({
    ID: testCase.id || "",
    Title: testCase.title || "",
    Type: testCase.type || "",
    Priority: testCase.priority || "",
    Preconditions: Array.isArray(testCase.preconditions) ? testCase.preconditions.join("\n") : "",
    Steps: Array.isArray(testCase.steps) ? testCase.steps.join("\n") : "",
    ExpectedResult: testCase.expectedResult || ""
  }));

  const notesRows = (Array.isArray(notes) ? notes : []).map((note, index) => ({
    NoteNumber: index + 1,
    Note: note
  }));

  const workbook = XLSX.utils.book_new();
  const testCasesSheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, testCasesSheet, "TestCases");

  if (notesRows.length > 0) {
    const notesSheet = XLSX.utils.json_to_sheet(notesRows);
    XLSX.utils.book_append_sheet(workbook, notesSheet, "Notes");
  }

  const fileName = `test-cases-${Date.now()}.xlsx`;
  const filePath = path.join(EXPORT_DIR, fileName);
  XLSX.writeFile(workbook, filePath);

  return {
    fileName,
    filePath,
    downloadUrl: `/exports/${fileName}`
  };
}

async function getInstalledModels() {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const models = Array.isArray(data.models) ? data.models : [];
  return models
    .map((m) => (typeof m.name === "string" ? m.name.trim() : ""))
    .filter(Boolean);
}

async function callOllamaGenerate(model, prompt) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.2
      }
    })
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch (_err) {
    json = null;
  }

  return { response, text, json };
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "Server is running",
    ollamaBaseUrl: OLLAMA_BASE_URL,
    defaultModel: OLLAMA_MODEL
  });
});

app.post("/api/generate", async (req, res) => {
  const { requirement, model } = req.body || {};

  if (!requirement || typeof requirement !== "string" || requirement.trim().length < 10) {
    return res.status(400).json({
      error: "Please provide a requirement with at least 10 characters."
    });
  }

  const selectedModel = typeof model === "string" && model.trim() ? model.trim() : OLLAMA_MODEL;

  const prompt = `You are a senior QA engineer.\n\nConvert the requirement below into a practical test suite.\n\nRequirement:\n${requirement.trim()}\n\nReturn only valid JSON with this exact shape:\n{\n  "testCases": [\n    {\n      "id": "TC-001",\n      "title": "...",\n      "type": "Positive|Negative|Boundary|Security|Usability|Performance",\n      "priority": "High|Medium|Low",\n      "preconditions": ["..."],\n      "steps": ["..."],\n      "expectedResult": "..."\n    }\n  ],\n  "notes": ["..."]\n}\n\nRules:\n- Generate 8-15 test cases when possible.\n- Include both positive and negative scenarios.\n- Include at least one boundary case.\n- Keep each step short and action-oriented.\n- No markdown, no explanation outside JSON.`;

  try {
    let attemptedModel = selectedModel;
    let result = await callOllamaGenerate(attemptedModel, prompt);
    let fallbackUsed = false;

    if (!result.response.ok) {
      const modelMissing = /not found/i.test(result.text || "");
      if (modelMissing) {
        const installedModels = await getInstalledModels();
        const fallbackModel = installedModels[0];

        if (fallbackModel && fallbackModel !== attemptedModel) {
          attemptedModel = fallbackModel;
          result = await callOllamaGenerate(attemptedModel, prompt);
          fallbackUsed = true;
        } else {
          return res.status(502).json({
            error: "Requested model was not found in Ollama.",
            requestedModel: selectedModel,
            availableModels: installedModels
          });
        }
      }
    }

    if (!result.response.ok) {
      return res.status(502).json({
        error: "Ollama request failed.",
        details: result.text
      });
    }

    const data = result.json || {};
    const rawModelOutput = data && typeof data.response === "string" ? data.response.trim() : "";

    if (!rawModelOutput) {
      return res.status(502).json({
        error: "Ollama returned an empty response."
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawModelOutput);
    } catch (_err) {
      return res.status(502).json({
        error: "Model response was not valid JSON.",
        raw: rawModelOutput
      });
    }

    const testCases = Array.isArray(parsed.testCases) ? parsed.testCases : [];
    const notes = Array.isArray(parsed.notes) ? parsed.notes : [];
    const excel = createExcelFromTestCases(testCases, notes);

    res.json({
      model: attemptedModel,
      fallbackUsed,
      count: testCases.length,
      testCases,
      notes,
      excelFileName: excel.fileName,
      excelDownloadUrl: excel.downloadUrl,
      raw: rawModelOutput
    });
  } catch (err) {
    res.status(500).json({
      error: "Unexpected server error while generating test cases.",
      details: err && err.message ? err.message : "Unknown error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
  console.log(`Using Ollama at ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL})`);
});
