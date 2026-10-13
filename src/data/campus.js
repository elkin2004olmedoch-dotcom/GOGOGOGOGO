// Reference center for PUCE's main Quito campus (Av. 12 de Octubre).
// This viewing area is approximate, not an official property boundary.
export const campusCenter = { lat: -0.20986, lng: -78.49142 }
export const campusBounds = { north: -0.2075, south: -0.2122, east: -78.4888, west: -78.4940 }
export function validPosition(point) {
  return !!point && typeof point.lat === 'number' && typeof point.lng === 'number' &&
    Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180
}
export function inCampusArea(point) {
  return validPosition(point) && point.lat >= campusBounds.south &&
    point.lat <= campusBounds.north && point.lng >= campusBounds.west && point.lng <= campusBounds.east
}
export function normalizeDevices(raw) {
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw).filter(([, d]) => validPosition(d)).map(([id, d]) => ({
    ...d, id, name: typeof d.name === 'string' ? d.name : 'Celular',
    color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#2563eb',
    speed: Number.isFinite(d.speed) ? Math.max(0, d.speed) : 0,
    accuracy: Number.isFinite(d.accuracy) ? Math.max(0, d.accuracy) : null,
    trail: (Array.isArray(d.trail) ? d.trail : Object.values(d.trail ?? {}))
      .filter(validPosition).slice(-500),
  }))
}
export function isFresh(device, now = Date.now()) {
  const age = now - Date.parse(device.updatedAt)
  return Number.isFinite(age) && age >= -60000 && age < 30000
}
