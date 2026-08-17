// Tek kaynak lib/i18n/az.json — bkz. LUHIVE_MATCHMAKING.md §6 "Dil".
// Edge Function'ın kendi kopyası yok; proje kökündeki dosyayı relative
// import ile okuyor ki iki yerde senkron tutma riski olmasın.
import az from "../../../lib/i18n/az.json" with { type: "json" };

const dictionaries = { az } as const;

type Language = keyof typeof dictionaries;

export function getDictionary(language: string) {
  return language in dictionaries ? dictionaries[language as Language] : dictionaries.az;
}
