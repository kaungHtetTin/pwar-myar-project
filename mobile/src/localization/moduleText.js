import { NEW_FEATURE_MESSAGES, NEW_FEATURE_PATTERNS } from '../../../shared/localization/newFeatures.js';

export function translateModuleText(value, language, messages, patterns = []) {
  const source = String(value ?? '');
  if (language !== 'my' || !source.trim()) return source;
  const leading = source.match(/^\s*/)?.[0] || '';
  const trailing = source.match(/\s*$/)?.[0] || '';
  const clean = source.trim();
  const direct = messages[clean] || NEW_FEATURE_MESSAGES[clean];
  if (direct) return `${leading}${direct}${trailing}`;
  for (const [pattern, replacement] of [...patterns, ...NEW_FEATURE_PATTERNS]) {
    const match = clean.match(pattern);
    if (!match) continue;
    const translated = typeof replacement === 'function' ? replacement(...match.slice(1)) : clean.replace(pattern, replacement);
    return `${leading}${translated}${trailing}`;
  }
  return source;
}
