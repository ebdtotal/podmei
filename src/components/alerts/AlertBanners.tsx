import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import type { AppAlert } from "@/lib/alerts";
import { cn } from "@/lib/utils";

export function AlertBanners({
  alerts,
  onDismiss,
}: {
  alerts: AppAlert[];
  onDismiss?: (id: string) => void;
}) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "relative flex items-start gap-3 rounded-2xl border px-4 py-3 pr-10 text-sm",
            alert.level === "danger"
              ? "border-red/40 bg-red/10 text-ink"
              : "border-orange/40 bg-orange/10 text-ink",
          )}
        >
          {onDismiss ? (
            <button
              type="button"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-base leading-none text-mute hover:bg-black/5 hover:text-ink"
              aria-label="Excluir aviso"
              onClick={() => onDismiss(alert.id)}
            >
              ×
            </button>
          ) : null}
          <Link to={alert.href} className="flex min-w-0 flex-1 items-start gap-3">
            <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", alert.level === "danger" ? "text-red" : "text-orange")} />
            <span>
              <span className="block font-semibold">{alert.title}</span>
              <span className="mt-0.5 block text-mute">{alert.body}</span>
            </span>
          </Link>
        </div>
      ))}
    </div>
  );
}
