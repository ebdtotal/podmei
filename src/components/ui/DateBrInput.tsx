import { useEffect, useState } from "react";
import { formatDate, maskDateBr, parseDateBr } from "@/lib/utils";

/** Campo de data em DD/MM/AAAA; valor externo permanece ISO (yyyy-mm-dd). */
export function DateBrInput({
  value,
  onChange,
  className = "input",
  required,
  id,
  name,
  placeholder = "DD/MM/AAAA",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  required?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => (value ? formatDate(value) : ""));

  useEffect(() => {
    const next = value ? formatDate(value) : "";
    setText((prev) => {
      const prevIso = parseDateBr(prev);
      if (prevIso && prevIso === value) return prev;
      return next;
    });
  }, [value]);

  return (
    <input
      id={id}
      name={name}
      className={className}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      required={required}
      value={text}
      onChange={(e) => {
        const masked = maskDateBr(e.target.value);
        setText(masked);
        const iso = parseDateBr(masked);
        if (iso) onChange(iso);
        else if (!masked) onChange("");
      }}
      onBlur={() => {
        if (!text) {
          onChange("");
          return;
        }
        const iso = parseDateBr(text);
        if (iso) {
          setText(formatDate(iso));
          onChange(iso);
        } else if (value) {
          setText(formatDate(value));
        }
      }}
    />
  );
}
