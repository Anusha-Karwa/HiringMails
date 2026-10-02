import { describe, expect, it } from "vitest";
import { DEFAULT_FROM, senderAddress } from "./email";

describe("senderAddress()", () => {
  it("strips quotes left over from pasting env values", () => {
    expect(senderAddress('"Kargo Hiring <onboarding@resend.dev>"')).toBe("Kargo Hiring <onboarding@resend.dev>");
    expect(senderAddress("'hiring@kargo.in'")).toBe("hiring@kargo.in");
  });
  it("falls back to the shared sender when missing or malformed", () => {
    expect(senderAddress(undefined)).toBe(DEFAULT_FROM);
    expect(senderAddress("Kargo Hiring")).toBe(DEFAULT_FROM);
    expect(senderAddress("Kargo <not-an-email>")).toBe(DEFAULT_FROM);
  });
});
