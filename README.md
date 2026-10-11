# Breezy

*Happy lungs, fresh air.*

Breezy is a cross-platform mobile app that warns asthma-sensitive families when a street-level pollution plume is heading toward their block. A Python pipeline turns OpenAQ sensor readings and wind data into plume polygons; the app checks, on the phone, whether you are inside one. Your location never leaves your phone.

Built for the Hacklanta Social Good track.

## Honest status
| Part | State |
| --- | --- |
| Pipeline code (Python) | Written. 39 unit tests pass. OpenAQ part confirmed live on Oct 10 (7 PM2.5 locations in the Atlanta box). **OpenWeatherMap call not yet working (HTTP 401, key activation).** |
| App code (React Native / Expo) | Written. 55 unit tests pass, TypeScript typechecks, iOS config prebuild succeeds. **Not yet run on a phone, and the screens have not been looked at on a device.** |
| Background tracking, alerts, headphone audio | Code written. **Unverified until the iPhone test (T2).** |
| AWS deploy | Guide written, **commands untested.** |
| Sensor timing | The first live check (Atlanta, Oct 10) returned readings about 58 minutes old, so these sensors report roughly hourly. Breezy does not claim real-time air quality. The app shows the age of the newest sensor reading. |
| Plume cone length and spread | The team's own illustrative model, not a validated dispersion model. Numbers in `pipeline/breezy_pipeline/config.py` are labeled assumptions. |
| Audio warning | Placeholder tones. Replace `app/assets/audio/alert.wav` with the ElevenLabs recording. |

Nothing in this project states a performance number as a result. Numbers like "under 50 ms" are targets until measured.

## How it works
1. **Ingest:** a Lambda job polls OpenAQ v3 every 5 minutes for a bounding box and pulls wind speed and direction from OpenWeatherMap.
2. **Model:** Python's Shapely builds a downwind plume polygon from each sensor above a threshold and writes one JSON file (`plumes.json`) to Amazon S3. If any step fails, nothing is published, so the file's timestamp ages honestly.
3. **Shield:** the app downloads that file, tracks your location in the background, and checks on the device whether you are inside a plume. If so it sends a lock-screen alert, or plays a bundled voice warning through connected headphones. If the data is older than 10 minutes it shows "Stale / Unverified" instead of "safe".

```
OpenAQ ──┐
         ├─► Lambda (Python, Shapely, every 5 min) ──► S3 plumes.json ──► app (HTTPS GET)
Weather ─┘                                                                  │
                                      on the phone: GPS ► point-in-polygon ► alert / audio / all-clear
```

Specs: `.claude/specs/breezy/` (requirements, design, tasks, platform research). Working rules: `CLAUDE.md`. Libraries and AI tools used: `DISCLOSURES.md`.

## Tech stack

**Languages**
- TypeScript — the mobile app
- Python 3 — the data pipeline (runs on the AWS Lambda Python runtime)
- Swift — our own local iOS module for headphone detection (`app/modules/headphones`)

**Mobile app (React Native + Expo, TypeScript)**
- React Native 0.86 / React 19 — cross-platform UI
- Expo SDK 57 as an **Expo development build** (not Expo Go; background location is unsupported in Expo Go)
  - `expo-location` + `expo-task-manager` — background location and on-device plume checks
  - `expo-notifications` — lock-screen alerts
  - `expo-audio` — bundled voice warning, plays without a network call
  - `expo-dev-client`, `expo-status-bar`
- `@react-native-async-storage/async-storage` — on-device storage (no cloud account)

**Data pipeline (Python)**
- Shapely — downwind plume polygon geometry
- `urllib` (standard library) — HTTP calls to the data APIs
- boto3 — publishing the plume JSON to Amazon S3

**Cloud services**
- AWS Lambda — runs the pipeline on a schedule
- Amazon S3 — hosts the single published plume file (`plumes.json`), overwritten each cycle

**Data storage**
- Amazon S3 — one JSON object (the plume file), not a database
- AsyncStorage — on-device key-value storage; no server-side database, and coordinates never leave the phone

**External APIs**
- OpenAQ v3 — air-quality sensor readings (PM2.5)
- OpenWeatherMap — wind speed and direction
- ElevenLabs — used once to generate the bundled voice warning (not called at runtime)

**Tooling and testing**
- Jest + jest-expo — app unit tests
- pytest — pipeline unit tests
- TypeScript compiler (`tsc`) — type checking
- ESLint, Prettier — linting and formatting

See `DISCLOSURES.md` for the full list of third-party libraries, APIs, AI tools, and their licenses/terms.

## Project layout
```
breezy/
├── pipeline/           Python: sanitize, plume geometry, OpenAQ/OpenWeatherMap clients, S3 publish, Lambda handler
│   ├── breezy_pipeline/
│   ├── tests/
│   └── build_lambda.sh
├── app/                Expo (React Native, TypeScript) development-build app
│   ├── src/            geo, status rules, data, engine, alerts, screens, mock mode
│   ├── modules/headphones/   our small iOS module (Swift)
│   └── assets/
├── docs/               RUN_ON_YOUR_MAC.md, DEPLOY_AWS.md, prompt set
├── assets/             logo files
└── .claude/specs/breezy/
```

## Setup from scratch (VS Code on a Mac)

### 1. Install the tools
| Tool | Why | Where |
| --- | --- | --- |
| Visual Studio Code | your editor | https://code.visualstudio.com |
| Git | version control | https://git-scm.com |
| Node.js (LTS) | the Expo / React Native tooling | https://nodejs.org |
| Python 3 | the pipeline | https://www.python.org |
| Xcode | builds the iPhone app | Mac App Store |
| An iPhone with Developer Mode on | background location, notifications and headphones must be tested on a real device | Settings → Privacy & Security → Developer Mode |
| AWS account + AWS CLI | deploy the pipeline and the S3 file (later) | https://aws.amazon.com/cli |

Check in the VS Code terminal (Terminal → New Terminal): `node --version`, `npm --version`, `python3 --version`, `git --version`.

### 2. VS Code extensions
**ESLint**, **Prettier**, **Python** (Microsoft), **Expo Tools**, and **Swift** (optional, to read the headphone module).

### 3. Open the project
VS Code → File → Open Folder → the `breezy` folder.

### 4. API keys
Create free accounts and keep keys private; never commit them. Copy `.env.example` to `.env` and fill in:
- **OpenAQ v3:** https://docs.openaq.org/using-the-api/api-key
- **OpenWeatherMap:** https://openweathermap.org/api
- **ElevenLabs:** used once, to make the audio recording.

### 5. Pipeline: install, test, check the live APIs
```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
python -m breezy_pipeline.run_local check
python -m breezy_pipeline.run_local once --out plumes.json
```

### 6. App: install, test, run on your iPhone
```bash
cd app
cp .env.example .env
npm install
npm test
npm run typecheck
npx expo run:ios --device
```
Step-by-step with troubleshooting and the device test: `docs/RUN_ON_YOUR_MAC.md`.

### 7. Deploy the pipeline (optional for local demos)
`docs/DEPLOY_AWS.md`. Fallback: `python -m breezy_pipeline.run_local loop --out plumes.json`.

### 8. Demo mode (no live data needed)
In the app, tab **Air** → "Turn demo mode on". Simulates the plume reaching you, a wind shift (All Clear) and stale data. It is labeled DEMO on screen.

## Principles
- Location stays on the device. No account, no login.
- No claim, statistic or performance number is stated unless it is sourced or measured. Targets are labeled as targets.
