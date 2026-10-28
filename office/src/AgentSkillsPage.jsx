import React, {useEffect, useId, useRef, useState} from 'react';
import {Save, Sparkles} from 'lucide-react';
import {SkillManagementAI, SkillManagementModal} from './SkillManagementAI';
import {api} from './api';
import {OfficeTableLoadingStatus, OfficeTableLoadingRows, OfficeTableLoading, OfficeActionCell, OfficeActionHeader, OfficeTablePagination} from './OfficeTable';
import {RowActions} from './RowActions';
import {OfficeModal} from './OfficeModal';
import {OfficePageToolbar, OfficeStatusFilterDrawer} from './OfficePageToolbar';
import {usePageNavigation} from './usePageNavigation';
import {RetainedViews} from './RetainedViews';
import {useRetainedActivity} from './retainedActivity';
import './agent-skills.css';

const blank = {title:'',category:'Workflow',description:'',body:'',examples:'',tools:[],modules:[],private:false,family:'workflow',topic:'',screen:null};
const split = value => value.split(',').map(v=>v.trim()).filter(Boolean);
const listText = value => Array.isArray(value) ? value.join(', ') : value || '';
const payload = form => ({...form, tools:Array.isArray(form.tools)?form.tools:split(form.tools||''), modules:Array.isArray(form.modules)?form.modules:split(form.modules||'')});
const conditionsPayload = conditions => Object.fromEntries(Object.entries(conditions||{}).map(([key,value])=>[key,Array.isArray(value)?value:split(value)]));
const options = [['all','All statuses'],['published','Published'],['draft','Draft'],['archived','Archived']];

function SkillEditor({id, onBack, onChanged}) {
  const bodyHelp=useId(), formId=useId();
  const [record,setRecord]=useState(null), [form,setForm]=useState(blank), [slug,setSlug]=useState('');
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState(''), [preview,setPreview]=useState(null);
  const [loading,setLoading]=useState(Boolean(id)), [section,setSection]=useState('content');
  useEffect(()=>{if (!id) return;let alive=true;api(`/office/agent-skills/${id}`).then(data=>{if(alive){setRecord(data);setForm(data.draft);setSlug(data.slug);}}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[id]);
  const change=(key,value)=>{setForm(previous=>({...previous,[key]:value}));setPreview(null);setMessage('');};
  const dirty=!record || JSON.stringify(form)!==JSON.stringify(record.draft);
  const accept=data=>{setRecord(data);setForm(data.draft);onChanged();};
  async function save(event) {
    event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
    try {const data=await api(`/office/agent-skills${record?`/${record.id}`:''}`,{method:record?'PUT':'POST',body:JSON.stringify({...payload(form),slug,revision:record?.revision})});accept(data);setMessage('Draft saved. Publish when ready.');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function publish(version) {
    if(busy || !record || (version && !window.confirm(`Restore version ${version.number} as a new published version?`)))return;
    setBusy(true);setError('');setMessage('');
    try {accept(await api(`/office/agent-skills/${record.id}/${version?`versions/${version.id}/restore`:'publish'}`,{method:'POST',body:JSON.stringify({revision:record.revision})}));setMessage(version?'Previous content restored as a new published version.':'Published. New replies will use this version.');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function showPreview() {
    setBusy(true);setError('');
    try {setPreview(await api('/office/agent-skills/preview',{method:'POST',body:JSON.stringify(payload(form))}));setSection('preview');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function viewVersion(version) {
    setBusy(true); setError('');
    try {setPreview(await api(`/office/agent-skills/${record.id}/versions/${version.id}`));setSection('preview');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function moreVersions() {
    setBusy(true); setError('');
    try {const page=await api(`/office/agent-skills/${record.id}/versions?page=${record.versions_next_page}`);setRecord(value=>({...value,versions:[...value.versions,...page.items],versions_next_page:page.next_page}));}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function aiApplied(result) {
    const target = record?.id || id || Object.values(result?.created_skills || {})[0];
    if (target && result?.skill_ids?.includes(target)) {
      accept(await api(`/office/agent-skills/${target}`));
    } else onChanged();
  }
  return <OfficeModal title={record?.draft.title|| (id?'Edit skill':'New skill')} description="Edit the content, save a draft, then publish it for agents to use." className="office-skill-modal" onClose={onBack} busy={busy} footer={<>
    <span className="office-skill-save-hint">{busy?'Working...':dirty&&record?'Unsaved changes':record?'Draft saved':'Start with a name and instructions'}</span>
    <button type="button" disabled={busy} onClick={onBack}>Close</button>
    <button type="button" disabled={busy||loading||Boolean(id&&!record)} onClick={showPreview}>Preview</button>
    <button type="button" disabled={busy||!record||dirty} title={dirty?'Save the draft before publishing':'Make the saved draft available to agents'} onClick={()=>publish()}>Publish</button>
    <button className="office-button-primary" disabled={busy||loading||Boolean(id&&!record)} type="submit" form={formId}><Save size={16}/>Save draft</button>
  </>}>
    {loading?<p role="status">Loading skill...</p>:<>
      <div className="office-skill-overview">
        <div className="office-skill-badges"><span className={`office-status office-status-${record?.status==='published'?'active':'pending'}`}>{record?.status||'New draft'}</span>{record?.published_version&&<span>Published v{record.published_version}</span>}{record?.is_required&&<span className="office-skill-required">Required base skill</span>}</div>
        {record&&<code>{record.slug}</code>}
      </div>
      <nav className="office-skill-sections" aria-label="Skill editor sections">
        {[['content','Content'],['settings','Settings'],['ai','AI assistance'],...(record?[['history','Version history']]:[]),...(preview?[['preview','Preview']]:[])].map(([value,label])=><button key={value} type="button" aria-pressed={section===value} disabled={busy} onClick={()=>setSection(value)}>{label}</button>)}
      </nav>
      {message&&<p role="status" className="feedback success">{message}</p>}{error&&<p role="alert" className="feedback error">{error}</p>}
      <form id={formId} onSubmit={save} onInvalid={event=>{const panel=event.target.closest('[data-skill-section]');if(panel&&panel.hidden){event.preventDefault();setSection(panel.dataset.skillSection);const input=event.target;requestAnimationFrame(()=>{input.focus();input.reportValidity();});}}}>
        <fieldset disabled={busy||Boolean(id&&!record)} className="office-skill-fields">
          <div hidden={section!=='content'} data-skill-section="content" className="office-skill-section">
            <div className="office-skill-grid"><label>Name<input required maxLength={200} value={form.title} onChange={e=>change('title',e.target.value)}/></label><label>Category<input required maxLength={80} value={form.category} onChange={e=>change('category',e.target.value)}/></label></div>
            <label>When to use<textarea rows={2} maxLength={2000} value={form.description||''} placeholder="Describe when an agent should use this skill" onChange={e=>change('description',e.target.value)}/></label>
            <label>Instructions and decision steps<textarea aria-label="Instructions and decision steps" aria-describedby={bodyHelp} required rows={9} maxLength={60000} value={form.body} onChange={e=>change('body',e.target.value)}/><small id={bodyHelp}>Write the steps and checks the agent should follow. Plain text or Markdown.</small></label>
            <label>Examples <span className="office-skill-optional">Optional</span><textarea rows={3} maxLength={16000} value={form.examples||''} placeholder="A user question and the expected response or approach" onChange={e=>change('examples',e.target.value)}/></label>
          </div>
          <div hidden={section!=='settings'} data-skill-section="settings" className="office-skill-section">
            <div className="office-skill-section-heading"><h3>Skill settings</h3><p>Control how this skill is identified and where it applies.</p></div>
            {record?.is_required&&<p className="office-skill-note">This is a required base skill. Its kind and applicability are fixed; you can edit its content and tool references.</p>}
            <div className="office-skill-grid"><label>Stable key<input required disabled={Boolean(record)} pattern="[a-z0-9_-]+" maxLength={100} value={slug} onChange={e=>{setSlug(e.target.value);if(!record)change('topic',e.target.value);}}/><small>Lowercase letters, numbers, underscores or hyphens.</small></label><label>Kind<select disabled={record?.is_required} value={form.family} onChange={e=>change('family',e.target.value)}><option value="workflow">Workflow</option><option value="instruction">Soul / core instructions</option><option value="onboarding">App setup guide</option></select></label></div>
            <div className="office-skill-grid"><label>Lookup topic<input required disabled={record?.is_required} value={form.topic} maxLength={100} onChange={e=>change('topic',e.target.value)}/></label><label>Required modules<input disabled={record?.is_required} value={listText(form.modules)} onChange={e=>change('modules',e.target.value)}/><small>Comma-separated. Leave empty for general guidance.</small></label></div>
            <label>Related tools<input value={listText(form.tools)} onChange={e=>change('tools',e.target.value)}/><small>Comma-separated existing tool names. References do not grant permissions.</small></label>
            <label className="office-skill-check"><input type="checkbox" disabled={record?.is_required} checked={form.private} onChange={e=>change('private',e.target.checked)}/>Owner-only workflow</label>
            {form.family==='onboarding'&&<label>App screen key<input value={form.screen||''} onChange={e=>change('screen',e.target.value)}/></label>}
          </div>
        </fieldset>
      </form>
      {section==='preview'&&preview&&<section className="office-skill-preview"><div className="office-skill-section-heading"><h3>Instruction preview</h3><p>{preview.notice}</p></div><pre>{preview.text}</pre></section>}
      <div hidden={section!=='ai'} className="office-skill-section">
        <SkillManagementAI context={{...(record?.id||id?{skill_id:record?.id||id}:{}),editor_draft:payload(form),editor_slug:slug}} onApplied={aiApplied} onBusyChange={setBusy}/>
      </div>
      {section==='history'&&record&&<section className="office-skill-version-section"><div className="office-skill-section-heading"><h3>Version history</h3><p>View previously published content or restore an earlier version.</p></div>
        <div className="office-table-scroll"><table className="office-data-table"><thead><tr><th>Version</th><th>Notes</th><OfficeActionHeader/></tr></thead><tbody>{record.versions?.map(version=><tr key={version.id}><td><strong>v{version.number}</strong>{version.number===record.published_version&&<span className="office-skill-current">Current</span>}</td><td>{version.note||'Published'}</td><OfficeActionCell><RowActions label={`version ${version.number}`} disabled={busy}><button type="button" onClick={()=>viewVersion(version)}>View version {version.number}</button>{version.number!==record.published_version&&<button type="button" onClick={()=>publish(version)}>Restore version {version.number}</button>}</RowActions></OfficeActionCell></tr>)}{!record.versions?.length&&<tr><td colSpan={3}>No published versions yet.</td></tr>}</tbody></table></div>
        {record.versions_next_page&&<button type="button" disabled={busy} onClick={moreVersions}>Load older versions</button>}
      </section>}
    </>}
  </OfficeModal>;
}

export function AgentSkillsPage({refreshToken=0}) {
  const active=useRetainedActivity();const [aiOpen,setAiOpen]=useState(false);const [query,setQuery]=useState({q:'',status:'all',page:1,per_page:25}), [search,setSearch]=useState(''),[filterOpen,setFilterOpen]=useState(false);
  const [result,setResult]=useState(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false);
  const loaded=useRef('');const scroll=useRef(null); const [loadedKey,setLoadedKey]=useState('');
  const navigation=usePageNavigation('office-agent-skills',{kind:'list'},()=>location.href,{resumeHistory:false,capture:()=>scroll.current?.scrollTop,restore:(_view,value)=>requestAnimationFrame(()=>{if(scroll.current)scroll.current.scrollTop=value||0;})});
  const editor=navigation.view.kind==='editor'?navigation.view:null;
  const key=new URLSearchParams({...query,refresh,refreshToken}).toString();
  useEffect(()=>{if(!active||loaded.current===key)return;let alive=true;setError('');api(`/office/agent-skills?${key}`).then(data=>{if(alive){loaded.current=key;setLoadedKey(key);setResult(data);}}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[key,active]);
  const edit=id=>navigation.go({kind:'editor',id,key:crypto.randomUUID()});
  async function archive(skill) {
    if(busy||!window.confirm(`Archive ${skill.title}? Agents will stop loading this optional skill for new replies.`))return;
    setBusy(true);setError('');try{await api(`/office/agent-skills/${skill.id}`,{method:'DELETE',body:JSON.stringify({revision:skill.revision})});setRefresh(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const content=<section className="office-panel">
    <div className="office-panel-header"><div><h2>Skill library</h2><p>Publish reusable workflows and soul instructions, then assign them to agents. Draft changes do not affect active replies.</p></div></div>
    {error&&<p role="alert" className="feedback error">{error}</p>}
    {result&&loadedKey!==key&&!error&&<OfficeTableLoadingStatus label="Updating skills..."/>}
    {!result&&!error?<OfficeTableLoading columns={["Skill", "Category", "Status", "Published version"]} label="Loading skills..."/>:result&&<><div className="office-table-scroll" ref={scroll}><table className="office-data-table"><thead><tr><th>Skill</th><th>Category</th><th>Status</th><th>Published version</th><OfficeActionHeader/></tr></thead><tbody>{result.items.map(skill=><tr key={skill.id}><td><strong>{skill.title}</strong><small className="office-business-meta">{skill.slug}{skill.is_required?' · Required':''}</small></td><td>{skill.category}</td><td><span className={`office-status office-status-${skill.status==='published'?'active':skill.status==='draft'?'pending':'none'}`}>{skill.status}</span></td><td>{skill.published_version||'None'}</td><OfficeActionCell><RowActions label={skill.title} disabled={busy}><button type="button" onClick={()=>edit(skill.id)}>Edit skill</button>{!skill.is_required&&<button type="button" className="danger-button" onClick={()=>archive(skill)}>Archive skill</button>}</RowActions></OfficeActionCell></tr>)}</tbody></table>{!result.items.length&&<p>No skills match these filters.</p>}</div>
    <OfficeTablePagination label="Skill" total={result.total} page={result.page} perPage={query.per_page} lastPage={result.last_page} disabled={busy} onPageChange={page=>setQuery(v=>({...v,page}))} onPerPageChange={per_page=>setQuery(v=>({...v,per_page,page:1}))}/></>}
  </section>;
  return <>
    <OfficePageToolbar extraActions={<button type="button" disabled={busy} onClick={()=>setAiOpen(true)}><Sparkles size={16}/>Manage skills with AI</button>} visible={!editor} searchLabel="Search skills" search={search} onSearchChange={setSearch} onSearch={()=>setQuery(v=>({...v,q:search.trim(),page:1}))} onClearSearch={()=>{setSearch('');setQuery(v=>({...v,q:'',page:1}));}} actionLabel="Add skill" onCreate={()=>edit(null)} onFilterOpen={()=>setFilterOpen(true)} filterOpen={filterOpen} filterCount={query.status==='all'?0:1} busy={busy}/>
    <OfficeStatusFilterDrawer open={filterOpen&&active&&!editor} title="Skill filters" status={query.status} options={options} onClose={()=>setFilterOpen(false)} onApply={status=>{setQuery(v=>({...v,status,page:1}));setFilterOpen(false);}} onClear={()=>{setQuery(v=>({...v,status:'all',page:1}));setFilterOpen(false);}}/>
    {content}
    {aiOpen&&active&&!editor&&<SkillManagementModal onClose={()=>setAiOpen(false)} onApplied={()=>setRefresh(v=>v+1)}/>}
    <RetainedViews activeKey={editor?.key||'closed'}>{editor?<SkillEditor id={editor.id} onBack={()=>navigation.back({kind:'list'})} onChanged={()=>setRefresh(v=>v+1)}/>:null}</RetainedViews>
  </>;
}

function AssignmentForm({item, skills, busy, error, onSave, onClose}) {
  const formId=useId();
  const [form,setForm]=useState(()=>({...item,conditions:{...item.conditions}}));
  const skill=skills.find(value=>value.id===Number(form.skill_id));
  const change=(field,value)=>setForm(previous=>({...previous,[field]:value}));
  return <OfficeModal title={item.skill_id?'Edit assignment':'Add assignment'} description="Choose how and when this agent loads the skill." onClose={onClose} busy={busy} className="office-assignment-modal" footer={<>
    <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
    <button type="submit" form={formId} className="office-button-primary" disabled={busy||!skill}><Save size={16}/>{busy?'Saving...':'Save assignment'}</button>
  </>}>
    <form id={formId} onSubmit={event=>{event.preventDefault();if(!busy&&skill)onSave({...form,skill_id:Number(form.skill_id)});}}>
      <fieldset disabled={busy} className="office-skill-fields">
        <label>Skill<select required disabled={Boolean(item.skill_id)} value={form.skill_id} onChange={event=>change('skill_id',event.target.value)}><option value="">Select a skill</option>{skills.map(value=><option key={value.id} value={value.id}>{value.slug} ({value.status})</option>)}</select></label>
        {skill?.is_required&&<p className="office-muted">Required base skills must remain enabled with their existing loading and applicability settings.</p>}
        <div className="office-skill-grid"><label>Loading<select disabled={skill?.is_required} value={form.mode} onChange={event=>change('mode',event.target.value)}><option value="always">Always</option><option value="on_demand">On demand</option></select></label><label>Order<input type="number" min={0} max={999999} required value={form.position} onChange={event=>change('position',event.target.value)}/></label></div>
        <label className="office-skill-check"><input type="checkbox" disabled={skill?.is_required} checked={form.enabled} onChange={event=>change('enabled',event.target.checked)}/>Enabled</label>
        <h3>Applicability</h3>
        {['roles','channels','contexts'].map(field=><label key={field}>{field[0].toUpperCase()+field.slice(1)}<input disabled={skill?.is_required} value={listText(form.conditions?.[field])} onChange={event=>change('conditions',{...form.conditions,[field]:event.target.value})}/></label>)}
        <small>Comma-separated values. Leave empty for unrestricted applicability. Roles: owner, staff, customer, internal. Channels: business_web, business_mobile, shop, telegram_private, telegram_group. Contexts: image, follow_up, owner_access, staff_access, restricted_access.</small>
      </fieldset>
    </form>
    {error&&<p role="alert" className="feedback error">{error}</p>}
  </OfficeModal>;
}

function AssignmentEditor({agent, onBack}) {
  const active=useRetainedActivity(); const [aiOpen,setAiOpen]=useState(false);
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[editing,setEditing]=useState(null);
  useEffect(()=>{let alive=true;api(`/office/agent-assignments/${agent.key}`).then(value=>{if(alive)setData(value);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[agent.key]);
  async function save(items) {
    if(busy)return;
    setBusy(true);setError('');setMessage('');
    try {
      const value=await api(`/office/agent-assignments/${agent.key}`,{method:'PUT',body:JSON.stringify({revision:data.agent.revision,items:items.map(({skill_id,mode,position,enabled,conditions})=>({skill_id,mode,position:Number(position),enabled,conditions:conditionsPayload(conditions)}))})});
      setData(value);setEditing(null);setMessage('Assignments saved. New replies use the new selection.');
    } catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const edit=item=>{setError('');setMessage('');setEditing(item);};
  const available=data?.skills.filter(skill=>!data.items.some(item=>item.skill_id===skill.id))||[];
  return <>
    <OfficePageToolbar extraActions={<button type="button" disabled={busy||Boolean(editing)||!data} onClick={()=>setAiOpen(true)}><Sparkles size={16}/>Manage skills with AI</button>} actionLabel="Add assignment" onCreate={()=>edit({skill_id:'',mode:'on_demand',position:100,enabled:true,conditions:{}})} actionDisabled={!data||!available.length} busy={busy||Boolean(editing)} onBack={onBack} backLabel="Back to agents"/>
    <section className="office-panel">
      <div className="office-panel-header"><div><h2>{agent.name}: assigned skills</h2><p>Manage loading, order and applicability for each assigned skill. Assignments do not change tool permissions.</p></div></div>
      {message&&<p role="status" className="feedback success">{message}</p>}
      {error&&!editing&&<p role="alert" className="feedback error">{error}</p>}
      {!data&&!error?<OfficeTableLoading columns={["Skill", "Loading", "Order", "Status", "Applicability"]} label="Loading assignments..."/>:data&&<div className="office-table-scroll"><table className="office-data-table"><thead><tr><th>Skill</th><th>Loading</th><th>Order</th><th>Status</th><th>Applicability</th><OfficeActionHeader/></tr></thead><tbody>
        {data.items.map(item=>{const skill=data.skills.find(value=>value.id===item.skill_id);const restrictions=Object.entries(item.conditions||{}).filter(([,value])=>listText(value));return <tr key={item.skill_id}>
          <td><strong>{skill?.slug||`Skill ${item.skill_id}`}</strong>{skill?.is_required&&<small className="office-business-meta">Required base skill</small>}</td>
          <td>{item.mode==='always'?'Always':'On demand'}</td><td>{item.position}</td><td><span className={`office-status office-status-${item.enabled?'active':'none'}`}>{item.enabled?'Enabled':'Disabled'}</span></td>
          <td>{restrictions.length?restrictions.map(([field,value])=><small className="office-business-meta" key={field}>{field}: {listText(value)}</small>):'Unrestricted'}</td>
          <OfficeActionCell><RowActions label={skill?.slug||`Skill ${item.skill_id}`} disabled={busy||Boolean(editing)}><button type="button" onClick={()=>edit(item)}>Edit assignment</button>{!skill?.is_required&&<button type="button" className="danger-button" onClick={()=>{if(window.confirm(`Remove ${skill?.slug||'this skill'} from ${agent.name}?`))save(data.items.filter(value=>value.skill_id!==item.skill_id));}}>Remove assignment</button>}</RowActions></OfficeActionCell>
        </tr>;})}
        {!data.items.length&&<tr><td colSpan={6}>No skills assigned. Add an assignment to get started.</td></tr>}
      </tbody></table></div>}
    </section>
    {aiOpen&&active&&<SkillManagementModal context={{agent:agent.key}} onClose={()=>setAiOpen(false)} onApplied={async()=>setData(await api(`/office/agent-assignments/${agent.key}`))}/>}
    {editing&&active&&<AssignmentForm item={editing} skills={editing.skill_id?data.skills:available} busy={busy} error={error} onClose={()=>{if(!busy){setEditing(null);setError('');}}} onSave={item=>save(editing.skill_id?data.items.map(value=>value.skill_id===item.skill_id?item:value):[...data.items,item])}/>}
  </>;
}

export function AgentAssignmentsPage({refreshToken=0}) {
  const active=useRetainedActivity(); const [aiOpen,setAiOpen]=useState(false),[aiRefresh,setAiRefresh]=useState(0);
  const [agents,setAgents]=useState(null),[error,setError]=useState('');
  const navigation=usePageNavigation('office-agent-assignments',{kind:'list'},()=>location.href,{resumeHistory:false});
  useEffect(()=>{let alive=true;api('/office/agent-assignments').then(value=>{if(alive)setAgents(value.items);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[refreshToken,aiRefresh]);
  const editor=navigation.view.kind==='editor'?navigation.view:null;
  return <><OfficePageToolbar visible={!editor} extraActions={<button type="button" onClick={()=>setAiOpen(true)}><Sparkles size={16}/>Manage skills with AI</button>}/><RetainedViews activeKey={editor?.key||'list'}>{editor?<AssignmentEditor agent={editor.agent} onBack={()=>navigation.back({kind:'list'})}/>:<section className="office-panel"><div className="office-panel-header"><div><h2>Agent assignments</h2><p>Share skills across agents while preserving each agent's existing role and tool permissions.</p></div></div>{error&&<p role="alert">{error}</p>}{!agents&&!error&&<OfficeTableLoadingStatus label="Loading agents..."/>}<div className="office-table-scroll"><table className="office-data-table"><thead><tr><th>Agent</th><th>Key</th><OfficeActionHeader/></tr></thead><tbody>{!agents&&!error&&<OfficeTableLoadingRows columns={3}/>}{agents?.map(agent=><tr key={agent.key}><td><strong>{agent.name}</strong></td><td>{agent.key}</td><OfficeActionCell><RowActions label={agent.name}><button type="button" onClick={()=>navigation.go({kind:'editor',agent,key:crypto.randomUUID()})}>Edit assignments</button></RowActions></OfficeActionCell></tr>)}</tbody></table></div></section>}</RetainedViews>{aiOpen&&active&&!editor&&<SkillManagementModal onClose={()=>setAiOpen(false)} onApplied={()=>setAiRefresh(v=>v+1)}/>}</>;
}
