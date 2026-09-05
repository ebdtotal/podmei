import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function BackToReports() {
  return (
    <Link
      to="/app/relatorios"
      className="no-print inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:underline"
    >
      <ArrowLeft className="size-4" />
      Voltar aos relatórios
    </Link>
  );
}
