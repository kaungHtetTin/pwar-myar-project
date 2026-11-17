import React from 'react';
import { AssistantReply } from './AssistantReply';

export function AssistantSubscriptionNotice({ access, role, language, screens, onNavigate }) {
  if (access?.allowed !== false) return null;
  const my = language === 'my';
  return <div className="ai-subscription-notice" role="status" data-no-localize>
    <p>{my ? 'ဝိုင်းဝိုင်းကို သက်တမ်းရှိသော အခမဲ့အစမ်းသုံးကာလ သို့မဟုတ် ဝန်ဆောင်မှုအစီအစဉ်ဖြင့်သာ အသုံးပြုနိုင်ပါတယ်။' : 'Wyne Wyne is available with an active free trial or valid subscription.'}</p>
    {role === 'owner' && screens?.includes('billing') ? <AssistantReply role={role} screens={screens} onNavigate={onNavigate} body={my ? '[ဝန်ဆောင်မှုသက်တမ်းတိုးရန်](#mkpos-screen=billing)' : '[Open Billing to renew](#mkpos-screen=billing)'}/> : <p>{my ? 'သက်တမ်းတိုးရန် လုပ်ငန်းပိုင်ရှင် သို့မဟုတ် PwarMyar support ကို ဆက်သွယ်ပါ။' : 'Contact your business owner or PwarMyar support to renew.'}</p>}
  </div>;
}
