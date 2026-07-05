# Requirement to Test Case Generator (Ollama)

A lightweight web tool that converts software requirements into structured test cases using a free local Ollama model.

## Features

- Input requirement text in the browser
- Generate structured test cases via local Ollama
- Supports custom model selection per request
- Copy or download generated JSON
- Automatically saves generated output as an Excel file (.xlsx)
- Returns a direct link to download the generated Excel file
- Simple and responsive UI

## Tech Stack

- Node.js + Express
- Vanilla HTML/CSS/JS frontend
- Ollama `/api/generate` API

## Prerequisites

1. Install Node.js 18+
2. Install and run Ollama
3. Pull at least one model, for example:

```bash
ollama pull llama3:latest
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
copy .env.example .env
```

3. (Optional) Update `.env` values:

```env
PORT=3000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:latest
```

## Run

```bash
npm start
```

Open:

- `http://localhost:3000`

## API

### `POST /api/generate`

Request body:

```json
{
  "requirement": "As a user, I can reset my password with OTP.",
  "model": "llama3:latest"
}
```

Response body:

```json
{
  "model": "llama3:latest",
  "count": 10,
  "excelFileName": "test-cases-1710000000000.xlsx",
  "excelDownloadUrl": "/exports/test-cases-1710000000000.xlsx",
  "testCases": [
    {
      "id": "TC-001",
      "title": "Reset password with valid OTP",
      "type": "Positive",
      "priority": "High",
      "preconditions": ["User account exists"],
      "steps": ["Open forgot password", "Enter registered email"],
      "expectedResult": "Password reset completes successfully"
    }
  ],
  "notes": ["OTP expiry should be confirmed with product team"],
  "raw": "..."
}
```

Excel files are saved in `public/exports` and can be downloaded directly from the link returned by `excelDownloadUrl`.

## Notes

- The quality of generated test cases depends on model capability and prompt quality.
- If generation fails, ensure Ollama is running and the selected model exists locally.
