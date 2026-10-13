const baseDevices = [
  {
    id: 'device-01',
    name: 'Juan',
    color: '#22c55e',
    baseLat: 4.601520,
    baseLng: -74.066180,
    status: 'Dentro del campus',
  },
  {
    id: 'device-02',
    name: 'Ana',
    color: '#f59e0b',
    baseLat: 4.602210,
    baseLng: -74.066930,
    status: 'Ruta activa',
  },
  {
    id: 'device-03',
    name: 'Sofía',
    color: '#3b82f6',
    baseLat: 4.601970,
    baseLng: -74.065360,
    status: 'Cerca de la entrada principal',
  },
]

export function getMockDevices() {
  const now = Date.now() / 1000

  return baseDevices.map((device, index) => {
    const orbit = now / 9 + index * 1.7
    const driftLat = Math.sin(orbit) * 0.00045
    const driftLng = Math.cos(orbit * 1.4) * 0.0006

    return {
      ...device,
      lat: device.baseLat + driftLat,
      lng: device.baseLng + driftLng,
      speed: 1.2 + (index * 0.5),
      updatedAt: new Date().toISOString(),
    }
  })
}
