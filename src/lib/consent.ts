// The consent notice shown to patients (DPDP Act 2023). Its version is stored with every
// ConsentRecord, so we can always show what a patient agreed to. Change the wording => bump the version.

export const CONSENT_NOTICE_VERSION = "v1";
export const CONSENT_PURPOSE = "OPD queue";

/** RETENTION_DAYS from the environment; 90 if missing or not a whole number of at least 1. */
export function retentionDays(value: string | undefined = process.env.RETENTION_DAYS): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 90;
}

/** Plain-language notice in English and Hindi. */
export function consentNotice(days: number): { en: string; hi: string } {
  return {
    en: `We keep your name, phone number and age only to run the OPD queue. We never record your illness. They are made anonymous after ${days} days. You can ask the hospital to delete them.`,
    hi: `हम आपका नाम, फ़ोन नंबर और उम्र सिर्फ़ OPD की कतार चलाने के लिए रखते हैं। आपकी बीमारी की कोई जानकारी दर्ज नहीं की जाती। ये जानकारी ${days} दिन बाद गुमनाम कर दी जाती है। आप अस्पताल से इसे हटाने के लिए कह सकते हैं।`,
  };
}
