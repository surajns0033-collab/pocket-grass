export function buildMessages({ placeLabel, senseLabel, sky, take }) {
  const when = sky.isDay === false ? "at night" : "outside";
  const system = [
    `Finish one short sentence about a person ${when}, at ${placeLabel}, noticing ${senseLabel}.`,
    sky.constraint || "",
    "Do not mention clocks, cities, numbers, or the weather report.",
  ]
    .filter(Boolean)
    .join(" ");
  return [
    { role: "system", content: system },
    { role: "user", content: take > 1 ? "A different sound. Finish the sentence." : "Finish the sentence." },
  ];
}

export function formatChat(messages, family = "gemma") {
  if (family === "gemma") {
    const system = messages.find((message) => message.role === "system")?.content || "";
    const turns = messages.filter((message) => message.role !== "system");
    let prompt = "";
    let firstUser = true;
    for (const message of turns) {
      const role = message.role === "assistant" ? "model" : "user";
      const prefix = firstUser && role === "user" && system ? `${system}\n\n` : "";
      if (role === "user") firstUser = false;
      prompt += `<start_of_turn>${role}\n${prefix}${String(message.content).trim()}<end_of_turn>\n`;
    }
    prompt += "<start_of_turn>model\n";
    return prompt;
  }

  let prompt = "";
  for (const message of messages) {
    prompt += `<|im_start|>${message.role}\n${message.content}<|im_end|>\n`;
  }
  prompt += "<|im_start|>assistant\n";
  return prompt;
}

export function familyOf(modelId) {
  return /gemma/i.test(modelId || "") ? "gemma" : "smol";
}
