import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startDeviceGps } from './gpsService.js'

function harness() {
  let success, failure, cleared = null
  const points = [], errors = []
  const geolocation = {
    watchPosition(ok, fail, options) {
      success = ok; failure = fail
      assert.equal(options.enableHighAccuracy, true)
      return 12
    },
    clearWatch(id) { cleared = id },
  }
  const stop = startDeviceGps({geolocation, id:'phone', name:'Mi celular',
    onPosition:p => points.push(p), onError:e => errors.push(e)})
  const emit = (lat, lng, timestamp, accuracy = 5) => success({
    coords:{latitude:lat, longitude:lng, accuracy, speed:null, heading:null}, timestamp})
  return {points, errors, stop, emit, fail:e => failure(e), cleared:() => cleared}
}
test('local GPS emits actual readings and walking trail without Firebase', () => {
  const h = harness()
  h.emit(-0.20986, -78.49142, 1000)
  h.emit(-0.20980, -78.49140, 2000)
  assert.equal(h.points.length, 2)
  assert.equal(h.points[1].lat, -0.20980)
  assert.equal(h.points[1].trail.length, 2)
  h.stop()
})
test('stopping clears GPS and prevents further callbacks', () => {
  const h = harness()
  h.stop()
  h.emit(0, 0, 1000)
  h.fail({code:1})
  assert.equal(h.cleared(), 12)
  assert.equal(h.points.length, 0)
  assert.equal(h.errors.length, 0)
})
test('inaccurate fixes retain position but are excluded from path', () => {
  const h = harness()
  h.emit(0, 0, 1000, 100)
  assert.equal(h.points[0].accuracy, 100)
  assert.equal(h.points[0].trail.length, 0)
  h.stop()
})
test('long sensor gaps start a new path segment', () => {
  const h = harness()
  h.emit(0, 0, 1000)
  h.emit(0.001, 0, 40000)
  assert.equal(h.points[1].trail.length, 1)
  h.stop()
})
test('permission errors reach UI without invented positions', () => {
  const h = harness()
  h.fail({code:1, message:'denied'})
  assert.equal(h.errors[0].code, 1)
  assert.equal(h.points.length, 0)
  h.stop()
})
