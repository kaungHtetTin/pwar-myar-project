import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Package } from 'lucide-react';
import { SidebarNavigation } from './SidebarNavigation';
it('opens in-app AI without selecting another module or clearing a draft',()=>{
 const select=vi.fn(),open=vi.fn();window.addEventListener('mkpos:open-ai-assistant',open);
 render(<SidebarNavigation modules={[{id:'products',label:'Products',icon:Package}]} active="products" onSelect={select}><input aria-label="Retained search" defaultValue="Water"/></SidebarNavigation>);
 fireEvent.click(screen.getByRole('button',{name:'PwarMyar AI assistant'}));expect(open).toHaveBeenCalledTimes(1);expect(select).not.toHaveBeenCalled();expect(screen.getByLabelText('Retained search')).toHaveValue('Water');
 expect(screen.getByRole('button',{name:'Products'})).toHaveAttribute('aria-current','page');window.removeEventListener('mkpos:open-ai-assistant',open);
});
it('keeps in-app support available without assigned modules',()=>{render(<SidebarNavigation modules={[]}/>);expect(screen.getByRole('button',{name:'PwarMyar AI assistant'})).toBeInTheDocument();expect(screen.queryByRole('link',{name:'AI customer service'})).not.toBeInTheDocument();});
