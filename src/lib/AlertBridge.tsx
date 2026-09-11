import { useEffect, useRef } from "react";
import { buildAlerts, buildPortfolioAlerts, filterAlertsForPlan, visibleAlerts } from "./alerts";
import { useAuth } from "./auth";
import { hasPremiumAccess, isPremiumPlan } from "./plans";
import { notifyAlerts, scheduleEventMorningNotifications } from "./notify";
import { platform } from "./platform";
import { useStore } from "./store";

/** Agenda a notificação local e pede o e-mail (5 dias antes / faixa de limite) uma vez por sessão. */
export function AlertBridge() {
  const { user } = useAuth();
  const { company, entries, employee, payrolls, clients, events } = useStore();
  const ran = useRef<string>("");
  const eventsStamp = useRef<string>("");

  useEffect(() => {
    if (!user || user.role === "master") return;
    const premium = hasPremiumAccess(user);
    const raw =
      user.role === "contador"
        ? buildPortfolioAlerts(clients)
        : buildAlerts(company, entries, undefined, { employee, payrolls });
    const alerts = filterAlertsForPlan(visibleAlerts(raw), premium);
    const stamp = `${user.id}:${alerts.map((a) => a.id).join("|")}`;
    if (ran.current === stamp) return;
    ran.current = stamp;
    void notifyAlerts(alerts);
    void platform.checkAlertEmails().catch(() => undefined);
  }, [user, company, entries, employee, payrolls, clients]);

  useEffect(() => {
    if (!user || user.role === "master") return;
    if (!isPremiumPlan(user.plan) && user.plan !== "contador" && user.role !== "contador") return;
    const allEvents = user.role === "contador" ? clients.flatMap((c) => c.events ?? []) : events;
    const stamp = `${user.id}:${allEvents.map((e) => `${e.id}:${e.date}:${e.title}`).join("|")}`;
    if (eventsStamp.current === stamp) return;
    eventsStamp.current = stamp;
    void scheduleEventMorningNotifications(allEvents);
    void platform.checkAlertEmails().catch(() => undefined);
  }, [user, events, clients]);

  return null;
}
