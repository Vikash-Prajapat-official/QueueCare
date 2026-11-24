// Display text shared by the desk and doctor screens (Hindi arrives with next-intl in Phase 6).

export const PRIORITY_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  ELDERLY: "Elderly (60+)",
  PREGNANT: "Pregnant",
  DISABLED: "Disabled",
  EMERGENCY: "Emergency",
};

export const STATUS_LABELS: Record<string, string> = {
  WAITING: "Waiting",
  CALLED: "Called",
  IN_CONSULT: "In consult",
  SKIPPED: "Skipped",
  NO_SHOW: "No-show",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }));
