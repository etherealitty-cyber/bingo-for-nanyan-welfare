import { describe, expect, it } from "vitest";
import { parseServerDate } from "./date";

describe("parseServerDate", () => {
  it("accepts Supabase timestamps that already contain a timezone", () => {
    const date = parseServerDate("2026-07-21T12:33:53.743195+00:00");
    expect(date.toISOString()).toBe("2026-07-21T12:33:53.743Z");
  });

  it("treats legacy timezone-free server timestamps as UTC", () => {
    const date = parseServerDate("2026-07-21 12:33:53");
    expect(date.toISOString()).toBe("2026-07-21T12:33:53.000Z");
  });
});
