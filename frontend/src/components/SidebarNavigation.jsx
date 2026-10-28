import React from 'react';
import { Bot } from 'lucide-react';

const sections = [
  { id: 'operations', label: 'Operations', modules: ['sell', 'products', 'purchases', 'sales', 'shop'] },
  { id: 'contacts', label: 'Contacts', modules: ['suppliers', 'customers'] },
  { id: 'finance', label: 'Finance', modules: ['expenses', 'transactions', 'reports'] },
  { id: 'administration', label: 'Administration', modules: ['billing', 'access', 'settings'] },
];

export function SidebarNavigation({ modules, active, onSelect, children }) {
  return <nav aria-label="Main navigation">
    {sections.map((section) => {
      const visible = modules.filter((module) => section.modules.includes(module.id));
      if (!visible.length) return null;
      const headingId = `sidebar-section-${section.id}`;
      return <section className="sidebar-nav-group" key={section.id} aria-labelledby={headingId}>
        <h2 className="sidebar-nav-heading" id={headingId}>{section.label}</h2>
        {visible.map(({ id, icon: Icon, label }) => <button
          key={id}
          type="button"
          className={id === active ? 'active' : ''}
          aria-current={id === active ? 'page' : undefined}
          aria-label={label}
          title={label}
          onClick={() => onSelect(id)}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>)}
      </section>;
    })}
    {children}
    <button className={`telegram-support-link${active === 'assistant' ? ' active' : ''}`} aria-current={active === 'assistant' ? 'page' : undefined} type="button" aria-label="PwarMyar AI assistant" title="PwarMyar AI assistant" onClick={() => window.dispatchEvent(new Event('mkpos:open-ai-assistant'))}>
      <Bot size={18} aria-hidden="true" /><span>PwarMyar AI assistant</span>
    </button>
  </nav>;
}
