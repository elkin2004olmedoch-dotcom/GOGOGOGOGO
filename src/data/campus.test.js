import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validPosition, inCampusArea, normalizeDevices, isFresh, campusCenter } from './campus.js'
test('rejects malformed or out-of-range GPS readings', () => {
  for (const p of [null, {}, {lat: null, lng: null}, {lat: '0', lng: 0},
    {lat: NaN, lng: 0}, {lat: 91, lng: 0}, {lat: 0, lng: 181}]) assert.equal(validPosition(p), false)
  assert.equal(validPosition({lat: 0, lng: 0}), true)
})
test('campus area includes Quito reference and excludes old Bogota position', () => {
  assert.equal(inCampusArea(campusCenter), true)
  assert.equal(inCampusArea({lat: 4.6015, lng: -74.066}), false)
})
test('normalization rejects bad markers, filters paths and bounds history', () => {
  const devices = normalizeDevices({ invalid: {lat: null, lng: null}, ok: {
    lat: 0, lng: 0, color: 'bad', speed: -1,
    trail: [...Array.from({length: 510}, () => ({lat: 0, lng: 0})), {lat: 100, lng: 0}]
  }})
  assert.equal(devices.length, 1)
  assert.equal(devices[0].trail.length, 500)
  assert.equal(devices[0].speed, 0)
  assert.equal(devices[0].color, '#2563eb')
})
test('Firebase object-form paths are supported', () => {
  assert.equal(normalizeDevices({a: {lat: 0, lng: 0, trail: {0: {lat: 0, lng: 0}}}})[0].trail.length, 1)
})
test('invalid or stale timestamps are never marked live', () => {
  const now = Date.parse('2026-10-13T12:00:00Z')
  assert.equal(isFresh({updatedAt:'invalid'}, now), false)
  assert.equal(isFresh({updatedAt:'2026-10-13T11:59:20Z'}, now), false)
  assert.equal(isFresh({updatedAt:'2026-10-13T11:59:50Z'}, now), true)
})
