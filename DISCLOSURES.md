# Breezy: Disclosures

This file lists everything Breezy uses that was not written by the team during Hacklanta, and everything that existed before the hacking period. It is kept up to date as the project is built.

Status key: **Planned** (in the spec, not yet used) · **In use** (added to the code). Licenses are filled in from each project's own page when the dependency is added; until then they read "to verify".

## 1. Existed before the hacking period
Nothing. The hacking period opened on Oct 9, 2026 at 8:30 pm per the event, and all work on Breezy (brief, logo, specs, code) began on Oct 10, 2026 at about 12 am, after it opened (owner statement).

## 2. Open-source libraries and frameworks
| Name | Purpose | Status | License |
| --- | --- | --- | --- |
| React Native | Cross-platform mobile UI | Planned | to verify |
| Expo | Build/run tooling, notifications, location, audio | Planned | to verify |
| TypeScript | App language | Planned | to verify |
| AsyncStorage | On-device storage | Planned | to verify |
| expo-location, expo-task-manager | Background location | Planned | to verify |
| expo-notifications | Alerts | Planned | to verify |
| expo-audio | Bundled warning audio | Planned | to verify |
| expo-dev-client | Development build | In use | to verify |
| Local iOS module `modules/headphones` | Headphone detection; written by the team from Expo's local-module template, not a third-party package | In use (untested on device) | n/a |
| Jest, jest-expo, pytest, boto3 | Testing and AWS upload | In use | to verify |
| Shapely | Plume polygon geometry (Python) | Planned | to verify |

## 3. External APIs and services
| Name | Purpose | Status | Terms |
| --- | --- | --- | --- |
| OpenAQ v3 | Air quality sensor data | Planned | to verify |
| OpenWeatherMap | Wind speed and direction | Planned | to verify |
| AWS Lambda, Amazon S3 | Run the pipeline, host the plume file | Planned | to verify |
| ElevenLabs | One-time generation of the bundled warning audio | Planned | to verify (including permitted use of generated audio) |

## 4. AI tools
| Tool | How it was used |
| --- | --- |
| Claude (Anthropic) | Drafted the specs, research notes and logo concepts from the team's brief, and will write code under the team's direction using a spec-driven workflow. The team's brief, decisions and review at each stage set what was built. |
| ElevenLabs | Generates the pre-recorded voice warnings |

## 5. Data and references
- EPA AirNow AQI technical assistance document: the PM2.5 threshold default (35.5 µg/m³) is the lower bound of its "Unhealthy for Sensitive Groups" band. The plume cone shape (length, spread) is the team's own illustrative model, not a validated dispersion model.
Plume polygons are computed from live OpenAQ and OpenWeatherMap data. No user location or health data is collected or stored in the cloud.

## 6. Anything else
No code, designs or assets from previous hackathons or earlier projects are used (owner statement: nothing was written before the event).
