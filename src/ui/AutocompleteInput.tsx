/**
 * AutocompleteInput - Input with dropdown suggestions.
 */

import * as React from "react";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
}

export function AutocompleteInput(props: AutocompleteInputProps) {
  const { value, onChange, suggestions, placeholder, disabled } = props;
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!value) return suggestions.slice(0, 10);
    const lower = value.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().startsWith(lower))
      .slice(0, 10);
  }, [value, suggestions]);

  function handleSelect(item: string) {
    onChange(item);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [value]);

  return (
    <div className="accounting-autocomplete-wrapper">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      {showSuggestions && filtered.length > 0 && (
        <div ref={listRef} className="accounting-autocomplete-list">
          {filtered.map((item, i) => (
            <div
              key={item}
              className={`accounting-autocomplete-item ${i === selectedIndex ? "accounting-autocomplete-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
