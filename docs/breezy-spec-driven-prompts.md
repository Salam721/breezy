# Breezy: Spec-Driven Prompt Set (Claude Code)

Breezy ("Happy lungs, fresh air") is a cross-platform mobile app that warns asthma-sensitive families when a street-level pollution plume is heading toward their block.

Flow: Requirements → Design → Tasks → Implementation. Review and approve at every gate. Specs live in `.claude/specs/breezy/`. Tip: press Shift+Tab for Plan mode before big steps.

Brand: original lungs logo (teal + blue), tagline "Happy lungs, fresh air".

## Decisions made by the project owner (apply everywhere)
1. **Location:** the app requests background ("Always") location during first-run onboarding, with a plain-language explanation. Coordinates never leave the device; the app downloads plume polygons and checks them on-device.
2. **Plume storage:** a single JSON object in Amazon S3, overwritten every cycle (replaces the FastAPI cache from the first diagram). It carries a `generated_at` timestamp used for the staleness rule.
3. **Audio wording:** "Emergency audio is bundled in the app and plays without any network call." No latency number is claimed unless measured.
4. **Background alerts:** a server push cannot know a user's location, so alerts come from on-device background tasks. Platform limits (especially iOS) are verified in the design phase.
5. **MVP vs stretch:** MVP is what the core demo needs. Stretch features are built only if time remains. Proposed stretch: detour routing (FR-3.3) and the accelerometer-based battery logic (part of NFR-2.1).
6. **No unverified claims:** the "15-minute head start" is removed. No claim, statistic or performance number appears in the app, the spec or the pitch unless it is backed by a cited source or a measurement we ran.

---

## Prompt 0: Setup (run once)

```
Create a CLAUDE.md for this project. Context: I'm building "Breezy", a
hackathon project (24–36 hour scope). Stack: React Native + Expo (TypeScript)
for mobile; Python + Shapely on AWS Lambda for the ingestion/plume pipeline;
OpenAQ v3 and OpenWeatherMap as data sources; Amazon S3 for the published plume
file; AsyncStorage for on-device data.
Working rules: follow the spec-driven flow (requirements → design → tasks →
implement one task at a time). Never write code before I approve the spec
phase. Specs live in .claude/specs/breezy/. At the end of each phase,
stop and wait for my approval. Do not improvise: use only my stated logic and
decisions, and list anything undecided as an open question. No claim, statistic
or performance number may appear anywhere unless it is backed by a cited source
or a measurement we ran.
```

## Prompt 1: Requirements

```
I want to build Breezy: a cross-platform mobile app that protects
asthma-sensitive people, especially children and low-income families near
highways and industrial zones, from street-level pollution plumes that city-wide
AQI apps miss. It predicts where toxic air is heading and alerts users before it
reaches their block.

How it works:
- A Python pipeline on AWS Lambda polls OpenAQ v3 every 5 minutes for a target
  bounding box, discards bad sensor data (negative values, dead nodes, spikes
  above 500 PM2.5), pulls wind speed and direction from OpenWeatherMap, and uses
  Shapely to build a downwind plume-cone polygon from any sensor above a
  configurable threshold. Polygons are written to a single JSON object in Amazon
  S3, overwritten as wind shifts, with a generated_at timestamp.
- The React Native/Expo app requests background ("Always") location permission
  during first-run onboarding with a plain-language explanation, tracks location
  in the background, downloads the polygon file, and checks on-device whether the
  user is inside a plume. User coordinates never leave the device. If inside, it
  fires a lock-screen push alert with clear guidance (e.g., "Close windows
  immediately"). If Bluetooth or wired headphones are connected, it plays a
  bundled pre-recorded ElevenLabs audio clip instead. It sends an "All Clear"
  when the user leaves the plume or the wind shifts. If the user is navigating
  A→B through a plume, it suggests a detour waypoint and deep-links to
  Apple/Google Maps (stretch).
- No login. A 5-second asthma baseline survey and all metrics are stored on
  device in AsyncStorage. Users log inhaler clicks and tap [I Closed Windows] /
  [I Rerouted], which feed a private Impact Dashboard.

UI: the palette is teal and blue, friendly and appealing to both children and
adults. Alert states stay clearly urgent and distinguishable from the calm
default look.

Non-functional requirements:
- Emergency audio is bundled in the app and plays without any network call
- Point-in-polygon check runs on device (target <50ms, to be measured)
- If data is older than 10 minutes, show "Stale/Unverified" instead of implying safety
- Battery use stays under 3% per hour (target, to be measured; low-power location
  when stationary, GPS only on sustained movement is stretch)
- All network traffic over HTTPS/TLS
- No PII or tracking logs stored in the cloud

Before writing any code, create a spec. Write the requirements as user stories
with acceptance criteria in EARS format (WHEN ... THE SYSTEM SHALL ...). Group
them by: Ingestion, Plume Generation, Client Tracking & Intersect, Alerting,
Accountless Profile & Impact Tracking, UI/Visual Design, and Non-Functional.
Save to .claude/specs/breezy/requirements.md.

Do not invent requirements. Trace each one to my brief or my decisions, and tag
anything you derived. Add an "Open Questions & Conflicts" section listing
anything undecided, infeasible or underspecified. Then pause so I can review.
```

## Prompt 2: Design

```
Requirements approved. Now create the technical design in
.claude/specs/breezy/design.md. Cover:
- the data model (sensor reading, wind vector, plume polygon, user profile,
  impact events) and the JSON shape the app downloads from S3,
- the plume algorithm: how the wind angle and speed set the cone's direction,
  length and width, with the Shapely logic (cite sources for any parameter),
- the on-device point-in-polygon algorithm and its time complexity,
- the architecture: Lambda → S3 → how the app fetches it and how the staleness
  check uses generated_at,
- background location, battery strategy, and the notification and headphone
  audio-routing flow, with platform limits verified against current docs,
- the file structure for the Expo app and the Python pipeline,
- screens: onboarding survey, home/map status, alert, detour (stretch), Impact Dashboard,
- design tokens: the teal and blue palette (primary, secondary, background,
  text) plus separate alert, warning and stale-data colors, with a check that
  text contrast is readable,
- a "Hackathon MVP vs Production Roadmap" table (AsyncStorage → PostGIS, Lambda
  → Celery/Redis, etc.).

For each key decision, give the alternatives and trade-offs. Pause for my review
before writing tasks.
```

## Prompt 3: Tasks

```
Design approved. Break the work into ordered implementation tasks in
.claude/specs/breezy/tasks.md. Order them so there's a demoable vertical
slice early, with the pipeline and plume math first, then the app. Each task
should be completable and verifiable on its own, reference the requirement IDs it
satisfies, and include a test where it makes sense (e.g., unit tests for sanitizing
data, plume geometry and point-in-polygon edge cases). Mark each task as
MVP or stretch.
```

## Prompt 4: Implement (repeat per task)

```
Let's implement task 1. Show me the changes before applying them.
```
Then:
```
Looks good — apply it. How do I run/see this so far?
```
```
Implement the next task.
```

## Prompt 5: Demo data and mock mode

```
Add a mock mode: a built-in set of fake sensor readings and a scripted wind shift
so I can demo a plume reaching a given location without live sensors or
real-world travel. Tell me exactly how to trigger it and how to run the app on my
phone with Expo.
```

## Prompt 6: Polish

```
Polish the alert screen, the map status ("Safe / Plume / Stale"), and the Impact
Dashboard for a 90-second judge demo. Use the teal and blue design tokens from
design.md: clean, friendly for children and adults, large readable text, and a
calming tone. Keep the plume-alert state clearly urgent so it stands out from
the calm default look.
```
