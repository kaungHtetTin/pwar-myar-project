import React from 'react';
import { Construction } from 'lucide-react';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { REMAINING_PAGE_MESSAGES, REMAINING_PAGE_PATTERNS } from '../localization/remainingPagesLocale';

function ModulePlaceholderContent({ module }) {
  return (
    <main className="module-placeholder">
      <section>
        <span><Construction size={28} /></span>
        <p className="page-kicker">Mobile workspace</p>
        <h1>{module?.label || 'No access'}</h1>
        <p>{module ? `${module.label} is connected to the navigation system and ready for its mobile-first screen.` : 'No workspace modules are assigned to this account. Ask the owner to update your access.'}</p>
      </section>
    </main>
  );
}

export function ModulePlaceholder(props) { return <ModuleLocalizationBoundary messages={REMAINING_PAGE_MESSAGES} patterns={REMAINING_PAGE_PATTERNS}><ModulePlaceholderContent {...props} /></ModuleLocalizationBoundary>; }
