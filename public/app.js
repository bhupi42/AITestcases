const form = document.getElementById("generator-form");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const cardsEl = document.getElementById("cards");
const metaEl = document.getElementById("meta");
const excelLinkWrapEl = document.getElementById("excel-link-wrap");
const excelLinkEl = document.getElementById("excel-link");
const rawOutputEl = document.getElementById("raw-output");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");
const generateBtn = document.getElementById("generate-btn");

let latestJson = "";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#485748";
}

function renderCases(testCases) {
  cardsEl.innerHTML = "";

  if (!testCases.length) {
    cardsEl.innerHTML = "<p>No test cases generated.</p>";
    return;
  }

  for (const testCase of testCases) {
    const card = document.createElement("article");
    card.className = "card";

    const preconditions = safeArray(testCase.preconditions)
      .map((item) => `<li>${item}</li>`)
      .join("");

    const steps = safeArray(testCase.steps)
      .map((item) => `<li>${item}</li>`)
      .join("");

    card.innerHTML = `
      <h3>${testCase.id || "TC-?"} - ${testCase.title || "Untitled test"}</h3>
      <div class="badges">
        <span class="badge">${testCase.type || "Unknown"}</span>
        <span class="badge">Priority: ${testCase.priority || "N/A"}</span>
      </div>
      <p class="block-title">Preconditions</p>
      <ul>${preconditions || "<li>None</li>"}</ul>
      <p class="block-title">Steps</p>
      <ol>${steps || "<li>No steps provided</li>"}</ol>
      <p class="block-title">Expected Result</p>
      <p>${testCase.expectedResult || "Not specified"}</p>
    `;

    cardsEl.appendChild(card);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const requirement = (formData.get("requirement") || "").toString().trim();
  const model = (formData.get("model") || "").toString().trim();

  if (requirement.length < 10) {
    setStatus("Requirement must be at least 10 characters.", true);
    return;
  }

  generateBtn.disabled = true;
  setStatus("Generating test cases...");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirement, model })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to generate test cases.");
    }

    const resultForExport = {
      model: payload.model,
      count: payload.count,
      testCases: payload.testCases,
      notes: payload.notes
    };

    latestJson = JSON.stringify(resultForExport, null, 2);
    rawOutputEl.textContent = latestJson;
    metaEl.textContent = `Model: ${payload.model} | Cases: ${payload.count}`;

    if (payload.excelDownloadUrl) {
      excelLinkEl.href = payload.excelDownloadUrl;
      excelLinkEl.setAttribute("download", payload.excelFileName || "generated-test-cases.xlsx");
      excelLinkWrapEl.classList.remove("hidden");
    } else {
      excelLinkWrapEl.classList.add("hidden");
    }

    renderCases(safeArray(payload.testCases));

    resultsEl.classList.remove("hidden");
    setStatus("Done. Test cases generated successfully.");
  } catch (err) {
    setStatus(err.message || "Unexpected error", true);
  } finally {
    generateBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  if (!latestJson) {
    setStatus("No output to copy yet.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(latestJson);
    setStatus("JSON copied to clipboard.");
  } catch (_err) {
    setStatus("Clipboard access failed. Copy manually from raw output.", true);
  }
});

downloadBtn.addEventListener("click", () => {
  if (!latestJson) {
    setStatus("No output to download yet.", true);
    return;
  }

  const blob = new Blob([latestJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `generated-test-cases-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded JSON file.");
});
