import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button, ChoiceGroup, Field, IconButton, Input, InputGroup, Radio, Switch } from '../components/Controls';

export function SettingField({ label, error, hint, children }) {
  const id = useId();
  return <Field id={id} label={label} error={error} hint={hint}>
    {React.isValidElement(children) ? React.cloneElement(children, { id: children.props.id || id, 'aria-invalid': Boolean(error) }) : children}
  </Field>;
}

export function SettingsSection({ title, description, children, className = '' }) {
  return <section className={`mobile-form-section ${className}`}>
    {title && <div className="mobile-section-heading"><div><h3>{title}</h3>{description && <p>{description}</p>}</div></div>}
    {children}
  </section>;
}

export function SettingsToggle({ label, description, ...props }) {
  return <label className="settings-toggle-row">
    <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
    <Switch aria-label={label} {...props} />
  </label>;
}

export function SettingsChoices({ label, value, options, onChange, className = '' }) {
  const name = useId();
  return <ChoiceGroup className={`ui-choice-group--plain settings-choice-list ${className}`}>
    <legend>{label}</legend>
    {options.map(option => <label key={option.value} className={value === option.value ? 'is-selected' : ''}>
      <Radio name={name} aria-label={option.label} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
    </label>)}
  </ChoiceGroup>;
}

export function SettingsPassword({ ...props }) {
  const [visible, setVisible] = useState(false);
  return <InputGroup className="settings-password">
    <Input {...props} type={visible ? 'text' : 'password'} />
    <IconButton variant="ghost" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(current => !current)}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </IconButton>
  </InputGroup>;
}

export function SettingsSegments({ label, value, options, onChange }) {
  return <ChoiceGroup className="ui-choice-group--plain settings-segments"><legend>{label}</legend><div>
    {options.map(option => <Button key={option.value} variant="choice" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</Button>)}
  </div></ChoiceGroup>;
}
