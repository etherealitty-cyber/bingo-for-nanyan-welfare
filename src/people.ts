import type { Person } from "./types";

export function pinPersonThird(people: Person[], nickname = "吴恒涛"): Person[] {
  const pinned = people.find((person) => person.nickname === nickname);
  if (!pinned) return people;

  const others = people.filter((person) => person.id !== pinned.id);
  others.splice(Math.min(2, others.length), 0, pinned);
  return others;
}

export function shufflePeopleWithPinnedThird(
  people: Person[],
  random: () => number = Math.random,
): Person[] {
  const shuffled = people.filter((person) => person.nickname !== "吴恒涛");

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const pinned = people.find((person) => person.nickname === "吴恒涛");
  if (pinned) shuffled.splice(Math.min(2, shuffled.length), 0, pinned);
  return shuffled;
}
