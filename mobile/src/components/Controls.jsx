import React, { createContext, forwardRef, useContext, useId, useRef } from 'react';
import { Search, X } from 'lucide-react';

const classes = (...values) => values.filter(Boolean).join(' ');
const FieldContext = createContext(null);
const descriptions = (...values) => [...new Set(classes(...values).split(' ').filter(Boolean))].join(' ') || undefined;

function useFieldAttributes(props) {
  const field = useContext(FieldContext);
  return {
    ...props,
    id: props.id || field?.id,
    'aria-invalid': props['aria-invalid'] ?? field?.invalid,
    'aria-describedby': descriptions(props['aria-describedby'], field?.describedBy),
  };
}

/** Use plain for composite controls (cards, tabs, menus), which retain their layout. */
export const Button = forwardRef(function Button({ variant = 'secondary', type = 'button', busy = false, disabled, className, children, ...props }, ref) {
  return <button {...props} ref={ref} type={type} disabled={disabled || busy} aria-busy={busy || props['aria-busy']} className={classes('ui-button', `ui-button--${variant}`, className)}>{children}</button>;
});

export const IconButton = forwardRef(function IconButton({ variant = 'secondary', className, ...props }, ref) {
  return <Button {...props} ref={ref} variant={variant} className={classes('ui-icon-button', className)} />;
});

export const FloatingActionButton = forwardRef(function FloatingActionButton({ label, className, ...props }, ref) {
  return <IconButton {...props} ref={ref} variant="primary" className={classes('ui-fab', className)} aria-label={label} title={label} />;
});

export const Input = forwardRef(function Input({ type = 'text', className, ...props }, ref) {
  const attributes = useFieldAttributes(props);
  const kind = ['checkbox', 'radio'].includes(type) ? 'ui-check' : ['file', 'range', 'color', 'hidden'].includes(type) ? `ui-${type}` : 'ui-input';
  return <input {...attributes} ref={ref} type={type} className={classes(kind, className)} />;
});

export const Checkbox = forwardRef(function Checkbox(props, ref) {
  return <Input {...props} ref={ref} type="checkbox" />;
});

export const Radio = forwardRef(function Radio(props, ref) {
  return <Input {...props} ref={ref} type="radio" />;
});

export const Switch = forwardRef(function Switch({ className, ...props }, ref) {
  return <span className={classes('ui-switch', className)}>
    <Input {...props} ref={ref} type="checkbox" role="switch" className="ui-switch-input" />
    <span className="ui-switch-track" aria-hidden="true" />
  </span>;
});

export const Select = forwardRef(function Select({ className, fullWidth = true, ...props }, ref) {
  const attributes = useFieldAttributes(props);
  return <select {...attributes} ref={ref} className={classes('ui-input', 'ui-select', !fullWidth && 'ui-select--inline', className)} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  const attributes = useFieldAttributes(props);
  return <textarea {...attributes} ref={ref} className={classes('ui-input', 'ui-textarea', className)} />;
});

/** One border and focus ring for an input with icons, actions, currency or units. */
export const InputGroup = forwardRef(function InputGroup({ as: Element = 'div', className, ...props }, ref) {
  return <Element {...props} ref={ref} className={classes('ui-input-group', className)} />;
});

/** Composable shell: adds no DOM, so existing label associations and layouts survive. */
export const FieldShell = forwardRef(function FieldShell({ as: Element = 'div', className, ...props }, ref) {
  return <Element {...props} ref={ref} className={classes('ui-field', className)} />;
});

export const ChoiceGroup = forwardRef(function ChoiceGroup({ className, ...props }, ref) {
  return <fieldset {...props} ref={ref} className={classes('ui-choice-group', className)} />;
});

export function Badge({ tone = 'muted', dot = false, className, children, ...props }) {
  return <span {...props} className={classes('ui-badge', `ui-badge--${tone}`, dot && 'ui-badge--dot', className)}>{children}</span>;
}

/** A labeled form field; accepts an Input, Select, Textarea or compound control. */
export function Field({ id: suppliedId, label, error, hint, children, className }) {
  const generatedId = useId();
  const isControl = child => React.isValidElement(child) && [Input, Select, Textarea, Checkbox, Radio, 'input', 'select', 'textarea'].includes(child.type);
  const firstControl = React.Children.toArray(children).find(isControl);
  const id = suppliedId || firstControl?.props.id || generatedId;
  const describedBy = classes(hint && `${id}-hint`, error && `${id}-error`);
  const controls = React.Children.map(children, child => isControl(child) ? React.cloneElement(child, {
    id: child.props.id || id,
    'aria-invalid': error ? true : child.props['aria-invalid'],
    'aria-describedby': descriptions(child.props['aria-describedby'], describedBy),
  }) : child);
  return <FieldContext.Provider value={{ id, describedBy, invalid: error ? true : undefined }}><FieldShell className={classes('mobile-field', className)}>
    <label htmlFor={id}>{label}</label>
    {controls}
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {error && <small id={`${id}-error`} className="mobile-field-error" role="alert">{error}</small>}
  </FieldShell></FieldContext.Provider>;
}

/** Supports composition for existing scanner/clear actions, or a complete search input. */
export const SearchInput = forwardRef(function SearchInput({ as: Element = 'label', className, children, onClear, clearLabel = 'Clear search', inputProps, ...props }, ref) {
  const inputRef = useRef(null);
  if (children !== undefined) return <Element {...props} ref={ref} className={classes('mobile-search', 'ui-search', className)}>{children}</Element>;
  return <Element className={classes('mobile-search', 'ui-search', className)}>
    <Search size={18} aria-hidden="true" />
    <Input type="search" {...props} {...inputProps} ref={node => { inputRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }} />
    {onClear && props.value && <IconButton variant="ghost" disabled={props.disabled || inputProps?.disabled || props.readOnly || inputProps?.readOnly} aria-label={clearLabel} onClick={event => { onClear(event); inputRef.current?.focus(); }}><X size={18} aria-hidden="true" /></IconButton>}
  </Element>;
});
