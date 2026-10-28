import { describe, expect, it } from 'vitest';
import { translateText } from './translations';

describe('translations', () => {
  it('localizes the new Telegram settings, navigation, modal and connection messages', () => {
    for (const label of ['Bot token', 'Webhook URL', 'Add group', 'Group name', 'Telegram group ID', 'Bot is not a member', 'Test connection', 'Register webhook', 'Connection and webhook', 'Close Manage group', 'Customer conversations', 'Allowed representative actions', '6 pending updates', 'Shop, 6 orders need action', 'Chat, 3 unread messages', 'The daily limit field must not be greater than 10000.', 'Group settings changed. Reload before saving.']) {
      expect(translateText(label, 'my')).toMatch(/\p{Script=Myanmar}/u);
      expect(translateText(label, 'en')).toBe(label);
    }
    for (const value of ['@fixture_shop_bot', '-100123', 'https://fixture.test/webhook']) expect(translateText(value, 'my')).toBe(value);
  });
  it('keeps English text unchanged', () => {
    expect(translateText('Products', 'en')).toBe('Products');
  });

  it('translates shared UI text to Myanmar', () => {
    expect(translateText('Products', 'my')).toBe('ကုန်ပစ္စည်းများ');
    expect(translateText('Save', 'my')).toBe('သိမ်းဆည်းမည်');
  });

  it('translates every shared navigation action to Myanmar', () => {
    ['Sell', 'Products', 'Purchases', 'Suppliers', 'Customers', 'Expenses', 'Transactions', 'Reports', 'Billing', 'Settings', 'Access', 'Sign out', 'Back to dashboard']
      .forEach((label) => expect(translateText(label, 'my')).not.toBe(label));
  });

  it('translates dynamic notification messages', () => {
    expect(translateText('Barcode not found: 12345', 'my')).toBe('ဘားကုဒ် ရှာမတွေ့ပါ - 12345');
    expect(translateText('7 rows loaded', 'my')).toBe('7 အတန်း ဖွင့်ပြီး');
  });

  it('translates customer account labels and dynamic counts', () => {
    expect(translateText('Page Receivable', 'my')).toBe('ဤစာမျက်နှာရှိ ရရန်ငွေ');
    expect(translateText('Payable', 'my')).toBe('ပေးရန်ငွေ');
    expect(translateText('Settled', 'my')).toBe('စာရင်းရှင်းပြီး');
    expect(translateText('Search customer, phone, address, note', 'my')).toBe('ဖောက်သည်၊ ဖုန်း၊ လိပ်စာ (သို့) မှတ်ချက်ဖြင့် ရှာပါ');
    expect(translateText('11 shown', 'my')).toBe('11 ခု ပြသထားသည်');
    expect(translateText('11 total customers', 'my')).toBe('ဖောက်သည်စုစုပေါင်း 11 ယောက်');
  });

  it('translates report scope labels', () => {
    expect(translateText('Selected Period', 'my')).not.toBe('Selected Period');
    expect(translateText('Paid During Sales', 'my')).not.toBe('Paid During Sales');
    expect(translateText('Current Accounts', 'my')).not.toBe('Current Accounts');
    expect(translateText('Current Receivable', 'my')).not.toBe('Current Receivable');
    expect(translateText('Customers Owing', 'my')).not.toBe('Customers Owing');
  });

  it('translates receipt layout controls', () => {
    expect(translateText('Receipt Layout', 'my')).not.toBe('Receipt Layout');
    expect(translateText('Left Margin (mm)', 'my')).not.toBe('Left Margin (mm)');
    expect(translateText('Header Alignment', 'my')).not.toBe('Header Alignment');
    expect(translateText('Recommended Layout', 'my')).not.toBe('Recommended Layout');
  });

  it('translates multiline purchase cost warnings', () => {
    const message = [
      'The new buying cost is higher than these selling prices:',
      'Tea: Retail 900 Ks is below new cost 1,000 Ks',
      '',
      'Save this purchase anyway?',
    ].join('\n');
    const translated = translateText(message, 'my');
    expect(translated).toContain('ဝယ်ဈေးအသစ်သည် အောက်ပါရောင်းဈေးများထက် မြင့်နေသည်:');
    expect(translated).toContain('Tea: Retail 900 Ks သည် ဝယ်ဈေးအသစ် 1,000 Ks ထက်နည်းနေသည်');
    expect(translated).toContain('ဤအဝယ်ကို ဆက်သိမ်းမည်လား။');
  });
});
