import { useEffect, useRef } from "react";
import { buildAlerts } from "./alerts";
import { notifyAlerts } from "./notify";
import { platform } from "./platform";
import { useStore } from "./store";
import { useAuth } from "./auth";

/** Agenda a notificação local e pede o e-mail (5 dias antes / faixa de limite) uma vez por sessão. */
export function AlertBridge() {
  const { user } = useAuth();
  const { company, entries } = useStore();
  const ran = useRef<string>("");

  useEffect(() => {
    if (!user || user.role === "master") return;
    const alerts = buildAlerts(company, entries);
    const stamp = `${user.id}:${alerts.map((a) => a.id).join("|")}`;
    if (ran.current === stamp) return;
    ran.current = stamp;
    void notifyAlerts(alerts);
    void platform.checkAlertEmails().catch(() => undefined);
  }, [user, company, entries]);

  return null;
}
