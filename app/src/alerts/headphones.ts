/**
 * Headphone detection via our local iOS module (modules/headphones).
 * UNTESTED until built on a real iPhone (task T2). If the native module is not
 * present (for example in a plain JS test), these return false / [] and the
 * app falls back to the notification.
 */
type Native = { isConnected(): boolean; currentOutputs(): string[] };

let native: Native | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  native = require('../../modules/headphones').default as Native;
} catch {
  native = null;
}

export function headphonesConnected(): boolean {
  try {
    return native ? native.isConnected() : false;
  } catch {
    return false;
  }
}

export function currentAudioOutputs(): string[] {
  try {
    return native ? native.currentOutputs() : [];
  } catch {
    return [];
  }
}

export const headphoneModuleAvailable = (): boolean => native !== null;
