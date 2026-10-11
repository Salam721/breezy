import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// PLACEHOLDER clip (generated tones). Replace assets/audio/alert.wav with the ElevenLabs
// recording of the approved script; keep the same file name. Bundled in the app (R4.3, R7.1).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ALERT_CLIP = require('../../assets/audio/alert.wav');

/** Plays the bundled warning with no network call. Throws if playback cannot start. */
export async function playAlertClip(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: true,
  });
  const player = createAudioPlayer(ALERT_CLIP);
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) player.remove();
  });
  player.play();
}
