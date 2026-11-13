(function(){
 'use strict';
 const $=id=>document.getElementById(id),TZ='America/Sao_Paulo';
 const STATUS={pending:'Retomar contato',contacted:'Contato realizado',paid:'Pago',closed:'Encerrado'};
 const FIELDS='id,name,phone,commitment_date,commitment_time,status,note,created_at,updated_at';
 const state={user:null,rows:[],period:'all',status:'open',query:'',day:null,month:'',error:'',loading:false,saving:false,editing:null,epoch:0,mutation:false};
 let client=null,booting=true,request=0,lastFocus=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
 function isoDate(year,month,day){return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
 function dateParts(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');return m?m.slice(1).map(Number):null;}
 function validDate(value){const a=dateParts(value);if(!a||a[0]<1900||a[0]>9999)return false;const d=new Date(Date.UTC(a[0],a[1]-1,a[2]));return d.getUTCFullYear()===a[0]&&d.getUTCMonth()===a[1]-1&&d.getUTCDate()===a[2];}
 function displayDate(value,weekday=false){const a=dateParts(value);if(!a)return '';return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',...(weekday?{weekday:'long'}:{}),day:'2-digit',month:weekday?'long':'2-digit',year:'numeric'}).format(new Date(Date.UTC(a[0],a[1]-1,a[2])));}
 function normalizePhone(raw){
  raw=String(raw||'').trim();let n=raw.replace(/\D/g,'');const explicit=/^\+/.test(raw)||/^00/.test(raw);
  if(/^00/.test(raw))n=n.slice(2);
  if(!explicit){if(/^55\d{10,11}$/.test(n)){}else if(/^[1-9]\d{9,10}$/.test(n))n='55'+n;else throw new Error('Informe o telefone com DDD. Para outro país, use + e o código do país.');}
  if(!/^[1-9]\d{7,14}$/.test(n))throw new Error('Confira o telefone: use o DDD e o número completo.');
  if(n.startsWith('55')&&!/^55[1-9]\d{9,10}$/.test(n))throw new Error('Confira o DDD e o número do telefone brasileiro.');
  return n;
 }
 function displayPhone(n){if(/^55\d{10,11}$/.test(n)){const local=n.slice(4);return '('+n.slice(2,4)+') '+local.slice(0,-4)+'-'+local.slice(-4);}return '+'+n;}
 function openStatus(row){return row.status==='pending'||row.status==='contacted';}
 function matchingStatus(row){return state.status==='all'||(state.status==='open'?openStatus(row):row.status===state.status);}
 function matchingSearch(row){const q=state.query.trim().toLocaleLowerCase('pt-BR');if(!q)return true;const n=q.replace(/\D/g,'');return String(row.name||'').toLocaleLowerCase('pt-BR').includes(q)||(n.length>0&&String(row.phone).includes(n));}
 function errorText(error,action){
  if(error?.code==='42P01'||error?.code==='PGRST205')return 'Falta ativar a agenda no banco. Execute o arquivo supabase-agenda-leads.sql no SQL Editor do seu Supabase e tente novamente.';
  if(error?.code==='23505')return 'Já existe um compromisso desse telefone nesta data. Feche o formulário e use a busca para editar o registro existente.';
  if(error?.code==='42501'||error?.status===401||error?.status===403)return 'Seu acesso não permitiu essa alteração. Entre novamente com seu PIN e tente de novo.';
  return 'Não foi possível '+action+'. Confira sua conexão e tente novamente. Nenhuma confirmação de sucesso foi recebida.';
 }
 function notice(message){$('agendaNotice').textContent=message;$('agendaNotice').hidden=!message;}
 function setError(message){state.error=message;$('agendaErrorText').textContent=message;$('agendaError').hidden=!message;}
 function loginError(message){$('agendaLoginError').textContent=message;$('agendaLoginError').hidden=!message;}
 function formError(message){$('agendaFormError').textContent=message;$('agendaFormError').hidden=!message;}
 function clearPrivate(){
  state.epoch++;request++;state.user=null;state.rows=[];state.editing=null;state.saving=false;state.mutation=false;state.loading=false;state.error='';state.query='';state.day=null;state.status='open';state.period='all';
  if($('agendaEditor').open)$('agendaEditor').close();$('agendaEditorForm').reset();$('agendaList').replaceChildren();$('agendaCalendarGrid').replaceChildren();$('agendaNotice').hidden=true;$('agendaError').hidden=true;$('agendaDashboard').hidden=true;$('agendaLogout').hidden=true;$('agendaGate').hidden=false;$('agendaLoading').hidden=true;
  $('agendaSearch').value='';$('agendaStatus').value='open';formError('');setFormBusy(false);
 }
 function applyUser(user){
  if(!user){clearPrivate();return;}
  if(state.user?.id===user.id)return;
  clearPrivate();state.user={id:user.id};state.month=today().slice(0,7);$('agendaGate').hidden=true;$('agendaDashboard').hidden=false;$('agendaLogout').hidden=false;loginError('');render();setTimeout(()=>loadRows(),0);
 }
 async function verifyUser(){const {data,error}=await client.auth.getUser();if(error)throw error;return data?.user||null;}
 async function loadRows(){
  if(!state.user)return;const epoch=state.epoch,userId=state.user.id,req=++request;state.loading=true;setError('');$('agendaRefresh').disabled=true;$('agendaRetry').disabled=true;
  const rows=[];let offset=0;
  try{
   while(true){
    const {data,error}=await client.from('lead_commitments').select(FIELDS).eq('owner_id',userId).order('commitment_date',{ascending:true}).order('id',{ascending:true}).range(offset,offset+499);
    if(error)throw error;if(epoch!==state.epoch||req!==request||state.user?.id!==userId)return;
    if(!Array.isArray(data))throw new Error('Resposta inválida');rows.push(...data);if(data.length<500)break;offset+=500;
   }
   if(epoch!==state.epoch||req!==request)return;
   state.rows=rows.filter(r=>r&&typeof r.id==='string'&&validDate(r.commitment_date)&&Object.hasOwn(STATUS,r.status));render();
  }catch(e){if(epoch===state.epoch&&req===request){setError(errorText(e,'carregar os compromissos')+(state.rows.length?' A lista abaixo pode estar desatualizada.':''));}}
  finally{if(epoch===state.epoch&&req===request){state.loading=false;$('agendaRefresh').disabled=false;$('agendaRetry').disabled=false;renderList();}}
 }
 function filteredRows(){const t=today();return state.rows.filter(r=>matchingStatus(r)&&matchingSearch(r)&&(
  state.day?r.commitment_date===state.day:state.period==='today'?r.commitment_date===t:state.period==='overdue'?r.commitment_date<t:state.period==='upcoming'?r.commitment_date>t:true
 )).sort((a,b)=>a.commitment_date.localeCompare(b.commitment_date)||(a.commitment_time||'99:99').localeCompare(b.commitment_time||'99:99')||a.id.localeCompare(b.id));}
 function render(){
  if(!state.user)return;const t=today(),open=state.rows.filter(openStatus);
  $('agendaTodayCount').textContent=open.filter(r=>r.commitment_date===t).length;
  $('agendaOverdueCount').textContent=open.filter(r=>r.commitment_date<t).length;
  $('agendaUpcomingCount').textContent=open.filter(r=>r.commitment_date>t).length;
  document.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(!state.day&&b.dataset.period===state.period)));
  $('agendaStatus').value=state.status;$('agendaSelectedDate').hidden=!state.day;if(state.day)$('agendaSelectedDate').querySelector('span').textContent=displayDate(state.day);
  renderCalendar();renderList();
 }
 function renderList(){
  if(!state.user)return;const rows=filteredRows(),t=today(),titles={today:'Compromissos para hoje',overdue:'Compromissos atrasados',upcoming:'Próximos compromissos',all:'Seus compromissos'};
  $('agendaListTitle').textContent=state.day?'Contatos de '+displayDate(state.day):titles[state.period];$('agendaListCount').textContent=rows.length+' compromisso'+(rows.length!==1?'s':'');
  if(!rows.length){$('agendaList').innerHTML='<div class="empty">'+(state.loading?'Carregando seus compromissos…':state.error?'A agenda não pôde ser atualizada. Use “Tentar novamente” acima.':state.rows.length?'Nenhum compromisso com esses filtros. Altere o período ou escolha “Todos os status”.':'Adicione seu primeiro compromisso.<br>Um telefone e a data combinada já são suficientes.')+'</div>';return;}
  let html='',date='';for(const r of rows){
   if(r.commitment_date!==date){if(date)html+='</section>';date=r.commitment_date;html+='<section class="day-group"><h3>'+esc(displayDate(date,true))+'</h3>';}
   const overdue=r.commitment_date<t&&openStatus(r),id=esc(r.id);
   html+='<article class="lead-card'+(overdue?' overdue':'')+'"><div class="lead-main"><div><h3>'+esc(r.name||'Contato sem nome')+'</h3><p class="lead-phone"><a href="https://wa.me/'+encodeURIComponent(r.phone)+'" target="_blank" rel="noopener noreferrer">'+esc(displayPhone(r.phone))+'</a></p><p class="lead-time">'+(r.commitment_time?'Horário combinado: '+esc(r.commitment_time.slice(0,5)):'Sem horário definido')+(overdue?' · Retorno pendente':'')+'</p></div><span class="status-pill status-'+esc(r.status)+'">'+esc(STATUS[r.status])+'</span></div>'+(r.note?'<p class="lead-note">'+esc(r.note)+'</p>':'')+'<div class="lead-actions"><a class="button whatsapp" href="https://wa.me/'+encodeURIComponent(r.phone)+'" target="_blank" rel="noopener noreferrer">ABRIR WHATSAPP</a><button class="button secondary" type="button" data-edit="'+id+'">EDITAR / REMARCAR</button>'+(r.status==='pending'?'<button class="button secondary" type="button" data-status="contacted" data-id="'+id+'">CONTATO REALIZADO</button>':'')+(openStatus(r)?'<button class="button secondary" type="button" data-status="paid" data-id="'+id+'">MARCAR PAGO</button>':'')+'<button class="button danger" type="button" data-delete="'+id+'">EXCLUIR</button></div></article>';
  }if(date)html+='</section>';$('agendaList').innerHTML=html;
  $('agendaList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.edit));
  $('agendaList').querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>changeStatus(b.dataset.id,b.dataset.status));
  $('agendaList').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteRow(b.dataset.delete));
 }
 function renderCalendar(){
  if(!state.month)state.month=today().slice(0,7);const [y,m]=state.month.split('-').map(Number),first=new Date(Date.UTC(y,m-1,1)),offset=first.getUTCDay();
  $('agendaMonthTitle').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'}).format(first);
  const counts=new Map();for(const r of state.rows.filter(r=>matchingStatus(r)&&matchingSearch(r)))counts.set(r.commitment_date,(counts.get(r.commitment_date)||0)+1);
  let html=['D','S','T','Q','Q','S','S'].map((w,i)=>'<span class="calendar-weekday" aria-label="'+['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][i]+'">'+w+'</span>').join('');
  for(let i=0;i<42;i++){const d=new Date(Date.UTC(y,m-1,1-offset+i)),date=isoDate(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()),n=counts.get(date)||0;html+='<button class="calendar-day'+(d.getUTCMonth()!==m-1?' outside':'')+(date===today()?' today':'')+'" type="button" data-day="'+date+'" aria-pressed="'+String(date===state.day)+'" aria-label="'+esc(displayDate(date))+': '+n+' compromisso'+(n!==1?'s':'')+'">'+d.getUTCDate()+(n?'<span class="calendar-dot" aria-hidden="true"></span>':'')+'</button>';}
  $('agendaCalendarGrid').innerHTML=html;$('agendaCalendarGrid').querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{state.day=b.dataset.day;render();});
 }
 function moveMonth(delta){const [y,m]=state.month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));state.month=isoDate(d.getUTCFullYear(),d.getUTCMonth()+1,1).slice(0,7);renderCalendar();}
 function openEditor(id=null){
  if(!state.user||state.saving||state.mutation)return;const row=id?state.rows.find(r=>r.id===id):null;if(id&&!row)return;lastFocus=document.activeElement;state.editing=row?{...row}:null;
  $('agendaEditorForm').reset();$('leadName').value=row?.name||'';$('leadPhone').value=row?('+'+row.phone):'';$('leadDate').value=row?.commitment_date||state.day||today();$('leadTime').value=row?.commitment_time?.slice(0,5)||'';$('leadStatus').value=row?.status||'pending';$('leadNote').value=row?.note||'';$('editorTitle').textContent=row?'Editar compromisso':'Novo compromisso';$('agendaRescheduleHint').hidden=true;formError('');setFormBusy(false);$('agendaEditor').showModal();$('leadPhone').focus({preventScroll:true});
 }
 function closeEditor(){if(state.saving)return;$('agendaEditor').close();state.editing=null;formError('');$('agendaEditorForm').reset();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
 function setFormBusy(busy){state.saving=busy;$('agendaSave').disabled=busy;$('agendaSave').textContent=busy?'SALVANDO…':'SALVAR COMPROMISSO';$('agendaCloseEditor').disabled=busy;$('agendaCancelEditor').disabled=busy;$('agendaEditor').querySelectorAll('input,select,textarea').forEach(e=>e.disabled=busy);}
 async function assertAccess(userId){const user=await verifyUser();if(!user||user.id!==userId){applyUser(user);throw new Error('Sessão alterada');}}
 async function saveForm(e){
  e.preventDefault();if(state.saving||!state.user)return;formError('');let payload;
  try{
   const name=$('leadName').value.trim(),phone=normalizePhone($('leadPhone').value),date=$('leadDate').value,time=$('leadTime').value,status=$('leadStatus').value,note=$('leadNote').value.trim();
   if(name.length>120||note.length>1500)throw new Error('Confira o tamanho do nome e da observação.');
   if(!validDate(date))throw new Error('Informe uma data válida, com dia, mês e ano.');
   if(time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Confira o horário informado.');
   if(!Object.hasOwn(STATUS,status))throw new Error('Escolha um andamento válido.');
   payload={name:name||null,phone,commitment_date:date,commitment_time:time||null,status:state.editing&&state.editing.commitment_date!==date?'pending':status,note};
  }catch(error){formError(error.message);return;}
  const epoch=state.epoch,userId=state.user.id,editingId=state.editing?.id;setFormBusy(true);
  try{
   await assertAccess(userId);if(epoch!==state.epoch)return;
   let query=client.from('lead_commitments');query=editingId?query.update(payload).eq('id',editingId).eq('owner_id',userId):query.insert(payload);
   const {data,error}=await query.select('id').single();if(error)throw error;if(!data?.id)throw new Error('Sem confirmação');if(epoch!==state.epoch)return;
   setFormBusy(false);closeEditor();notice(editingId?'Compromisso atualizado.':'Compromisso salvo.');await loadRows();
  }catch(error){if(epoch===state.epoch)formError(errorText(error,'salvar o compromisso'));}
  finally{if(epoch===state.epoch)setFormBusy(false);}
 }
 async function changeStatus(id,status){
  if(!state.user||state.mutation||state.saving||!Object.hasOwn(STATUS,status))return;const row=state.rows.find(r=>r.id===id);if(!row)return;const epoch=state.epoch,userId=state.user.id;state.mutation=true;disableList(true);notice('');
  try{await assertAccess(userId);if(epoch!==state.epoch)return;const {data,error}=await client.from('lead_commitments').update({status}).eq('id',id).eq('owner_id',userId).select('id').single();if(error)throw error;if(!data?.id)throw new Error('Sem confirmação');if(epoch!==state.epoch)return;notice('Status atualizado para “'+STATUS[status]+'”.');await loadRows();}
  catch(error){if(epoch===state.epoch)setError(errorText(error,'atualizar o status'));}
  finally{if(epoch===state.epoch){state.mutation=false;disableList(false);}}
 }
 async function deleteRow(id){
  if(!state.user||state.mutation||state.saving)return;const row=state.rows.find(r=>r.id===id);if(!row||!confirm('Excluir o compromisso de '+(row.name||displayPhone(row.phone))+' em '+displayDate(row.commitment_date)+'? Essa ação não pode ser desfeita.'))return;
  const epoch=state.epoch,userId=state.user.id;state.mutation=true;disableList(true);notice('');
  try{await assertAccess(userId);if(epoch!==state.epoch)return;const {data,error}=await client.from('lead_commitments').delete().eq('id',id).eq('owner_id',userId).select('id').single();if(error)throw error;if(!data?.id)throw new Error('Sem confirmação');if(epoch!==state.epoch)return;notice('Compromisso excluído.');await loadRows();}
  catch(error){if(epoch===state.epoch)setError(errorText(error,'excluir o compromisso'));}
  finally{if(epoch===state.epoch){state.mutation=false;disableList(false);}}
 }
 function disableList(disabled){$('agendaList').querySelectorAll('button').forEach(b=>b.disabled=disabled);$('agendaNew').disabled=disabled;}
 function bind(){
  $('agendaLoginForm').onsubmit=async e=>{e.preventDefault();const pin=$('agendaPin').value.trim();if(!pin||!client)return;$('agendaLogin').disabled=true;loginError('');try{const {error}=await client.auth.signInWithPassword({email:window.APP_CONFIG.ADMIN_EMAIL,password:pin});if(error)throw error;const user=await verifyUser();if(!user)throw new Error('Sem sessão');applyUser(user);$('agendaPin').value='';}catch(e){loginError('Não foi possível entrar. Confira o PIN e sua conexão.');}finally{$('agendaLogin').disabled=false;}};
  $('agendaPin').oninput=e=>{e.target.value=e.target.value.replace(/\D/g,'');};
  $('agendaLogout').onclick=async()=>{clearPrivate();loginError('');try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;}catch(e){loginError('Não foi possível confirmar a saída. Recarregue e tente sair novamente.');}};
  $('agendaNew').onclick=()=>openEditor();$('agendaRefresh').onclick=$('agendaRetry').onclick=()=>loadRows();
  $('agendaSearch').oninput=e=>{state.query=e.target.value;renderList();renderCalendar();};$('agendaStatus').onchange=e=>{state.status=e.target.value;render();};
  document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{state.period=b.dataset.period;state.day=null;if(b.closest('.summary'))state.status='open';render();});
  $('agendaPrevMonth').onclick=()=>moveMonth(-1);$('agendaNextMonth').onclick=()=>moveMonth(1);$('agendaClearDay').onclick=()=>{state.day=null;render();};
  $('agendaCloseEditor').onclick=$('agendaCancelEditor').onclick=()=>closeEditor();$('agendaEditorForm').onsubmit=saveForm;
  $('agendaEditor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
  $('leadDate').onchange=()=>{const changed=!!state.editing&&state.editing.commitment_date!==$('leadDate').value;$('agendaRescheduleHint').hidden=!changed;if(changed)$('leadStatus').value='pending';};
 }
 async function boot(){
  bind();
  if(!window.APP_CONFIG?.SUPABASE_URL||!window.APP_CONFIG?.SUPABASE_ANON_KEY||!window.supabase?.createClient){$('agendaLoading').textContent='A agenda não pôde iniciar. Confira a configuração do site e sua conexão, depois recarregue a página.';return;}
  try{
   client=window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL,window.APP_CONFIG.SUPABASE_ANON_KEY);
   client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){clearPrivate();return;}
    if(booting)return;
    if(state.user&&session?.user?.id!==state.user.id)clearPrivate();
    if(event==='SIGNED_IN'&&session?.user?.id!==state.user?.id){const epoch=state.epoch;setTimeout(async()=>{try{const user=await verifyUser();if(epoch===state.epoch)applyUser(user);}catch(e){if(epoch===state.epoch){clearPrivate();loginError('Sua sessão não pôde ser confirmada. Entre novamente.');}}},0);}
   });
   const epoch=state.epoch,user=await verifyUser();booting=false;if(epoch===state.epoch)applyUser(user);
  }catch(e){booting=false;clearPrivate();loginError('Não foi possível conferir seu acesso. Confira a conexão e entre novamente.');}
 }
 boot();
})();
