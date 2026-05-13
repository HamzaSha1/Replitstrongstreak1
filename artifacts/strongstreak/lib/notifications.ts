import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleRestTimerNotification(seconds: number): Promise<string | null> {
  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Rest complete 💪",
      body: "Time to get back to work!",
      sound: true,
    },
    trigger: { seconds },
  });
  return id;
}

export async function cancelNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function scheduleWeightReminderNotification(hour: number, minute: number): Promise<string> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Log your weight 📊",
      body: "Don't forget to track your progress today!",
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    } as any,
  });
  return id;
}
