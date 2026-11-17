import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LocaleProvider } from './LocaleProvider';
import { useLocale } from './LocaleContext';
import { ModuleLocalizationBoundary } from './ModuleLocalizationBoundary';
import { translateModuleText } from './moduleText';
import { SHOP_MESSAGES } from '../shop/shopLocale';

function Probe() {
  const { language, setLanguage } = useLocale();
  return <ModuleLocalizationBoundary messages={SHOP_MESSAGES}>
    <h2>Connection and webhook</h2>
    <label>Bot token<input aria-label="Bot token" type="password" placeholder="Paste the token from BotFather" defaultValue="unsaved-token" /></label>
    <button type="button">Manage group</button>
    <p data-no-localize title="Group name">@fixture_shop_bot</p>
    <button type="button" data-no-localize onClick={() => setLanguage(language === 'my' ? 'en' : 'my')}>Switch language</button>
  </ModuleLocalizationBoundary>;
}

it('translates the new business features and connection errors in the mobile catalogue', () => {
  for (const label of ['Bot token', 'Webhook URL', 'Add group', 'Group name', 'Telegram group ID', 'Connection and webhook', 'Bot is not a member', 'Test connection', 'Register webhook', '6 pending updates', 'Shop, 6 orders need action', 'Chat, 3 unread messages', 'The daily limit field must not be greater than 10000.', 'Group settings changed. Reload before saving.']) {
    expect(translateModuleText(label, 'my', SHOP_MESSAGES)).toMatch(/\p{Script=Myanmar}/u);
    expect(translateModuleText(label, 'en', SHOP_MESSAGES)).toBe(label);
  }
});

it('switches new labels and placeholders without replacing a draft or translating bot identity', async () => {
  localStorage.setItem('mkpos.language', 'en');
  render(<LocaleProvider><Probe /></LocaleProvider>);
  const input = screen.getByLabelText('Bot token');
  fireEvent.change(input, { target: { value: 'keep-my-token' } });
  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));
  await waitFor(() => expect(input).toHaveAttribute('aria-label', translateModuleText('Bot token', 'my', SHOP_MESSAGES)));
  expect(input).toHaveAttribute('placeholder', translateModuleText('Paste the token from BotFather', 'my', SHOP_MESSAGES));
  expect(input).toHaveValue('keep-my-token');
  expect(screen.getByText('@fixture_shop_bot')).toHaveAttribute('title', 'Group name');
  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));
  await waitFor(() => expect(input).toHaveAttribute('aria-label', 'Bot token'));
  expect(input).toHaveValue('keep-my-token');
});
