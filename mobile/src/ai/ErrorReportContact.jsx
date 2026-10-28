import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiRequest } from '../api/client';
import { PageAppBar } from '../navigation/PageAppBar';
import { Button, IconButton, Input } from '../components/Controls';
import { useLocale } from '../localization/LocaleContext';
import { usePageRefresh } from '../navigation/pageRefresh';

const channels = [['facebook', 'Facebook'], ['telegram', 'Telegram'], ['viber', 'Viber'], ['phone', 'Phone']];
const fields = {
  facebook: ['Facebook / Messenger link', 'https://facebook.com/your.profile'],
  telegram: ['Telegram username, link or phone', '@username'],
  viber: ['Viber phone number', '+959123456789'],
  phone: ['Phone number', '+959123456789'],
};

function ErrorReportContactForm({ api, requestId, language = 'en', onDone }) {
  const my = language === 'my', id = useId(), saving = useRef(false);
  const [report, setReport] = useState(null), [channel, setChannel] = useState(''), [value, setValue] = useState('');
  const [error, setError] = useState(''), [fieldError, setFieldError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  usePageRefresh(() => setRetry(n => n + 1));
  useEffect(() => {
    let active = true;
    api(`/ai-assistant/error-report-requests/${requestId}`).then(row => { if (active) { setReport(row); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [api, requestId, retry]);
  async function submit(event) {
    event.preventDefault();
    if (saving.current || !channel) return;
    saving.current = true; setBusy(true); setError(''); setFieldError('');
    try {
      const result = await api(`/ai-assistant/error-report-requests/${requestId}/submit`, { method: 'POST', body: JSON.stringify({ contact_choice: channel === 'skip' ? 'skip' : 'provided', contact_channel: channel === 'skip' ? null : channel, contact_value: channel === 'skip' ? null : value.trim() }) });
      setReport(current => ({ ...current, report_id: result.id, reference: result.reference }));
      window.dispatchEvent(new CustomEvent('mkpos:error-report-submitted', { detail: { requestId, reportId: result.id } }));
    } catch (e) { setFieldError(e.payload?.errors?.contact_value?.[0] || ''); setError(e.message); }
    finally { saving.current = false; setBusy(false); }
  }
  if (report?.report_id) return <div className="ai-report-contact"><p role="status">{report.reference} · {my ? 'Report တင်ပြီးပါပြီ။ Admin စစ်ဆေးရန် စောင့်ဆိုင်းနေပါသည်။' : 'Report submitted. Awaiting admin review.'}</p><Button type="button" onClick={onDone}>{my ? 'ပြီးပြီ' : 'Done'}</Button></div>;
  if (!report) return <div className="ai-report-contact">{error ? <><p role="alert">{error}</p><Button type="button" onClick={() => setRetry(n => n + 1)}>Retry</Button></> : <p role="status">Loading report…</p>}</div>;
  return <form className="ai-report-contact" onSubmit={submit} aria-label="Error report contact">
    <div><h3>{my ? 'Admin က ဘယ်ကနေ ဆက်သွယ်ပေးရမလဲ?' : 'How should admins contact you?'}</h3><p>{my ? 'ပေးထားသော contact ကို ဤ report နှင့်အတူ admin ထံ ပို့ပေးပါမည်။' : 'Your contact will be shared with admins for this report.'}</p></div>
    <div className="ai-report-contact-summary" data-no-localize><strong>{report.title}</strong><p>{report.description}</p></div>
    <fieldset disabled={busy}><legend>{my ? 'ဆက်သွယ်မည့် channel' : 'Contact channel'}</legend><div className="ai-report-contact-options">{channels.map(([key, title]) => <label key={key} className={channel === key ? 'is-selected' : ''}><Input required type="radio" name={`${id}-channel`} value={key} checked={channel === key} onChange={() => { setChannel(key); setValue(''); setFieldError(''); setError(''); }} />{title}</label>)}</div>
      <label className="ai-report-contact-skip"><Input required type="radio" name={`${id}-channel`} checked={channel === 'skip'} onChange={() => { setChannel('skip'); setFieldError(''); setError(''); }} />{my ? 'Contact မပေးဘဲ report တင်မည်' : 'Submit without contact details'}</label>
      {channel && channel !== 'skip' && <div className="ai-report-contact-field"><label htmlFor={`${id}-value`}>{fields[channel][0]}</label><Input id={`${id}-value`} required type={['phone', 'viber'].includes(channel) ? 'tel' : 'text'} maxLength={255} value={value} placeholder={fields[channel][1]} onChange={e => { setValue(e.target.value); setFieldError(''); setError(''); }} aria-describedby={`${id}-help${fieldError ? ` ${id}-error` : ''}`} aria-invalid={!!fieldError} /><small id={`${id}-help`}>{my ? 'မိမိကို ဆက်သွယ်နိုင်သော account / နံပါတ် ထည့်ပါ။' : 'Enter an account or number where admins can reach you.'}</small>{fieldError && <small role="alert" id={`${id}-error`}>{fieldError}</small>}</div>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className="ai-report-contact-actions"><Button type="button" disabled={busy} onClick={onDone}>{my ? 'နောက်မှ' : 'Not now'}</Button><Button variant="primary" type="submit" disabled={busy || !channel || (channel !== 'skip' && !value.trim())}>{busy ? (my ? 'တင်နေသည်…' : 'Submitting…') : (my ? 'Report တင်မည်' : 'Submit report')}</Button></div>
  </form>;
}

export function ErrorReportContactPage({ requestId, onBack }) {
  const { language } = useLocale();
  return <main className="ai-report-contact-page"><PageAppBar><IconButton variant="ghost" aria-label={language === 'my' ? 'AI အကူအညီပေးသူထံ ပြန်မည်' : 'Back to AI assistant'} onClick={onBack}><ArrowLeft size={22}/></IconButton><h1>{language === 'my' ? 'အမှားတင်ပြချက်' : 'Error report'}</h1></PageAppBar><ErrorReportContactForm key={requestId} api={apiRequest} requestId={requestId} language={language} onDone={onBack}/></main>;
}
export function ErrorReportContactPrompt({ request, onOpen, language }) {
  const [saved, setSaved] = useState(request.report_id);
  useEffect(() => {
    const receive = e => { if (Number(e.detail.requestId) === Number(request.id)) setSaved(e.detail.reportId); };
    window.addEventListener('mkpos:error-report-submitted', receive);
    return () => window.removeEventListener('mkpos:error-report-submitted', receive);
  }, [request.id]);
  const reportId = saved || request.report_id;
  return <div className="ai-report-contact-request">{reportId ? <p role="status">ERR-{String(reportId).padStart(6, '0')} · {language === 'my' ? 'တင်ပြီး' : 'Submitted'}</p> : <Button type="button" onClick={() => onOpen(request.id)}>{language === 'my' ? 'ဆက်သွယ်ရန် ဖြည့်ပြီး report တင်မည်' : 'Contact and submit'}</Button>}</div>;
}
