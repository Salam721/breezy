# Breezy: Requirements

Status: DRAFT, awaiting owner review. No code has been written.

Every requirement traces to the project brief (Hacklanta Asthma doc, IDs such as FR-1.1) or to an owner decision (D1–D6). Anything not in the brief is tagged **[derived]** and repeated in Open Questions. No statistic or performance number is claimed unless sourced or measured. Numeric targets from the brief are labeled "target".

## Overview
Breezy warns asthma-sensitive people when a street-level pollution plume is heading toward their location. A Python pipeline on AWS Lambda turns OpenAQ sensor readings plus wind data into plume polygons and publishes them to S3. The React Native/Expo app downloads them and checks, on the phone, whether the user is inside a plume.

## Glossary
- **Plume polygon:** a 2D directional cone extending downwind from a sensor reporting PM2.5 above a threshold.
- **Pipeline:** the scheduled AWS Lambda job.
- **Plume file:** the single JSON object in S3 holding the current polygons and a `generated_at` timestamp.
- **App:** the React Native/Expo mobile application.

## Owner decisions
- **D1** The app requests background ("Always") location during first-run onboarding with a plain-language explanation. User coordinates never leave the device.
- **D2** Plume data is published as a single JSON object in S3, overwritten each cycle, with `generated_at`.
- **D3** Emergency audio is bundled in the app and plays without any network call. No latency figure is claimed.
- **D4** Alerts come from on-device background tasks. Platform limits are verified in design.
- **D5** Stretch features are built only if time remains. Proposed stretch: FR-3.3 detour routing and the accelerometer part of NFR-2.1.
- **D6** The "15-minute head start" claim is removed. No unverified claims anywhere.
- **D7** The app is built as a development build, not run in Expo Go (background location is not supported in Expo Go).
- **D8** Hackathon testing is iPhone only. The codebase stays cross-platform (R7.5), but the headphone module is iOS-only and Android is untested.

---

## 1. Ingestion

**Story:** As the system operator, I want fresh sensor and wind data fetched automatically so plumes reflect current conditions.

- **R1.1** (FR-1.1) WHEN 5 minutes have elapsed since the previous cycle, THE PIPELINE SHALL poll the OpenAQ v3 `/locations` endpoint for the latest telemetry of the configured geographic bounding box.
- **R1.2** (FR-1.2) WHEN raw readings are received, THE PIPELINE SHALL filter out dead sensors, negative values, and single-frame PM2.5 values above 500, and SHALL extract the PM2.5 values.
- **R1.3** (FR-1.3) WHEN a cycle runs, THE PIPELINE SHALL concurrently query OpenWeatherMap for live wind direction (degrees) and wind speed (mph) and attach them to the sensor data.
- **R1.4** [derived from NFR-1.3 and D2] IF a cycle fails to obtain OpenAQ or OpenWeatherMap data, THEN THE PIPELINE SHALL leave the previously published plume file unchanged so its `generated_at` reflects its true age.
- **R1.5** [derived] IF no valid PM2.5 reading remains after sanitizing, THEN THE PIPELINE SHALL NOT publish a new file, because an empty "fresh" file would claim "no plumes" without any data behind it.

## 2. Plume Generation

**Story:** As a user, I want the danger zone drawn in the direction the wind is carrying the pollution, not as a static circle.

- **R2.1** (FR-2.1) WHEN a sensor reports PM2.5 above the configurable health threshold, THE PIPELINE SHALL construct, using Python's Shapely library, a 2D directional plume polygon extending downwind from that sensor. (In the brief's ETL terms this is the Load step: the enriched coordinates are fed into the geospatial layer. Shapely for the hackathon; a PostGIS buffer is the production alternative.)
- **R2.2** (FR-2.2, D2) WHEN plume polygons are recomputed, THE PIPELINE SHALL overwrite the plume file in S3 with the new polygons and a new `generated_at` timestamp.
- **R2.3** (D2) THE PLUME FILE SHALL be served over HTTPS.

## 3. Client Tracking & Intersect Engine

**Story:** As a user, I want the app to know when I am inside a plume without me opening it.

- **R3.1** (D1) WHEN the user first opens the app, THE APP SHALL explain in plain language why location access is needed and request background ("Always") location permission.
- **R3.2** (FR-3.1) WHILE the phone is locked or other apps are in the foreground, THE APP SHALL continue to capture the device's GPS coordinates. This requires a development build, not Expo Go (see platform-research.md). IF the user force-quits the app, THEN background tracking stops until the app is reopened (Android does not restart it automatically; iOS may restart it only for geofence events).
- **R3.3** [derived from D1, D4] THE APP SHALL download the plume file over HTTPS and cache it on the device, refreshing it whenever the app is awake (app opened, or woken by a background location update, if verified by test). THE APP SHALL NOT assume a 5-minute phone-side refresh: the background-task library's minimum interval is 15 minutes on Android and iOS timing is chosen by the system. THE APP SHALL NOT transmit the user's coordinates to any server.
- **R3.4** (FR-3.2) WHEN a new location fix is captured, THE APP SHALL test the user's point against the cached plume polygons on the device.
- **R3.5** [derived from NFR-1.3] WHILE the network is unavailable, THE APP SHALL keep using the last cached plume file and SHALL apply the staleness rule (R7.3).
- **R3.6 (Stretch, FR-3.3)** WHEN a user navigating from A to B has a route that crosses an active plume, THE APP SHALL generate a spatial waypoint detour and deep-link it to the native maps app (Apple Maps or Google Maps).

## 4. Alerting

**Story:** As a user, I want a clear warning when I am in a plume, in whichever form I can notice fastest.

- **R4.1** (FR-4.1) WHEN the user's location intersects an active plume, THE APP SHALL fire a lock-screen notification with explicit guidance text (for example, "Close windows immediately") at the highest priority the OS allows. The OS does not guarantee delivery timing or priority, so this is verified by a physical-device test and the app SHALL NOT claim "immediate" until measured.
- **R4.2** (FR-4.2, D3) WHEN the user's location intersects an active plume AND Bluetooth or wired headphones are connected, THE APP SHALL bypass the visual alert and play a pre-recorded warning file directly to the headphones. Headphone detection uses a small iOS module of our own (`app/modules/headphones`) that reads the current audio output route. It is untested until built on an iPhone (task T2). IF it does not work on a physical device, THEN headphone audio becomes a stretch feature and R4.1 remains the primary alert.
- **R4.3** (D3) THE APP SHALL play the pre-recorded warning from a file bundled in the app package, without any network call. The clips are generated with ElevenLabs during development.
- **R4.4** (FR-4.3) WHEN the user exits a plume boundary, OR the wind shifts the hazard away from the user's building, THE APP SHALL send an updated "All Clear" notification with a calming message.

## 5. Accountless Profile & Impact Tracking

**Story:** As a family, I want to start using the app immediately and keep my health data private.

- **R5.1** (FR-5.1) THE APP SHALL be usable immediately with no registration, login or password.
- **R5.2** (FR-5.2) THE APP SHALL store the user's health settings and the 5-second asthma baseline survey answers only on the device, in AsyncStorage.
- **R5.3** (FR-5.3) THE APP SHALL provide an "Inhaler Click" tracker and the buttons [I Closed Windows] and [I Rerouted] on the home screen.
- **R5.4** (FR-5.3) WHEN the user taps an Inhaler Click or event button, THE APP SHALL store the event locally and add it to the cumulative totals shown on the private Impact Dashboard.

## 6. UI / Visual Design

- **R6.1** (brief, UI Colors) THE APP SHALL use a teal and blue colour palette that appeals to both children and adults.
- **R6.2** [derived from FR-4.1] THE APP'S plume-alert state SHALL be visually distinct from, and clearly more urgent than, the calm default look.
- **R6.3** (brief) THE APP SHALL present the product name "Breezy" with the lungs logo and the tagline "Happy lungs, fresh air".
- **R6.4** (NFR-1.3) THE APP SHALL display distinct map statuses for safe, in-plume and "Stale/Unverified".

## 7. Non-Functional

- **R7.1** (NFR-1.1, D3) Emergency audio SHALL be bundled in the app and play without any network call. No latency figure is claimed unless measured.
- **R7.2** (NFR-1.2) The on-device point-in-polygon check SHALL complete in under 50 ms (target, to be measured).
- **R7.3** (NFR-1.3) IF the app's most recent plume file is older than 10 minutes by its `generated_at`, THEN THE APP SHALL show the status "Stale/Unverified" and SHALL NOT imply the user is safe.
- **R7.4** (NFR-2.1) Battery use SHALL stay under 3% per hour (target, to be measured). *Stretch part:* use low-power tower triangulation while stationary indoors and wake high-accuracy GPS only on sustained movement detected by the accelerometer.
- **R7.5** (NFR-2.2) The app SHALL be one cross-platform React Native/Expo codebase giving the same user flow on Android and iOS.
- **R7.6** (NFR-3.1, D1) All network traffic SHALL use HTTPS/TLS. User coordinates SHALL NOT be transmitted (this supersedes the brief's wording that the app sends lat/long to the backend).
- **R7.7** (NFR-3.2) No personally identifiable health data and no user tracking logs SHALL be stored on a central cloud server.
- **R7.8** (D6) No claim, statistic or performance number SHALL appear in the app, spec, README or pitch unless backed by a cited source or a measurement we ran.

---

## Open Questions & Conflicts

1. **Plume geometry parameters.** The brief says "directional cone" but gives no length, width or threshold values. The health threshold is "customizable" with no default. Design must derive these from cited sources, or you supply them. Nothing is invented. *Needs your input.*
2. **Target area.** Which city or bounding box? *Needs your input.*
3. **Background execution (D4), partly verified.** See `platform-research.md`. Confirmed: background location needs a development build and "Always" permission, and tracking stops on force-quit. Unverified: whether a background location task can fetch the plume file and schedule a local notification (the Expo docs do not say). *Resolve with an early physical-device test spike.*
4. **Headphone detection (R4.2), unverified.** expo-audio documents no way to detect connected output devices. The npm package react-native-headphone-detection was last published in 2020 (peer dependency react-native ^0.41.2), so it was not used. We wrote a small iOS module that reads `AVAudioSession.currentRoute`. *Resolve with the T2 spike on an iPhone.*
5. **"Wind shifts the hazard away from the building" (R4.4).** The brief doesn't say how the device decides this. Proposed [derived]: the next polygon file no longer contains the user's point. *Confirm.*
6. **API limits.** Polling every 5 minutes for OpenAQ v3 and OpenWeatherMap must fit their free-tier limits. To be verified from official docs before design.
7. **Audio script.** The exact wording of each ElevenLabs clip, and which languages. *Needs your input.*
8. **MVP vs stretch (D5).** Confirm that detour routing and accelerometer battery logic are stretch.
9. **Derived requirements.** R1.4, R1.5, R3.3, R3.5, R6.2 are derived. Confirm or remove.
10. **iOS time-sensitive / critical alerts.** expo-notifications supports `interruptionLevel` on iOS (since 0.28.3 per its changelog) and exposes an `allowCriticalAlerts` permission option; entitlement requirements were not verified. *Verify before claiming alert priority.*
11. **Where the danger-zone check runs.** The brief mentions "backend logic" for it; this spec follows D1 (on-device only). *Confirm.*
13. **Sensor latency (T0 finding).** Atlanta's OpenAQ sensors reported readings about 58 minutes old, with PM2.5 between 0.1 and 6.2 µg/m³. Breezy's input is therefore roughly hourly, not real-time, and live data will rarely cross the 35.5 threshold. The pipeline default for "dead sensor" was raised from 60 to 120 minutes, and the plume file now carries `data_as_of`. *Confirm the 120-minute limit and how to describe data freshness in the pitch.*
12. **Plume vector math.** The brief asks for "exact Python logic" for the directional vector and polygon but gives no numbers (see item 1).

## Removed from the brief
- "15-minute head start" (no supporting basis).
- "<10 ms" and "zero latency" audio figures (unverifiable as stated).
- Backend "FastAPI" cache (replaced by S3, D2).
- App uploading user lat/long to the backend (replaced by on-device check, D1).
