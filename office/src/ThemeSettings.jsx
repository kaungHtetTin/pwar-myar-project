import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { resolvedTheme, themeRoles, themeVariables, validThemeColor } from './themeRuntime';
import usage from './themeUsage.json';
import './theme-settings.css';

const title = role => role.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const formulaTitle = expression => expression.replace('color-mix(in srgb, ', '').replace(/\)$/, '').replaceAll('currentColor', 'Current text').replace(/var\(--(?:theme-)?([\w-]+)\)/g, (_, role) => title(role.replaceAll('-', '_'))).replace(', ', ' + ');
export function ThemeSettings({ branding, onSaved }) {
  const [primary, setPrimary] = useState(branding.primary_color), [mode, setMode] = useState(branding.theme_mode || 'light');
  const [preview, setPreview] = useState(null), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [search, setSearch] = useState('');
  const pending = useRef(false), request = useRef({ color: '', key: '' });
  const baseline = useRef({ primary: branding.primary_color, mode: branding.theme_mode || 'light', version: branding.theme_version || 1 });
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (baseline.current.version >= (branding.theme_version || 1)) return;
    if (primary !== baseline.current.primary || mode !== baseline.current.mode || preview) { setStale(true); return; }
    baseline.current = { primary: branding.primary_color, mode: branding.theme_mode || 'light', version: branding.theme_version || 1 };
    setPrimary(branding.primary_color); setMode(branding.theme_mode || 'light'); setStale(false);
  }, [branding, primary, mode, preview]);
  const palette = (preview?.primary_color === primary.toLowerCase() ? preview.palettes : resolvedTheme(branding))[mode];
  function changeColor(value) { setPrimary(value); setPreview(null); setError(''); setNotice(''); }
  async function generate() {
    if (!validThemeColor(primary)) throw new Error('Choose a six-digit HEX primary color.');
    const color = primary.toLowerCase();
    if (request.current.color !== color) request.current = { color, key: crypto.randomUUID() };
    const result = await api('/office/branding/theme/preview', { method: 'POST', body: JSON.stringify({ primary_color: color, request_key: request.current.key }), timeoutMs: 110000 });
    setPreview(result);
    return result;
  }
  async function run(kind) {
    if (pending.current) return;
    if (kind === 'save' && stale) { setError('Reset changes to load the latest settings before applying.'); return; }
    pending.current = true; setBusy(kind); setError(''); setNotice('');
    try {
      if (kind === 'generate') { await generate(); setNotice('Palette generated. Review both modes, then apply the theme.'); }
      else {
        if (!validThemeColor(primary)) throw new Error('Choose a six-digit HEX primary color.');
        let candidate = preview;
        if (primary.toLowerCase() !== branding.primary_color.toLowerCase() && !candidate) candidate = await generate();
        const value = await api('/office/branding', { method: 'PUT', body: JSON.stringify({ primary_color: primary.toLowerCase(), theme_mode: mode, theme_version: baseline.current.version, ...(candidate ? { preview_id: candidate.preview_id } : {}) }) });
        baseline.current = { primary: value.primary_color, mode: value.theme_mode, version: value.theme_version };
        onSaved(value); setPreview(null); setStale(false); setNotice('Theme applied to all apps. Open apps update automatically within 30 seconds.');
      }
    } catch (e) { setError(e.message); }
    finally { pending.current = false; setBusy(''); }
  }
  function reset() { baseline.current = { primary: branding.primary_color, mode: branding.theme_mode || 'light', version: branding.theme_version || 1 }; setPrimary(branding.primary_color); setMode(branding.theme_mode || 'light'); setPreview(null); setError(''); setNotice(''); setStale(false); }
  return <section className="office-theme-settings" aria-label="Platform theme">
    <div><h2>Theme for all apps</h2><p>Office, desktop, mobile, Shop and the public website use this palette.</p></div>
    <form onSubmit={e => { e.preventDefault(); void run('save'); }}><fieldset disabled={!!busy}>
      <div className="office-theme-controls"><label>Primary theme color<input type="color" value={validThemeColor(primary) ? primary : branding.primary_color} onChange={e => changeColor(e.target.value)} /></label><label>Primary HEX<input type="text" maxLength={7} pattern="#[0-9a-fA-F]{6}" required value={primary} onChange={e => changeColor(e.target.value)} spellCheck={false} /></label><fieldset className="office-theme-modes"><legend>Appearance</legend>{['light', 'dark'].map(value => <label key={value}><input type="radio" name="platform-theme-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />{title(value)}</label>)}</fieldset></div>
      <div className="office-theme-actions"><button type="button" disabled={!validThemeColor(primary)} onClick={() => void run('generate')}>{busy === 'generate' ? 'Generating…' : 'Generate with System Agent'}</button><button type="button" onClick={reset}>Reset changes</button><button type="submit" className="office-button-primary" disabled={stale}>{busy === 'save' ? 'Applying…' : 'Apply theme to all apps'}</button></div>
    </fieldset></form>
    {error && <p role="alert" className="feedback error">{error}</p>}{notice && <p role="status" className="office-success">{notice}</p>}
    {stale && <p role="status">The live theme changed elsewhere. Your draft is preserved. Reset changes to load the latest settings before applying.</p>}
    {preview && <p className="office-theme-rationale">{preview.rationale}{preview.estimated_cost_usd && <small> Generation cost: ${preview.estimated_cost_usd}</small>}</p>}
    <section className="office-theme-preview" aria-label={`${title(mode)} theme preview`} style={themeVariables(palette)}><aside><strong>PwarMyar</strong><span>Overview</span><b>Selected page</b></aside><div><h3>Theme preview</h3><p>Readable text, matching surfaces and clear actions.</p><article><strong>Business overview</strong><small>Secondary text and borders</small><div><span className="office-theme-preview-primary">Primary action</span><span className="office-theme-preview-secondary">Secondary</span></div><div className="office-theme-preview-statuses">{['success', 'warning', 'danger', 'info'].map(role => <span key={role} style={{ background: palette[`${role}_soft`], color: palette[`${role}_text`] }}>{title(role)}</span>)}</div></article></div></section>
    <div className="office-theme-inventory-heading"><div><h3>{preview ? 'Generated' : 'Saved'} {mode} palette</h3><p>{themeRoles.length} color roles · {branding.theme_mode || 'light'} is currently active{preview ? ' · Preview is not applied yet' : ''}</p></div><label>Find color role<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Text, surface, chart…" /></label></div>
    <div className="office-theme-swatches" aria-label="Theme color inventory">{themeRoles.filter(role => title(role).toLowerCase().includes(search.toLowerCase())).map(role => <article key={role}><span className="office-theme-swatch" style={{ background: palette[role] }} aria-hidden="true" /><div><strong>{title(role)}</strong><code>{palette[role]}</code><small>{(usage.roles[role]?.apps || ['Shared palette']).join(', ')}</small></div></article>)}</div>
    <details><summary>Transparent and overlay colors ({usage.derived?.length || 0})</summary><div className="office-theme-swatches">{usage.derived?.filter(row => title(row.role).toLowerCase().includes(search.toLowerCase())).map(row => {
      const color = palette[row.role] + Math.round(row.opacity * 255).toString(16).padStart(2, '0');
      return <article key={`${row.role}:${row.opacity}`}><span className="office-theme-swatch" style={{ background: color }} aria-hidden="true"/><div><strong>{title(row.role)} {Number((row.opacity * 100).toFixed(2))}%</strong><code>{color}</code><small>{row.apps.join(', ')}</small></div></article>;
    })}</div></details>
    <details><summary>Contextual color blends ({usage.formulas?.length || 0})</summary><p>These colors blend with the surrounding text, surface or metric accent.</p><div className="office-theme-swatches" style={{ ...themeVariables(palette), color:palette.text, '--brand':palette.primary, '--brand-100':palette.primary_soft, '--surface':palette.surface, '--danger':palette.danger, '--metric-accent':palette.primary }}>{usage.formulas?.filter(row => formulaTitle(row.expression).toLowerCase().includes(search.toLowerCase())).map(row => <article key={row.expression}><span className="office-theme-swatch" style={{ background:row.expression }} aria-hidden="true"/><div><strong>{formulaTitle(row.expression)}</strong><small>{row.apps.join(', ')}</small></div></article>)}</div></details>
  </section>;
}
