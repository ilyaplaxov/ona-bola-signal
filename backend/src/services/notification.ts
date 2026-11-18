import type { Alert } from "@ona-bola/shared";

/**
 * A way to tell people about a new alert. The MVP has only the in-app inbox (brief section 5.5);
 * Telegram or SMS plug in here later without touching the measurement pipeline.
 */
export interface NotificationChannel {
  readonly name: string;
  deliver(alert: Alert): Promise<void>;
}

/** The in-app inbox reads the alerts table directly, so delivery has nothing more to do. */
export const inAppChannel: NotificationChannel = {
  name: "in-app",
  async deliver() {},
};

const channels: NotificationChannel[] = [inAppChannel];

/** Runs after the database transaction committed. A failing channel is logged, never fatal. */
export async function deliverAlerts(newAlerts: Alert[]): Promise<void> {
  for (const alert of newAlerts) {
    for (const channel of channels) {
      try {
        await channel.deliver(alert);
      } catch (error) {
        console.error(
          `Notification channel ${channel.name} failed for alert ${alert.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
