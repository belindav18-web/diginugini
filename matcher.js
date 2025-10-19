// Load once at boot
import kb from "./diginu_kb_clean.json"; // path to the cleaned file

const ITEMS = kb.items || [];
const norm = s => (s || "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

function tokens(s){ return new Set(norm(s).split(" ").filter(Boolean)); }

function jaccard(a, b){
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function scoreItem(qTokens, it){
  let best = jaccard(qTokens, tokens(it.question));
  if (Array.isArray(it.aliases)) {
    for (const a of it.aliases) {
      const s = jaccard(qTokens, tokens(a));
      if (s > best) best = s;
    }
  }
  return best;
}

export function findKbAnswer(userText){
  const qTokens = tokens(userText);
  let best = { score: 0, item: null };
  for (const it of ITEMS){
    const s = scoreItem(qTokens, it);
    if (s > best.score) best = { score: s, item: it };
  }

  // Tune this threshold. 0.25–0.35 works well for short FAQs.
  const CONF_THRESHOLD = 0.28;

  if (best.item && best.score >= CONF_THRESHOLD) {
    return best.item;  // {question, answer, ...}
  }

  // No confident match → let your LLM or default handle it
  return null;
}
