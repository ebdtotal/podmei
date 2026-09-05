import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="inline-flex rounded-full border border-line bg-bg p-0.5"
      role="group"
      aria-label="Tema"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Modo claro"
        title="Modo claro"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full",
          theme === "light" ? "bg-paper text-ink shadow-sm" : "text-mute",
        )}
      >
        <Sun className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Modo escuro"
        title="Modo escuro"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full",
          theme === "dark" ? "bg-paper text-ink shadow-sm" : "text-mute",
        )}
      >
        <Moon className="size-4" />
      </button>
    </div>
  );
}
