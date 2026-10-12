const statusEl = document.querySelector("#model-status");
const lastNoteEl = document.querySelector("#last-note");
const setupEl = document.querySelector("#setup");
const resultEl = document.querySelector("#result");
const outsideEl = document.querySelector("#outside");
const writeBtn = document.querySelector("#write");
const formError = document.querySelector("#form-error");
const goActions = document.querySelector("#go-actions");
const stayEl = document.querySelector("#stay");

const chosen = { minutes: "20", place: "park", sense: "plants" };
let take = 1;
let ready = false;
let current = null;
let timerHandle = 0;
let endsAt = 0;

function selected(group) {
  const pressed = group.querySelector('[aria-pressed="true"]');
  return pressed ? pressed.dataset.value : "";
}

function bindChoices(id, key) {
  const group = document.querySelector("#" + id);
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    for (const item of group.querySelectorAll("button")) item.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-pressed", "true");
    chosen[key] = button.dataset.value;
    take = 1;
  });
}

bindChoices("minutes", "minutes");
bindChoices("place", "place");
bindChoices("sense", "sense");

function showLastNote() {
  const notes = JSON.parse(localStorage.getItem("pocket-grass-notes") || "[]");
  if (!notes.length) {
    lastNoteEl.hidden = true;
    return;
  }
  lastNoteEl.hidden = false;
  lastNoteEl.textContent = notes[0].note
    ? `Last time you came back with: ${notes[0].note}`
    : "You came back last time.";
}

function show(view) {
  setupEl.hidden = view !== "setup";
  resultEl.hidden = view !== "card";
  outsideEl.hidden = view !== "out";
  document.body.classList.toggle("is-out", view === "out");
  if (view !== "out") window.clearTimeout(timerHandle);
}

async function poll() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    ready = Boolean(data.ready);
    statusEl.textContent = data.error || data.status || "Loading Gemma…";
    writeBtn.disabled = !ready;
    if (!ready && !data.error) setTimeout(poll, 1000);
  } catch {
    statusEl.textContent = "The server is not running. Start it with npm start, then refresh.";
    setTimeout(poll, 2000);
  }
}

function renderCard(data) {
  current = data;
  formError.textContent = "";
  const cardMode = !data.stayIn;
  goActions.hidden = !cardMode;
  stayEl.hidden = cardMode;
  document.querySelector(".eyebrow").textContent = cardMode ? "Your card" : "Stay in";
  document.querySelector("#card-title").hidden = !cardMode;
  document.querySelector("#card-sky").hidden = !cardMode;
  for (const id of ["card-where", "card-notice", "card-pocket", "card-model"]) {
    document.querySelector("#" + id).hidden = !cardMode;
  }
  for (const heading of resultEl.querySelectorAll("h2")) heading.hidden = !cardMode;

  if (data.stayIn) {
    document.querySelector("#stay-reason").textContent = data.reason;
    show("card");
    return;
  }

  document.querySelector("#card-title").textContent = data.card.title;
  document.querySelector("#card-where").textContent = data.card.where;
  document.querySelector("#card-notice").textContent = data.card.notice;
  document.querySelector("#card-pocket").textContent = data.card.pocket;
  const sky = data.sky || {};
  document.querySelector("#card-sky").textContent = sky.found
    ? `Sky checked: ${sky.summary}, ${sky.tempC}°C, ${sky.label}.`
    : sky.used
      ? "The sky could not be checked. Look up before you go."
      : "Sky not checked. Look up before you go.";
  document.querySelector("#card-model").textContent = `Written on this computer in ${Math.max(1, Math.round(data.ms / 1000))}s.`;
  show("card");
}

setupEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ready) return;
  formError.textContent = "";
  writeBtn.disabled = true;
  let seconds = 0;
  writeBtn.textContent = "Writing the card…";
  const clock = window.setInterval(() => {
    seconds += 1;
    writeBtn.textContent = `Writing the card… ${seconds}s`;
  }, 1000);
  try {
    const response = await fetch("/api/card", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        minutes: Number(chosen.minutes),
        place: chosen.place,
        sense: chosen.sense,
        city: document.querySelector("#city").value,
        take,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The card did not come back.");
    renderCard(data);
  } catch (error) {
    formError.textContent = error.message;
  } finally {
    window.clearInterval(clock);
    writeBtn.disabled = !ready;
    writeBtn.textContent = "Write my card";
  }
});

document.querySelector("#again").addEventListener("click", () => {
  take += 1;
  show("setup");
});

document.querySelector("#stay-back").addEventListener("click", () => show("setup"));

function formatTime(total) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function finishOutside() {
  window.clearTimeout(timerHandle);
  document.querySelector("#timer").textContent = "0:00";
  document.querySelector("#out-hint").textContent = "Time. You can look at the phone again.";
  document.querySelector("#came-back").hidden = false;
  if (navigator.vibrate) navigator.vibrate(180);
  const context = new AudioContext();
  const tone = (freq, at) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.05, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    osc.start(at);
    osc.stop(at + 0.26);
  };
  const now = context.currentTime;
  tone(523, now);
  tone(659, now + 0.18);
}

function tick() {
  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  document.querySelector("#timer").textContent = formatTime(left);
  if (left <= 0) {
    finishOutside();
    return;
  }
  timerHandle = window.setTimeout(tick, 250);
}

function stepOut(seconds, practice) {
  if (!current || current.stayIn) return;
  document.querySelector("#out-kicker").textContent = practice ? "Practice" : "Phone away";
  document.querySelector("#out-notice").textContent = current.card.notice;
  document.querySelector("#out-hint").textContent = "Leave this page open. The phone can go in a pocket.";
  document.querySelector("#came-back").hidden = true;
  document.querySelector("#note-form").hidden = true;
  document.querySelector("#note").value = "";
  endsAt = Date.now() + seconds * 1000;
  show("out");
  tick();
}

document.querySelector("#step-out").addEventListener("click", () => stepOut(current.minutes * 60, false));
document.querySelector("#practice").addEventListener("click", () => stepOut(15, true));
document.querySelector("#out-back").addEventListener("click", () => show("card"));

document.querySelector("#came-back").addEventListener("click", () => {
  document.querySelector("#came-back").hidden = true;
  document.querySelector("#note-form").hidden = false;
  document.querySelector("#note").focus();
});

document.querySelector("#note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const note = document.querySelector("#note").value.trim();
  const notes = JSON.parse(localStorage.getItem("pocket-grass-notes") || "[]");
  notes.unshift({
    at: new Date().toISOString(),
    title: current?.card?.title || "",
    note,
  });
  localStorage.setItem("pocket-grass-notes", JSON.stringify(notes.slice(0, 8)));
  showLastNote();
  show("setup");
});

showLastNote();
poll();
