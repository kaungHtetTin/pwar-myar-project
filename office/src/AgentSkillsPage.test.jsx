import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {AgentSkillsPage, AgentAssignmentsPage} from './AgentSkillsPage';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
const content={title:'Fractional sales',category:'Workflow',description:'Half units',body:'Read the base unit before selling 0.5.',examples:'One viss, half a viss.',tools:[],modules:[],private:false,family:'workflow',topic:'fractional',screen:null};
let record;
beforeEach(()=>{
  vi.stubGlobal('scrollTo', vi.fn());
  record={id:1,slug:'fractional',status:'published',revision:1,is_required:false,draft:{...content},published_version:1,versions:[{id:10,number:1,note:'Imported'}]};
  api.mockReset();
  api.mockImplementation(async(path,options)=>{
    if(path.startsWith('/office/agent-skills?'))return{items:[{...record,...record.draft}],total:1,page:1,per_page:25,last_page:1};
    if(path==='/office/agent-skills/preview')return{text:JSON.parse(options.body).body,notice:'Preview only. No business action.'};
    if(path==='/office/agent-skills/1/publish'){record={...record,revision:record.revision+1,published_version:2};return record;}
    if(path==='/office/agent-skills/1'&&options?.method==='PUT'){record={...record,draft:JSON.parse(options.body),revision:record.revision+1};return record;}
    if(path==='/office/agent-skills/1')return record;
    if(path==='/office/agent-assignments')return{items:[{id:1,key:'wyne_wyne',name:'Wyne Wyne',revision:1}]};
    if(path==='/office/agent-assignments/wyne_wyne')return{agent:{id:1,key:'wyne_wyne',revision:1},skills:[{id:1,slug:'base-soul',is_required:true,status:'published'}],items:[{skill_id:1,mode:'always',position:10,enabled:true,conditions:{}}]};
    throw new Error(`Unexpected request ${path}`);
  });
  window.history.replaceState({},'', '/');
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
async function edit(){fireEvent.click(await screen.findByRole('button',{name:'Actions for Fractional sales'}));fireEvent.click(screen.getByRole('menuitem',{name:'Edit skill'}));await screen.findByDisplayValue(content.body);}
it('keeps draft edits separate from publishing and previews without a model request',async()=>{
  render(<AgentSkillsPage/>);await edit();
  fireEvent.change(screen.getByLabelText('Instructions and decision steps'),{target:{value:'Check units, then choose quantity 0.5.'}});
  expect(screen.getByRole('button',{name:'Publish',exact:true})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Preview',exact:true}));await screen.findByText('Preview only. No business action.');
  fireEvent.click(screen.getByRole('button',{name:'Save draft',exact:true}));await screen.findByText('Draft saved. Publish when ready.');
  expect(api.mock.calls.filter(([path])=>path.endsWith('/publish'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Publish',exact:true}));await screen.findByText('Published. New replies will use this version.');
  expect(api.mock.calls.filter(([path])=>path.endsWith('/publish'))).toHaveLength(1);
});
it('restores the filtered skill list on Back without an initial refetch',async()=>{
  render(<AgentSkillsPage/>);await screen.findByText('Fractional sales');
  fireEvent.change(screen.getByLabelText('Search skills'),{target:{value:'Fractional'}});fireEvent.submit(screen.getByRole('search'));
  await waitFor(()=>expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Fractional')));
  await edit();
  const requests=api.mock.calls.filter(([path])=>path.startsWith('/office/agent-skills?')).length;
  fireEvent.click(screen.getByRole('button',{name:'Close',exact:true}));
  await waitFor(()=>expect(screen.getByLabelText('Search skills')).toBeVisible());
  expect(screen.getByLabelText('Search skills')).toHaveValue('Fractional');
  expect(api.mock.calls.filter(([path])=>path.startsWith('/office/agent-skills?'))).toHaveLength(requests);
});
it('retains an unsaved editor after browser Back and Forward',async()=>{
  render(<AgentSkillsPage/>);await edit();
  fireEvent.change(screen.getByLabelText('Name'),{target:{value:'My unsaved workflow'}});
  await act(async()=>window.history.back());
  await waitFor(()=>expect(screen.getByLabelText('Search skills')).toBeVisible());
  await act(async()=>window.history.forward());
  await waitFor(()=>expect(screen.getByLabelText('Name')).toBeVisible());
  expect(screen.getByLabelText('Name')).toHaveValue('My unsaved workflow');
});
it('locks required assignment controls and saves only on explicit submission',async()=>{
  render(<AgentAssignmentsPage/>);
  fireEvent.click(await screen.findByRole('button',{name:'Actions for Wyne Wyne'}));fireEvent.click(screen.getByRole('menuitem',{name:'Edit assignments'}));
  await screen.findByText('base-soul');
  fireEvent.click(screen.getByRole('button',{name:'Actions for base-soul'}));
  fireEvent.click(screen.getByRole('menuitem',{name:'Edit assignment'}));
  expect(screen.getByLabelText('Loading')).toBeDisabled();expect(screen.getByLabelText('Enabled')).toBeDisabled();
  expect(screen.queryByRole('button',{name:'Remove assignment'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Save assignment'}));await screen.findByText('Assignments saved. New replies use the new selection.');
  expect(api.mock.calls.filter(([,options])=>options?.method==='PUT')).toHaveLength(1);
});


it('keeps an unsaved skill draft when using AI assistance and returning to Content',async()=>{
  render(<AgentSkillsPage/>); await edit();
  const name = screen.getByLabelText('Name');
  fireEvent.change(name,{target:{value:'My unsaved workflow'}});
  fireEvent.click(screen.getByRole('button',{name:'AI assistance',exact:true}));
  expect(screen.getByLabelText('What should AI help with?')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Content',exact:true}));
  expect(screen.getByLabelText('Name')).toBe(name);
  expect(name).toHaveValue('My unsaved workflow');
  expect(api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
});

it('opens and closes the library AI manager without losing list filters or refetching',async()=>{
  render(<AgentSkillsPage/>); await screen.findByText('Fractional sales');
  fireEvent.change(screen.getByLabelText('Search skills'),{target:{value:'Fractional'}});
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(()=>expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Fractional')));
  const reads=api.mock.calls.filter(([path])=>path.startsWith('/office/agent-skills?')).length;
  fireEvent.click(screen.getByRole('button',{name:'Manage skills with AI'}));
  await screen.findByRole('dialog',{name:'Manage skills with AI'});
  fireEvent.click(screen.getByRole('button',{name:'Close',exact:true}));
  expect(screen.getByLabelText('Search skills')).toHaveValue('Fractional');
  expect(api.mock.calls.filter(([path])=>path.startsWith('/office/agent-skills?'))).toHaveLength(reads);
});
