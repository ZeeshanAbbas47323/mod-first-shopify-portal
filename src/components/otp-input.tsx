"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = true,
}: OtpInputProps) {
  const inputs = React.useRef<(HTMLInputElement | null)[]>([]);
  const completed = React.useRef(false);

  React.useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  React.useEffect(() => {
    if (value.length === length && !completed.current) {
      completed.current = true;
      onComplete(value);
    }
    if (value.length < length) completed.current = false;
  }, [value, length, onComplete]);

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;

    if (digits.length > 1) {
      const filled = (value.slice(0, index) + digits).slice(0, length);
      onChange(filled);
      inputs.current[Math.min(filled.length, length - 1)]?.focus();
      return;
    }

    const next = value.padEnd(length, " ").split("");
    next[index] = digits;
    onChange(next.join("").replace(/\s/g, ""));
    if (index < length - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        inputs.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (!digits) return;
    onChange(digits);
    inputs.current[Math.min(digits.length, length - 1)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={value[i] ?? ""}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "size-11 rounded-lg border bg-card text-center",
            "text-lg font-semibold text-foreground caret-transparent",
            "outline-none transition-colors",
            "focus:border-[#005bd3] focus:ring-3 focus:ring-[#005bd3]/20",
            "disabled:cursor-not-allowed disabled:opacity-60",
            invalid ? "border-destructive" : "border-input"
          )}
        />
      ))}
    </div>
  );
}
