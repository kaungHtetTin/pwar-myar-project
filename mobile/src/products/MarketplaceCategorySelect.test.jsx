import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MarketplaceCategorySelect } from './MarketplaceCategorySelect';
import { apiRequest } from '../api/client';
import { LocaleContext } from '../localization/LocaleContext';
vi.mock('../api/client',()=>({apiRequest:vi.fn()}));
beforeEach(()=>vi.resetAllMocks());

it('shows localized paths and supports optional unassigned selection', async()=>{
  apiRequest.mockResolvedValue({items:[{id:7,path:'Food / Rice',path_my:'အစားအစာ / ဆန်'}]});
  const change=vi.fn();render(<LocaleContext.Provider value={{language:'my'}}><MarketplaceCategorySelect form={{marketplace_category_id:''}} onChange={change}/></LocaleContext.Provider>);
  await screen.findByRole('option',{name:'အစားအစာ / ဆန်'});
  expect(screen.getByRole('combobox')).toHaveValue('');
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'7'}});expect(change).toHaveBeenCalledWith('7');
});

it('retains an unavailable existing category and allows clearing it after a failed load retry',async()=>{
  apiRequest.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({items:[]});
  const change=vi.fn();render(<MarketplaceCategorySelect form={{marketplace_category_id:9,marketplace_category:{path:'Old category'}}} onChange={change}/>);
  await screen.findByRole('alert');expect(change).not.toHaveBeenCalled();expect(screen.getByRole('combobox')).toHaveValue('9');
  fireEvent.click(screen.getByRole('button',{name:'Retry categories'}));
  await waitFor(()=>expect(screen.getByRole('combobox')).not.toBeDisabled());
  expect(screen.getByRole('option',{name:'Old category (Unavailable)'})).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:''}});expect(change).toHaveBeenCalledWith('');
});
