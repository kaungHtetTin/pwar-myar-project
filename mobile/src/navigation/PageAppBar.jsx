import React, { useContext, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { PageActivityContext } from './pageRefresh';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { ModuleLocalizationContext } from '../localization/ModuleLocalizationContext';
import { PageAppBarContext } from './PageAppBarContext';

// Pages own their title and action state; the persistent shell owns the bar DOM.
export function PageAppBar({ as: Element = 'header', className = '', children, ...props }) {
  const shell = useContext(PageAppBarContext);
  const active = useContext(PageActivityContext);
  const localization = useContext(ModuleLocalizationContext);
  const register = shell?.register;
  useLayoutEffect(() => {
    if (active && register) return register();
    return undefined;
  }, [active, register]);
  if (!shell) return <Element {...props} className={className}>{children}</Element>;
  return <><span hidden data-page-app-bar />{active && shell.host && createPortal(<ModuleLocalizationBoundary {...localization}><div {...props} className={`app-bar-page-content ${className}`}>{children}</div></ModuleLocalizationBoundary>, shell.host)}</>;
}
