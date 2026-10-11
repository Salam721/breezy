import { isInsideAnyPlume } from '../geo/plumeCheck';
import { runCheck } from '../engine/checkEngine';
import { MemoryStore } from '../data/storage';
import {
  DEMO_INITIAL_WIND_FROM, DEMO_SHIFTED_WIND_FROM, buildMockPlumeFile, coneRing, demoUserPoint,
} from '../mock/mockPlume';
import { computeStatus } from '../status/statusMachine';
import type { PlumeFile } from '../types';
import sample from './fixtures/plumes.sample.json';

describe('mock plume geometry matches the Python pipeline', () => {
  it('same ring as the pipeline for the same sensor, wind and speed', () => {
    const py = (sample as unknown as PlumeFile).features[0]; // sensor 11 at 33.75,-84.40; wind from 270 at 5 m/s
    const ts = coneRing(33.75, -84.4, 270, 5);
    const pyRing = py.geometry.coordinates[0];
    expect(ts.length).toBe(pyRing.length);
    ts.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(pyRing[i][0], 9);
      expect(y).toBeCloseTo(pyRing[i][1], 9);
    });
  });
});

describe('demo scenario', () => {
  const NOW = new Date('2026-10-10T22:30:00Z');
  it('user is inside the plume, then a wind shift moves it away', () => {
    const user = demoUserPoint(DEMO_INITIAL_WIND_FROM);
    expect(isInsideAnyPlume(user, buildMockPlumeFile(NOW, DEMO_INITIAL_WIND_FROM))).toBe(true);
    expect(isInsideAnyPlume(user, buildMockPlumeFile(NOW, DEMO_SHIFTED_WIND_FROM))).toBe(false);
  });
  it('an old mock file shows Stale/Unverified', () => {
    const f = buildMockPlumeFile(NOW, DEMO_INITIAL_WIND_FROM, 15);
    expect(computeStatus(f, demoUserPoint(DEMO_INITIAL_WIND_FROM), NOW).status).toBe('STALE');
  });
  it('full run through the engine: ALERT, then ALL_CLEAR after the wind shift', async () => {
    const store = new MemoryStore();
    const user = demoUserPoint(DEMO_INITIAL_WIND_FROM);
    let alerts = 0, clears = 0;
    const base = {
      store, fetchImpl: async () => { throw new Error('unused'); }, plumeUrl: '',
      notifyAlert: async () => { alerts++; }, notifyAllClear: async () => { clears++; },
      playAudio: async () => {}, headphonesConnected: () => false, now: () => NOW,
    };
    const r1 = await runCheck(user, { ...base, fileOverride: buildMockPlumeFile(NOW, DEMO_INITIAL_WIND_FROM) });
    const r2 = await runCheck(user, { ...base, fileOverride: buildMockPlumeFile(NOW, DEMO_SHIFTED_WIND_FROM) });
    expect([r1.event, r2.event]).toEqual(['ALERT', 'ALL_CLEAR']);
    expect([alerts, clears]).toEqual([1, 1]);
  });
});
