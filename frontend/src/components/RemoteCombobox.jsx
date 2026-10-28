import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export function RemoteCombobox({
  value,
  selectedOption = null,
  onSelect,
  onQueryChange,
  loadOptions,
  placeholder = 'Search...',
  emptyLabel = 'No matches found',
  allowClear = true,
  disabled = false,
  autoFocus = false,
  getLabel = (option) => option?.name || '',
}) {
  const [query, setQuery] = useState(selectedOption ? getLabel(selectedOption) : '');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestIdRef = useRef(0);
  const getLabelRef = useRef(getLabel);
  getLabelRef.current = getLabel;

  useEffect(() => {
    setQuery(selectedOption ? getLabelRef.current(selectedOption) : '');
  }, [value, selectedOption]);

  useEffect(() => {
    if (!open || disabled) return undefined;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await loadOptions(query.trim());
        if (requestId === requestIdRef.current) {
          setOptions(rows || []);
          setActiveIndex((rows || []).length ? 0 : -1);
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, open, disabled, loadOptions]);

  function choose(option) {
    onSelect(option || null);
    setQuery(option ? getLabel(option) : '');
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="remote-combobox">
      <Search size={15} aria-hidden="true" />
      <input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoFocus={autoFocus}
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          onQueryChange?.(event.target.value);
          setOpen(true);
          if (value) onSelect(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {allowClear && value && (
        <button type="button" className="remote-combobox-clear mkpos-dismiss-icon" aria-label="Clear selection" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(null)}>
          <X size={14} />
        </button>
      )}
      {open && (
        <div className="remote-combobox-menu" role="listbox">
          {loading && <div className="remote-combobox-status">Searching...</div>}
          {!loading && options.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={String(option.id) === String(value)}
              className={index === activeIndex ? 'active' : ''}
              key={option.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {getLabel(option)}
            </button>
          ))}
          {!loading && !options.length && <div className="remote-combobox-status">{emptyLabel}</div>}
        </div>
      )}
    </div>
  );
}
