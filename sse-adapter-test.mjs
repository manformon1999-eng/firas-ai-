// Standalone test of the Max-engine SSE parsing (mirrors server.mjs adapters).
// Validates Anthropic + OpenRouter event handling and cross-chunk line buffering.

function parseAnthropic(chunks) {
  const out = { content: "", reasoning: "" };
  let buffer = "", any = false;
  const dec = new TextDecoder();
  for (const c of chunks) {
    buffer += dec.decode(c, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt; try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.type === "content_block_delta" && evt.delta) {
        if (evt.delta.type === "text_delta" && evt.delta.text) { out.content += evt.delta.text; any = true; }
        else if (evt.delta.type === "thinking_delta" && evt.delta.thinking) { out.reasoning += evt.delta.thinking; }
      } else if (evt.type === "error" && !any) { return { ...out, served: false }; }
    }
  }
  return { ...out, served: any };
}

function parseOpenRouter(chunks) {
  const out = { content: "", reasoning: "" };
  let buffer = "", any = false;
  const dec = new TextDecoder();
  for (const c of chunks) {
    buffer += dec.decode(c, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt; try { evt = JSON.parse(payload); } catch { continue; }
      const delta = evt.choices && evt.choices[0] && evt.choices[0].delta;
      if (delta) {
        if (delta.reasoning) out.reasoning += delta.reasoning;
        if (delta.content) { out.content += delta.content; any = true; }
      }
    }
  }
  return { ...out, served: any };
}

const enc = (s) => new TextEncoder().encode(s);
let pass = 0, fail = 0;
const eq = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) { pass++; } else { fail++; console.log("FAIL", name, "\n  got ", JSON.stringify(got), "\n  want", JSON.stringify(want)); } };

// 1) Anthropic happy path (event: lines ignored, text_delta collected) — note the
//    raw stream is split into chunks that break mid-line to test buffering.
const anthRaw =
  'event: message_start\ndata: {"type":"message_start"}\n\n' +
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}\n\n' +
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo wo"}}\n\n' +
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}\n\n' +
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"rld"}}\n\n' +
  'event: message_stop\ndata: {"type":"message_stop"}\n\n';
// split the raw stream at an awkward byte boundary (mid JSON line)
const cut = 120;
eq("anthropic", parseAnthropic([enc(anthRaw.slice(0, cut)), enc(anthRaw.slice(cut))]),
   { content: "Hello world", reasoning: "hmm", served: true });

// 2) Anthropic error before any content → not served (caller falls back)
const anthErr = 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error"}}\n\n';
eq("anthropic-error", parseAnthropic([enc(anthErr)]), { content: "", reasoning: "", served: false });

// 3) OpenRouter / DeepSeek-R1 (reasoning + content, [DONE] ignored)
const orRaw =
  'data: {"choices":[{"delta":{"reasoning":"think.."}}]}\n\n' +
  'data: {"choices":[{"delta":{"content":"4"}}]}\n\n' +
  'data: {"choices":[{"delta":{"content":" total"}}]}\n\n' +
  'data: [DONE]\n\n';
eq("openrouter", parseOpenRouter([enc(orRaw.slice(0, 40)), enc(orRaw.slice(40))]),
   { content: "4 total", reasoning: "think..", served: true });

// 4) OpenRouter empty stream → not served
eq("openrouter-empty", parseOpenRouter([enc('data: [DONE]\n\n')]), { content: "", reasoning: "", served: false });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
