// Luhive'in kendi (native) etkinlik/kayıt sayfası URL kalıbı — üründen
// doğrulandı: luhive.com/c/{community_slug}/{event_slug}
const LUHIVE_BASE_URL = "https://luhive.com";

export function buildNativeEventUrl(communitySlug: string, eventSlug: string): string {
  return `${LUHIVE_BASE_URL}/c/${communitySlug}/${eventSlug}`;
}
