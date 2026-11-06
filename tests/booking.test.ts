import { describe, expect, it } from "vitest";
import { bookingSchema } from "../src/lib/booking";

const valid = {
  name: "Tatenda Moyo",
  email: "tatenda@example.com",
  whatsapp: "+44 7700 900123",
  country: "uk",
  service: "land",
  description: "Stand 123, Harare South",
  slot: "evening",
  callType: "video",
};

describe("bookingSchema", () => {
  it("accepts a valid booking", () => {
    expect(bookingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const r = bookingSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed WhatsApp number", () => {
    const r = bookingSchema.safeParse({ ...valid, whatsapp: "call me" });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown service", () => {
    const r = bookingSchema.safeParse({ ...valid, service: "mining" });
    expect(r.success).toBe(false);
  });

  it("rejects a filled honeypot", () => {
    const r = bookingSchema.safeParse({ ...valid, website: "spam.example" });
    expect(r.success).toBe(false);
  });

  it("allows an empty description", () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.description;
    expect(bookingSchema.safeParse(rest).success).toBe(true);
  });
});
