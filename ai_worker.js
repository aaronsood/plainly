import * as webllm from './webllm.js';

let engine = null;

self.onmessage = async (e) => {
  const { type, text, mode } = e.data;

  if (type === 'LOAD') {
    try {
      const initProgressCallback = (report) => {
        self.postMessage({ type: 'LOADING', progress: Math.round(report.progress * 100), text: report.text });
      };
      engine = await webllm.CreateMLCEngine(
        'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        { initProgressCallback }
      );
      self.postMessage({ type: 'READY' });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }

  if (type === 'ANALYSE') {
    const prompts = {
      summarise: `Summarise this webpage content in 3-5 clear sentences. Be concise and factual.\n\n${text}`,
      eli5: `Explain this webpage like I'm 12 years old. Use simple words and short sentences.\n\n${text}`,
      redflags: `Read this and list any red flags, concerning clauses, hidden fees, data collection, or anything suspicious. If nothing concerning, say so.\n\n${text}`,
      keyfacts: `Extract the 5 most important facts from this page as a bullet list.\n\n${text}`,
      trustcheck: `Assess whether this page seems trustworthy. Look for bias, manipulation, misleading claims, or credibility signals.\n\n${text}`
    };

    try {
      const chunks = await engine.chat.completions.create({
        messages: [{ role: 'user', content: prompts[mode] || prompts.summarise }],
        stream: true,
        max_tokens: 512
      });
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) self.postMessage({ type: 'CHUNK', chunk: delta });
      }
      self.postMessage({ type: 'DONE' });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
};