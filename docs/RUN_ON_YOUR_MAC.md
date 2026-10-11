# Run Breezy on your Mac and iPhone (tasks T0, T1, T2)

Everything below runs on **your Mac**. The cloud sandbox where the code was written cannot reach the OpenAQ or OpenWeatherMap APIs or a phone, so these steps are the first time the live pieces run. If a step fails, paste the exact error back to Claude.

What was verified before you got this: pipeline unit tests (39 pass), app unit tests (55 pass), TypeScript typecheck, and an iOS prebuild of the config. **Not yet verified:** live API calls, the iPhone build, background behavior, the headphone module, the AWS deploy.

## 0. One-time setup
1. Install **VS Code** and open the `breezy` folder (File → Open Folder).
2. Install **Node.js LTS** and **Python 3** (see README for links). Check: `node --version`, `python3 --version`.
3. Install **Xcode** from the Mac App Store, open it once and accept the license. Then in a terminal: `xcode-select --install` if prompted.
4. On the iPhone: Settings → Privacy & Security → **Developer Mode** → on (it restarts the phone). Connect it by USB and tap "Trust".

## T0: check the live APIs (about 10 minutes)
1. Get keys: **OpenAQ** (https://docs.openaq.org/using-the-api/api-key) and **OpenWeatherMap** (https://openweathermap.org/api). OpenWeatherMap's FAQ says a new key can take up to 2 hours to activate, and a 401 error means the key is not active yet, is mistyped, or is missing from the request.
2. Create the keys file by hand: copy `.env.example` to `.env` (in the `breezy` folder), open it in VS Code, paste both keys with no quotes or spaces, and save.
3. In the VS Code terminal, run these **one line at a time and without any `#` comments** (the macOS shell, zsh, treats a `#` comment as part of the command and fails):
```bash
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
python -m breezy_pipeline.run_local check
```
Expect `39 passed` from pytest.
4. **Send Claude the full output of `check`** (it prints no keys). For every sensor it shows the reading, its age, and whether it was kept or dropped and why. It also shows the wind at the center of the box.
5. Compare the printed wind with a trusted report for Atlanta right now. If the report's "wind from" direction is about 180 degrees different, tell Claude: the direction convention is flipped and it is a one-line fix.
6. If it prints `No PM2.5 sensors found`, widen the box: `export BREEZY_BBOX="-84.8,33.5,-84.0,34.1"` and run `check` again.

**First T0 result (Oct 10):** the Atlanta box returned 7 PM2.5 locations and 6 readings, all about 58 minutes old, with values from 0.1 to 6.2 µg/m³ (none near the 35.5 threshold). OpenWeatherMap returned HTTP 401. Consequences: these sensors update roughly hourly, so do not describe Breezy's input as real-time; real data will usually show "no plumes", so the demo uses demo mode.

Then make a first plume file: `python -m breezy_pipeline.run_local once --out plumes.json` and open `plumes.json`. An empty `features` list is normal when no sensor is above 35.5 µg/m³.

## Host plumes.json over HTTPS (needed for T2)
The phone downloads the file from an HTTPS URL. Easiest path: follow `docs/DEPLOY_AWS.md` (S3 bucket + public read of that one file). For a quick T2 test only, any public HTTPS URL that serves the JSON works.

## T1: build the app on your iPhone
```bash
cd ../app
cp .env.example .env
npm install
npx expo run:ios --device
```
- Pick your iPhone when asked. The first build takes a while.
- If Xcode says the bundle identifier is taken or signing fails: in `app/app.json` change `app.breezy.hacklanta` (under `ios.bundleIdentifier`) to something unique like `com.yourname.breezy`, then in Xcode (open `app/ios/Breezy.xcworkspace`) → Settings → Accounts, add your Apple ID, and under the Breezy target → Signing & Capabilities choose your personal team.
- If it complains about CocoaPods: `brew install cocoapods` and run the command again. (Likely fix, not verified.)
- If the headphone module fails to compile, paste the Xcode error to Claude. The Swift file is untested.
- On the phone, if iOS says "Untrusted Developer": Settings → General → VPN & Device Management → trust your Apple ID.

## T2: the device test (this decides what we can promise)
Open the app → finish onboarding (allow location, then "Always", and notifications) → tab **Device test**. Run in order and write down the result of each:

| # | Do | Report |
| --- | --- | --- |
| 1 | "Request permissions" | The text it shows (fg/bg status) |
| 2 | "Fetch plume file now" | ok or the error |
| 3 | "Start tracking", then "Turn probe mode on" | tracking shows on |
| 4 | Lock the phone and walk or drive for 10 to 15 minutes | Did lock-screen "Background task ran…" notifications appear? |
| 5 | Open the app → "Refresh log" | Paste the whole Background log |
| 6 | "Notification in 10 s", lock the phone | Did it appear on the lock screen? |
| 7 | Connect headphones (wired, then Bluetooth) → "Check headphones" | The `connected=` and `outputs=[...]` text for each |
| 8 | With headphones in, "Play alert clip" | Did you hear it in the headphones? |

The log answers the open questions: whether a background task can fetch the file, whether it can post a notification, and how often it runs. Your results decide whether headphone audio and background refresh stay in the demo or move to stretch.

## Demo without live data
Tab **Air** → "Turn demo mode on". Buttons simulate the plume reaching you, a wind shift (All Clear), and stale data. It is labeled DEMO on screen.
