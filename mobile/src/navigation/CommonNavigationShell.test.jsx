import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AppShell } from './AppShell';
import { PageAppBar } from './PageAppBar';
import { AppBarMenu } from './AppBarMenu';
import { RetainedViews } from './RetainedViews';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { LocaleContext } from '../localization/LocaleContext';

const modules = [{ id: 'products', label: 'Products', path: '/products' }, { id: 'reports', label: 'Reports', path: '/reports' }];
const session = { user: { name: 'Owner', role: 'owner' }, business: { name: 'Shop' } };

function Flow() {
  const [pathname, setPathname] = useState('/products');
  const module = modules.find(row => row.path === pathname);
  return <AppShell session={session} modules={modules} activeModule={module} pathname={pathname} onNavigatePath={setPathname}>
    <RetainedViews activeKey={pathname}><main><PageAppBar><h1>{module.label}</h1><AppBarMenu /></PageAppBar><input aria-label={`${module.label} search`} defaultValue="" /></main></RetainedViews>
  </AppShell>;
}

it('keeps both navigation elements mounted while switching only the retained page and header content', () => {
  render(<Flow />);
  const bar = screen.getByRole('banner'), bottom = screen.getByRole('navigation', { name: 'Workspace modules' });
  const source = screen.getByLabelText('Products search');
  fireEvent.change(source, { target: { value: 'Rice' } });
  expect(screen.getByRole('region', { name: 'Pull to refresh page' })).not.toContainElement(bar);
  fireEvent.click(within(bottom).getByRole('button', { name: 'Reports' }));
  expect(screen.getByRole('banner')).toBe(bar);
  expect(screen.getByRole('navigation', { name: 'Workspace modules' })).toBe(bottom);
  expect(within(bar).getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
  expect(within(bar).queryByRole('heading', { name: 'Products' })).not.toBeInTheDocument();
  fireEvent.click(within(bottom).getByRole('button', { name: 'Products' }));
  expect(screen.getByLabelText('Products search')).toBe(source);
  expect(source).toHaveValue('Rice');
  expect(bar.querySelector('.app-bar-menu')).toBe(bar.querySelector('.app-bar-page-content').lastElementChild);
  fireEvent.touchStart(bar, { touches: [{ clientY: 10 }] });
  fireEvent.touchMove(bar, { touches: [{ clientY: 190 }] });
  expect(screen.queryByText('Release to refresh')).not.toBeInTheDocument();
});

it('carries page localization to the shell-owned app bar', async () => {
  render(<LocaleContext.Provider value={{ language: 'my', setLanguage: () => {} }}><AppShell session={session} modules={modules} activeModule={modules[0]} pathname="/products"><ModuleLocalizationBoundary messages={{ Products: 'ကုန်ပစ္စည်းများ' }}><main><PageAppBar><h1>Products</h1><AppBarMenu /></PageAppBar></main></ModuleLocalizationBoundary></AppShell></LocaleContext.Provider>);
  expect(await within(screen.getByRole('banner')).findByRole('heading', { name: 'ကုန်ပစ္စည်းများ' })).toBeInTheDocument();
});
