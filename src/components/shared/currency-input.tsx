"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Format a numeric string with thousand separators (non-breaking space).
 */
function formatWithSeparators(value: string): string {
  if (!value) return "";
  const negative = value.startsWith("-");
  const cleaned = value.replace(/[^0-9.,]/g, "");
  const parts = cleaned.replace(",", ".").split(".");
  const intPart = parts[0] ?? "";
  const decPart = parts.length > 1 ? parts[1] : null;
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

/**
 * Count digits (non-separator chars) up to a position in a formatted string.
 */
function digitsBeforePos(str: string, pos: number): number {
  let count = 0;
  for (let i = 0; i < pos && i < str.length; i++) {
    if (str[i] !== "\u00A0" && str[i] !== " ") count++;
  }
  return count;
}

/**
 * Find position in formatted string where N digits have been seen.
 */
function posAfterDigits(str: string, targetDigits: number): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] !== "\u00A0" && str[i] !== " ") count++;
    if (count >= targetDigits) return i + 1;
  }
  return str.length;
}

interface CurrencyInputProps {
  value: string;
  onChange: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  onBlur?: (rawValue: string) => void;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  className = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
  onBlur,
  disabled,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatWithSeparators(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when external value changes (but not during typing)
  const isTyping = useRef(false);
  useEffect(() => {
    if (!isTyping.current) {
      const currentRaw = parseFormatted(displayValue);
      if (currentRaw !== value) {
        setDisplayValue(formatWithSeparators(value));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const rawInput = input.value;
      const cursorPos = input.selectionStart ?? rawInput.length;

      // Count how many real digits are before the cursor in the NEW input
      const digitsBefore = digitsBeforePos(rawInput, cursorPos);

      const parsed = parseFormatted(rawInput);

      // Validate: allow empty, minus, or valid number
      if (parsed !== "" && parsed !== "-" && !/^-?\d*\.?\d*$/.test(parsed)) {
        return;
      }

      const formatted = formatWithSeparators(parsed);

      isTyping.current = true;
      setDisplayValue(formatted);
      onChange(parsed);

      // Restore cursor: find position in new formatted string where same number of digits appear
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const newPos = posAfterDigits(formatted, digitsBefore);
          inputRef.current.setSelectionRange(newPos, newPos);
        }
        isTyping.current = false;
      });
    },
    [onChange],
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
 * Uncontrolled variant for inline-edit fields (defaultValue + onBlur).
 */
interface CurrencyInputUncontrolledProps {
  defaultValue: string | number;
  onBlur: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const rawInput = input.value;
      const cursorPos = input.selectionStart ?? rawInput.length;
      const digitsBefore = digitsBeforePos(rawInput, cursorPos);

      const parsed = parseFormatted(rawInput);
      if (parsed !== "" && parsed !== "-" && !/^-?\d*\.?\d*$/.test(parsed)) return;

      const formatted = formatWithSeparators(parsed);
      setDisplayValue(formatted);

      requestAnimationFrame(() => {
        if (inputRef.current) {
          const newPos = posAfterDigits(formatted, digitsBefore);
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    [],
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
