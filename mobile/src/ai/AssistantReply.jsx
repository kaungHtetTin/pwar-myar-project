import { useLocale } from '../localization/LocaleContext';
import { featureText } from '../../../shared/localization/newFeatures.js';
import { Input } from '../components/Controls';
import appPages from './app-pages.json';
import React, { createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const elements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'del', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'hr', 'a', 'br', 'input'];
const components = {
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  h4: ({ children }) => <h4>{children}</h4>,
  h5: ({ children }) => <h4>{children}</h4>,
  h6: ({ children }) => <h4>{children}</h4>,
  table: ReportTable,
  input: ChecklistItem,
};

/** Assistant Markdown only. User messages stay plain text; HTML/images are never enabled. */
const NavigationContext = createContext({ screens: [], language: 'en' });
function ReportTable({ children }) {
  const { language } = useContext(NavigationContext);
  return <div className="ai-report-table" role="region" aria-label={featureText('Report table', language)} tabIndex={0}><table>{children}</table></div>;
}
function ChecklistItem({ checked }) {
  const { language } = useContext(NavigationContext);
  return <Input type="checkbox" checked={Boolean(checked)} disabled readOnly aria-label={featureText(checked ? 'Completed item' : 'Incomplete item', language)}/>;
}
function ScreenLink({ href, children }) {
  const { screens, onNavigate, disabled, role, language } = useContext(NavigationContext);
  const screen = /^#mkpos-screen=([a-z_]+)$/.exec(href || '')?.[1];
  if (screen && Object.hasOwn(appPages, screen) && screens.includes(appPages[screen].module) && (!appPages[screen].owner_only || role === 'owner') && onNavigate) {
    return <button type="button" className="ai-screen-button" disabled={disabled} onClick={() => onNavigate(screen)}>{React.Children.map(children, child => typeof child === 'string' ? featureText(child, language) : child)}</button>;
  }
  return href && /^(https?:|mailto:|tel:)/i.test(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>;
}
const replyComponents = { ...components, a: ScreenLink };

export function AssistantReply({ body, onNavigate, screens = [], disabled = false, role = null }) {
  const { language } = useLocale();
  return <NavigationContext.Provider value={{ screens, onNavigate, disabled, role, language }}><div className="ai-reply-content" data-no-localize>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={replyComponents} allowedElements={elements} skipHtml>{body}</ReactMarkdown>
  </div></NavigationContext.Provider>;
}
