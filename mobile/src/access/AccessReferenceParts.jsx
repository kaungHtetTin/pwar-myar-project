import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, Checkbox, FieldShell, IconButton, Input } from '../components/Controls';
import React, { useState } from 'react';
import { Eye, EyeOff, ShoppingBag, Users, BarChart3, Settings, Store, LockKeyhole, ChevronLeft } from 'lucide-react';
import { accessPermissionGroups } from './accessUtils';

export function AccessPermissionGroups({ modules, selected, onToggle, error }) {
  const icons = { Operations: ShoppingBag, Contacts: Users, Finance: BarChart3, 'My Shop': Store, Other: Settings };
  return <div className="access-reference-permissions">{accessPermissionGroups(modules).map(group => { const Icon = icons[group.label] || Settings; return <section className="access-reference-panel access-permission-group" key={group.label}><span className="access-group-icon"><Icon size={22} /></span><div><h3>{group.label}</h3><div>{group.modules.map(module => <label key={module.id}><Checkbox type="checkbox" checked={selected.includes(module.id)} onChange={() => onToggle(module.id)} /><span>{module.label}</span></label>)}</div></div></section>; })}<section className="access-reference-panel access-permission-group access-owner-only"><span className="access-group-icon"><Settings size={21} /></span><div><h3>Administration</h3><p>Billing, access and settings are managed by the shop owner.</p></div></section>{error && <p className="mobile-field-error" role="alert">{error}</p>}</div>;
}

export function AccessPasswordField({ label, value, onChange, error, autoFocus, autoComplete = 'new-password', hint }) {
  const [visible, setVisible] = useState(false);
  return <FieldShell as="label" className="mobile-field access-password-field"><span>{label}<em className="access-required">*</em></span><div><Input aria-label={label} autoFocus={autoFocus} type={visible ? 'text' : 'password'} required minLength="8" autoComplete={autoComplete} value={value} onChange={onChange} /><Button variant="plain" type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(current => !current)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</Button></div>{hint && <small>{hint}</small>}{error && <small className="mobile-field-error" role="alert">{error}</small>}</FieldShell>;
}

export function AccessDenied({ onBack }) {
  return <main className="sale-retail-page access-reference-page access-denied-page"><PageAppBar className="retail-sale-header access-reference-header"><IconButton variant="ghost" type="button" aria-label="Back to authorized workspace" onClick={onBack}><ChevronLeft size={26} /></IconButton><h1>Access</h1><AppBarMenu /></PageAppBar><section className="access-denied-content"><span><LockKeyhole size={48} /></span><h2>Permission denied</h2><p>You do not have access to staff management.<br />Ask your business owner for permission.</p><Button variant="primary" className="mobile-primary" type="button" onClick={onBack}><ChevronLeft size={20} />Back to authorized workspace</Button></section></main>;
}
