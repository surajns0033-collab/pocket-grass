export function describe(code) {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

export function assess(current, label) {
  if (!current || typeof current.weather_code !== "number") {
    throw new Error("No current weather");
  }
  const summary = describe(current.weather_code);
  const wind = Number(current.wind_speed_10m) || 0;
  const isDay = current.is_day === 1;
  const temp = Math.round(Number(current.temperature_2m));
  let stayIn = false;
  let reason = "";
  if (current.weather_code >= 95) {
    stayIn = true;
    reason = "Thunder is in the forecast. Stay inside until it passes.";
  } else if (summary === "snow") {
    stayIn = true;
    reason = "Snow is falling. Stay in unless you already planned a careful walk.";
  } else if (wind >= 50) {
    stayIn = true;
    reason = "The wind is high enough to skip this one. Stay in.";
  }

  let skyKind = { clear: "clear", cloudy: "cloud", fog: "cloud", rain: "rain", snow: "snow", storm: "storm" }[summary];
  if (!isDay && (skyKind === "clear" || skyKind === "cloud")) skyKind = "night";

  const constraints = [];
  if (summary === "rain") {
    constraints.push("It is raining. Where must keep them under a roof, a porch, or a dense tree.");
  }
  if (!isDay) {
    constraints.push("It is dark. Notice must use sound or the sky, not small visual details.");
  }
  if (summary === "fog") {
    constraints.push("Fog. Keep the where-line close to the starting place.");
  }
  if (temp >= 35) {
    constraints.push("It is very hot. The where-line must be shade, and the task must be easy.");
  }

  return {
    used: true,
    found: true,
    label,
    tempC: temp,
    windKmh: Math.round(wind),
    isDay,
    summary,
    stayIn,
    reason,
    skyKind,
    line: `Sky: ${summary}, ${temp}C, ${isDay ? "daytime" : "after dark"}, wind ${Math.round(wind)} km/h, in ${label}.`,
    constraint: constraints.join(" "),
  };
}

async function getJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { "user-agent": "pocket-grass/1.0" },
  });
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  return response.json();
}

const UNKNOWN = {
  used: true,
  found: false,
  stayIn: false,
  skyKind: "unknown",
  line: "Sky: not available. Do not invent a forecast.",
  constraint: "",
  label: "",
};

export async function lookupSky(city) {
  const name = (city || "").trim();
  if (!name) {
    return {
      used: false,
      found: false,
      stayIn: false,
      skyKind: "unknown",
      line: "Sky: not checked. Do not invent a forecast. Mention glancing up before they start.",
      constraint: "",
      label: "",
    };
  }
  try {
    const geo = await getJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
    );
    const hit = geo.results?.[0];
    if (!hit) return { ...UNKNOWN, line: "Sky: that city was not found. Do not invent a forecast." };
    const label = [hit.name, hit.admin1, hit.country_code].filter(Boolean).join(", ");
    const forecast = await getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code,is_day,wind_speed_10m&timezone=auto`,
    );
    return assess(forecast.current, label);
  } catch {
    return UNKNOWN;
  }
}
