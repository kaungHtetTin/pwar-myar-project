import React, { useId } from 'react';
import { ChoiceGroup, Radio } from './Controls';

/** Controlled presets: date calculation and pending filter state stay with the page. */
export function DateRangeChoices({ legend = 'Date range', options, value, onChange }) {
  const name = useId();
  return <ChoiceGroup className="date-range-choices">
    <legend>{legend}</legend>
    {options.map(option => <label key={option.value}>
      <Radio name={name} aria-label={option.label} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span>{option.label}</span>
      {option.start && option.end && <small data-no-localize aria-hidden="true">{option.start} – {option.end}</small>}
    </label>)}
  </ChoiceGroup>;
}
