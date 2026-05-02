# Plainly

Understand any webpage instantly. Summarise, simplify, find red flags, check trustworthiness — all running locally on your device. No data ever leaves your browser.

![demo](demo.gif)

## Why

Every AI browser extension sends your page content to a server. Plainly doesn't. The model runs entirely in your browser using WebLLM + Llama 3.2. Your data stays yours.

## Features

- 5 analysis modes: Summarise, Simplify, Red Flags, Key Facts, Trust Check
- Streams output token by token
- Caches results per page — no re-running on the same URL
- Works on any webpage including paywalled content you can already see
- Chromium only (Chrome, Edge, Brave)

## Install

1. Clone this repo
   ```bash
   git clone https://github.com/yourusername/plainly.git
   cd plainly
   ```

2. Download the WebLLM bundle
   ```bash
   curl -L -o webllm.js "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/lib/index.js"
   ```

3. Go to `chrome://extensions` → Enable Developer Mode → Load unpacked → select the `plainly` folder

4. Click the extension icon — first run downloads ~2GB of model weights (cached after that, never uploaded anywhere)

## Usage

Navigate to any webpage, click the Plainly icon, pick a mode and hit **Analyse this page**.

| Mode | What it does |
|------|-------------|
| Summarise | 3-5 sentence summary of the page |
| Simple | Explains it like you're 12 |
| Red flags | Finds shady clauses, hidden fees, data collection |
| Key facts | Top 5 facts as a bullet list |
| Trust | Checks for bias, manipulation, credibility signals |

## Stack

- [WebLLM](https://github.com/mlc-ai/web-llm) — in-browser LLM inference via WebAssembly
- Llama 3.2 3B Instruct (q4f16 quantised)
- Chrome Extensions Manifest V3

## Privacy

- No backend, no API calls, no telemetry
- The model runs entirely in your browser via WebAssembly
- Page content never leaves your device
- Results are cached locally in `chrome.storage.local`

## License

MIT
