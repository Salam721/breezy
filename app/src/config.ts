/**
 * Where the app downloads plumes.json from (an HTTPS URL to the S3 object).
 * Set EXPO_PUBLIC_PLUME_URL in app/.env (see .env.example). If it is empty the
 * app uses only its cached file, and shows "Stale/Unverified" when there is none.
 */
export const PLUME_URL: string = process.env.EXPO_PUBLIC_PLUME_URL ?? '';

/** Demo scenario centre (placeholder in Atlanta). Used by mock mode only. */
export const DEMO_SENSOR = { lat: 33.75, lon: -84.4 };
