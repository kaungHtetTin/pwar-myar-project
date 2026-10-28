import React from 'react';
import { ChevronRight, Globe, Info, Mail, MessageCircle, Phone, Send, Server, Smartphone, Store } from 'lucide-react';
import { viberHref } from '../platformContacts';

export function SettingsAbout({ version, contacts }) {
  const links = [
    ...(contacts.email ? [{ label: 'Email', detail: contacts.email, href: `mailto:${contacts.email}`, icon: Mail }] : []),
    ...contacts.phone_numbers.map(value => ({ label: 'Phone', detail: value, href: `tel:${value.replace(/[^+\d]/g, '')}`, icon: Phone })),
    ...(contacts.telegram_url ? [{ label: 'Telegram', detail: contacts.telegram_url.replace(/^https:\/\/(?:www\.)?t\.me\//, '@'), href: contacts.telegram_url, icon: Send }] : []),
    ...contacts.viber_numbers.map(value => ({ label: 'Viber', detail: value, href: viberHref(value), icon: MessageCircle })),
    ...(contacts.community_url ? [{ label: 'Community', detail: contacts.community_label || 'Join the community', href: contacts.community_url, icon: Globe }] : []),
  ];
  return <section className="settings-about-page">
    <div className="settings-brand-card"><span className="settings-row-icon"><Store size={28} /></span><span><strong>PwarMyar</strong><small>Version {version}</small><p>Mobile workspace</p></span></div>
    <section><h2 className="settings-group-label">App information</h2><dl>
      {[[Smartphone, 'Application', 'PwarMyar'], [Info, 'Version', version], [Smartphone, 'Mode', 'Laravel Online POS'], [Server, 'Data location', 'Configured Laravel server']].map(([Icon, label, value]) => <div key={label}><span className="settings-row-icon"><Icon size={19} /></span><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl></section>
    {links.length > 0 && <section><h2 className="settings-group-label">Support</h2><div className="settings-support-list">{links.map(({ label, detail, href, icon: Icon }) => <a key={href} href={href} {...(/^https:/.test(href) ? { target: '_blank', rel: 'noreferrer' } : {})}><span className="settings-row-icon"><Icon size={20} /></span><span><strong>{label}</strong><small>{detail}</small></span><ChevronRight size={18} /></a>)}</div></section>}
  </section>;
}

