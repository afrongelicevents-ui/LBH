/** FAQ entries (site.faq.<key>) shown as quick-question buttons in the chat. */
export const ASSISTANT_FAQ_KEYS = ["what", "there", "cost", "pay", "money", "proof", "family", "mistake", "privacy", "languages"] as const;
export type AssistantFaqKey = (typeof ASSISTANT_FAQ_KEYS)[number];

/** How many quick questions show before "More questions". */
export const ASSISTANT_FIRST_CHIPS = 5;

/** Max length of one typed question. */
export const ASSISTANT_MAX_QUESTION = 500;
