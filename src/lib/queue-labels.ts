// Values for priorities and statuses. Their names on screen come from messages/*.json
// (keys "priority.<VALUE>" and "status.<VALUE>"), so they appear in the chosen language.

export const PRIORITIES = ["NORMAL", "ELDERLY", "PREGNANT", "DISABLED", "EMERGENCY"] as const;
export type PriorityValue = (typeof PRIORITIES)[number];

export const STATUSES = ["WAITING", "CALLED", "IN_CONSULT", "SKIPPED", "NO_SHOW", "DONE", "CANCELLED"] as const;
