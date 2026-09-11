import { useEffect, useState } from "react";
import { formatMoney, maskMoneyBr, parseMoneyBr } from "@/lib/utils";

/** Campo de valor em R$ 0,00; valor externo permanece number. */
export function MoneyBrInput({
  value,
  onChange,
  className = "input",
  required,
  id,
  name,
  placeholder = "R$ 0,00",
  autoFocus,
  min,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  required?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Se informado, rejeita valores abaixo no blur (ex.: 0). */
  min?: number;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(() => formatMoney(Number.isFinite(value) ? value : 0));

  useEffect(() => {
    const n = Number.isFinite(value) ? value : 0;
    setText((prev) => {
      const prevN = parseMoneyBr(prev);
      if (Math.round(prevN * 100) === Math.round(n * 100)) return prev;
      return formatMoney(n);
    });
  }, [value]);

  return (
    <input
      id={id}
      name={name}
      className={className}
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      placeholder={placeholder}
      required={required}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        const masked = maskMoneyBr(e.target.value);
        setText(masked);
        onChange(parseMoneyBr(masked));
      }}
      onBlur={() => {
        let n = parseMoneyBr(text);
        if (min != null && n < min) n = min;
        setText(formatMoney(n));
        onChange(n);
      }}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}
