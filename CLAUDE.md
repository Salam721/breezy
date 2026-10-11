# Breezy

"Happy lungs, fresh air." A cross-platform mobile app that warns asthma-sensitive families when a street-level pollution plume is heading toward their block.

## Context
Hackathon project (24–36 hour scope).

## Stack
- Mobile: React Native + Expo (TypeScript)
- Pipeline: Python + Shapely on AWS Lambda
- Data sources: OpenAQ v3, OpenWeatherMap
- Published plume file: Amazon S3 (single JSON object, overwritten each cycle, includes `generated_at`)
- On-device storage: AsyncStorage

## Working rules
1. Follow the spec-driven flow: requirements → design → tasks → implement one task at a time.
2. Specs live in `.claude/specs/breezy/`.
3. Never write code before the project owner approves the spec phase.
4. At the end of each phase, stop and wait for approval.
5. Do not improvise. Use only the owner's stated logic and decisions. List anything undecided as an open question.
6. No claim, statistic or performance number may appear in the app, the spec, the README or the pitch unless it is backed by a cited source or a measurement we ran. Targets are labeled "target, to be measured".

## Owner decisions
- Request background ("Always") location at first-run onboarding with a plain-language explanation. Coordinates never leave the device.
- Plume data is served from S3, not a server.
- Emergency audio is bundled in the app and plays without any network call.
- Alerts come from on-device background tasks. Platform limits are verified in the design phase.
- Stretch (only if time remains): detour routing (FR-3.3) and accelerometer-based battery logic.
- The "15-minute head start" claim is removed.
- Hackathon testing is iPhone only (Mac build machine). Headphone detection is our own iOS module; it is untested until run on the iPhone.
- Build as an Expo development build, not Expo Go (background location is unsupported in Expo Go). Platform research is in `.claude/specs/breezy/platform-research.md`; items marked unverified there must be tested on a physical device before being claimed.

## Brand
Original lungs logo in teal and blue. Palette: teal and blue, appealing to both children and adults. Alert states stay clearly urgent.
