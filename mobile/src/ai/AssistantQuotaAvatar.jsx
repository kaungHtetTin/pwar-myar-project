import { featureText, quotaRemainingText } from '../../../shared/localization/newFeatures.js';
import React from 'react';
import { Bot } from 'lucide-react';

import { weeklyProgress, weeklyReset } from './weeklyProgress';

export function AssistantQuotaReset({ usage, fallback = 'PwarMyar assistant', language = 'en' }) {
  const reset = weeklyReset(usage, language);
  if (!reset) return <small>{fallback}</small>;
  return <small className="ai-weekly-reset" data-no-localize><time dateTime={usage.resets_at} title={`${reset.full} (Asia/Yangon)`} aria-label={`${language === 'my' ? 'နောက်တစ်ပတ် ပြန်စမည့်အချိန်' : 'Next weekly reset'}: ${reset.full} (Asia/Yangon)`}>{language === 'my' ? 'ပြန်စမည့်နေ့' : 'Resets'} {reset.date}</time></small>;
}

export function AssistantQuotaAvatar({ usage, language = 'en' }) {
  const progress = weeklyProgress(usage);
  const label = progress ? quotaRemainingText(progress.remaining, usage.limit, progress.percent, language) : featureText('AI assistant', language);
  return <span className="ai-weekly-avatar" data-empty={progress?.remaining === 0 || undefined} style={progress ? { '--ai-quota-color': progress.color } : undefined} title={label}
    role={progress ? 'progressbar' : 'img'} aria-label={featureText(progress ? 'Weekly AI requests remaining' : 'AI assistant', language)} aria-valuemin={progress ? 0 : undefined} aria-valuemax={progress ? 100 : undefined} aria-valuenow={progress?.percent} aria-valuetext={progress ? label : undefined}>
    {progress && <svg className="ai-weekly-ring" viewBox="0 0 44 44" aria-hidden="true"><circle className="ai-weekly-track" cx="22" cy="22" r="19"/><circle className="ai-weekly-fill" cx="22" cy="22" r="19" pathLength="100" strokeDasharray={`${progress.percent} 100`} strokeOpacity={progress.percent === 0 ? 0 : 1}/></svg>}
    <span className="ai-weekly-avatar-core"><Bot size={21} aria-hidden="true"/></span>
    {progress && <span className="ai-weekly-percent" aria-hidden="true" data-no-localize>{progress.percent}%</span>}
  </span>;
}
