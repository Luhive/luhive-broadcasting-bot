// Bkz. LUHIVE_MATCHMAKING.md §6 "UTM attribution".
// URL/URLSearchParams kullanılır, string concat ile ? veya & elle eklenmez —
// registration_url'in zaten query string taşıyıp taşımadığı bilinmiyor.
//
// Not: registration_url zaten bir utm_source içeriyorsa searchParams.set bunun
// üzerine yazar. Bu kasıtlı — bot'tan gelen trafiğin gerçek kaynağı bot'tur.
export function buildRegisterUrl(registrationUrl: string): string {
  const url = new URL(registrationUrl);
  url.searchParams.set("utm_source", "luhive_bot");
  return url.toString();
}
