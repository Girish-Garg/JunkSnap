import { screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const EMAIL = 'resident@example.com';
const PASSWORD = 'Jodhpur-2026';

async function signUpThroughSheet(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  await user.type(screen.getByLabelText('Email'), EMAIL);
  await user.type(screen.getByLabelText('Password'), PASSWORD);
  await user.click(screen.getByLabelText('I agree to the terms and the privacy note'));
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  await user.type(await screen.findByLabelText('6-digit code'), '123456');
  await user.click(screen.getByRole('button', { name: 'Verify' }));
}

describe('signing in before the camera', () => {
  it('asks a signed-out user to sign in, then opens the camera sheet', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Sign in' })).toHaveFocus();
    await signUpThroughSheet(user);
    expect(await screen.findByRole('heading', { level: 2, name: 'Report a waste site' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText(`Signed in as ${EMAIL}`)).toBeInTheDocument();
  });
});

describe('sign-up and sign-in errors', () => {
  it('shows each problem under its field', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Report' }));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email, like name@example.com.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Use 8 or more characters with a small letter and a number.');
    expect(screen.getByText('Accept the terms to continue.')).toBeInTheDocument();
  });

  it('says when the password is wrong', async () => {
    const user = userEvent.setup();
    const services = testServices();
    await services.auth.signUp(EMAIL, PASSWORD);
    await services.auth.confirmSignUp(EMAIL, '123456');
    await services.auth.signOut();
    await renderApp(<AppRoutes />, { services });
    await user.click(screen.getByRole('button', { name: 'Report' }));
    await user.type(screen.getByLabelText('Email'), EMAIL);
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is wrong.');
  });
});

describe('gated site actions and password reset', () => {
  it('resumes a site action after signing in', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1' });
    await user.click(await screen.findByRole('button', { name: 'Letter' }));
    await signUpThroughSheet(user);
    expect(await screen.findByRole('heading', { level: 2, name: 'Draft letter' })).toBeInTheDocument();
  });

  it('resets a forgotten password with the emailed code', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Report' }));
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByLabelText('Email'), EMAIL);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.type(screen.getByLabelText('New password'), 'New-password-1');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('Password changed. Sign in with your new password.')).toBeInTheDocument();
  });
});

describe('email code without a remembered password', () => {
  it('sends a verified new user to sign in when the code step cannot sign in by itself', async () => {
    const user = userEvent.setup();
    const services = testServices();
    await services.auth.signUp(EMAIL, PASSWORD);
    vi.spyOn(services.auth, 'confirmSignUp').mockResolvedValue(null);
    await renderApp(<AppRoutes />, { services });
    await user.click(screen.getByRole('button', { name: 'Activity' }));
    await user.type(screen.getByLabelText('Email'), EMAIL);
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Email verified. Sign in to continue.')).toBeInTheDocument();
  });
});
