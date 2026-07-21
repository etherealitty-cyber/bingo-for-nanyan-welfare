import { describe, expect, it } from "vitest";
import { completedLines, minimumCorrect, topics, validLines, type Draft } from "./game";

describe("Bingo rules", () => {
  it("marks the center as free and four other anti-diagonal cells as special", () => {
    expect(topics.filter((topic) => topic.free)).toHaveLength(1);
    expect(topics.filter((topic) => topic.special)).toHaveLength(4);
  });

  it("requires 7 correct answers for a line through the free center", () => {
    expect(minimumCorrect(validLines.find((line) => line.id === "row-3")!)).toBe(7);
  });

  it("requires 8 correct answers for a regular line", () => {
    expect(minimumCorrect(validLines.find((line) => line.id === "row-1")!)).toBe(8);
  });

  it("rejects a completed line containing the same person twice", () => {
    const line = validLines[0];
    const draft: Draft = Object.fromEntries(
      line.cellIds.map((cellId, index) => [cellId, {
        yesParticipantId: index === 0 ? "same" : `yes-${index}`,
        noParticipantId: index === 1 ? "same" : `no-${index}`,
      }]),
    );
    expect(completedLines(draft)).toHaveLength(0);
  });
});
