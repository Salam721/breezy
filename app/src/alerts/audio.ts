import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// ElevenLabs clip, bundled in the app (R4.3, R7.1). Played when the user is in a plume and
// headphones are connected. good-air.mp3 and audio-device.mp3 are in assets/audio but not
// connected yet: no trigger for them is in the spec.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ALERT_CLIP = require('../../assets/audio/bad-air-padded.mp3');

// Keep a reference so the player is not garbage-collected mid-playback (unverified cause; harmless).
let current: ReturnType<typeof createAudioPlayer> | null = null;

/** Plays the bundled warning with no network call. Throws if playback cannot start. */
export async function playAlertClip(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: true,
  });
  current?.remove();
  const player = createAudioPlayer(ALERT_CLIP);
  current = player;
  player.volume = 1;
  player.muted = false;
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      player.remove();
      if (current === player) current = null;
    }
  });
  player.play();
}

/** Device test only: plays the clip, then reports the player's own state after 1 s. */
export async function playAlertClipDiagnostic(): Promise<string> {
  await playAlertClip();
  await new Promise((r) => setTimeout(r, 1000));
  const p = current;
  if (!p) return 'player already finished (state not available)';
  return `isLoaded=${p.isLoaded} playing=${p.playing} duration=${p.duration}s t=${p.currentTime}s volume=${p.volume} muted=${p.muted}`;
}