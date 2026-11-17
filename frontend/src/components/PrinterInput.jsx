import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function PrinterInput({ label, value, printers, onChange, onRefresh, placeholder }) {
  const id = useId();
  const input = useRef(null);
  const menu = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const options = [...new Set(printers)].filter((name) => name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    menu.current?.children[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  function showAll() {
    setQuery('');
    setActive(-1);
    setOpen(true);
  }

  function choose(name) {
    onChange(name);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="field printer-input" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label htmlFor={id}>{label}</label>
      <div className="printer-input-control">
        <input
          id={id} ref={input} role="combobox" autoComplete="off"
          aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 && options[active] ? `${id}-option-${active}` : undefined}
          value={value} placeholder={placeholder}
          onFocus={() => { showAll(); onRefresh?.(); }}
          onClick={showAll}
          onChange={(event) => {
            onChange(event.target.value);
            setQuery(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (!open) { showAll(); return; }
              setActive((index) => options.length ? (index < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length) : -1);
            } else if (event.key === 'Enter' && open && options[active]) {
              event.preventDefault();
              choose(options[active]);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
        <button type="button" aria-label="Show all printers" tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { input.current.focus(); showAll(); }}><ChevronDown size={17} /></button>
      </div>
      {open && <div ref={menu} id={`${id}-list`} className="printer-input-menu" role="listbox" aria-label={label}>
        {options.map((name, index) => <button key={name} id={`${id}-option-${index}`}
          type="button" role="option" tabIndex={-1} aria-selected={name === value}
          className={index === active ? 'active' : ''}
          onMouseDown={(event) => event.preventDefault()} onClick={() => choose(name)}>{name}</button>)}
        {!options.length && <div className="printer-input-empty">No matching devices. You can type the exact printer name or COM port.</div>}
      </div>}
    </div>
  );
}
