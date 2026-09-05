import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Logo({
  to = "/",
  light = false,
  full = false,
}: {
  to?: string;
  light?: boolean;
  full?: boolean;
}) {
  return (
    <Link to={to} className="flex items-center gap-2">
      <img src="/pod-mei-icon.png" alt="" className="size-9 rounded-xl object-cover shadow-sm" />
      <span className="leading-tight">
        <span className={cn("block text-sm font-bold tracking-tight", light ? "text-white" : "text-ink")}>
          POD<span className="text-green">MEI</span>
        </span>
        {full ? (
          <span className={cn("block text-[10px] font-medium", light ? "text-white/80" : "text-ink")}>
            O poder de cuidar do <span className={light ? "text-white" : "text-green"}>seu negócio.</span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}
