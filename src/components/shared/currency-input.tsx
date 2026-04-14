"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Format a numeric string with thousand separators (space for hu-HU).
 * Preserves decimal part if present.
 */
function formatWithSeparators(value: string): string {
  if (!value) return "";
  const negative = value.startsWith("-");
  const cleaned = value.replace(/[^0-9.,]/g, "");
  // Support both comma and dot as decimal separator
  const parts = cleaned.replace(",", ".").split(".");
  const intPart = parts[0] ?? "";
  const decPart = parts.length > 1 ? parts[1] : null;
  // Add space every 3 digits from right
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  const result = decPart !== null ? `${formatted},${decPart}` : formatted;
  return negative ? `-${result}` : result;
}

/**
 * Parse a formatted string back to a raw numeric string.
 */
function parseFormatted(formatted: string): string {
  return formatted
    .replace(/\u00A0/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
}

interface CurrencyInputProps {
  value: string;
  onChange: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  step?: string;
  onBlur?: (rawValue: string) => void;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  className = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
  min,
  onBlur,
  disabled,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatWithSeparators(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  // Sync display when external value changes
  useEffect(() => {
    const currentRaw = parseFormatted(displayValue);
    if (currentRaw !== value) {
      setDisplayValue(formatWithSeparators(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Restore cursor position after formatting
  useEffect(() => {
    if (cursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
      cursorRef.current = null;
    }
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const raw = input.value;
      const cursorPos = input.selectionStart ?? 0;

      // Count non-separator chars before cursor in old value
      const oldBeforeCursor = displayValue.slice(0, cursorPos);
      const oldDigitsBefore = oldBeforeCursor.replace(/[\u00A0\s]/g, "").length;

      const parsed = parseFormatted(raw);

      // Allow empty, minus, or valid number (with optional decimal)
      if (parsed !== "" && parsed !== "-" && !/^-?\d*\.?\d*$/.test(parsed)) {
        return;
      }

      // Respect min/step constraints
      if (min !== undefined && parsed !== "" && parsed !== "-") {
        const numVal = Number(parsed);
        if (!isNaN(numVal) && numVal < Number(min)) {
          // Allow typing, don't block
        }
      }

      const formatted = formatWithSeparators(parsed);
      setDisplayValue(formatted);
      onChange(parsed);

      // Calculate new cursor position
      let newCursor = 0;
      let digitsSeen = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (digitsSeen >= oldDigitsBefore) break;
        if (formatted[i] !== "\u00A0" && formatted[i] !== " ") {
          digitsSeen++;
        }
        newCursor = i + 1;
      }
      cursorRef.current = newCursor;
    },
    [displayValue, onChange, min],
  );

  const handleBlur = useCallback(() => {
    if (onBlur) {
      onBlur(parseFormatted(displayValue));
    }
  }, [onBlur, displayValue]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      autoComplete="off"
    />
  );
}

/**
 * Uncontrolled variant — works with defaultValue and onBlur like the existing
 * maintenance detail / property detail inline-edit inputs.
 */
interface CurrencyInputUncontrolledProps {
  defaultValue: string | number;
  onBlur: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  step?: string;
  disabled?: boolean;
}

export function CurrencyInputUncontrolled({
  defaultValue,
  onBlur: onBlurProp,
  placeholder = "0",
  className = "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
  disabled,
}: CurrencyInputUncontrolledProps) {
  const initial = defaultValue === 0 ? "" : String(defaultValue ?? "");
  const [displayValue, setDisplayValue] = useState(() => formatWithSeparators(initial));
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  useEffect(() => {
    if (cursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
      cursorRef.current = null;
    }
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const raw = input.value;
      const cursorPos = input.selectionStart ?? 0;
      const oldBeforeCursor = displayValue.slice(0, cursorPos);
      const oldDigitsBefore = oldBeforeCursor.replace(/[\u00A0\s]/g, "").length;

      const parsed = parseFormatted(raw);
      if (parsed !== "" && parsed !== "-" && !/^-?\d*\.?\d*$/.test(parsed)) return;

      const formatted = formatWithSeparators(parsed);
      setDisplayValue(formatted);

      let newCursor = 0;
      let digitsSeen = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (digitsSeen >= oldDigitsBefore) break;
        if (formatted[i] !== "\u00A0" && formatted[i] !== " ") digitsSeen++;
        newCursor = i + 1;
      }
      cursorRef.current = newCursor;
    },
    [displayValue],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={() => onBlurProp(parseFormatted(displayValue))}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      autoComplete="off"
    />
  );
}
