import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MINUTES, PLACES, SENSES, retrieve, starter } from "./lib/catalog.js";
import { assemble, fromStarter, stem } from "./lib/assemble.js";
import { completeOnGradient, gradientConfig } from "./lib/gradient.js";
import { newText, parseSpoken, tooClose } from "./lib/parse.js";
import { buildMessages, familyOf, formatChat } from "./lib/prompt.js";
import { lookupSky } from "./lib/weather.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(root, "public");
const PORT = Number(process.env.PORT) || 4173;
const MODEL_ID = process.env.MODEL_ID || "onnx-community/gemma-3-270m-it-ONNX";
const MODEL_DTYPE = process.env.MODEL_DTYPE || "q8";
const FAMILY = familyOf(MODEL_ID);
const GRADIENT = gradientConfig();
const CARD_DEADLINE_MS = Number(process.env.CARD_DEADLINE_MS) || 10000;
const LOCAL_MODEL = process.env.LOCAL_MODEL !== "off";

const health = {
  ready: false,
  model: GRADIENT ? GRADIENT.model : MODEL_ID,
  backend: GRADIENT ? "digitalocean-gradient" : "local-gemma",
  status: "Starting",
  error: "",
};

let generatorPromise = null;
let busy = false;

function loadModel() {
  if (GRADIENT) {
    health.ready = true;
    health.status = `Gemma on DigitalOcean Gradient (${GRADIENT.model}).`;
    return Promise.resolve(null);
  }
  if (!LOCAL_MODEL) {
    health.status = "No Gradient key set; cards come from the starter deck.";
    health.starterOnly = true;
    return Promise.resolve(null);
  }
  if (generatorPromise) return generatorPromise;
  generatorPromise = (async () => {
    const { env, pipeline } = await import("@huggingface/transformers");
    env.cacheDir = path.join(root, ".cache");
    health.status = "Loading Gemma 3 270M (first run downloads about 320MB)";
    const generator = await pipeline("text-generation", MODEL_ID, {
      dtype: MODEL_DTYPE,
      device: "cpu",
      progress_callback: (update) => {
        if (update.status === "progress" && update.file) {
          const pct = update.progress == null ? "" : ` ${Math.round(update.progress)}%`;
          health.status = `Downloading ${update.file}${pct}`;
        } else if (update.status === "done" && update.file) {
          health.status = `Readying ${update.file}`;
        } else if (update.status) {
          health.status = update.status;
        }
      },
    });
    health.ready = true;
    health.status = "Gemma 3 270M is ready on this computer.";
    return generator;
  })().catch((error) => {
    health.error = error instanceof Error ? error.message : String(error);
    health.status = "The open model failed to load.";
    generatorPromise = null;
    throw error;
  });
  return generatorPromise;
}

async function writeCard({ minutes, place, sense, sky, take }) {
  const generator = await loadModel();
  let lastRaw = "";
  let skipId = "";
  const started = Date.now();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const example = retrieve(place, sense, sky.skyKind, skipId);
    const messages = buildMessages({
      placeLabel: PLACES[place],
      senseLabel: SENSES[sense],
      sky,
      take: take + attempt - 1,
    });
    const lead = stem(sense, sky);
    let raw = "";
    if (GRADIENT) {
      raw = await completeOnGradient({ messages, lead });
    } else {
      const prompt = `${formatChat(messages, FAMILY)}${lead}`;
      const sample = attempt > 1 || take > 1;
      const options = { max_new_tokens: 24, min_new_tokens: 3, repetition_penalty: 1.2, do_sample: sample };
      if (sample) options.temperature = 0.8;
      const output = await generator(prompt, options);
      raw = newText(output?.[0]?.generated_text, prompt);
      const at = raw.lastIndexOf(lead.trim());
      if (at !== -1) raw = raw.slice(at);
    }
    console.log(`attempt ${attempt}: ${raw.replace(/\s+/g, " ").slice(0, 240)}`);
    lastRaw = raw;
    const spoken = parseSpoken(raw, lead);
    if (spoken && !tooClose({ title: spoken.title, notice: spoken.notice }, example)) {
      return {
        card: assemble(minutes, place, sky, spoken),
        ms: Date.now() - started,
        attempts: attempt,
      };
    }
    skipId = example.id;
  }
  const error = new Error("The model did not return a usable card. Try again.");
  error.status = 422;
  error.raw = lastRaw;
  throw error;
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 10_000) {
        reject(Object.assign(new Error("Request is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(text));
      } catch {
        reject(Object.assign(new Error("Send JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(publicDir, relative);
  if (file !== publicDir && !file.startsWith(publicDir + path.sep)) {
    send(res, 403, { error: "Forbidden" });
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      send(res, 404, { error: "Not found" });
      return;
    }
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
    }[path.extname(file)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      send(res, 200, health);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/card") {
      const body = await readJson(req);
      const minutes = Number(body.minutes);
      const place = body.place;
      const sense = body.sense;
      const city = String(body.city || "").trim().slice(0, 80);
      const take = Math.min(6, Math.max(1, Number(body.take) || 1));
      if (!MINUTES.includes(minutes) || !PLACES[place] || !SENSES[sense]) {
        send(res, 400, { error: "Choose a time, a place, and what you notice." });
        return;
      }
      const sky = await lookupSky(city);
      if (sky.stayIn) {
        send(res, 200, { stayIn: true, reason: sky.reason, sky, model: health.model, backend: health.backend });
        return;
      }
      const reply = { stayIn: false, sky, minutes, model: health.model, backend: health.backend };
      let written = null;
      let why = "";
      if (!health.ready) {
        why = "loading";
      } else if (busy && !GRADIENT) {
        why = "busy";
      } else {
        if (!GRADIENT) busy = true;
        const started = Date.now();
        const job = writeCard({ minutes, place, sense, sky, take }).finally(() => {
          if (!GRADIENT) busy = false;
        });
        written = await Promise.race([
          job,
          new Promise((resolve) => setTimeout(() => resolve(null), CARD_DEADLINE_MS)),
        ]).catch((error) => {
          console.error(`card failed: ${error.message}`);
          return null;
        });
        if (!written) why = Date.now() - started >= CARD_DEADLINE_MS ? "slow" : "unusable";
      }
      if (written) {
        send(res, 200, { ...reply, source: "gemma", card: written.card, ms: written.ms, attempts: written.attempts });
      } else {
        const item = starter(place, sense, sky.skyKind, take);
        send(res, 200, { ...reply, source: "starter", why, card: fromStarter(minutes, place, sky, item), ms: 0 });
      }
      return;
    }
    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }
    send(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const status = error.status || 500;
    send(res, status, { error: error.message || "Something went wrong.", raw: error.raw || "" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Pocket Grass  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if ((net.family === "IPv4" || net.family === 4) && !net.internal) {
        console.log(`On your phone   http://${net.address}:${PORT}`);
      }
    }
  }
  loadModel().catch((error) => {
    console.error(error);
  });
});
