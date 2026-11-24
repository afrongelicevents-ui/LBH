import { describe, expect, it } from "vitest";
import { faqAnswer, lbhKnowledge, answerQuestion } from "@/lib/assistant";

describe("chat assistant", () => {
  it("knowledge comes from the site text and has no HTML", () => {
    const k = lbhKnowledge();
    expect(k).toContain("Land Verification");
    expect(k).toContain("50% deposit");
    expect(k).toContain("not a bank account");
    expect(k).not.toMatch(/<[a-z]/i);
    expect(k.length).toBeLessThan(12000); // stays inside the free AI allowance per question
  });

  it("falls back to the FAQ when there is no AI", async () => {
    const r = await answerQuestion("Do I need to be in Zimbabwe for this?", [], "en");
    expect(r.source).toBe("faq");
    expect(r.answer).toMatch(/No\./);
  });

  it("answers in the visitor's language", () => {
    const r = faqAnswer("Does LBH hold my money?", "sn");
    expect(r.source).toBe("faq");
    expect(r.answer).not.toMatch(/^No\. Your Build Account/);
  });

  it("hands prices and payments to a person", () => {
    expect(faqAnswer("How much does it cost to build?", "en").handoff).toBe(true);
    expect(faqAnswer("Did you receive my payment?", "en").handoff).toBe(true);
  });

  it("says it is not sure about unrelated questions", () => {
    const r = faqAnswer("What's the weather in Harare?", "en");
    expect(r.source).toBe("none");
    expect(r.handoff).toBe(true);
  });
});
