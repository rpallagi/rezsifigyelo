"use client";

import { useCallback } from "react";

/**
 * Format a phone number for display as the user types.
 * Hungarian mobile: +36 30 123 4567
 * Hungarian landline: +36 1 234 5678
 * International: +XX XXX XXX XXXX (generic grouping)
 */
function formatPhone(digits: string): string {
  if (!digits) return "+";

  // Hungarian number: 36...
  if (digits.startsWith("36") && digits.length > 2) {
    const rest = digits.slice(2);
    // Budapest landline: +36 1 XXX XXXX
    if (rest.startsWith("1")) {
      const parts = [rest.slice(0, 1), rest.slice(1, 4), rest.slice(4, 8)].filter(Boolean);
      return `+36 ${parts.join(" ")}`;
    }
    // Mobile / other: +36 XX XXX XXXX
    const parts = [rest.slice(0, 2), rest.slice(2, 5), rest.slice(5, 9)].filter(Boolean);
    return `+36 ${parts.join(" ")}`;
  }

  // Generic international: +XX XXX XXX XXXX
  if (digits.length <= 2) return `+${digits}`;
  const country = digits.slice(0, 2);
  const rest = digits.slice(2);
  const groups: string[] = [];
  for (let i = 0; i < rest.length; i += 3) {
    groups.push(rest.slice(i, i + 3));
  }
  return `+${country} ${groups.join(" ")}`;
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "+36 30 123 4567",
  className = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
}: PhoneInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const digits = input.replace(/\D/g, "");

      // Always keep "+" — store formatted value, onChange gets the display value
      onChange(formatPhone(digits));
    },
    [onChange],
  );

  // Format existing value on render (handles loading saved data)
  const displayed = value
    ? value.includes(" ") ? value : formatPhone(value.replace(/\D/g, ""))
    : "+";

  return (
    <input
      type="tel"
      inputMode="tel"
      value={displayed}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      autoComplete="tel"
    />
  );
}
