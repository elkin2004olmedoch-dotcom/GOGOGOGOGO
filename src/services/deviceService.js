import { initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref } from 'firebase/database'
import { getMockDevices } from '../data/mockDevices'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)

let firebaseApp = null
let database = null

if (hasFirebaseConfig) {
  firebaseApp = initializeApp(firebaseConfig)
  database = getDatabase(firebaseApp)
}

function normalizeFirebaseDevices(rawDevices) {
  if (!rawDevices) return []

  return Object.entries(rawDevices).map(([id, device]) => ({
    id,
    name: device.name ?? `Dispositivo ${id}`,
    color: device.color ?? '#2563eb',
    lat: Number(device.lat),
    lng: Number(device.lng),
    speed: Number(device.speed ?? 0),
    status: device.status ?? 'Conectado',
    updatedAt: device.updatedAt ?? new Date().toISOString(),
  }))
}

export function subscribeToDevices(onDevices) {
  if (!hasFirebaseConfig || !database) {
    onDevices(getMockDevices())

    const intervalId = window.setInterval(() => {
      onDevices(getMockDevices())
    }, 2000)

    return () => window.clearInterval(intervalId)
  }

  const devicesRef = ref(database, 'devices')

  const unsubscribe = onValue(
    devicesRef,
    (snapshot) => {
      const raw = snapshot.val()
      const devices = normalizeFirebaseDevices(raw)
      onDevices(devices.length > 0 ? devices : [])
    },
    () => {
      onDevices(getMockDevices())
    },
  )

  return () => unsubscribe()
}
