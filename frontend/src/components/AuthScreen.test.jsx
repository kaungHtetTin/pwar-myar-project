import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { AuthScreen } from './AuthScreen';

vi.mock('../api', () => ({ request: vi.fn() }));

describe('AuthScreen', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it('resumes the original sign-in and signup drafts without requests or remounting', () => {
    const props = { onAuthenticated: vi.fn(), onNavigate: vi.fn() };
    const { rerender } = render(<AuthScreen {...props} page="login" />);
    const email = screen.getByLabelText('Email address', { exact: true });
    const password = screen.getByLabelText('Password', { exact: true });
    fireEvent.change(email, { target: { value: 'Unsubmitted@example.test' } });
    fireEvent.change(password, { target: { value: 'Private login draft' } });
    rerender(<AuthScreen {...props} page="signup" />);
    const business = screen.getByLabelText('Business name', { exact: true });
    fireEvent.change(business, { target: { value: 'Unsubmitted business' } });
    rerender(<AuthScreen {...props} page="login" />);
    expect(screen.getByRole('textbox', { name: 'Email address', exact: true })).toBe(email);
    expect(email).toHaveValue('Unsubmitted@example.test');
    expect(password).toHaveValue('Private login draft');
    rerender(<AuthScreen {...props} page="signup" />);
    expect(screen.getByRole('textbox', { name: 'Business name', exact: true })).toBe(business);
    expect(business).toHaveValue('Unsubmitted business');
    expect(request).not.toHaveBeenCalled();
  });

  it('signs an existing owner in', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    const session = { user: { name: 'Owner' }, business: { name: 'Shop' } };
    request.mockResolvedValue(session);
    render(<AuthScreen page="login" onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByPlaceholderText('owner@example.com'), 'owner@example.com');
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in to PwarMyar' }));

    expect(request).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ email: 'owner@example.com', password: 'password123' });
    expect(onAuthenticated).toHaveBeenCalledWith(session);
  });

  it('creates an isolated business owner account', async () => {
    const user = userEvent.setup();
    request.mockResolvedValue({ user: { name: 'Owner' }, business: { name: 'New Shop' } });
    render(<AuthScreen page="signup" onAuthenticated={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Example Store'), 'New Shop');
    await user.type(screen.getByPlaceholderText('Your full name'), 'Owner Name');
    await user.type(screen.getByPlaceholderText('owner@example.com'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'password123');
    await user.type(screen.getByPlaceholderText('Repeat your password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create business account' }));

    expect(request).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({
      business_name: 'New Shop', owner_name: 'Owner Name', email: 'new@example.com', password_confirmation: 'password123',
    });
  });

  it('navigates between the dedicated authentication pages', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { rerender } = render(<AuthScreen page="login" onAuthenticated={vi.fn()} onNavigate={onNavigate} />);

    expect(screen.queryByPlaceholderText('Example Store')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Create business account' }));
    expect(onNavigate).toHaveBeenCalledWith('signup');

    rerender(<AuthScreen page="signup" onAuthenticated={vi.fn()} onNavigate={onNavigate} />);
    expect(screen.getByPlaceholderText('Example Store')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Sign in instead' }));
    expect(onNavigate).toHaveBeenCalledWith('login');
  });
});
