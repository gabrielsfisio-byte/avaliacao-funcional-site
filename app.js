(function(){

const supabase = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

/* ---------- CIF band helper (mesma escala usada nos laudos: 0-4/5-24/25-49/50-95/96-100) ---------- */
function cifBand(pct){
  pct = Math.max(0, Math.min(100, pct));
  if(pct<=4)   return {q:0,label:'Sem deficiência', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
  if(pct<=24)  return {q:1,label:'Leve',             txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
  if(pct<=49)  return {q:2,label:'Moderada',         txt:'var(--r2-txt)', bg:'var(--r2-bg)'};
  if(pct<=95)  return {q:3,label:'Grave',            txt:'var(--r3-txt)', bg:'var(--r3-bg)'};
  return         {q:4,label:'Completa',        txt:'var(--r4-txt)', bg:'var(--r4-bg)'};
}
function evaBand(v){
  if(v<=3) return {label:'Leve', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
  if(v<=6) return {label:'Moderada', txt:'var(--r2-txt)', bg:'var(--r2-bg)'};
  return {label:'Grave', txt:'var(--r3-txt)', bg:'var(--r3-bg)'};
}
function pillHtml(band){ return `<span class="pill" style="color:${band.txt};background:${band.bg}">${band.label}</span>`; }

/* ---------- Dados dos instrumentos ---------- */
const ODI_SECTIONS = [
 ["Intensidade da dor",[
  "Não sinto dor no momento","A dor é muito leve no momento","A dor é moderada no momento",
  "A dor é razoavelmente intensa no momento","A dor é muito intensa no momento","A dor é a pior imaginável no momento"]],
 ["Cuidados pessoais (lavar-se, vestir-se etc.)",[
  "Posso cuidar de mim normalmente, sem causar dor extra",
  "Posso cuidar de mim normalmente, mas isso causa dor extra",
  "É doloroso cuidar de mim, e sou lento e cuidadoso",
  "Preciso de alguma ajuda, mas consigo fazer a maior parte dos cuidados pessoais",
  "Preciso de ajuda todos os dias na maioria dos cuidados pessoais",
  "Não consigo me vestir, lavo-me com dificuldade e fico na cama"]],
 ["Levantar objetos",[
  "Consigo levantar objetos pesados sem dor extra",
  "Consigo levantar objetos pesados, mas isso causa dor extra",
  "A dor me impede de levantar objetos pesados do chão, mas consigo se estiverem bem posicionados (ex.: em uma mesa)",
  "A dor me impede de levantar pesos, mas consigo objetos leves a moderados se bem posicionados",
  "Só consigo levantar objetos muito leves",
  "Não consigo levantar ou carregar nada"]],
 ["Andar",[
  "A dor não me impede de andar qualquer distância","A dor me impede de andar mais que 1600 metros",
  "A dor me impede de andar mais que 800 metros","A dor me impede de andar mais que 400 metros",
  "Só consigo andar usando bengala ou muletas","Fico na cama a maior parte do tempo e preciso me arrastar até o banheiro"]],
 ["Sentar",[
  "Consigo sentar em qualquer tipo de cadeira o tempo que quiser",
  "Só consigo sentar na minha cadeira preferida o tempo que quiser",
  "A dor me impede de sentar por mais de 1 hora","A dor me impede de sentar por mais de 30 minutos",
  "A dor me impede de sentar por mais de 10 minutos","A dor me impede totalmente de sentar"]],
 ["Ficar em pé",[
  "Consigo ficar em pé o tempo que quiser sem dor extra",
  "Consigo ficar em pé o tempo que quiser, mas isso causa dor extra",
  "A dor me impede de ficar em pé por mais de 1 hora","A dor me impede de ficar em pé por mais de 30 minutos",
  "A dor me impede de ficar em pé por mais de 10 minutos","A dor me impede totalmente de ficar em pé"]],
 ["Dormir",[
  "Meu sono nunca é perturbado pela dor","Meu sono é ocasionalmente perturbado pela dor",
  "Por causa da dor, durmo menos de 6 horas","Por causa da dor, durmo menos de 4 horas",
  "Por causa da dor, durmo menos de 2 horas","A dor me impede totalmente de dormir"]],
 ["Vida sexual (se aplicável)",[
  "Minha vida sexual é normal e não causa dor extra",
  "Minha vida sexual é normal, mas causa alguma dor extra",
  "Minha vida sexual é quase normal, mas é bastante dolorosa",
  "Minha vida sexual é bastante restringida pela dor",
  "Minha vida sexual é quase inexistente por causa da dor","A dor impede totalmente qualquer vida sexual"]],
 ["Vida social",[
  "Minha vida social é normal e não causa dor extra",
  "Minha vida social é normal, mas aumenta a intensidade da dor",
  "A dor não tem efeito significativo na vida social, exceto limitar atividades mais intensas (ex.: esportes)",
  "A dor restringiu minha vida social e não saio com a mesma frequência",
  "A dor restringiu minha vida social ao meu domicílio","Não tenho vida social por causa da dor"]],
 ["Viagens / locomoção",[
  "Consigo viajar para qualquer lugar sem dor","Consigo viajar para qualquer lugar, mas isso causa dor extra",
  "A dor é forte, mas consigo viajar por mais de 2 horas","A dor limita minhas viagens a menos de 1 hora",
  "A dor limita viagens curtas e necessárias, de menos de 30 minutos","A dor me impede de viajar, exceto para tratamento"]]
];

const NDI_SECTIONS = [
 ["Intensidade da dor",[
  "Não sinto dor no momento","A dor é muito leve no momento","A dor é moderada no momento",
  "A dor é razoavelmente intensa no momento","A dor é muito intensa no momento","A dor é a pior imaginável no momento"]],
 ["Cuidados pessoais",[
  "Posso cuidar de mim normalmente, sem causar dor extra no pescoço",
  "Posso cuidar de mim normalmente, mas isso causa dor extra","É doloroso cuidar de mim, e sou lento e cuidadoso",
  "Preciso de alguma ajuda, mas consigo fazer a maior parte dos cuidados pessoais",
  "Preciso de ajuda todos os dias na maioria dos cuidados pessoais",
  "Não consigo me vestir, lavo-me com dificuldade e fico na cama"]],
 ["Levantar objetos",[
  "Consigo levantar objetos pesados sem dor extra no pescoço",
  "Consigo levantar objetos pesados, mas isso causa dor extra",
  "A dor me impede de levantar objetos pesados do chão, mas consigo se estiverem bem posicionados",
  "A dor me impede de levantar pesos, mas consigo objetos leves a moderados se bem posicionados",
  "Só consigo levantar objetos muito leves","Não consigo levantar ou carregar nada"]],
 ["Leitura",[
  "Posso ler o quanto quiser sem dor no pescoço","Posso ler o quanto quiser com leve dor no pescoço",
  "Posso ler o quanto quiser com dor moderada no pescoço","Não consigo ler o quanto quiser por causa de dor moderada",
  "Quase não consigo ler por causa de dor intensa","Não consigo ler nada"]],
 ["Dores de cabeça",[
  "Não tenho dores de cabeça","Tenho dores de cabeça leves, pouco frequentes",
  "Tenho dores de cabeça moderadas, pouco frequentes","Tenho dores de cabeça moderadas, frequentes",
  "Tenho dores de cabeça intensas, frequentes","Tenho dores de cabeça quase o tempo todo"]],
 ["Concentração",[
  "Consigo me concentrar totalmente quando quero, sem dificuldade",
  "Consigo me concentrar totalmente quando quero, com leve dificuldade",
  "Tenho dificuldade razoável em me concentrar quando quero","Tenho muita dificuldade em me concentrar quando quero",
  "Tenho enorme dificuldade em me concentrar quando quero","Não consigo me concentrar de forma alguma"]],
 ["Trabalho",[
  "Consigo trabalhar tanto quanto quiser","Só consigo fazer meu trabalho habitual, nada além disso",
  "Consigo fazer a maior parte do meu trabalho habitual, mas não mais","Não consigo fazer meu trabalho habitual",
  "Quase não consigo trabalhar","Não consigo trabalhar de forma alguma"]],
 ["Dirigir",[
  "Consigo dirigir sem dor no pescoço","Consigo dirigir o quanto quero, com leve dor no pescoço",
  "Consigo dirigir o quanto quero, com dor moderada no pescoço","Não consigo dirigir o quanto quero por causa da dor moderada",
  "Quase não consigo dirigir por causa de dor intensa","Não consigo dirigir de forma alguma"]],
 ["Sono",[
  "Não tenho problemas de sono","Meu sono é levemente perturbado (menos de 1h de insônia)",
  "Meu sono é levemente perturbado (1 a 2h de insônia)","Meu sono é moderadamente perturbado (2 a 3h de insônia)",
  "Meu sono é muito perturbado (3 a 5h de insônia)","Meu sono está completamente perturbado (5 a 7h de insônia)"]],
 ["Lazer / recreação",[
  "Consigo realizar todas as minhas atividades de lazer sem dor no pescoço",
  "Consigo realizar todas as minhas atividades de lazer, com alguma dor no pescoço",
  "Consigo realizar a maioria, mas não todas, as atividades de lazer por causa da dor",
  "Consigo realizar poucas das minhas atividades de lazer por causa da dor",
  "Quase não consigo realizar atividades de lazer por causa da dor","Não consigo realizar nenhuma atividade de lazer"]]
];

const TSK13_ITEMS = [
 "Tenho medo de me machucar se fizer exercícios físicos.",
 "Se eu tentasse superar a dor, ela aumentaria.",
 "Meu corpo está me dizendo que algo está seriamente errado.",
 "A dor sempre significa que eu machuquei meu corpo.",
 "Simplesmente porque algo agrava minha dor, não significa que seja perigoso.",
 "Tenho medo de que eu possa me machucar acidentalmente.",
 "Manter-me cuidadoso para não fazer movimentos desnecessários é a coisa mais segura que posso fazer para evitar a dor.",
 "Eu não teria tanta dor se não houvesse algo potencialmente perigoso acontecendo no meu corpo.",
 "Embora minha condição seja dolorosa, eu estaria melhor se estivesse fisicamente ativo.",
 "A dor me avisa quando devo parar o exercício para não me machucar.",
 "Não é realmente seguro para uma pessoa com minha condição ser fisicamente ativa.",
 "Não consigo fazer todas as coisas que pessoas normais fazem porque é fácil para mim me machucar.",
 "Ninguém deveria precisar praticar exercícios físicos quando está com dor."
];
const TSK13_REVERSE = [4];
const TSK13_OPTS = ["Discordo totalmente","Discordo","Concordo","Concordo totalmente"];

const QUICKDASH_ITEMS = [
 ["Abrir um pote ou vidro novo com tampa apertada.",["Nenhuma dificuldade","Pouca dificuldade","Dificuldade moderada","Muita dificuldade","Incapaz"]],
 ["Fazer tarefas domésticas pesadas (ex.: lavar paredes, limpar o chão).",["Nenhuma dificuldade","Pouca dificuldade","Dificuldade moderada","Muita dificuldade","Incapaz"]],
 ["Carregar uma sacola de compras ou uma pasta.",["Nenhuma dificuldade","Pouca dificuldade","Dificuldade moderada","Muita dificuldade","Incapaz"]],
 ["Lavar as costas.",["Nenhuma dificuldade","Pouca dificuldade","Dificuldade moderada","Muita dificuldade","Incapaz"]],
 ["Usar uma faca para cortar alimentos.",["Nenhuma dificuldade","Pouca dificuldade","Dificuldade moderada","Muita dificuldade","Incapaz"]],
 ["Atividades recreativas com esforço ou impacto no braço/ombro/mão (ex.: martelar, jogar).",["Nenhuma dificuldade","Pouca dificuldade","Dificuldade moderada","Muita dificuldade","Incapaz"]],
 ["Na última semana, o quanto seu problema interferiu nas suas atividades sociais normais?",["Nada","Pouco","Moderadamente","Muito","Extremamente"]],
 ["Na última semana, você foi limitado no trabalho ou em outra atividade regular diária?",["Nada limitado","Pouco limitado","Moderadamente limitado","Muito limitado","Incapaz"]],
 ["Dor no braço, ombro ou mão.",["Nenhuma","Leve","Moderada","Intensa","Extrema"]],
 ["Dor ao realizar qualquer atividade específica com o braço, ombro ou mão.",["Nenhuma","Leve","Moderada","Intensa","Extrema"]],
 ["Dificuldade para dormir por causa da dor no braço, ombro ou mão.",["Nenhuma","Leve","Moderada","Intensa","Extrema"]]
];

const WHODAS_ITEMS = [
 "Ficar em pé por longos períodos, como 30 minutos.",
 "Cuidar das suas responsabilidades domésticas.",
 "Aprender uma nova tarefa (ex.: chegar a um lugar novo).",
 "Participar tanto quanto outras pessoas em atividades da comunidade (festas, religiosas, de bairro).",
 "Sentir-se afetado emocionalmente por seu problema de saúde.",
 "Caminhar uma longa distância, como 1 quilômetro.",
 "Lavar todo o corpo.",
 "Vestir-se.",
 "Lidar com pessoas que você não conhece.",
 "Manter uma amizade.",
 "Realizar seu trabalho diário / tarefas de casa.",
 "Sua condição de saúde te afetou financeiramente?"
];
const WHODAS_OPTS = ["Nenhuma dificuldade","Dificuldade leve","Dificuldade moderada","Dificuldade grave","Dificuldade extrema / não consegue fazer"];

const QUESTIONNAIRES = {
 odi: { title:"Índice de Incapacidade de Oswestry (ODI)", short:"ODI · coluna lombar", type:"sections", data:ODI_SECTIONS,
  score(answers){ const a=answers.filter(v=>v!==null&&v!==undefined); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*5))*100:0, raw:sum, n:a.length}; } },
 ndi: { title:"Índice de Incapacidade Cervical (NDI)", short:"NDI · coluna cervical", type:"sections", data:NDI_SECTIONS,
  score(answers){ const a=answers.filter(v=>v!==null&&v!==undefined); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*5))*100:0, raw:sum, n:a.length}; } },
 tsk13: { title:"Escala Tampa de Cinesiofobia (TSK-13)", short:"TSK-13 · medo do movimento", type:"likert", items:TSK13_ITEMS, opts:TSK13_OPTS,
  score(answers){ let sum=0,n=0; answers.forEach((v,i)=>{ if(v!==null&&v!==undefined){ n++; const val=v+1; sum += TSK13_REVERSE.includes(i)?(5-val):val; }}); return {pct:n?((sum-n)/(n*3))*100:0, raw:sum, n}; } },
 quickdash: { title:"QuickDASH (função do membro superior)", short:"QuickDASH · membro superior", type:"likert",
  items:QUICKDASH_ITEMS.map(i=>i[0]), optsPerItem:QUICKDASH_ITEMS.map(i=>i[1]),
  score(answers){ const a=answers.filter(v=>v!==null&&v!==undefined); if(!a.length) return {pct:0,raw:0,n:0}; const sum=a.reduce((s,v)=>s+(v+1),0); const mean=sum/a.length; return {pct:((mean-1)/4)*100, raw:sum, n:a.length}; } },
 whodas: { title:"WHODAS 2.0 (12 itens) — funcionalidade geral", short:"WHODAS 2.0 · funcionalidade global", type:"likert", items:WHODAS_ITEMS, opts:WHODAS_OPTS,
  score(answers){ const a=answers.filter(v=>v!==null&&v!==undefined); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*4))*100:0, raw:sum, n:a.length}; } },
 eva: { title:"Escala Visual Analógica de Dor (EVA)", short:"EVA · dor em 4 condições", type:"sliders",
  items:["Repouso (agora)","Pior momento do dia","Melhor momento do dia","Sob simulação de demanda laboral"],
  score(answers){ return {answers}; } }
};
const QORDER = ["odi","ndi","tsk13","quickdash","whodas","eva"];

/* ---------- Supabase data layer ---------- */
function newUuid(){
 if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
 // fallback simples caso o navegador não suporte crypto.randomUUID
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
  const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8); return v.toString(16);
 });
}
async function dbCreatePatient(name, phone){
 const id = newUuid();
 const {error} = await supabase.from('submissions').insert({id, name, phone, responses:{}});
 if(error){ alert('Erro ao criar registro: '+error.message); throw error; }
 return id;
}
async function dbSaveResponses(id, responses){
 const {error, count} = await supabase.from('submissions').update({responses}, {count:'exact'}).eq('id', id);
 if(error){ alert('Erro ao salvar: '+error.message); throw error; }
 if(count === 0){ alert('Aviso técnico: nenhuma linha foi encontrada para atualizar (id: '+id+'). Isso indica que o paciente não foi criado corretamente antes de responder.'); }
}
async function dbListAll(){
 const {data, error} = await supabase.from('submissions').select('*').order('created_at', {ascending:false});
 if(error){ alert('Erro ao carregar pacientes: '+error.message); return []; }
 return data;
}
async function dbDelete(id){
 const {error} = await supabase.from('submissions').delete().eq('id', id);
 if(error){ alert('Erro ao excluir: '+error.message); }
}
async function authLogin(email, password){
 const {error} = await supabase.auth.signInWithPassword({email, password});
 return error ? error.message : null;
}
async function authLogout(){ await supabase.auth.signOut(); }
async function authCurrentUser(){
 const {data} = await supabase.auth.getUser();
 return data ? data.user : null;
}

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

/* ---------- App state ---------- */
let state = { view:'landing', patientId:null, patientName:'', responsesLocal:{}, qKey:null, qIndex:0, qAnswers:[], patients:[], openPatient:null, authError:'' };
const app = document.getElementById('app');
function render(){ app.innerHTML = views[state.view](); bind(); }

/* ---------- Views ---------- */
const views = {

landing(){
 return `
 <div class="topbar">
   <div class="brand">Gabriel dos Santos<small>Avaliação Funcional</small></div>
   <button class="mode-toggle" id="toAdmin">Área do profissional</button>
 </div>
 <main>
   <h1>Antes de começar</h1>
   <p class="sub">Você vai responder alguns questionários curtos sobre como seu problema de saúde afeta seu dia a dia. Não existe resposta certa ou errada — responda com o que reflete melhor sua situação atual.</p>
   <div class="card">
     <label class="field">Seu nome completo</label>
     <input type="text" id="pname" placeholder="Nome completo">
     <label class="field">Telefone (opcional)</label>
     <input type="tel" id="pphone" placeholder="(00) 00000-0000">
     <button class="btn btn-primary" id="startBtn">Começar</button>
   </div>
 </main>`;
},

list(){
 const rows = QORDER.map(k=>{
   const done = !!state.responsesLocal[k];
   return `<div class="qcard" data-q="${k}">
     <div><div class="qcard-title">${QUESTIONNAIRES[k].title}</div><div class="qcard-sub">${QUESTIONNAIRES[k].short}</div></div>
     <span class="badge ${done?'badge-done':'badge-pending'}">${done?'concluído':'pendente'}</span>
   </div>`;
 }).join('');
 return `
 <div class="topbar"><div class="brand">Olá, ${state.patientName.split(' ')[0]}<small>Escolha um questionário</small></div></div>
 <main>
   <p class="sub">Responda cada um destes. Quando terminar, pode fechar a página — seu fisioterapeuta já recebe os resultados.</p>
   ${rows}
   <button class="btn btn-ghost" id="finishBtn" style="width:100%;margin-top:10px;">Concluir e enviar</button>
 </main>`;
},

wizard(){
 const q = QUESTIONNAIRES[state.qKey];
 let total, current;
 if(q.type==='sections'){ total=q.data.length; current=q.data[state.qIndex]; }
 else { total=q.items.length; current=q.items[state.qIndex]; }
 const pct = Math.round(((state.qIndex)/total)*100);
 const arc = arcSvg(pct);
 let body='';
 if(q.type==='sections'){
  const [domain, opts] = current;
  body = `<div class="qtext">${domain}</div>` + opts.map((o,i)=>`<button class="opt ${state.qAnswers[state.qIndex]===i?'selected':''}" data-val="${i}">${o}</button>`).join('');
 } else if(q.type==='likert'){
  const opts = q.optsPerItem ? q.optsPerItem[state.qIndex] : q.opts;
  body = `<div class="qtext">${current}</div>` + opts.map((o,i)=>`<button class="opt ${state.qAnswers[state.qIndex]===i?'selected':''}" data-val="${i}">${o}</button>`).join('');
 } else if(q.type==='sliders'){
  const val = state.qAnswers[state.qIndex] ?? 0;
  body = `<div class="qtext">${current}</div>
   <div class="slider-wrap"><div class="slider-val" id="sliderVal">${val}</div>
   <input type="range" min="0" max="10" step="1" value="${val}" id="sliderInput">
   <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:12px;"><span>Sem dor</span><span>Dor máxima</span></div></div>`;
 }
 return `
 <div class="topbar"><div class="brand">${q.title}<small>${state.qIndex+1} de ${total}</small></div></div>
 <main>
  <div class="arcwrap">${arc}<div class="arc-label">${pct}% concluído</div></div>
  ${body}
  <div class="navrow">
   <button class="btn btn-ghost" id="backBtn">${state.qIndex===0?'Cancelar':'Voltar'}</button>
   <button class="btn btn-primary" id="nextBtn" ${state.qAnswers[state.qIndex]===null||state.qAnswers[state.qIndex]===undefined?'disabled':''}>${state.qIndex===total-1?'Concluir':'Próxima'}</button>
  </div>
 </main>`;
},

thanks(){
 return `<div class="topbar"><div class="brand">Gabriel dos Santos<small>Avaliação Funcional</small></div></div>
 <main><div class="center-msg">
   <h1>Recebido ✓</h1>
   <p class="sub">Obrigado, ${state.patientName.split(' ')[0]}. Suas respostas foram enviadas para o seu fisioterapeuta.</p>
 </div></main>`;
},

adminGate(){
 return `<div class="topbar"><div class="brand">Área do profissional<small>Digite seu PIN</small></div>
   <button class="mode-toggle" id="toPatient">Voltar</button></div>
 <main>
   <div class="card">
     <label class="field">PIN de acesso</label>
     <input type="text" id="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••" autofocus
       style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:26px;letter-spacing:.3em;">
     ${state.authError?`<div class="errtext">${state.authError}</div>`:''}
     <button class="btn btn-primary" id="loginBtn">Entrar</button>
     <p class="sub" style="margin-top:14px;margin-bottom:0;font-size:12.5px;">Depois da primeira vez, este navegador lembra de você — não vai pedir de novo.</p>
   </div>
 </main>`;
},

dashboard(){
 const q = (state._search||'').toLowerCase();
 const filtered = state.patients.filter(p=>p.name.toLowerCase().includes(q));
 const rows = filtered.map(p=>{
  const open = state.openPatient===p.id;
  const keys = Object.keys(p.responses||{});
  const inner = keys.map(k=>{
   const r = p.responses[k];
   const qdef = QUESTIONNAIRES[k];
   let pillsHtml='', detail='';
   if(k==='eva'){
    detail = qdef.items.map((label,i)=>{
     const v = r.answers[i]; const b = evaBand(v??0);
     return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span>${label}</span><span class="pill" style="color:${b.txt};background:${b.bg}">${v??'-'}/10</span></div>`;
    }).join('');
    pillsHtml = `<span class="pill" style="background:var(--gray-bg);color:var(--gray-txt)">4 condições</span>`;
   } else {
    const band = cifBand(r.pct);
    pillsHtml = pillHtml(band) + ` <span class="pill" style="background:var(--gray-bg);color:var(--gray-txt);margin-left:4px;">CIF ${band.q}</span>`;
    detail = `${r.pct.toFixed(0)}% · ${r.n} itens respondidos`;
   }
   return `<div class="score-line">
     <div><div class="sname">${qdef.title}</div><div class="sdetail">${detail}</div>${k==='eva'?`<div style="margin-top:6px;">${detail}</div>`:''}</div>
     <div>${pillsHtml}</div></div>`;
  }).join('') || `<p class="sub" style="margin:12px 0;">Nenhum questionário respondido ainda.</p>`;
  return `<div class="patient-row">
    <div class="patient-head" data-toggle="${p.id}">
      <div><div class="patient-name">${p.name}</div><div class="patient-meta">${new Date(p.created_at).toLocaleString('pt-BR')} · ${keys.length}/6 questionários</div></div>
      <button class="del-link" data-del="${p.id}">excluir</button>
    </div>
    <div class="patient-body ${open?'open':''}">${inner}</div>
  </div>`;
 }).join('');
 return `<div class="topbar"><div class="brand">Painel do profissional<small>${state.patients.length} pacientes registrados</small></div>
   <button class="mode-toggle" id="logoutBtn">Sair</button></div>
 <main>
   <div style="display:flex;gap:10px;margin-bottom:18px;">
     <input class="searchbar" id="search" placeholder="Buscar por nome..." value="${state._search||''}" style="margin-bottom:0;flex:1;">
     <button class="btn btn-ghost" id="refreshBtn" style="white-space:nowrap;">↻ Atualizar</button>
   </div>
   ${filtered.length? rows : `<div class="empty">Nenhum paciente encontrado.<br>Envie o link desta página para o paciente responder.</div>`}
 </main>`;
}
};

function arcSvg(pct){
 const r=42, c=2*Math.PI*r, off = c - (c*pct/100);
 return `<svg width="104" height="104" viewBox="0 0 104 104">
   <circle cx="52" cy="52" r="${r}" fill="none" stroke="#E4E6EB" stroke-width="8"/>
   <circle cx="52" cy="52" r="${r}" fill="none" stroke="#1D2A44" stroke-width="8" stroke-linecap="round"
     stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 52 52)"/>
   <text x="52" y="58" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="20" fill="#1D2A44">${pct}°</text>
 </svg>`;
}

/* ---------- Bindings & fluxo ---------- */
function bind(){
 const $ = (id)=>document.getElementById(id);

 if(state.view==='landing'){
  $('toAdmin').onclick = ()=>{ state.view='adminGate'; render(); };
  $('startBtn').onclick = async ()=>{
   const name = $('pname').value.trim();
   if(!name){ $('pname').style.borderColor='#C00000'; return; }
   state.patientName = name;
   state.responsesLocal = {};
   $('startBtn').disabled = true; $('startBtn').textContent='Enviando...';
   state.patientId = await dbCreatePatient(name, $('pphone').value.trim());
   state.view='list'; render();
  };
 }

 if(state.view==='list'){
  document.querySelectorAll('.qcard').forEach(el=>{
   el.onclick = ()=>{
    const k = el.dataset.q;
    state.qKey=k; state.qIndex=0;
    const q = QUESTIONNAIRES[k];
    const len = q.type==='sections'? q.data.length : q.items.length;
    const existing = state.responsesLocal[k];
    state.qAnswers = existing && existing.rawAnswers ? existing.rawAnswers.slice() : new Array(len).fill(null);
    state.view='wizard'; render();
   };
  });
  $('finishBtn').onclick = ()=>{ state.view='thanks'; render(); };
 }

 if(state.view==='wizard'){
  const q = QUESTIONNAIRES[state.qKey];
  const total = q.type==='sections'? q.data.length : q.items.length;
  if(q.type==='sliders'){
   const slider = $('sliderInput');
   slider.oninput = ()=>{ $('sliderVal').textContent = slider.value; state.qAnswers[state.qIndex] = parseInt(slider.value); $('nextBtn').disabled=false; };
   if(state.qAnswers[state.qIndex]===null) state.qAnswers[state.qIndex]=0;
  } else {
   document.querySelectorAll('.opt').forEach(el=>{ el.onclick = ()=>{ state.qAnswers[state.qIndex] = parseInt(el.dataset.val); render(); }; });
  }
  $('backBtn').onclick = ()=>{ if(state.qIndex===0){ state.view='list'; render(); } else { state.qIndex--; render(); } };
  $('nextBtn').onclick = async ()=>{
   if(state.qIndex < total-1){ state.qIndex++; render(); return; }
   const result = q.score(state.qAnswers);
   result.rawAnswers = state.qAnswers.slice();
   result.completedAt = Date.now();
   state.responsesLocal[state.qKey] = result;
   $('nextBtn').disabled = true; $('nextBtn').textContent='Salvando...';
   await dbSaveResponses(state.patientId, state.responsesLocal);
   state.view='list'; render();
  };
 }

 if(state.view==='adminGate'){
  $('toPatient').onclick = ()=>{ state.authError=''; state.view='landing'; render(); };
  $('pin').oninput = (e)=>{ e.target.value = e.target.value.replace(/[^0-9]/g,''); };
  $('pin').addEventListener('keydown', (e)=>{ if(e.key==='Enter') $('loginBtn').click(); });
  $('loginBtn').onclick = async ()=>{
   const pin = $('pin').value.trim();
   if(!pin){ return; }
   $('loginBtn').disabled = true; $('loginBtn').textContent='Entrando...';
   const err = await authLogin(window.APP_CONFIG.ADMIN_EMAIL, pin);
   if(err){ state.authError = 'PIN incorreto.'; state.view='adminGate'; render(); return; }
   state.authError='';
   state.patients = await dbListAll();
   state.view='dashboard'; render();
  };
 }

 if(state.view==='dashboard'){
  $('logoutBtn').onclick = async ()=>{ await authLogout(); state.view='landing'; render(); };
  $('refreshBtn').onclick = async ()=>{
   $('refreshBtn').textContent='Atualizando...';
   state.patients = await dbListAll();
   render();
  };
  $('search').oninput = (e)=>{ state._search = e.target.value; render(); };
  document.querySelectorAll('[data-toggle]').forEach(el=>{
   el.onclick = (e)=>{ if(e.target.dataset.del) return; const id = el.dataset.toggle; state.openPatient = state.openPatient===id?null:id; render(); };
  });
  document.querySelectorAll('[data-del]').forEach(el=>{
   el.onclick = async (e)=>{
    e.stopPropagation();
    if(!confirm('Excluir todas as respostas deste paciente?')) return;
    await dbDelete(el.dataset.del);
    state.patients = await dbListAll();
    render();
   };
  });
 }
}

/* ---------- Inicialização: se já houver sessão salva, pula direto pro painel ---------- */
(async function init(){
 const user = await authCurrentUser();
 if(user){
  state.patients = await dbListAll();
  state.view='dashboard';
 }
 render();
})();

})();
