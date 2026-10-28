import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {AiAssistantSettingsPage} from './AiAssistantSettingsPage';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
const data={settings:{enabled:false,configured:true,model:'deepseek-flash',weekly_limit:50,max_tokens:1600},usage:{today_requests:0,today_failures:0,input_tokens:0,output_tokens:0},recent_runs:[]};
beforeEach(()=>{api.mockReset();api.mockResolvedValue(data);});
it('separates provider, assistant and pricing while preserving drafts and saving only the active section',async()=>{
 const view=render(<AiAssistantSettingsPage view="provider"/>);const key=await screen.findByLabelText('New API key');
 fireEvent.change(key,{target:{value:'sk-private-draft-example'}});expect(screen.queryByRole('button',{name:'Save assistant settings'})).not.toBeInTheDocument();
 view.rerender(<AiAssistantSettingsPage view="assistant"/>);expect(screen.queryByRole('button',{name:'Replace key'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('DeepSeek model'),{target:{value:''}});
 view.rerender(<AiAssistantSettingsPage view="pricing"/>);expect(screen.getByLabelText('DeepSeek model')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Platform markup (%)'),{target:{value:'7.5'}});
 api.mockResolvedValueOnce({...data,settings:{...data.settings,sales_ai_markup_percent:'7.50'}});
 fireEvent.click(screen.getByRole('button',{name:'Save Sales AI pricing'}));await screen.findByText('AI assistant settings saved.');
 expect(api).toHaveBeenLastCalledWith('/office/ai-assistant',{method:'PUT',body:JSON.stringify({usd_to_mmk_rate:null,sales_ai_markup_percent:'7.5'})});
 view.rerender(<AiAssistantSettingsPage view="assistant"/>);expect(screen.getByLabelText('DeepSeek model')).toHaveValue('');
 fireEvent.change(screen.getByLabelText('DeepSeek model'),{target:{value:'deepseek-v4-pro'}});
 api.mockResolvedValueOnce({...data,settings:{...data.settings,model:'deepseek-v4-pro',sales_ai_markup_percent:'7.50'}});
 fireEvent.click(screen.getByRole('button',{name:'Save assistant settings'}));await waitFor(()=>expect(api).toHaveBeenLastCalledWith('/office/ai-assistant',{method:'PUT',body:JSON.stringify({enabled:false,model:'deepseek-v4-pro',weekly_limit:50,max_tokens:1600})}));
 view.rerender(<AiAssistantSettingsPage view="provider"/>);expect(key).toHaveValue('sk-private-draft-example');expect(api.mock.calls.filter(([,options])=>!options)).toHaveLength(1);
});
it('shows configuration without reports and saves only non-secret settings',async()=>{
 render(<AiAssistantSettingsPage/>);await screen.findByLabelText('DeepSeek model');expect(screen.getByText('DeepSeek API key is configured on the server.')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Status'),{target:{value:'true'}});fireEvent.change(screen.getByLabelText('Weekly requests per user'),{target:{value:'25'}});fireEvent.click(screen.getByRole('button',{name:'Save assistant settings'}));
 await screen.findByText('AI assistant settings saved.');expect(api).toHaveBeenCalledWith('/office/ai-assistant',{method:'PUT',body:JSON.stringify({enabled:true,model:'deepseek-flash',weekly_limit:25,max_tokens:1600,usd_to_mmk_rate:null,sales_ai_markup_percent:'5.00'})});expect(screen.queryByRole('table',{name:'AI requests'})).not.toBeInTheDocument();expect(screen.queryByRole('region',{name:'AI usage'})).not.toBeInTheDocument();
});
it('retains model edits when saving fails',async()=>{
 render(<AiAssistantSettingsPage/>);await screen.findByLabelText('DeepSeek model');fireEvent.change(screen.getByLabelText('DeepSeek model'),{target:{value:'deepseek-v4-pro'}});api.mockRejectedValueOnce(new Error('Connection interrupted'));fireEvent.click(screen.getByRole('button',{name:'Save assistant settings'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');expect(screen.getByLabelText('DeepSeek model')).toHaveValue('deepseek-v4-pro');await waitFor(()=>expect(screen.getByRole('button',{name:'Save assistant settings'})).toBeEnabled());
});
it('saves the USD to MMK rate as entered and retains it after a failed save', async()=>{
 api.mockResolvedValueOnce({...data,settings:{...data.settings,usd_to_mmk_rate:'4200.125'}});
 render(<AiAssistantSettingsPage/>);const rate=await screen.findByLabelText('USD to MMK exchange rate');expect(rate).toHaveValue(4200.125);
 fireEvent.change(rate,{target:{value:'4300.5'}});api.mockRejectedValueOnce(new Error('Connection interrupted'));fireEvent.click(screen.getByRole('button',{name:'Save assistant settings'}));await screen.findByRole('alert');expect(rate).toHaveValue(4300.5);
 api.mockResolvedValueOnce({...data,settings:{...data.settings,usd_to_mmk_rate:'4300.5'}});fireEvent.click(screen.getByRole('button',{name:'Save assistant settings'}));await screen.findByText('AI assistant settings saved.');expect(JSON.parse(api.mock.calls.at(-1)[1].body).usd_to_mmk_rate).toBe('4300.5');
});
it('defaults platform markup to five percent and saves an edited markup',async()=>{
 render(<AiAssistantSettingsPage/>);const markup=await screen.findByLabelText('Platform markup (%)');expect(markup).toHaveValue(5);
 fireEvent.change(markup,{target:{value:'7.5'}});api.mockResolvedValueOnce({...data,settings:{...data.settings,sales_ai_markup_percent:'7.50'}});fireEvent.click(screen.getByRole('button',{name:'Save assistant settings'}));await screen.findByText('AI assistant settings saved.');expect(JSON.parse(api.mock.calls.at(-1)[1].body).sales_ai_markup_percent).toBe('7.5');expect(markup).toHaveValue(7.5);
});
it('tests saved and draft keys without saving, replaces explicitly and clears the password', async()=>{
 render(<AiAssistantSettingsPage/>);const input=await screen.findByLabelText('New API key');expect(input).toHaveAttribute('type','password');expect(input).toHaveValue('');
 api.mockResolvedValueOnce({message:'Connection successful.'});fireEvent.click(screen.getByRole('button',{name:'Test connection'}));await screen.findByText('Connection successful.');expect(api).toHaveBeenLastCalledWith('/office/ai-assistant/test-connection',{method:'POST',body:'{}'});
 fireEvent.change(screen.getByLabelText('DeepSeek model'),{target:{value:'deepseek-v4-pro'}});
 fireEvent.change(input,{target:{value:'sk-new-private-example-key'}});api.mockResolvedValueOnce({message:'Connection successful.'});fireEvent.click(screen.getByRole('button',{name:'Test connection'}));await waitFor(()=>expect(api).toHaveBeenLastCalledWith('/office/ai-assistant/test-connection',{method:'POST',body:JSON.stringify({api_key:'sk-new-private-example-key'})}));await waitFor(()=>expect(screen.getByRole('button',{name:'Replace key'})).toBeEnabled());
 expect(input).toHaveValue('sk-new-private-example-key');api.mockResolvedValueOnce({settings:data.settings});fireEvent.click(screen.getByRole('button',{name:'Replace key'}));await screen.findByText('API key replaced.');expect(input).toHaveValue('');expect(screen.getByLabelText('DeepSeek model')).toHaveValue('deepseek-v4-pro');expect(api).toHaveBeenLastCalledWith('/office/ai-assistant/api-key',{method:'PUT',body:JSON.stringify({api_key:'sk-new-private-example-key'})});
});
it('preserves a replacement key after failure and prevents duplicate submissions',async()=>{
 render(<AiAssistantSettingsPage/>);const input=await screen.findByLabelText('New API key');fireEvent.change(input,{target:{value:'sk-new-private-example-key'}});
 let reject;api.mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail;}));fireEvent.click(screen.getByRole('button',{name:'Replace key'}));expect(screen.getByRole('button',{name:'Test connection'})).toBeDisabled();expect(screen.getByRole('button',{name:'Save assistant settings'})).toBeDisabled();reject(new Error('Could not save key.'));await screen.findByRole('alert');expect(input).toHaveValue('sk-new-private-example-key');expect(api.mock.calls.filter(([path])=>path==='/office/ai-assistant/api-key')).toHaveLength(1);
});
