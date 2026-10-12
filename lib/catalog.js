export const PLACES = {
  sidewalk: "a sidewalk",
  park: "a park",
  balcony: "a balcony",
  garden: "a garden",
  trail: "a trail",
};

export const SENSES = {
  birds: "birds",
  plants: "plants",
  sky: "the sky",
  soil: "the ground",
  quiet: "quiet sounds",
};

export const MINUTES = [10, 20, 40];

// Style examples for the local model. The card the person reads is generated,
// not copied from this list.
export const OUTINGS = [
  {
    id: "sidewalk-birds",
    place: "sidewalk",
    sense: "birds",
    sky: "clear",
    title: "Three calls, one block",
    where: "Walk to the first tree on your block and stop under it.",
    notice: "Stay until you have heard three bird calls that are not the same.",
    pocket: "Put the phone away before the first call, and come back after the third.",
  },
  {
    id: "sidewalk-quiet-rain",
    place: "sidewalk",
    sense: "quiet",
    sky: "rain",
    title: "Doorway rain",
    where: "Stand in a doorway or under an awning, where the rain misses you.",
    notice: "Close your eyes and count ten separate sounds the rain is making.",
    pocket: "Pocket the phone before you start counting.",
  },
  {
    id: "park-plants",
    place: "park",
    sense: "plants",
    sky: "cloud",
    title: "One leaf, up close",
    where: "Find a tree or shrub at the edge of the path, not the middle of the lawn.",
    notice: "Look at one leaf until you can describe its edge without looking back.",
    pocket: "Read this, then pocket the phone until you can say that edge out loud.",
  },
  {
    id: "park-sky",
    place: "park",
    sense: "sky",
    sky: "clear",
    title: "Cloud with a hole",
    where: "Stand in the open part of the park, away from the path if you can.",
    notice: "Pick one cloud and watch it until its shape actually changes.",
    pocket: "Phone away while you watch. The card can wait.",
  },
  {
    id: "balcony-night",
    place: "balcony",
    sense: "sky",
    sky: "night",
    title: "Balcony, no lamp",
    where: "Step onto the balcony and leave the room light off.",
    notice: "Find the brightest thing in the sky, or the farthest sound if the sky is blank.",
    pocket: "Put the phone face down until you have named that thing.",
  },
  {
    id: "garden-soil",
    place: "garden",
    sense: "soil",
    sky: "clear",
    title: "A hand in the soil",
    where: "Crouch at the nearest patch of soil, a pot, or a bare bed.",
    notice: "Touch the soil and notice if it is dry, cool, or crumbling.",
    pocket: "Phone stays in the pocket while your hand is in the soil.",
  },
  {
    id: "trail-birds",
    place: "trail",
    sense: "birds",
    sky: "cloud",
    title: "Stop at the bend",
    where: "Walk until the path bends, then stand still off to the side.",
    notice: "Wait for one bird to move, not just to call.",
    pocket: "Pocket the phone at the bend. Walk back when you have seen the movement.",
  },
  {
    id: "garden-rain",
    place: "garden",
    sense: "plants",
    sky: "rain",
    title: "Leaves holding water",
    where: "Stay on a covered step or under the widest leaves, out of the open rain.",
    notice: "Find one leaf that is holding a drop, and watch whether it falls.",
    pocket: "Phone away until that drop falls or you have watched it for a full minute.",
  },
  {
    id: "balcony-quiet",
    place: "balcony",
    sense: "quiet",
    sky: "rain",
    title: "Rain on the rail",
    where: "Stand at the balcony rail, under cover if the rain is reaching you.",
    notice: "Listen for the difference between rain on the rail and rain on the ground.",
    pocket: "Set the phone down inside before you listen.",
  },
  {
    id: "trail-soil",
    place: "trail",
    sense: "soil",
    sky: "clear",
    title: "The path changes",
    where: "Walk until the ground under you changes, from pavement to dirt or gravel.",
    notice: "Stop and notice what your foot feels that it did not feel a minute ago.",
    pocket: "Phone in the pocket from the first step. Check the card only when the ground changes.",
  },
];

function rank(place, sense, skyKind) {
  return OUTINGS.map((item) => {
    let score = 0;
    if (item.place === place) score += 3;
    if (item.sense === sense) score += 3;
    if (item.sky === skyKind) score += 2;
    return { item, score };
  }).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
}

export function retrieve(place, sense, skyKind, skipId = "") {
  const ranked = rank(place, sense, skyKind);
  return (ranked.find((row) => row.item.id !== skipId) || ranked[0]).item;
}

export function starter(place, sense, skyKind, take = 1) {
  const top = rank(place, sense, skyKind).slice(0, 3);
  return top[(Math.max(1, take) - 1) % top.length].item;
}
