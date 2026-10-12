const DEFAULT_URL = "https://inference.do-ai.run/v1";
const DEFAULT_MODEL = "gemma-4-31B-it";

export function gradientConfig() {
  const key = (process.env.DIGITALOCEAN_INFERENCE_KEY || process.env.MODEL_ACCESS_KEY || "").trim();
  if (!key) return null;
  return {
    url: (process.env.DIGITALOCEAN_INFERENCE_URL || DEFAULT_URL).replace(/\/$/, ""),
    key,
    model: process.env.DIGITALOCEAN_INFERENCE_MODEL || DEFAULT_MODEL,
  };
}

export async function completeOnGradient({ messages, lead, maxTokens = 24 }) {
  const config = gradientConfig();
  if (!config) throw new Error("DigitalOcean Gradient is not configured.");
  const body = {
    model: config.model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  };
  const response = await fetch(`${config.url}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`DigitalOcean Gradient returned ${response.status}.`);
    error.status = response.status >= 400 && response.status < 500 ? 502 : 502;
    error.raw = text.slice(0, 400);
    throw error;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw Object.assign(new Error("DigitalOcean Gradient sent a non-JSON reply."), { raw: text.slice(0, 400) });
  }
  const content = data.choices?.[0]?.message?.content || "";
  return `${lead}${content}`.trim();
}
