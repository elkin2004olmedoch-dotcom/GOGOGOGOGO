import { useEffect, useMemo, useState } from 'react'
import { APIProvider, InfoWindow, Map, Marker, Polygon } from '@vis.gl/react-google-maps'
import { subscribeToDevices } from './services/deviceService'
import './App.css'

const campusBounds = {
  north: 4.606,
  south: 4.597,
  east: -74.062,
  west: -74.070,
}

const campusPolygon = [
  { lat: 4.6039, lng: -74.0683 },
  { lat: 4.6038, lng: -74.0639 },
  { lat: 4.5992, lng: -74.0634 },
  { lat: 4.5988, lng: -74.0678 },
  { lat: 4.6007, lng: -74.0689 },
]

const defaultCenter = { lat: 4.6015, lng: -74.0660 }

function formatTime(value) {
  if (!value) return 'Sin actualización'
  const date = new Date(value)
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function App() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [source, setSource] = useState('simulación')
  const [viewMode, setViewMode] = useState('campus')

  useEffect(() => {
    const unsubscribe = subscribeToDevices((nextDevices) => {
      setDevices(nextDevices)
      setSource(nextDevices.length > 0 ? 'Firebase' : 'simulación')
    })

    return () => unsubscribe()
  }, [])

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? devices[0],
    [devices, selectedDeviceId],
  )

  const visibleDevices = useMemo(() => {
    if (viewMode === 'campus') {
      return devices.filter((device) => {
        const insideCampus =
          device.lat >= campusBounds.south &&
          device.lat <= campusBounds.north &&
          device.lng >= campusBounds.west &&
          device.lng <= campusBounds.east

        return insideCampus
      })
    }

    return devices
  }, [devices, viewMode])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Campus tracking</p>
          <h1>Rastreo en tiempo real</h1>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className={viewMode === 'campus' ? 'mode-btn active' : 'mode-btn'}
            onClick={() => setViewMode('campus')}
          >
            Solo dentro de la U
          </button>
          <button
            type="button"
            className={viewMode === 'global' ? 'mode-btn active' : 'mode-btn'}
            onClick={() => setViewMode('global')}
          >
            Vista general
          </button>
        </div>
      </header>

      <main className="layout">
        <aside className="panel devices-panel">
          <div className="panel-header">
            <span>Dispositivos</span>
            <span className="status-pill">{source}</span>
          </div>

          {visibleDevices.length === 0 ? (
            <div className="empty-state">No hay dispositivos activos.</div>
          ) : (
            <ul className="device-list">
              {visibleDevices.map((device) => (
                <li key={device.id}>
                  <button
                    type="button"
                    className={
                      selectedDevice?.id === device.id ? 'device-card active' : 'device-card'
                    }
                    onClick={() => setSelectedDeviceId(device.id)}
                  >
                    <span
                      className="dot"
                      style={{ backgroundColor: device.color ?? '#2563eb' }}
                    />
                    <div>
                      <strong>{device.name}</strong>
                      <small>{device.status}</small>
                    </div>
                    <span className="speed">{device.speed ?? 0} m/s</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="panel map-panel">
          {!apiKey ? (
            <div className="map-fallback">
              <h2>Falta la API key de Google Maps</h2>
              <p>
                Añade tu <strong>VITE_GOOGLE_MAPS_API_KEY</strong> en el archivo .env para
                cargar el mapa.
              </p>
            </div>
          ) : (
            <APIProvider apiKey={apiKey}>
              <Map
                defaultCenter={defaultCenter}
                defaultZoom={viewMode === 'campus' ? 17 : 14}
                mapId="campus-tracker-map"
                gestureHandling="greedy"
                restriction={{
                  latLngBounds: campusBounds,
                  strictBounds: viewMode === 'campus',
                }}
                className="map-canvas"
              >
                {viewMode === 'campus' && (
                  <Polygon
                    paths={campusPolygon}
                    options={{
                      fillColor: '#22c55e',
                      fillOpacity: 0.12,
                      strokeColor: '#22c55e',
                      strokeOpacity: 0.7,
                      strokeWeight: 2,
                    }}
                  />
                )}

                {visibleDevices.map((device) => (
                  <Marker
                    key={device.id}
                    position={{ lat: device.lat, lng: device.lng }}
                    title={device.name}
                    onClick={() => setSelectedDeviceId(device.id)}
                    icon={{
                      path: window.google?.maps?.SymbolPath?.CIRCLE ?? 'circle',
                      scale: 10,
                      fillColor: device.color ?? '#2563eb',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2,
                    }}
                  />
                ))}

                {selectedDevice && (
                  <InfoWindow
                    position={{ lat: selectedDevice.lat, lng: selectedDevice.lng }}
                    onCloseClick={() => setSelectedDeviceId(null)}
                  >
                    <div className="info-window">
                      <h3>{selectedDevice.name}</h3>
                      <p>{selectedDevice.status}</p>
                      <ul>
                        <li>Lat: {selectedDevice.lat}</li>
                        <li>Lng: {selectedDevice.lng}</li>
                        <li>Última actualización: {formatTime(selectedDevice.updatedAt)}</li>
                      </ul>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
