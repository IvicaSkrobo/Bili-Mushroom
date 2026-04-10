export interface GeoResult {
  country: string;
  region: string;
}

/**
 * Reverse-geocodes a lat/lng pair using Nominatim.
 * Returns { country, region } on success.
 * On ANY error (network, parse, offline), returns { country: "", region: "" } — never throws.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BiliMushroom/0.1 (hr.biligrupa.bilimushroom)',
      },
    });
    const data = await res.json();
    const address = data?.address;
    if (!address) return { country: '', region: '' };
    const country: string = address.country ?? '';
    const region: string = address.state ?? address.county ?? '';
    return { country, region };
  } catch {
    return { country: '', region: '' };
  }
}
