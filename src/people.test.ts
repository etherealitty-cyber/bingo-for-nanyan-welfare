import { describe, expect, it } from "vitest";
import type { Person } from "./types";
import { pinPersonThird, shufflePeopleWithPinnedThird } from "./people";

const people: Person[] = ["甲", "乙", "吴恒涛", "丙", "丁"].map((nickname, index) => ({
  id: `p${index}`,
  nickname,
  role: "staff",
  roleLabel: "工作人员",
}));

describe("人员显示顺序", () => {
  it("随机排列其他人并将吴恒涛固定为第三位", () => {
    const ordered = shufflePeopleWithPinnedThird(people, () => 0);

    expect(ordered[2].nickname).toBe("吴恒涛");
    expect(ordered.map((person) => person.id).sort()).toEqual(people.map((person) => person.id).sort());
    expect(ordered.filter((person) => person.nickname !== "吴恒涛").map((person) => person.nickname))
      .not.toEqual(people.filter((person) => person.nickname !== "吴恒涛").map((person) => person.nickname));
  });

  it("筛选人员后仍将吴恒涛放在第三位", () => {
    const ordered = pinPersonThird([people[4], people[2], people[1], people[3]]);
    expect(ordered.map((person) => person.nickname)).toEqual(["丁", "乙", "吴恒涛", "丙"]);
  });
});
