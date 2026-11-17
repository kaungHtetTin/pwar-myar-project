import { describe, expect, it } from 'vitest';
import {
  appHomeLocation,
  appHomePath,
  authLocationFor,
  authPageFromPath,
  authPathFor,
  isAuthPath,
  routePathFromLocation,
  usesPortableRouting,
} from './authRouting';

describe('authentication routing', () => {
  it('maps dedicated login and signup URLs', () => {
    expect(authPageFromPath('/login')).toBe('login');
    expect(authPageFromPath('/signup')).toBe('signup');
    expect(authPageFromPath('/forgot-password')).toBe('forgot-password');
    expect(authPathFor('forgot-password', '/app/')).toBe('/app/forgot-password');
    expect(authLocationFor('forgot-password', './')).toBe('#/forgot-password');
    expect(authPathFor('login')).toBe('/login');
    expect(authPathFor('signup')).toBe('/signup');
  });

  it('does not treat application URLs as authentication pages', () => {
    expect(isAuthPath('/login')).toBe(true);
    expect(isAuthPath('/signup')).toBe(true);
    expect(isAuthPath('/')).toBe(false);
  });

  it('keeps auth and home routes inside a subdirectory deployment', () => {
    const base = '/public/app/';
    expect(appHomePath(base)).toBe(base);
    expect(authPathFor('login', base)).toBe('/public/app/login');
    expect(authPathFor('signup', base)).toBe('/public/app/signup');
    expect(authPageFromPath('/public/app/signup', base)).toBe('signup');
    expect(isAuthPath('/public/app/login', base)).toBe(true);
    expect(isAuthPath('/public/app/', base)).toBe(false);
  });

  it('uses hash routes for portable builds that can move between directories', () => {
    const base = './';
    expect(usesPortableRouting(base)).toBe(true);
    expect(routePathFromLocation({ pathname: '/any/deploy/folder/', hash: '#/signup' }, base)).toBe('/signup');
    expect(authLocationFor('login', base)).toBe('#/login');
    expect(authLocationFor('signup', base)).toBe('#/signup');
    expect(appHomeLocation(base)).toBe('#/');
  });

  it('recognizes legacy hash authentication links under both deployment bases', () => {
    expect(routePathFromLocation({ pathname: '/public/app/', hash: '#/signup' }, '/public/app/')).toBe('/public/app/signup');
    expect(routePathFromLocation({ pathname: '/', hash: '#/login' }, '/')).toBe('/login');
    expect(routePathFromLocation({ pathname: '/public/app/login', hash: '' }, '/public/app/')).toBe('/public/app/login');
  });
});
