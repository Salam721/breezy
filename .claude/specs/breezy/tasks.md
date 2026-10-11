# Breezy: Implementation Tasks

Status: DRAFT, awaiting owner review. Hacking period ends 2026-10-11 08:00.
Rule: each task is small, verifiable on its own, and cites requirement IDs. **MVP** = needed for the demo. **Stretch** = only if time remains. Tasks marked *(sandbox)* can be built and tested here; *(Mac)* and *(iPhone)* run on your machine, because the sandbox cannot reach OpenAQ, OpenWeatherMap or a phone. Time estimates are not given because none can be verified; work in order and cut from the bottom.

## Status (updated)
| Task | State |
| --- | --- |
| T0 API check | Command ready (`run_local check`). **Needs you on the Mac.** |
| T1 Toolchain | Guide ready (`docs/RUN_ON_YOUR_MAC.md`). **Needs you on the Mac and iPhone.** |
| T2 Device spike | Code ready (Device test screen, probe mode, headphone module). **Needs you on the iPhone.** |
| B1 to B4 | Done and tested in the sandbox (36 tests). Live API calls not yet run. |
| B5 | Lambda package builds (about 19 MB). Deploy guide written, **commands untested.** |
| C1 to C4 | Done, 53 Jest tests pass. |
| D1 to D5 | Code written and typechecked; **not yet run on a device.** |
| D6 | Placeholder tones in the app. **Needs the ElevenLabs recording and approved script from you.** |
| E1 | Icon and colour tokens done. **Screens not yet seen on a device.** |
| E5 | README and run guides written; commands marked tested or untested. |
| E2 to E4 | Not started (stretch). |

## Phase A: Resolve the unknowns first
| # | Task | Where | Verify | Reqs |
| --- | --- | --- | --- | --- |
| T0 | **API check.** Create OpenAQ and OpenWeatherMap keys. Run one curl for the Atlanta bbox and one for current weather. Report how many PM2.5 locations come back, and compare `wind.deg` with a trusted wind report to settle from/to. I give you the exact commands. | Mac | Counts and a wind sample reported back | R1.1 to R1.3 |
| T1 | **Toolchain.** Install Xcode, enable iPhone developer mode, scaffold the Expo project and run an empty development build on the iPhone with `npx expo run:ios --device`. | Mac + iPhone | App icon opens on the phone | R7.5 |
| T2 | **Device spike.** Minimal app: background location task, fetch a small JSON file, schedule a local notification, play a bundled clip, detect headphones. Lock the phone and walk. Report which steps worked. | iPhone | Written pass/fail table for the five [U] items | R3.2, R3.3, R4.1 to R4.3 |

## Phase B: Pipeline *(sandbox for B1 to B3; Mac for B4)*
| # | Task | Verify | Reqs | Tag |
| --- | --- | --- | --- | --- |
| B1 | Sanitizer: drop negative, >500 and dead sensors; extract PM2.5 | Unit tests with fixture readings | R1.2 | MVP |
| B2 | Plume geometry per design 3.3, including calm case | Unit tests: polygon validity, apex at sensor, axis points downwind, wind from 270° puts the cone to the east | R2.1 | MVP |
| B3 | Plume file builder: GeoJSON, `generated_at`, config block | Unit tests on shape and timestamp | R2.2 | MVP |
| B4 | OpenAQ and OpenWeatherMap clients with concurrency; S3 writer that skips publish on failure | Run once on the Mac with keys; failure case leaves old file | R1.1, R1.3, R1.4, R2.2 | MVP |
| B5 | Lambda handler, EventBridge 5-minute schedule, public-read S3 object over HTTPS. Fallback: local 5-minute loop | `plumes.json` refreshes on its own; URL opens in a browser | R2.2, R2.3 | MVP |

## Phase C: App core *(sandbox for tests; iPhone for run)*
| # | Task | Verify | Reqs | Tag |
| --- | --- | --- | --- | --- |
| C1 | Types, storage module, design tokens | Jest tests for storage round trip | R5.2, R6.1 | MVP |
| C2 | Point-in-polygon and plume check with a bounding-box pre-check | Jest: inside, outside, on edge, concave polygon, empty file; timing logged | R3.4, R7.2 | MVP |
| C3 | Plume client: fetch over HTTPS, cache, staleness status | Jest with fake clock: 9 min fresh, 11 min stale; offline uses cache | R3.3, R3.5, R7.3 | MVP |
| C4 | Status state machine: SAFE, IN_PLUME, STALE; transitions emit alert and all-clear once | Jest transition table | R4.1, R4.4, R6.4 | MVP |

## Phase D: App screens and tracking
| # | Task | Verify | Reqs | Tag |
| --- | --- | --- | --- | --- |
| D1 | Onboarding: survey and permission flow with plain-language explanation | Fresh install walkthrough on iPhone | R3.1, R5.1, R5.2 | MVP |
| D2 | Home screen: status card, Inhaler Click, [I Closed Windows], [I Rerouted] | Taps persist across app restart | R5.3, R6.4 | MVP |
| D3 | Impact Dashboard with local totals | Counts match taps | R5.4 | MVP |
| D4 | Background location task wired to the check, alert, audio and all-clear, built on the T2 results | Locked-phone walk test; mock mode in foreground | R3.2, R4.1 to R4.4 | MVP |
| D5 | Mock mode: fixture plume, simulated location, scripted wind shift | Demo runs with no live data; screen is labeled "demo" | Prompt 5 | MVP |
| D6 | Recorded audio: owner supplies the script; ElevenLabs clips bundled in the app | Plays with airplane mode on | R4.3, R7.1 | MVP if headphones work |

## Phase E: Finish
| # | Task | Verify | Reqs | Tag |
| --- | --- | --- | --- | --- |
| E1 | Polish: teal and blue UI, urgent alert state, app icon and splash from the logo | Visual check on the iPhone | R6.1 to R6.3 | MVP |
| E2 | Map with plume polygons on Home | Polygons draw over Atlanta | R6.4 | Stretch |
| E3 | Detour routing and deep link to Maps | Route avoids a mock plume | R3.6 | Stretch |
| E4 | Accelerometer-gated low-power location, battery measurement | Measured drain reported honestly | R7.4 | Stretch |
| E5 | Finalize README with tested commands; update DISCLOSURES.md with versions and licenses; record measured numbers only | Fresh-clone setup works | R7.8 | MVP |

## Order of work
T0 and T1 start now, in parallel with B1 to B3 (which I can do while you set up the Mac). T2 follows T1. B4, B5 and C1 to C4 proceed while T2 runs. D4 waits for the T2 results.
