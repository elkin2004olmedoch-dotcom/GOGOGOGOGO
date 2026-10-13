import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getDatabase, onValue, onDisconnect, ref, set, remove } from 'firebase/database'
import { normalizeDevices } from '../data/campus'
import { startDeviceGps } from './gpsService'

const runtime = window.PUCE_CONFIG?.firebase ?? {}
const configuredValue = (value, fallback) => value && !value.startsWith('tu') ? value : fallback
const config = {
  apiKey: configuredValue(import.meta.env.VITE_FIREBASE_API_KEY, runtime.apiKey),
  authDomain: configuredValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, runtime.authDomain),
  databaseURL: configuredValue(import.meta.env.VITE_FIREBASE_DATABASE_URL, runtime.databaseURL),
  projectId: configuredValue(import.meta.env.VITE_FIREBASE_PROJECT_ID, runtime.projectId),
  appId: configuredValue(import.meta.env.VITE_FIREBASE_APP_ID, runtime.appId),
}
export const hasFirebaseConfig = Object.values(config).every(Boolean)
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
    onStatus('Firebase sin configurar: el monitor todavía no recibe ubicaciones.')
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
  if (signal.aborted) return () => {}
  const id = crypto.randomUUID()
  let active = true
  let stopGps = () => {}
  let timer = null
  let latest = null
  let lastSent = 0
  let publishing = false
  let pending = Promise.resolve()
  let target = null
  let disconnect = null
  let owner = null
  let unsubscribeConnection = () => {}
  let connected = false
  let cloudStatus = hasFirebaseConfig ? 'conectando Firebase…' : 'solo en este celular; falta configurar Firebase para el monitor'
  const report = () => {
    if (active) onStatus((latest ? 'GPS activo · ' : 'Esperando GPS · ') + cloudStatus)
  }
  function cleanup() {
    if (!active) return
    active = false
    stopGps()
    if (timer !== null) window.clearInterval(timer)
    unsubscribeConnection()
    signal.removeEventListener('abort', cleanup)
    if (target) {
      pending = pending.catch(() => {}).then(async () => {
        await remove(target)
        await disconnect?.cancel()
      }).catch(() => {})
    }
  }
  signal.addEventListener('abort', cleanup, { once: true })
  function publish() {
    if (!active || !connected || !target || !latest || publishing || Date.now() - lastSent < 1000) return
    lastSent = Date.now()
    publishing = true
    const { id: localId, ...reading } = latest
    void localId
    const payload = { ...reading, owner }
    pending = pending.catch(() => {}).then(async () => {
      if (!active || !connected) return
      await set(target, payload)
      if (active) { cloudStatus = 'enviado a Firebase'; report() }
    }).catch(error => {
      if (active) { cloudStatus = 'Firebase no recibe datos: ' + error.message; report() }
    }).finally(() => { publishing = false })
  }
  report()
  // Starting GPS must never wait for login, rules, network or database setup.
  try {
    stopGps = startDeviceGps({
      geolocation: navigator.geolocation, id,
      name: name.trim().slice(0, 60) || 'Mi celular',
      onPosition: point => {
        if (!active) return
        latest = point
        onPosition(point)
        report()
        publish()
      },
      onError: error => {
        if (error.code === 1) {
          cleanup()
          onStatus('Permiso denegado. Habilita ubicación y vuelve a iniciar.')
        } else onStatus('Esperando señal GPS: ' + error.message)
      },
    })
  } catch (error) { cleanup(); throw error }
  if (hasFirebaseConfig) {
    timer = window.setInterval(publish, 1000)
    void authenticate().then(user => {
      if (!active) return
      owner = user.uid
      target = ref(database, 'rooms/' + room + '/devices/' + id)
      unsubscribeConnection = onValue(ref(database, '.info/connected'), async snapshot => {
        connected = false
        if (!active) return
        if (!snapshot.val()) { cloudStatus = 'sin conexión a Firebase'; report(); return }
        try {
          disconnect = onDisconnect(target)
          await disconnect.remove()
          if (!active) return
          connected = true
          cloudStatus = 'Firebase conectado'
          report()
          publish()
        } catch (error) { cloudStatus = 'Firebase no recibe datos: ' + error.message; report() }
      })
    }).catch(error => {
      if (active) { cloudStatus = 'solo local; Firebase: ' + error.message; report() }
    })
  }
  return cleanup
}
