import { useEffect, useRef, useState } from 'react'
import { APIProvider, InfoWindow, Map, Marker, useMap } from '@vis.gl/react-google-maps'
import { subscribeToDevices, startGpsSharing, validRoom } from './services/deviceService'
import { campusCenter, campusBounds, inCampusArea, isFresh } from './data/campus'
import './App.css'

function getRoom() {
  const url = new URL(window.location.href)
  const existing = url.searchParams.get('room')
  if (validRoom(existing ?? '')) return existing
  const room = crypto.randomUUID()
  url.searchParams.set('room', room)
  window.history.replaceState(null, '', url)
  return room
}
function formatTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin señal' : date.toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' })
}
// Access the native Maps API rather than relying on optional wrapper exports.
function MapOverlays({ devices, selected, follow, view, centerRequest }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const overlays = devices.flatMap(device => {
      const route = new google.maps.Polyline({
        map, path: device.trail, strokeColor: device.color,
        strokeOpacity: 0.9, strokeWeight: selected?.id === device.id ? 6 : 3,
      })
      const circle = new google.maps.Circle({
        map, center: device, radius: device.accuracy ?? 0,
        fillColor: device.color, fillOpacity: 0.08, strokeOpacity: 0.2,
        strokeColor: device.color, clickable: false,
      })
      return [route, circle]
    })
    return () => overlays.forEach(overlay => overlay.setMap(null))
  }, [map, devices, selected?.id])
  useEffect(() => {
    if (!map) return
    if (view === 'campus') { map.fitBounds(campusBounds); return }
    map.setZoom(17)
  }, [map, view, centerRequest])
  useEffect(() => {
    if (map && follow && selected) map.panTo({ lat: selected.lat, lng: selected.lng })
  }, [map, follow, selected])
  return null
}
export default function App() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const [room] = useState(getRoom)
  const [devices, setDevices] = useState([])
  const [source, setSource] = useState('Conectando…')
  const [gpsStatus, setGpsStatus] = useState('GPS detenido')
  const [position, setPosition] = useState(null)
  const [name, setName] = useState('')
  const [tracking, setTracking] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState('global')
  const [follow, setFollow] = useState(true)
  const [centerRequest, setCenterRequest] = useState(0)
  const [mapError, setMapError] = useState('')
  const [shareStatus, setShareStatus] = useState('')
  const [now, setNow] = useState(Date.now())
  const controller = useRef(null)
  const stopping = useRef(null)
  useEffect(() => subscribeToDevices(room, setDevices, setSource), [room])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => () => {
    controller.current?.abort()
    stopping.current?.()
  }, [])
  const stop = () => {
    controller.current?.abort()
    stopping.current?.()
    controller.current = null
    stopping.current = null
    setTracking(false)
    setPosition(null)
    setGpsStatus('GPS detenido')
  }
  const start = async () => {
    if (controller.current) return
    const abort = new AbortController()
    controller.current = abort
    setTracking(true)
    setGpsStatus('Conectando GPS…')
    try {
      const cleanup = await startGpsSharing({
        room, name, signal: abort.signal,
        onPosition: point => {
          if (abort.signal.aborted) return
          setPosition(point)
          setSelectedId(previous => previous ?? point.id)
        },
        onStatus: message => {
          if (abort.signal.aborted) return
          setGpsStatus(message)
          if (message.startsWith('Permiso denegado')) {
            controller.current = null
            stopping.current = null
            setTracking(false)
            setPosition(null)
          }
        },
      })
      if (abort.signal.aborted) cleanup()
      else stopping.current = cleanup
    } catch (error) {
      if (abort.signal.aborted) return
      abort.abort()
      controller.current = null
      setTracking(false)
      setGpsStatus(error.message)
    }
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareStatus('Enlace copiado. Ábrelo en los otros celulares.')
    } catch { setShareStatus('Copia el enlace de la barra de direcciones y compártelo.') }
  }
  // Local fix remains visible while Firebase confirms the write.
  const merged = position ? [...devices.filter(d => d.id !== position.id), position] : devices
  const visible = merged.filter(d => view !== 'campus' || inCampusArea(d))
  const selected = visible.find(d => d.id === selectedId)
  const recent = visible.filter(d => isFresh(d, now))
  return (
    <div className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">PUCE · Quito</p><h1>Tu recorrido en vivo</h1>
          <p>Ubicación GPS y recorrido de los celulares de tu sala.</p></div>
        <div className="topbar-actions">
          <button className="mode-btn" onClick={() => { setView('campus'); setFollow(false); setCenterRequest(v => v + 1) }}>Zona PUCE</button>
          <button className="mode-btn" onClick={() => setView('global')}>Todos los dispositivos</button>
          <button className="mode-btn" onClick={copyLink}>Compartir sala</button>
        </div>
      </header>
      {shareStatus && <p role="status">{shareStatus}</p>}
      <main className="layout">
        <aside className="panel devices-panel">
          <div className="gps-controls">
            <label htmlFor="device-name">Nombre de tu celular</label>
            <input id="device-name" maxLength={60} value={name} disabled={tracking}
              onChange={event => setName(event.target.value)} placeholder="Ej. Celular de Elkin" />
            <button className="mode-btn active" onClick={tracking ? stop : start}>
              {tracking ? 'Detener ubicación' : 'Compartir mi GPS'}
            </button>
            <p role="status" aria-live="polite">{gpsStatus}</p>
            {position && <p>Precisión aproximada: ±{Math.round(position.accuracy)} m</p>}
            <p className="helper">Comparte el enlace de esta sala. Cada celular debe abrirlo y activar su GPS. Mantén la página abierta.</p>
          </div>
          <div className="panel-header"><span>Dispositivos ({recent.length} con señal reciente)</span></div>
          <p className="helper" role="status">{source}</p>
          {visible.length === 0 ? <p className="empty-state">
            {view === 'campus' ? 'No hay celulares en la zona aproximada de la PUCE. Prueba Todos los dispositivos.' : 'Todavía no hay ubicaciones. Activa el GPS o comparte la sala.'}
          </p> : <ul className="device-list">{visible.map(device => (
            <li key={device.id}><button className={selectedId === device.id ? 'device-card active' : 'device-card'}
              onClick={() => { setSelectedId(device.id); setFollow(true) }}>
              <span className="dot" style={{ backgroundColor: device.color }} />
              <div><strong>{device.name || 'Mi celular'}</strong>
                <small>{isFresh(device, now) ? 'Señal reciente' : 'Señal antigua'}</small>
                <small>{formatTime(device.updatedAt)}</small></div>
              <span className="speed">{(device.speed * 3.6).toFixed(1)} km/h</span>
            </button></li>
          ))}</ul>}
          <label className="follow-control"><input type="checkbox" checked={follow}
            onChange={e => setFollow(e.target.checked)} /> Seguir el celular seleccionado</label>
          <p className="helper">La línea muestra el recorrido registrado; el círculo muestra el margen de precisión del GPS.</p>
        </aside>
        <section className="panel map-panel" aria-label="Mapa GPS de la PUCE">
          {!apiKey || apiKey.startsWith('tu_') || mapError ? <div className="map-fallback"><div>
            <h2>{mapError ? 'No se pudo cargar Google Maps' : 'Google Maps necesita configuración'}</h2>
            <p>{mapError || 'Configura VITE_GOOGLE_MAPS_API_KEY para cargar el mapa.'}</p>
          </div></div> : <APIProvider apiKey={apiKey} language="es" region="EC"
            onError={error => setMapError(error.message || 'Revisa la clave y Maps JavaScript API.')}>
            <Map defaultCenter={campusCenter} defaultZoom={17} className="map-canvas"
              gestureHandling="greedy" onDragstart={() => setFollow(false)}>
              <MapOverlays devices={visible} selected={selected} follow={follow} view={view} centerRequest={centerRequest} />
              <Marker position={campusCenter} title="PUCE · campus principal Quito" label="PUCE" />
              {visible.map(device => <Marker key={device.id} position={device} title={device.name}
                opacity={isFresh(device, now) ? 1 : 0.4}
                onClick={() => setSelectedId(device.id)}
                icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: device.color,
                  fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 }} />)}
              {selected && <InfoWindow position={selected} onCloseClick={() => setSelectedId(null)}>
                <div className="info-window"><h3>{selected.name || 'Mi celular'}</h3>
                  <p>{selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</p>
                  <p>Precisión: ±{Math.round(selected.accuracy ?? 0)} m</p>
                  <p>Última señal: {formatTime(selected.updatedAt)}</p></div>
              </InfoWindow>}
            </Map>
          </APIProvider>}
        </section>
      </main>
      <p className="helper">Zona PUCE aproximada. El GPS puede perder precisión dentro de edificios.</p>
    </div>
  )
}
