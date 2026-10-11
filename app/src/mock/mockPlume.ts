/**
 * Mock mode for demos (Prompt 5). Same wedge geometry and assumptions as the
 * Python pipeline (design.md 3.3), so the demo exercises the real app logic.
 * Everything built here is labelled "demo" in the UI; it is never presented as live data.
 */
import { DEMO_SENSOR } from '../config';
import type { PlumeFile, Position, Ring } from '../types';

export const MOCK = {
  speedMps: 5,
  horizonS: 600,
  halfAngleDeg: 30,
  minLenM: 300,
  arcPoints: 8,
  pm25: 80,
  mPerDeg: 111_320,
};

export function offset(lat: number, lon: number, bearingDeg: number, distM: number): Position {
  const b = (bearingDeg * Math.PI) / 180;
  const dx = distM * Math.sin(b);
  const dy = distM * Math.cos(b);
  return [lon + dx / (MOCK.mPerDeg * Math.cos((lat * Math.PI) / 180)), lat + dy / MOCK.mPerDeg];
}

export const downwindBearing = (windFromDeg: number) => (windFromDeg + 180) % 360;

/** Wedge ring, counter-clockwise, closed, apex at the sensor. */
export function coneRing(lat: number, lon: number, windFromDeg: number, speedMps = MOCK.speedMps): Ring {
  const length = Math.max(MOCK.minLenM, speedMps * MOCK.horizonS);
  const bearing = downwindBearing(windFromDeg);
  const arc: Position[] = [];
  for (let i = 0; i <= MOCK.arcPoints; i++) {
    const b = bearing - MOCK.halfAngleDeg + (2 * MOCK.halfAngleDeg * i) / MOCK.arcPoints;
    arc.push(offset(lat, lon, b, length));
  }
  const apex: Position = [lon, lat];
  // apex -> arc is clockwise; reverse the arc so the exterior is counter-clockwise (RFC 7946).
  return [apex, ...arc.reverse(), apex];
}

export function buildMockPlumeFile(now: Date, windFromDeg: number, ageMinutes = 0): PlumeFile {
  const generated = new Date(now.getTime() - ageMinutes * 60_000).toISOString();
  return {
    type: 'FeatureCollection',
    generated_at: generated,
    wind: { from_deg: windFromDeg, speed_mph: MOCK.speedMps * 2.2369362921, source: 'demo' },
    features: [
      {
        type: 'Feature',
        properties: { sensor_id: 0, location_id: 0, pm25: MOCK.pm25, observed_at: generated },
        geometry: { type: 'Polygon', coordinates: [coneRing(DEMO_SENSOR.lat, DEMO_SENSOR.lon, windFromDeg)] },
      },
    ],
  };
}

/** The demo user stands 1000 m downwind of the sensor for the initial wind. */
export function demoUserPoint(initialWindFromDeg: number): Position {
  return offset(DEMO_SENSOR.lat, DEMO_SENSOR.lon, downwindBearing(initialWindFromDeg), 1000);
}

export const DEMO_INITIAL_WIND_FROM = 270; // west wind: plume points east
export const DEMO_SHIFTED_WIND_FROM = 90; // east wind: plume points west, away from the user
