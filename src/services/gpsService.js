import { validPosition } from '../data/campus.js'

// Capture starts immediately, independently of Firebase availability.
export function startDeviceGps({ geolocation, id, name, onPosition, onError }) {
  let active = true
  let trail = []
  const watch = geolocation.watchPosition(fix => {
    if (!active) return
    const point = { lat: fix.coords.latitude, lng: fix.coords.longitude }
    if (!validPosition(point)) return
    const previous = trail.at(-1)
    if (previous && fix.timestamp - previous.timestamp > 30000) trail = []
    if (fix.coords.accuracy <= 80 &&
        (!previous || previous.lat !== point.lat || previous.lng !== point.lng || trail.length === 0)) {
      trail = [...trail, { ...point, timestamp: fix.timestamp }].slice(-500)
    }
    onPosition({ ...point, id, name, color: '#2563eb', accuracy: fix.coords.accuracy,
      speed: fix.coords.speed ?? 0, heading: fix.coords.heading ?? 0,
      updatedAt: new Date(fix.timestamp).toISOString(), trail })
  }, error => { if (active) onError(error) },
  { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
  return () => {
    active = false
    geolocation.clearWatch(watch)
  }
}
