# Campus tracking

Aplicación React para ver dispositivos en tiempo real en Google Maps, con una vista orientada a campus universitario.

## Requisitos

- Una clave de Google Maps `VITE_GOOGLE_MAPS_API_KEY`
- Una base de datos Firebase Realtime Database o Firestore con datos de ubicación

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

Ejemplo de estructura de datos en Firebase Realtime Database:

```json
{
  "devices": {
    "device-01": {
      "name": "Juan",
      "lat": 4.60152,
      "lng": -74.06618,
      "speed": 1.2,
      "status": "Dentro del campus",
      "updatedAt": "2026-10-13T15:00:00.000Z",
      "color": "#22c55e"
    }
  }
}
```

## Ejecutar

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Abre la URL que te muestre Vite, normalmente:

- http://localhost:5173/

## Funcionalidades

- Lectura en tiempo real desde Firebase
- Vista general y vista exclusiva del campus
- Mapa de Google Maps con marcadores por dispositivo
- Fallback de demo si no hay datos reales o no hay configuración
