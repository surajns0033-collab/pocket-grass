import test from "node:test";
import assert from "node:assert/strict";
import { newText, parseCard, parseSpoken, tooClose } from "../lib/parse.js";
import { retrieve } from "../lib/catalog.js";
import { whereLine } from "../lib/assemble.js";
import { assess, describe } from "../lib/weather.js";
import { familyOf, formatChat } from "../lib/prompt.js";

test("parse keeps the last four-line card", () => {
  const text = [
    "Title: Ignore this",
    "Where: No.",
    "Notice: No.",
    "Pocket: No.",
    "Title: Leaf count",
    "Where: Stand by the nearest tree.",
    "Notice: Find one leaf with a hole in it.",
    "Pocket: Put the phone away until you have found that leaf.",
  ].join("\n");
  assert.deepEqual(parseCard(text), {
    title: "Leaf count",
    where: "Stand by the nearest tree.",
    notice: "Find one leaf with a hole in it.",
    pocket: "Put the phone away until you have found that leaf.",
  });
});

test("parse rejects a card missing a line", () => {
  assert.equal(parseCard("Title: Only\nWhere: Here"), null);
});

test("copied example titles are rejected", () => {
  const example = { title: "One leaf, up close", notice: "Look at one leaf." };
  assert.equal(tooClose({ title: "One leaf, up close", notice: "Something else." }, example), true);
  assert.equal(tooClose({ title: "Wet bark", notice: "Touch the bark." }, example), false);
});

test("retrieval prefers place and sense", () => {
  const item = retrieve("trail", "birds", "cloud");
  assert.equal(item.id, "trail-birds");
});

test("thunder keeps the person inside", () => {
  const sky = assess({ weather_code: 95, temperature_2m: 22, is_day: 1, wind_speed_10m: 10 }, "Pune");
  assert.equal(describe(95), "storm");
  assert.equal(sky.stayIn, true);
});

test("leaked prompt is cut back to the model reply", () => {
  const prompt = "long prompt\n<<<\nNotice: Listen until you hear ";
  const full = `${prompt}one bird that is not a car`;
  assert.match(newText(full, "different-prefix"), /one bird that is not a car/);
  assert.deepEqual(parseSpoken(newText(full, prompt)), {
    title: "One bird that is",
    notice: "Listen until you hear one bird that is not a car.",
  });
});

test("rain tells you to stay under cover", () => {
  assert.match(whereLine("park", { summary: "rain", isDay: true, tempC: 20 }), /open rain/);
});

test("Gemma chat wraps the system line into the first user turn", () => {
  const prompt = formatChat(
    [
      { role: "system", content: "Be brief." },
      { role: "user", content: "Finish the sentence." },
    ],
    "gemma",
  );
  assert.match(prompt, /<start_of_turn>user\nBe brief.\n\nFinish the sentence.<end_of_turn>/);
  assert.match(prompt, /<start_of_turn>model\n$/);
  assert.equal(familyOf("onnx-community/gemma-3-270m-it-ONNX"), "gemma");
});

test("rain adds a cover constraint and does not stay-in by itself", () => {
  const sky = assess({ weather_code: 61, temperature_2m: 19, is_day: 1, wind_speed_10m: 8 }, "Pune");
  assert.equal(sky.summary, "rain");
  assert.equal(sky.stayIn, false);
  assert.match(sky.constraint, /under a roof/);
});
