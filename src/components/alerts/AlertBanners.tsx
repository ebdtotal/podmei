import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import type { AppAlert } from "@/lib/alerts";
import { cn } from "@/lib/utils";

export function AlertBanners({ alerts }: { alerts: AppAlert[] }) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Link
          key={alert.id}
          to={alert.href}
          className={cn(
            "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
            alert.level === "danger"
              ? "border-red/40 bg-red/10 text-ink"
              : "border-orange/40 bg-orange/10 text-ink",
          )}
        >
          <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", alert.level === "danger" ? "text-red" : "text-orange")} />
          <span>
            <span className="block font-semibold">{alert.title}</span>
            <span className="mt-0.5 block text-mute">{alert.body}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
