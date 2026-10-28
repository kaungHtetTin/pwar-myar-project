import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { AuthScreen } from './AuthScreen';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));

const session = {
  user: { id: 1, name: 'Moe Myint', email: 'moe@example.com', role: 'owner' },
  business: { id: 8, name: 'Moe Mini Mart' },
};

beforeEach(() => apiRequest.mockReset());

describe('mobile auth forms', () => {
  it('toggles password visibility with an accessible control', () => {
    render(<AuthScreen page="login" onAuthenticated={vi.fn()} onNavigate={vi.fn()} />);
    const password = screen.getByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  it('submits login details to the existing endpoint', async () => {
    const authenticated = vi.fn();
    apiRequest.mockResolvedValueOnce(session);
    render(<AuthScreen page="login" onAuthenticated={authenticated} onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'moe@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByLabelText('Keep me signed in on this device'));
    fireEvent.submit(screen.getByRole('button', { name: 'Login' }).closest('form'));

    await waitFor(() => expect(authenticated).toHaveBeenCalledWith(session));
    expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'moe@example.com', password: 'password123', remember: true }),
    });
  });

  it('enters the authenticated workspace with the active trial returned by registration', async () => {
    const authenticated = vi.fn();
    const trialSession = { ...session, subscription: { is_valid: true, access_type: 'trial', days_remaining: 31 } };
    apiRequest.mockResolvedValueOnce(trialSession);
    render(<AuthScreen page="signup" onAuthenticated={authenticated} onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Moe Mini Mart' } });
    fireEvent.change(screen.getByLabelText('Owner name'), { target: { value: 'Moe Myint' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'moe@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form'));

    await waitFor(() => expect(authenticated).toHaveBeenCalledWith(trialSession));
    expect(apiRequest).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ method: 'POST' }));
  });

  it('renders Laravel field validation errors beside their inputs', async () => {
    const error = Object.assign(new Error('The email has already been taken.'), {
      status: 422,
      payload: { errors: { email: ['The email has already been taken.'] } },
    });
    apiRequest.mockRejectedValueOnce(error);
    render(<AuthScreen page="signup" onAuthenticated={vi.fn()} onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Moe Mini Mart' } });
    fireEvent.change(screen.getByLabelText('Owner name'), { target: { value: 'Moe Myint' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'used@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form'));

    expect(await screen.findByText('The email has already been taken.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
  });

  it('catches mismatched passwords before registration', () => {
    render(<AuthScreen page="signup" onAuthenticated={vi.fn()} onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password456' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form'));

    expect(screen.getByText('The passwords do not match.')).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('switches between sign in and sign up without a full reload', () => {
    const navigate = vi.fn();
    render(<AuthScreen page="login" onAuthenticated={vi.fn()} onNavigate={navigate} />);

    fireEvent.click(screen.getByRole('link', { name: 'Create account' }));
    expect(navigate).toHaveBeenCalledWith('signup');
  });
});
