# Breezy: Platform Feasibility Research

Date: 2026-10-10. Source: official Expo documentation and package pages, read on this date. Limits: the notifications page was read in full except what the tool could not return; forum threads redirected and were not read. Anything not stated by a source is marked **unverified**.

## Confirmed
| Topic | Finding | Source |
| --- | --- | --- |
| Background location | Supported via `startLocationUpdatesAsync`. "You must use a development build to use background location since it is not supported in the Expo Go app." | Expo Location |
| Permissions | Foreground permission first, then background ("Always" on iOS). On Android 11+ the background request opens system settings, so explain first. If the user chose iOS "Allow Once", a later background request is denied and the user must enable it in Settings. "You must always be prepared to run with When In Use permission." | Expo Location |
| Android config | `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (the last required as of Android 14). A foreground-service notification shows while tracking. New builds with these permissions need Google Play review. | Expo Location |
| App killed | Background location stops if the user terminates the app. Android does not restart it automatically. iOS may restart it for geofence events only. Behavior after removal from recents varies by Android vendor. | Expo Location |
| Task definition | `TaskManager.defineTask` must be in the global scope; the JS app is spun up to run the task, with no views mounted. TaskManager is unavailable on Android in Expo Go and does not run background tasks on iOS in Expo Go. | Expo TaskManager |
| Background Task library | Android minimum interval 15 minutes. iOS: "short intervals are often ignored"; the system decides timing. Runs are not guaranteed. A 5-minute phone-side poll is **not** achievable with it. | Expo Background Task |
| Notifications | Remote push unavailable in Expo Go on Android from SDK 53; local notifications remain available in Expo Go. Delivery is not guaranteed (for example Android Doze). Apple advises against sending more than two or three per hour. Android 8+ requires notification channels. | Expo Notifications |
| iOS interruption level | `interruptionLevel` supported on iOS since expo-notifications 0.28.3. | expo-notifications changelog |
| Critical alerts | The permission request has an `allowCriticalAlerts` option. Entitlement requirements were not found in the sources read. | Expo Notifications |
| Bundled audio | expo-audio plays a `require()`d local asset. Background playback plugin option defaults to `true` and adds the iOS audio background mode. `shouldPlayInBackground` defaults to `false`. On Android, background playback stops after about 3 minutes without lock-screen controls. | Expo Audio |
| Headphone detection in expo-audio | No API documented for detecting connected output devices. `getAvailableInputs()` lists recording inputs only. | Expo Audio |
| Headphone detection candidate | react-native-headphone-detection v1.3.0, MIT, author Tintef. `isAudioDeviceConnected()` returns `{audioJack, bluetooth}`; has a change listener. iOS and Android folders; Android needs `BLUETOOTH` and `BLUETOOTH_ADMIN` permissions. Native module, so a development build. | npm/jsDelivr page and GitHub README |

## Unverified (needs a physical-device test)
1. Whether a background location task may make a network request to fetch the plume file. The TaskManager docs do not address network calls or time limits.
2. Whether a background task may schedule a local notification. Neither the TaskManager nor the Notifications page says.
3. Whether our own iOS headphone module (reads `AVAudioSession.currentRoute`) reports wired and Bluetooth headphones correctly. (The npm package react-native-headphone-detection was checked: version 1.3.0 published 2020-10-01, last modified 2022-05-14, peer dependency react-native ^0.41.2, so it was not used.)
4. iOS time-sensitive and critical alert entitlement requirements.
5. `expo-av`, which the brief names, is not in Expo SDK 57's bundled-modules list (`expo/bundledNativeModules.json`), while `expo-audio` is. The app uses expo-audio.
6. Android 12+ Bluetooth permission requirements for headphone detection.

## Consequences for the spec
- Use a development build (D7).
- The phone cannot poll every 5 minutes in the background. It refreshes the plume file when awake, and the 10-minute "Stale/Unverified" rule protects users.
- Do not claim "immediate" or "high-priority" alerts until tested.
- Headphone audio is at risk and becomes stretch if the test fails.
- Recommended first task: a minimal development build that, on a physical device, runs a background location task, fetches a small JSON file, schedules a local notification, and detects headphones. This turns items 1 to 3 into facts.

## Sources
- https://docs.expo.dev/versions/latest/sdk/location/
- https://docs.expo.dev/versions/latest/sdk/task-manager/
- https://docs.expo.dev/versions/latest/sdk/background-task/
- https://docs.expo.dev/versions/latest/sdk/notifications/
- https://docs.expo.dev/versions/latest/sdk/audio/
- https://docs.expo.dev/workflow/overview/
- https://github.com/expo/expo/blob/main/packages/expo-notifications/CHANGELOG.md
- https://github.com/Tintef/react-native-headphone-detection
- https://www.jsdelivr.com/package/npm/react-native-headphone-detection
