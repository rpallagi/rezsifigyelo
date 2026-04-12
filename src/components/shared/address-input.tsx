"use client";

import { useState, useRef, useEffect } from "react";
import { Building2 } from "lucide-react";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  existingAddresses: string[];
  placeholder?: string;
  id?: string;
}

export function AddressInput({
  value,
  onChange,
  existingAddresses,
  placeholder = "pl. 1234 Budapest, Kossuth u. 1.",
  id,
}: AddressInputProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const query = value.trim().toLowerCase();
  const suggestions =
    query.length >= 2
      ? existingAddresses.filter(
          (addr) => addr.toLowerCase().includes(query) && addr !== value,
        )
      : [];

  const showDropdown = open && suggestions.length > 0;

  useEffect(() => {
    setHighlightIndex(-1);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const select = (addr: string) => {
    onChange(addr);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      select(suggestions[highlightIndex]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-md"
        >
          {suggestions.map((addr, i) => (
            <li
              key={addr}
              onMouseDown={(e) => {
                e.preventDefault();
                select(addr);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                i === highlightIndex
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
              {addr}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
