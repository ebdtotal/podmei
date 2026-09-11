import { Capacitor } from "@capacitor/core";
import type { AppAlert } from "./alerts";
import type { CalendarEvent } from "./types";
import { todayIso } from "./utils";

const SHOWN = "podmei-alert-shown";
const EVENT_NOTIF = "podmei-event-notif";

function shownKey(id: string) {
  return `${SHOWN}:${id}:${todayIso()}`;
}

function alreadyShown(id: string) {
  try {
    return localStorage.getItem(shownKey(id)) === "1";
  } catch {
    return false;
  }
}

function markShown(id: string) {
  try {
    localStorage.setItem(shownKey(id), "1");
  } catch {
    /* ignore */
  }
}

async function scheduleNative(alerts: AppAlert[]) {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") {
    const asked = await LocalNotifications.requestPermissions();
    if (asked.display !== "granted") return;
  }
  const pending = alerts.filter((a) => !alreadyShown(a.id));
  if (!pending.length) return;
  await LocalNotifications.schedule({
    notifications: pending.map((alert, i) => ({
      id: Math.abs(hashId(alert.id)) % 2_000_000_000,
      title: alert.title,
      body: alert.body,
      schedule: { at: new Date(Date.now() + 1500 + i * 400) },
      extra: { href: alert.href },
    })),
  });
  pending.forEach((a) => markShown(a.id));
}

function hashId(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) | 0;
  return n;
}

async function notifyWeb(alerts: AppAlert[]) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return;
  }
  if (Notification.permission !== "granted") return;
  for (const alert of alerts) {
    if (alreadyShown(alert.id)) continue;
    new Notification(alert.title, { body: alert.body });
    markShown(alert.id);
  }
}

/** Notificação local no app (e no navegador, se o usuário permitir). */
export async function notifyAlerts(alerts: AppAlert[]) {
  if (!alerts.length) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await scheduleNative(alerts);
      return;
    }
  } catch {
    /* plugin ausente: cai no aviso do navegador */
  }
  await notifyWeb(alerts);
}

/** Agenda aviso no celular às 06:00 do dia do evento (Premium). */
export async function scheduleEventMorningNotifications(events: CalendarEvent[]) {
  if (!Capacitor.isNativePlatform()) return;
  const upcoming = events.filter((ev) => ev.date >= todayIso());
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const asked = await LocalNotifications.requestPermissions();
      if (asked.display !== "granted") return;
    }

    const prevRaw = localStorage.getItem(EVENT_NOTIF);
    const prevIds: number[] = prevRaw ? (JSON.parse(prevRaw) as number[]) : [];
    if (prevIds.length) {
      await LocalNotifications.cancel({ notifications: prevIds.map((id) => ({ id })) }).catch(() => undefined);
    }

    const notifications = upcoming
      .map((ev) => {
        const at = new Date(`${ev.date}T06:00:00`);
        if (at.getTime() <= Date.now()) return null;
        const id = (Math.abs(hashId(`evt-am:${ev.id}:${ev.date}`)) % 1_900_000_000) + 50_000_000;
        return {
          id,
          title: "Lembrete PODMEI",
          body: ev.title + (ev.note ? ` — ${ev.note}` : ""),
          schedule: { at, allowWhileIdle: true },
          extra: { href: "/app/calendario", eventId: ev.id },
        };
      })
      .filter((n): n is NonNullable<typeof n> => !!n);

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
    }
    localStorage.setItem(EVENT_NOTIF, JSON.stringify(notifications.map((n) => n.id)));
  } catch {
    /* plugin / permissão */
  }
}
