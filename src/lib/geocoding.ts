export interface GeoResult {
  country: string;
  region: string;
}

/** Round to 2 decimal places (~1km grid) for cache key */
function cacheKey(lat: number, lng: number): string {
  return `geocache_${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function loadFromCache(lat: number, lng: number): GeoResult | null {
  try {
    const stored = localStorage.getItem(cacheKey(lat, lng));
    if (stored) return JSON.parse(stored) as GeoResult;
    return null;
  } catch {
    return null;
  }
}

function saveToCache(lat: number, lng: number, result: GeoResult): void {
  try {
    localStorage.setItem(cacheKey(lat, lng), JSON.stringify(result));
  } catch {
    // Storage full or unavailable — ignore
  }
}

/**
 * Reverse-geocodes a lat/lng pair.
 * Checks localStorage cache first (works offline for previously visited locations).
 * Falls back to Nominatim when online, then saves result to cache.
 * Returns { country: "", region: "" } on any error — never throws.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  // Cache hit
  const cached = loadFromCache(lat, lng);
  if (cached) return cached;

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BiliMushroom/0.1 (hr.biligrupa.bilimushroom)' },
    });
    const data = await res.json();
    const address = data?.address;
    if (!address) return { country: '', region: '' };
    const result: GeoResult = {
      country: address.country ?? '',
      region: address.state ?? address.county ?? '',
    };
    if (result.country || result.region) {
      saveToCache(lat, lng, result);
    }
    return result;
  } catch {
    return { country: '', region: '' };
  }
}
