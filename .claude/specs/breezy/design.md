# Breezy: Technical Design

Status: DRAFT, awaiting owner review. No code written.
Date: 2026-10-10. Hacking period ends 2026-10-11 08:00. Test device: iPhone. Build machine: Mac. Target city: Atlanta, Georgia.

## Legend
- **[V]** verified from a cited source (see `platform-research.md` and the source list at the end).
- **[A]** assumption or modeling choice made for this design. Needs owner approval, and is disclosed in the README and DISCLOSURES.md. Not a scientific claim.
- **[U]** unverified. Settled by a test (task T0, T2) before we rely on it.

## 1. Architecture

```
OpenAQ v3 ──┐
            ├─► AWS Lambda (Python, every 5 min) ──► S3: plumes.json ──► App (HTTPS GET)
OpenWeather ┘     sanitize → wind → Shapely cone                          │
                                                                          ▼
                                       on-device: GPS ► point-in-polygon ► alert / audio / all-clear
                                                                          │
                                              AsyncStorage: profile, survey, impact events
```
- The server never receives a user's location (D1).
- The plume file is identical for every user in the area.
- The brief's FastAPI cache is replaced by S3 (D2).

## 2. Data model

**PlumeFile** (GeoJSON FeatureCollection; RFC 7946 puts coordinates in [longitude, latitude] order)
```json
{
  "type": "FeatureCollection",
  "generated_at": "2026-10-10T22:30:00Z",
  "wind": { "from_deg": 240, "speed_mph": 6.7, "source": "openweathermap" },
  "config": { "threshold_pm25": 35.5, "horizon_s": 600, "half_angle_deg": 30 },
  "features": [
    { "type": "Feature",
      "properties": { "sensor_id": 123, "location_id": 45, "pm25": 62.1, "observed_at": "2026-10-10T22:25:00Z" },
      "geometry": { "type": "Polygon", "coordinates": [[[-84.40, 33.75], [...], [-84.40, 33.75]]] } }
  ]
}
```
`generated_at` drives the staleness rule (R7.3). `data_as_of` is the newest sensor reading behind the file (T0: roughly an hour old), shown in the app so a fresh file is never mistaken for live air; `sensors_used` is the count. An empty `features` array means no active plumes, and is still a fresh file.

**App types (TypeScript)**
- `Profile { baselineSurvey: SurveyAnswers; createdAt: string }`
- `ImpactEvent { type: 'inhaler' | 'closed_windows' | 'rerouted'; at: string }`
- `AppStatus = 'SAFE' | 'IN_PLUME' | 'STALE'`

**AsyncStorage keys:** `profile`, `impactEvents` (array), `plumeCache` (last PlumeFile plus `fetchedAt`), `lastStatus`.

## 3. Pipeline (Python, AWS Lambda)

### 3.1 Steps per 5-minute cycle (R1.1 to R2.2)
1. **Extract.** `GET https://api.openaq.org/v3/locations?bbox=minLon,minLat,maxLon,maxLat&limit=1000` with header `X-API-Key`. [V] bbox order is min longitude, min latitude, max longitude, max latitude; default 100 results per page, max `limit` 1000; `meta.found` gives the total. Keep only sensors whose `parameter.name` is `pm25` (parameter id 2, µg/m³) [V]. Filtering by `parameters_id` in the query is **[U]** (not confirmed in the docs read), so we filter client-side.
2. **Latest values.** `GET /v3/locations/{id}/latest` per location [V endpoint exists; returns `value`, `datetime`, `sensorsId`, `locationsId`, coordinates]. `/v3/parameters/2/latest` may allow one call for all sensors, but bbox support is **[U]**. Chosen after T0 reports how many locations Atlanta has.
3. **Sanitize** (R1.2): drop negative values, single-frame values above 500, and dead sensors. "Dead" is **[A]**: no reading within `SENSOR_MAX_AGE_MIN` (default 120, owner to confirm). The first live check (T0) found Atlanta sensors reporting roughly hourly, with readings about 58 minutes old, so a 60-minute limit would drop live sensors.
4. **Wind** (R1.3): `GET https://api.openweathermap.org/data/2.5/weather?lat&lon&appid` at the bbox center, concurrently with step 2 (thread pool). [V] `wind.speed` defaults to m/s; `wind.deg` is "meteorological". Meteorological degrees are conventionally the direction the wind comes **from**, and the page doesn't state it, so **[U]**: confirmed in T0 against a known wind report. One wind vector for the whole bbox is **[A]** (the brief's FR-1.3 gives a single wind pull per cycle).
5. **Plume geometry** (R2.1), section 3.3.
6. **Publish** (R2.2): write `plumes.json` to S3 only if steps 1 to 5 succeeded. On any failure, leave the old file so `generated_at` ages honestly (R1.4). Also nothing is published if no valid reading remains after step 3 (R1.5, [derived]).

### 3.2 API budget [V]
OpenAQ free tier: 60 requests per minute and 2,000 per hour, scoped to the key. Calls per cycle = 1 (locations) + N (latest) + 1 (weather). At 12 cycles per hour, N must stay under about 165, and under 60 per minute. If Atlanta has more PM2.5 locations than that, switch to the parameter-latest endpoint or sample, decided after T0. OpenWeatherMap free limits were not found in the pages read **[U]**; 12 calls per hour is minimal.

### 3.3 Plume cone algorithm (**[A]**, illustrative model, not a validated dispersion model)
For each sensor with `pm25 ≥ THRESHOLD`:
```
bearing   = (wind_from_deg + 180) mod 360          # downwind, degrees clockwise from north
L         = max(MIN_LEN_M, speed_mps * HORIZON_S)  # how far the cone extends
if speed_mps < CALM_MPS: polygon = circle(sensor, MIN_LEN_M)   # direction unreliable
else: points = [sensor] + [ offset(sensor, bearing - HALF + 2*HALF*i/N, L) for i in 0..N ]
      polygon = Polygon(points)
offset(): dx = L*sin(b), dy = L*cos(b)
          lon += dx / (111320 * cos(lat)), lat += dy / 111320   # small-area equirectangular approximation
```
Parameters, all in config and written into `plumes.json`:

| Parameter | Proposed default | Basis |
| --- | --- | --- |
| `THRESHOLD_PM25` | 35.5 µg/m³ | [V] lower bound of EPA's "Unhealthy for Sensitive Groups" PM2.5 band (AirNow technical assistance document, Table 6). Those bands are 24-hour averages, applied here to the latest reading: **[A]**. |
| `HORIZON_S` | 600 | [A] how many seconds of wind travel the cone shows |
| `HALF_ANGLE_DEG` | 30 | [A] cone spread |
| `MIN_LEN_M` | 300 | [A] floor so a plume never has zero size |
| `CALM_MPS` | 0.5 | [A] below this the wind direction is treated as unreliable |
| `N` (arc points) | 8 | smoothness only |

The 111,320 m per degree figure and the planar approximation are rough but small relative to the cone size. Shapely only builds and validates the polygon (`Polygon`, `is_valid`).
**Complexity:** O(S·N) time for S qualifying sensors, O(S·N) space.

## 4. Mobile app (React Native + Expo, TypeScript, development build)

### 4.1 Modules
```
app/            screens: Onboarding, Home, Alert, ImpactDashboard
src/geo/        pointInPolygon.ts, plumeCheck.ts
src/data/       plumeClient.ts (fetch + cache + staleness), storage.ts
src/tasks/      locationTask.ts (TaskManager.defineTask at global scope)
src/alerts/     notify.ts, audio.ts, headphones.ts
src/theme/      tokens.ts
src/mock/       fixtures and simulated location (demo mode)
src/engine/     checkEngine.ts: one location check (status, transition, alert/audio)
modules/headphones/   local iOS module (Swift) reading AVAudioSession.currentRoute
```

### 4.2 Point-in-polygon (R3.4, R7.2)
Ray casting on [lon, lat]: cast a ray from the point and count edge crossings; odd means inside. At city scale the planar test is adequate. **Time O(V)** per polygon, **O(P·V)** for P polygons with V vertices each (about 10 here); **space O(1)**. A bounding-box pre-check skips distant polygons. The <50 ms target is measured on the iPhone, not assumed.

### 4.3 Status logic
- `STALE` if `now − generated_at > 10 min` (R7.3). Stale data never displays SAFE. If the user's point is inside a polygon in a stale file, the status stays `STALE` and the in-plume warning still shows **[A]**, so stale data never suppresses a warning.
- `IN_PLUME` if inside any polygon of a fresh file; otherwise `SAFE`.
- Alert fires on the transition into `IN_PLUME`. "All Clear" fires on the transition out (R4.4). Repeated alerts while staying inside are not sent **[A]**.

### 4.4 Background flow (R3.2 to R4.3)
`expo-location` `startLocationUpdatesAsync` runs a `TaskManager` task [V]. On each update: read `plumeCache`; if it is old, try to refresh from S3 **[U]**; run the check; on transition, schedule a local notification **[U]** and, if headphones are connected **[U]**, play the bundled clip via `expo-audio` [V]. If T2 fails any [U] step, fall back as in section 7.

### 4.5 Permissions flow (R3.1) [V]
Onboarding explains why location is needed, then requests foreground permission, then background ("Always"). On iOS the app must still work with "When In Use" and shows a clear banner if background is not granted.

### 4.6 Screens
1. **Onboarding:** 5-second baseline survey, then location permission.
2. **Home:** large status card (Safe, In plume, Stale/Unverified), plus the Inhaler Click, [I Closed Windows] and [I Rerouted] buttons. A map with polygons is MVP-light **[A]**: built only after the core path works.
3. **Alert:** guidance text and the same buttons.
4. **Impact Dashboard:** cumulative local counts. Layout is not specified in the brief; proposed: three count tiles plus a recent-events list **[A]**.

### 4.7 Design tokens (R6.1, R6.2) and contrast
Colors come from the logo. Contrast ratios computed by script against WCAG 2.x (4.5 is the AA minimum for normal text):

| Use | Colors | Ratio |
| --- | --- | --- |
| Body text | #0f172a on #f0fdfa | 17.12 |
| Muted text | #475569 on #f0fdfa | 7.27 |
| Primary button | white on blue #2563eb | 5.17 |
| Deep teal header | white on #0f766e | 5.47 |
| Alert state | white on red #b91c1c | 6.47 |
| Stale state | white on slate #475569 | 7.58 |
| Warning accent | #0f172a on amber #fbbf24 | 10.69 |

Do not put white text on the light teal #14b8a6 (ratio 2.49). Use teal only for icons and fills.

## 5. Deployment
- **S3:** one object `plumes.json`, public read, served over its HTTPS endpoint (the S3 website endpoint is HTTP-only, so we use the REST endpoint or CloudFront) **[U]**. `Cache-Control` kept short. Verified at deploy.
- **Lambda:** Python, scheduled by Amazon EventBridge every 5 minutes. Shapely is packaged as a layer or dependency bundle **[U]**.
- **Fallback if AWS setup threatens the deadline:** run the same pipeline script on the Mac in a 5-minute loop that writes the same file to S3. The app is unaffected.

## 6. Key decisions and trade-offs
| Decision | Alternative | Why |
| --- | --- | --- |
| S3 JSON | DynamoDB, FastAPI | One small file, many readers, no server (D2) |
| On-device check | Backend check | Privacy (D1) and offline use. Cost: depends on OS background limits |
| Client-side PM2.5 filtering | `parameters_id` filter | Filter not confirmed in docs |
| One wind pull per cycle | Per-sensor wind | Matches the brief; N times fewer calls |
| Development build via `npx expo run:ios --device` | EAS cloud build | [V] the local route needs Xcode and no paid Apple account; EAS needs Expo setup. Developer mode must be on. |
| expo-audio | expo-av | expo-audio documented; expo-av is not in the Expo SDK 57 bundled-modules list |
| Local iOS module for headphones | react-native-headphone-detection | That package was last published in 2020 (peer dependency react-native ^0.41.2). Our module is a few lines but is untested until T2. iOS only. |
| Ray casting | `@turf/boolean-point-in-polygon` | Small, easy to test; a library is fine if time is short |

## 7. Unverified items and fallbacks (settled in T0 and T2)
| Item | If it fails |
| --- | --- |
| Atlanta has enough PM2.5 sensors in OpenAQ | Widen bbox; if still sparse, demo uses mock data (labeled as such) |
| Background task can fetch the file | App refreshes when opened or woken; staleness rule protects users |
| Background local notification | Notify when the app is awake; foreground alert for the demo |
| Headphone detection | Headphone audio becomes stretch; lock-screen alert remains primary |
| OWM wind-direction convention | Flip the 180° offset after the T0 check |

## 8. MVP vs production roadmap
| Area | Hackathon MVP | Production |
| --- | --- | --- |
| Plume storage | One S3 JSON | PostgreSQL + PostGIS |
| Scheduler | Lambda on a timer | Celery + Redis queue |
| Geometry | Shapely in Lambda | PostGIS buffers |
| Phone storage | AsyncStorage | Same, plus opt-in anonymous ZIP-level analytics |
| Wind | One vector per bbox | Per-sensor or gridded wind |
| Battery | Standard location updates | Accelerometer-gated low-power mode (stretch) |
| Routing | None | Detour waypoints deep-linked to Maps (stretch) |

## 9. Sources
- OpenAQ: https://docs.openaq.org/using-the-api/geospatial, /pagination, /rate-limits, /api-key, /resources/latest, /resources/parameters, /resources/locations
- OpenWeatherMap: https://openweathermap.org/current
- EPA AirNow AQI technical assistance document: https://document.airnow.gov/technical-assistance-document-for-the-reporting-of-daily-air-quailty.pdf
- Expo: https://docs.expo.dev/develop/development-builds/create-a-build/ and the pages in `platform-research.md`
