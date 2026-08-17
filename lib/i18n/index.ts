import az from "./az.json";

// İngilizce ileride buraya `en.json` eklenerek genişletilir — bkz.
// LUHIVE_MATCHMAKING.md §6. O ana kadar tek desteklenen dil "az".
const dictionaries = { az } as const;

export type Language = keyof typeof dictionaries;

export const DEFAULT_LANGUAGE: Language = "az";

export function isSupportedLanguage(value: string): value is Language {
  return value in dictionaries;
}

export function getDictionary(language: string) {
  return isSupportedLanguage(language) ? dictionaries[language] : dictionaries[DEFAULT_LANGUAGE];
}

export type Dictionary = (typeof dictionaries)[Language];
