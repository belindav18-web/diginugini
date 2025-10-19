import { findKbAnswer } from "./matcher.js";

app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  // ✅ Search in KB first
  const kbHit = findKbAnswer(userMessage);

  if (kbHit) {
    return res.json({ reply: kbHit.answer });
  }

  // ❗ If no match, fallback to AI or default
  return res.json({
    reply: "I'm not 100% sure yet. You can contact wecare@diginu.com for unanswered questions and any diginuCashBack related questions, you can email cashback@diginu.com"
  });
});
