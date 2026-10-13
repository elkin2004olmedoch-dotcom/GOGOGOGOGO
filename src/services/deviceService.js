import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getDatabase, onValue, onDisconnect, ref, set, remove } from 'firebase/database'
import { normalizeDevices, validPosition } from '../data/campus'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const hasFirebaseConfig = Object.values(config).every(v => v && !v.startsWith('tu'))
const app = hasFirebaseConfig ? (getApps().length ? getApp() : initializeApp(config)) : null
const database = app ? getDatabase(app) : null
let loginPromise
async function authenticate() {
  if (!app) throw new Error('Configura Firebase para conectar los celulares.')
  const auth = getAuth(app)
  if (auth.currentUser) return auth.currentUser
  if (!loginPromise) loginPromise = signInAnonymously(auth).then(r => r.user)
    .finally(() => { loginPromise = null })
  return loginPromise
}
export function validRoom(room) {
  return /^[a-zA-Z0-9-]{20,80}$/.test(room)
}
export function subscribeToDevices(room, onDevices, onStatus) {
  let closed = false
  let unsubscribe = () => {}
  onDevices([])
  if (!hasFirebaseConfig) {
    onStatus('Firebase sin configurar')
    return unsubscribe
  }
  if (!validRoom(room)) {
    onStatus('Enlace de sala inválido')
    return unsubscribe
  }
  onStatus('Conectando a Firebase…')
  authenticate().then(() => {
    if (closed) return
    unsubscribe = onValue(ref(database, 'rooms/' + room + '/devices'), snapshot => {
      onDevices(normalizeDevices(snapshot.val()))
      onStatus('Firebase en tiempo real')
    }, error => {
      onDevices([])
      onStatus('Error de Firebase: ' + error.message)
    })
  }).catch(error => { if (!closed) onStatus(error.message) })
  return () => { closed = true; unsubscribe() }
}
export async function startGpsSharing({ room, name, signal, onPosition, onStatus }) {
  if (!validRoom(room)) throw new Error('Enlace de sala inválido')
  if (!window.isSecureContext) throw new Error('El GPS del celular necesita HTTPS.')
  if (!navigator.geolocation) throw new Error('Este navegador no ofrece ubicación.')
  const user = await authenticate()
  if (signal.aborted) return () => {}
  const id = user.uid + '-' + crypto.randomUUID()
  const target = ref(database, 'rooms/' + room + '/devices/' + id)
  let active = true
  let watch = null
  let timer = null
  let latest = null
  let trail = []
  let lastSent = 0
  let publishing = false
  let pending = Promise.resolve()
  let disconnect = onDisconnect(target)
  let unsubscribeConnection = () => {}
  let connected = false
  function cleanup() {
    if (!active) return
    active = false
    if (watch !== null) navigator.geolocation.clearWatch(watch)
    if (timer !== null) window.clearInterval(timer)
    unsubscribeConnection()
    signal.removeEventListener('abort', cleanup)
    // Queue removal after any in-flight write so stopping never re-creates a marker.
    pending = pending.catch(() => {}).then(async () => {
      await remove(target)
      await disconnect.cancel()
    }).catch(error => onStatus('No se pudo borrar la última ubicación: ' + error.message))
  }
  signal.addEventListener('abort', cleanup, { once: true })
  try {
    await disconnect.remove()
    if (signal.aborted || !active) { cleanup(); return cleanup }
  } catch (error) { cleanup(); throw error }
  function publish() {
    if (!active || !connected || !latest || publishing || Date.now() - lastSent < 1000) return
    lastSent = Date.now()
    publishing = true
    const payload = { ...latest, owner: user.uid, name: name.trim().slice(0, 60) || 'Mi celular',
      color: '#2563eb', trail }
    pending = pending.catch(() => {}).then(async () => {
      if (!active || !connected) return
      await set(target, payload)
      if (active) onStatus('Compartiendo ubicación')
    }).catch(error => { if (active) onStatus('Error al enviar GPS: ' + error.message) })
      .finally(() => { publishing = false })
  }
  unsubscribeConnection = onValue(ref(database, '.info/connected'), async snapshot => {
    connected = false
    if (!active) return
    if (!snapshot.val()) { onStatus('Sin conexión; esperando red…'); return }
    try {
      disconnect = onDisconnect(target)
      await disconnect.remove()
      if (!active) return
      connected = true
      onStatus(latest ? 'Compartiendo ubicación' : 'Esperando señal GPS…')
      publish()
    } catch (error) { if (active) onStatus('Error de conexión: ' + error.message) }
  })
  watch = navigator.geolocation.watchPosition(fix => {
    if (!active) return
    const point = { lat: fix.coords.latitude, lng: fix.coords.longitude }
    if (!validPosition(point)) return
    latest = { ...point, accuracy: fix.coords.accuracy,
      speed: fix.coords.speed ?? 0, heading: fix.coords.heading ?? 0,
      updatedAt: new Date(fix.timestamp).toISOString() }
    const previous = trail.at(-1)
    // Avoid connecting the route across long GPS gaps or very inaccurate fixes.
    if (previous && fix.timestamp - previous.timestamp > 30000) trail = []
    if (fix.coords.accuracy <= 80 && (!previous || previous.lat !== point.lat || previous.lng !== point.lng)) {
      trail = [...trail, { ...point, timestamp: fix.timestamp }].slice(-500)
    }
    onPosition({ ...latest, id, name, color: '#2563eb', trail })
    publish()
  }, error => {
    if (!active) return
    if (error.code === 1) {
      cleanup()
      onStatus('Permiso denegado. Habilita ubicación y vuelve a iniciar.')
    } else onStatus('Esperando señal GPS: ' + error.message)
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
  timer = window.setInterval(publish, 1000)
  onStatus('Esperando señal GPS…')
  return cleanup
}
