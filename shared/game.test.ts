import { describe, expect, it } from "vitest";
import { completedLines, minimumCorrect, topics, validLines, type Draft } from "./game";

describe("Bingo rules", () => {
  it("marks all five main-diagonal cells as special with no free cell", () => {
    expect(topics.filter((topic) => topic.free)).toHaveLength(0);
    expect(topics.filter((topic) => topic.special)).toHaveLength(5);
  });

  it("excludes the blue main diagonal and keeps the other diagonal valid", () => {
    expect(validLines.some((line) => line.id === "diagonal-main")).toBe(false);
    expect(validLines.find((line) => line.id === "diagonal-secondary")?.cellIds).toEqual([
      "r1c5", "r2c4", "r3c3", "r4c2", "r5c1",
    ]);
  });

  it("requires 8 correct answers for every valid line", () => {
    expect(minimumCorrect(validLines.find((line) => line.id === "row-1")!)).toBe(8);
    expect(minimumCorrect(validLines.find((line) => line.id === "row-3")!)).toBe(8);
    expect(minimumCorrect(validLines.find((line) => line.id === "diagonal-secondary")!)).toBe(8);
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
