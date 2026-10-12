const WHERE = {
  sidewalk: "Walk to the first tree on your block and stop under it.",
  park: "Stop beside the first tree or shrub at the edge of the path.",
  balcony: "Step onto the balcony and leave the bright room light off.",
  garden: "Crouch beside the nearest soil, pot, or planted bed.",
  trail: "Walk until the path bends, then stand just off to the side.",
};

export function stem(sense, sky) {
  if (sky.summary === "rain") return "Listen to the rain until you hear ";
  if (sky.isDay === false || sense === "birds" || sense === "quiet") return "Listen until you hear ";
  if (sense === "sky") return "Watch the sky until you see ";
  if (sense === "soil") return "Touch the ground and notice ";
  return "Look at one living thing until you can say ";
}

export function whereLine(place, sky) {
  if (sky.summary === "rain") {
    return "Stay under a roof, a porch, or dense cover. Do not stand in open rain.";
  }
  if (sky.summary === "fog") return "Stay close enough to see where you started.";
  if (typeof sky.tempC === "number" && sky.tempC >= 35) return "Stay in the shade, and don't go far.";
  const base = WHERE[place] || WHERE.park;
  if (sky.isDay === false) return `${base} It is dark, so stay close.`;
  return base;
}

export function assemble(minutes, place, sky, spoken) {
  return {
    title: spoken.title,
    where: whereLine(place, sky),
    notice: spoken.notice,
    pocket: `Read it once. Then pocket the phone for ${minutes} minutes, until you have noticed that one thing.`,
  };
}
