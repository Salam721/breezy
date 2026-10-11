import * as Notifications from 'expo-notifications';
import { MESSAGES } from './messages';

/** Call once at app start so notifications also show while the app is open. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

async function fire(title: string, body: string): Promise<void> {
  // trigger: null = deliver immediately. Priority and timing are decided by the OS (R4.1).
  await Notifications.scheduleNotificationAsync({ content: { title, body, sound: true }, trigger: null });
}

export const notifyAlert = () => fire(MESSAGES.alertTitle, MESSAGES.alertBody);
export const notifyAllClear = () => fire(MESSAGES.allClearTitle, MESSAGES.allClearBody);
export const notifyTest = (body: string) => fire('Breezy test', body);
