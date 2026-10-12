const LABELS = ["Title", "Where", "Notice", "Pocket"];

function field(block, label) {
  const others = LABELS.filter((name) => name.toLowerCase() !== label.toLowerCase()).join("|");
  const match = block.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${others}):|$)`, "i"));
  if (!match) return "";
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCard(text) {
  if (!text || typeof text !== "string") return null;
  const starts = [...text.matchAll(/Title:/gi)];
  if (!starts.length) return null;
  const block = text.slice(starts[starts.length - 1].index);
  const card = {
    title: field(block, "Title").slice(0, 80),
    where: field(block, "Where").slice(0, 220),
    notice: field(block, "Notice").slice(0, 220),
    pocket: field(block, "Pocket").slice(0, 220),
  };
  if (!card.title || !card.where || !card.notice || !card.pocket) return null;
  return card;
}

const MARK = "\n<<<\n";

export function newText(generated, prompt) {
  let text = generated;
  if (Array.isArray(text)) {
    const last = text[text.length - 1];
    text = typeof last === "string" ? last : last?.content || "";
  }
  if (typeof text !== "string") text = String(text ?? "");
  if (prompt && text.startsWith(prompt)) text = text.slice(prompt.length);
  const cut = text.lastIndexOf(MARK);
  if (cut !== -1) text = text.slice(cut + MARK.length);
  return text.replace(/<\|im_end\|>[\s\S]*$/, "").replace(/<\|im_start\|>[\s\S]*$/, "").trim();
}

export function parseSpoken(text, lead = "Listen until you hear ") {
  let body = (text || "").replace(/\s+/g, " ").trim().replace(/^notice:\s*/i, "");
  if (!body.toLowerCase().startsWith(lead.toLowerCase())) body = `${lead}${body}`;
  body = body.split(/[.!?\n]/)[0].replace(/[,"]+$/g, "").trim();
  const completion = body.slice(lead.length).trim();
  const completionWords = completion.split(/\s+/).filter(Boolean);
  if (completionWords.length < 2 || completionWords.length > 18) return null;
  if (/\d|minutes|skylight|title:|notice:|system|assistant|http|celsius|weather/i.test(completion)) return null;
  const sentence = `${body}.`;
  const title = completionWords.slice(0, 4).join(" ");
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    notice: sentence.charAt(0).toUpperCase() + sentence.slice(1),
  };
}

function norm(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tooClose(card, example) {
  return norm(card.title) === norm(example.title) || norm(card.notice) === norm(example.notice);
}
