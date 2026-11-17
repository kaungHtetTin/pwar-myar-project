import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AiUsageReportPage } from './AiReportsPages';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
beforeEach(() => api.mockReset());

it('retries failed usage loads through Reload report', async () => {
  api.mockRejectedValueOnce(new Error('Report unavailable')).mockResolvedValue({ usage: { today_requests: 2, today_failures: 0, input_tokens: 20, output_tokens: 10 } });
  render(<AiUsageReportPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Report unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Reload report' }));
  expect(await screen.findByRole('region', { name: 'AI usage' })).toHaveTextContent('Requests today (Asia/Yangon)');
  expect(api).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('region', { name: 'DeepSeek account balance' })).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

