import React, { useRef, useState } from 'react';
import { Copy, Mail, Phone, Send, ShieldCheck } from 'lucide-react';
import { Button, Field, Input, Textarea } from '../components/Controls';
import { useLocale } from '../localization/LocaleContext';
import { usePlatformContacts, viberHref } from '../platformContacts';

export function AccountDeletionRequest({ contacts, accountEmail = '' }) {
  const { language } = useLocale();
  const text = (english, myanmar) => language === 'my' ? myanmar : english;
  const [email, setEmail] = useState(accountEmail), [business, setBusiness] = useState(''), [copied, setCopied] = useState(false);
  const requestField = useRef(null);
  const request = `PwarMyar account deletion request\n\nPlease delete my PwarMyar account and associated personal data.\nAccount email: ${email.trim() || '[your account email]'}\nBusiness: ${business.trim() || '[business name, if applicable]'}\n\nPlease explain the ownership verification steps and any records that must be retained, including the reason and retention period. Please confirm when my request has been processed.`;
  async function copy() {
    try { await navigator.clipboard.writeText(request); setCopied(true); }
    catch { requestField.current?.focus(); requestField.current?.select(); setCopied(false); }
  }
  const telegram = /^https:\/\/t\.me\/[a-z0-9_]+\/?$/i.test(contacts.telegram_url || '') ? contacts.telegram_url : '';
  return <div className="account-deletion-request">
    <p>{text('Request deletion of your PwarMyar account and associated personal data. Copy the request, then contact PwarMyar support using a channel below.', 'သင်၏ PwarMyar အကောင့်နှင့် ဆက်စပ်ကိုယ်ရေးအချက်အလက်များ ဖျက်ရန် တောင်းဆိုနိုင်ပါသည်။ တောင်းဆိုချက်ကို ကူးယူပြီး အောက်ပါနည်းလမ်းတစ်ခုဖြင့် PwarMyar အကူအညီဌာနသို့ ဆက်သွယ်ပါ။')}</p>
    <Field label={text('Account email', 'အကောင့် အီးမေးလ်')}><Input type="email" autoComplete="email" maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setCopied(false); }} /></Field>
    <Field label={text('Business name (optional)', 'လုပ်ငန်းအမည် (မဖြည့်လည်းရ)')}><Input maxLength={200} value={business} onChange={event => { setBusiness(event.target.value); setCopied(false); }} /></Field>
    <Field label={text('Deletion request', 'ဖျက်သိမ်းရန် တောင်းဆိုချက်')}><Textarea ref={requestField} rows={7} value={request} readOnly data-no-localize /></Field>
    <Button variant="secondary" type="button" onClick={copy}><Copy size={18} aria-hidden="true" />{text('Copy deletion request', 'တောင်းဆိုချက်ကို ကူးယူမည်')}</Button>
    <p role="status">{copied ? text('Request copied. Send it to PwarMyar support to submit your request.', 'တောင်းဆိုချက်ကို ကူးယူပြီးပါပြီ။ တင်သွင်းရန် PwarMyar အကူအညီဌာနသို့ ပေးပို့ပါ။') : text('Copying does not submit a request. You can also select and copy the text manually.', 'ကူးယူခြင်းဖြင့် တောင်းဆိုချက်ကို မတင်သွင်းသေးပါ။ စာသားကို ရွေးချယ်ပြီး ကိုယ်တိုင်ကူးယူနိုင်ပါသည်။')}</p>
    <nav className="account-deletion-contacts" aria-label={text('Contact PwarMyar about account deletion', 'အကောင့်ဖျက်ရန် PwarMyar သို့ ဆက်သွယ်မည်')}>
      {contacts.email && <a href={`mailto:${encodeURIComponent(contacts.email)}?subject=${encodeURIComponent('PwarMyar account deletion request')}&body=${encodeURIComponent(request)}`}><Mail size={18} aria-hidden="true" />{text('Email support', 'အီးမေးလ်ဖြင့် ဆက်သွယ်မည်')}</a>}
      {telegram && <a href={telegram} target="_blank" rel="noreferrer"><Send size={18} aria-hidden="true" />{text('Telegram support', 'Telegram ဖြင့် ဆက်သွယ်မည်')}</a>}
      {(contacts.viber_numbers || []).slice(0, 1).map(phone => <a href={viberHref(phone)} key={phone}><Phone size={18} aria-hidden="true" />{text('Viber support', 'Viber ဖြင့် ဆက်သွယ်မည်')}</a>)}
      {(contacts.phone_numbers || []).map(phone => <a href={`tel:${phone.replace(/[^+0-9]/g, '')}`} key={phone}><Phone size={18} aria-hidden="true" /><span>{text('Call support', 'ဖုန်းဖြင့် ဆက်သွယ်မည်')} <span data-no-localize>{phone}</span></span></a>)}
    </nav>
    <p className="account-deletion-note"><ShieldCheck size={18} aria-hidden="true" />{text('Never send your password or admin PIN. Support must verify account ownership before deletion. Ask support which records must be retained for legal, security or accounting reasons, and for how long. Contacting support does not immediately delete your account or business records.', 'စကားဝှက် သို့မဟုတ် အက်ဒမင် PIN ကို မပေးပို့ပါနှင့်။ ဖျက်သိမ်းခြင်းမပြုမီ အကောင့်ပိုင်ဆိုင်မှုကို စစ်ဆေးရပါမည်။ ဥပဒေ၊ လုံခြုံရေး သို့မဟုတ် စာရင်းအင်းအတွက် မည်သည့်မှတ်တမ်းများကို မည်မျှကြာ သိမ်းဆည်းရမည်ကို အကူအညီဌာနအား မေးမြန်းပါ။ ဆက်သွယ်ခြင်းဖြင့် အကောင့်နှင့် လုပ်ငန်းမှတ်တမ်းများကို ချက်ချင်း မဖျက်သိမ်းပါ။')}</p>
  </div>;
}

export function AccountDeletionPage() {
  const contacts = usePlatformContacts();
  const { language } = useLocale();
  return <main className="account-deletion-page"><header><h1>{language === 'my' ? 'PwarMyar အကောင့်ဖျက်ရန် တောင်းဆိုမည်' : 'PwarMyar account deletion'}</h1><p>{language === 'my' ? 'အကောင့်ဝင်ရန် မလိုအပ်ပါ။' : 'You can request deletion without signing in or reinstalling the app.'}</p></header><AccountDeletionRequest contacts={contacts} /></main>;
}
