(function(){

const supabase = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

/* Registro de instrumentos e versões. Nenhuma conversão automática para CIF. */
const INSTRUMENT_META = {};

function metaOf(k){return INSTRUMENT_META[k]||{status:'UNAVAILABLE',administrationBlocked:true,version:'unknown',note:'Instrumento não cadastrado.'};}
const STATUS_MESSAGES=Object.freeze({VALID_OFFICIAL:'Resultado calculado conforme a versão identificada.',INCOMPLETE:'Aplicação incompleta — sem score.',LICENSE_REQUIRED:'Incorporação depende de autorização do titular.',UNAVAILABLE:'Aplicação indisponível: consulte a justificativa específica.',LEGACY_INVALID:'Aplicação histórica incompatível — dados preservados, sem recálculo.',INVALID_INPUT:'Respostas inválidas — sem score.'});
const SCORING_VERSION='4.0.0-versioned-clinimetry';
const BLOCKED_MESSAGE='Instrumento indisponível para esta aplicação. Consulte a justificativa no painel profissional.';
function statusLabel(s){return ({VALID_OFFICIAL:'Concluído',INCOMPLETE:'Incompleto',LICENSE_REQUIRED:'Autorização necessária',UNAVAILABLE:'Indisponível',LEGACY_INVALID:'Histórico incompatível',INVALID_INPUT:'Dados inválidos'})[s]||'Histórico incompatível';}
function administrationLabel(k){return metaOf(k).note;}
function canAdministerInstrument(k){return !!CURRENT_VALIDATED_INSTRUMENTS[k]&&metaOf(k).status==='VALID_OFFICIAL'&&!metaOf(k).administrationBlocked;}
const ASSIGNMENT_ALIASES=Object.freeze({fabqpa:'fabq',sss:'wpi'});
function activeKeys(keys){return [...new Set((keys||QORDER).map(k=>ASSIGNMENT_ALIASES[k]||k))].filter(canAdministerInstrument);}
function isAnswered(v){return v!==null&&v!==undefined&&v!=='NA';}
function countValidAnswers(a){return Array.isArray(a)?a.filter(isAnswered).length:0;}
function itemComplete(q,i,v){
 if(!isAnswered(v))return false;
 if(q.isItemComplete)return q.isItemComplete(i,v);
 if(q.type==='psfs')return !v.skipped&&!!v.activity.trim()&&Number.isInteger(v.score);
 return Number.isInteger(v);
}
function answerErrors(k,a){
 const q=CURRENT_VALIDATED_INSTRUMENTS[k],errors=[];
 if(!q)return ['Instrumento sem formulário atual habilitado'];
 const len=q.type==='sections'?q.data.length:q.items.length;
 if(!Array.isArray(a)||a.length!==len)return ['Comprimento inválido: esperado '+len];
 const integer=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
 for(let i=0;i<len;i++){
  const v=a[i];let ok=false;
  if(v===null)ok=q.answerPolicy.allowNull;
  else if(v==='NA')ok=q.answerPolicy.allowNA;
  else if(q.validateItem)ok=q.validateItem(i,v);
  else if(q.type==='sections')ok=integer(v,q.data[i][1].length-1);
  else if(q.type==='likert')ok=integer(v,(q.optsPerItem?q.optsPerItem[i]:q.opts).length-1);
  else if(q.type==='yesno')ok=integer(v,1);
  else if(q.type==='sliders')ok=integer(v,10);
  else if(q.type==='psfs')ok=!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='activity,score,skipped'&&typeof v.activity==='string'&&v.activity.length<=1000&&typeof v.skipped==='boolean'&&(v.score===null||integer(v.score,10));
  if(!ok)errors.push('Item '+(i+1)+': resposta inválida');
 }
 return errors;
}
function validateAnswers(k,a){return !answerErrors(k,a).length;}
function cloneAnswers(a){return a===undefined?null:JSON.parse(JSON.stringify(a));}
function validateAndScore(k,a){
 const meta=metaOf(k),q=CURRENT_VALIDATED_INSTRUMENTS[k];
 const result={status:meta.status,n:0,instrumentVersion:meta.version,scoringVersion:SCORING_VERSION,answeredAt:new Date().toISOString(),rawAnswers:cloneAnswers(a)};
 if(!canAdministerInstrument(k))return result;
 const errors=answerErrors(k,a);
 if(errors.length)return {...result,status:'INVALID_INPUT'};
 result.n=a.filter((v,i)=>itemComplete(q,i,v)).length;
 if(result.n<meta.minAnswered||(q.complete&&!q.complete(a)))return {...result,status:'INCOMPLETE'};
 return {...q.score(cloneAnswers(a)),...result,status:'VALID_OFFICIAL'};
}
function effectiveStatus(k,r){
 if(!r||r.instrumentVersion!==metaOf(k).version||r.scoringVersion!==SCORING_VERSION)return 'LEGACY_INVALID';
 if(!canAdministerInstrument(k))return metaOf(k).status;
 if(!['VALID_OFFICIAL','INCOMPLETE','INVALID_INPUT'].includes(r.status))return 'INVALID_INPUT';
 const checked=validateAndScore(k,r.rawAnswers);
 if(checked.status!==r.status)return checked.status==='VALID_OFFICIAL'?'INVALID_INPUT':checked.status;
 // A changed score cannot be presented as official; historical versions are never rescored.
 if(r.status==='VALID_OFFICIAL'&&(JSON.stringify(r.metrics)!==JSON.stringify(checked.metrics)||JSON.stringify(r.calculation)!==JSON.stringify(checked.calculation)))return 'INVALID_INPUT';
 return r.status;
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function numberText(n){return Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});}
function scoreLines(k,r){
 if(effectiveStatus(k,r)!=='VALID_OFFICIAL')return [STATUS_MESSAGES[effectiveStatus(k,r)]];
 const lines=(r.metrics||[]).map(m=>m.name+': '+numberText(m.value)+'/'+m.max+' — '+m.direction+(m.answered!==undefined?' (respondidos: '+m.answered+'/'+m.items+')':''));
 // Interpretive text also comes from the identified algorithm, never from an arbitrary database string.
 const checked=validateAndScore(k,r.rawAnswers);
 if(checked.interpretation)lines.push(checked.interpretation);
 return lines.length?lines:['Resultado registrado por região; sem score global.'];
}
function responseLines(k,r){
 const status=effectiveStatus(k,r),q=CURRENT_VALIDATED_INSTRUMENTS[k],meta=metaOf(k);
 const lines=[STATUS_MESSAGES[status],'Data: '+(r.answeredAt||r.completedAt||'não registrada'),'Versão coletada: '+(r.instrumentVersion||'não registrada')];
 if(status==='LEGACY_INVALID'||status==='INVALID_INPUT'||!q){lines.push('Respostas originais: '+JSON.stringify(r.rawAnswers??r.answers??r.activities??null));return lines;}
 lines.push(...scoreLines(k,r),'Método: '+SCORING_VERSION,'Fonte: '+meta.source,'Validação brasileira: '+meta.brazilSource,'Regra de ausência: '+meta.missing);
 if(meta.note)lines.push('Escopo: '+meta.note);
 if(status==='VALID_OFFICIAL')lines.push('Memória de cálculo: '+JSON.stringify(r.calculation));
 r.rawAnswers.forEach((v,i)=>{
  const label=q.type==='sections'?q.data[i][0]:q.items[i];
  if(!isAnswered(v)){lines.push(label+': não respondido');return;}
  if(q.type==='psfs'){lines.push(label+': '+v.activity+' — '+(v.score??'não respondido')+'/10');return;}
  if(q.type==='nmq'){lines.push(label+': '+Object.entries(NMQ_FIELDS).map(([f,t])=>t+' '+(v[f]===null?'não respondido':v[f]===1?'Sim':'Não')).join(' · '));return;}
  if(q.special?.[i]==='diseases'){v.entries.forEach((n,j)=>lines.push(WAI_DISEASES[j]+': '+(['Não possuo','Minha opinião','Diagnóstico médico','Minha opinião e diagnóstico médico'][n]||'Não respondido')+(v.details[j]?' — '+v.details[j]:'')));return;}
  if(q.special?.[i]==='multi'){lines.push(label+': '+v.map(n=>q.data[i][1][n]).join('; '));return;}
  const answer=q.type==='sections'?q.data[i][1][v]:q.type==='likert'?(q.optsPerItem?q.optsPerItem[i]:q.opts)[v]:q.type==='yesno'?(v?'Sim':'Não'):v+'/10';
  lines.push(label+': '+answer);
 });
 return lines;
}
function renderItemDetail(k,r){return responseLines(k,r).map(t=>'<div style="padding:9px 0;border-bottom:1px dashed var(--line)">'+escapeHtml(t)+'</div>').join('');}
function buildReportText(p){
 const lines=['AVALIAÇÃO FUNCIONAL — '+p.name,'Registro criado em: '+new Date(p.created_at).toLocaleString('pt-BR'),''];
 Object.entries(p.responses||{}).forEach(([k,r])=>lines.push('='.repeat(60),(effectiveStatus(k,r)==='LEGACY_INVALID'?LEGACY_INSTRUMENTS[k]?.title:QUESTIONNAIRES[k]?.title)||k,'Status: '+statusLabel(effectiveStatus(k,r)),...responseLines(k,r),''));
 return lines.join('\n');
}

/* Formulários ativos e schemas históricos sem textos dos itens bloqueados.
   LEGACY_SCHEMA preserva comprimento/índices, não uma versão para aplicação.
   Nenhum registro persistido é alterado ou recalculado. */
const LEGACY_SCHEMA = {
 "odi": {
  "type": "sections",
  "options": [
   6,
   6,
   6,
   6,
   6,
   6,
   6,
   6,
   6,
   6
  ]
 },
 "ndi": {
  "type": "sections",
  "options": [
   6,
   6,
   6,
   6,
   6,
   6,
   6,
   6,
   6,
   6
  ]
 },
 "tsk13": {
  "type": "likert",
  "options": [
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4
  ]
 },
 "quickdash": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "whodas": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "dn4": {
  "type": "yesno",
  "options": [
   2,
   2,
   2,
   2,
   2,
   2,
   2
  ]
 },
 "fabq": {
  "type": "likert",
  "options": [
   7,
   7,
   7,
   7,
   7,
   7,
   7
  ]
 },
 "pcs": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "rmdq": {
  "type": "yesno",
  "options": [
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2
  ]
 },
 "mjoa": {
  "type": "sections",
  "options": [
   6,
   8,
   4,
   4
  ]
 },
 "wiq": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "lefs": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "sfi": {
  "type": "sections",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "ict": {
  "type": "sections",
  "options": [
   3,
   11,
   5,
   5,
   6,
   6,
   5,
   3,
   5,
   5,
   5
  ]
 },
 "fiqr": {
  "type": "sections",
  "options": [
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11,
   11
  ]
 },
 "wpi": {
  "type": "yesno",
  "options": [
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2
  ]
 },
 "sss": {
  "type": "sections",
  "options": [
   4,
   4,
   4,
   4
  ]
 },
 "hoos": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "koos": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "fss": {
  "type": "likert",
  "options": [
   7,
   7,
   7,
   7,
   7,
   7,
   7,
   7,
   7
  ]
 },
 "psqi": {
  "type": "sections",
  "options": [
   4,
   4,
   4,
   4,
   4,
   4,
   4
  ]
 },
 "hit6": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "fabqpa": {
  "type": "likert",
  "options": [
   7,
   7,
   7,
   7
  ]
 },
 "comi": {
  "type": "sections",
  "options": [
   11,
   11,
   5,
   5,
   5,
   4,
   2
  ]
 },
 "hads": {
  "type": "likert",
  "options": [
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4
  ]
 },
 "csi": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "orebro": {
  "type": "sections",
  "options": [
   8,
   11,
   11,
   5,
   11,
   11,
   11,
   11,
   11,
   11
  ]
 },
 "ess": {
  "type": "likert",
  "options": [
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4
  ]
 },
 "chalder": {
  "type": "likert",
  "options": [
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4,
   4
  ]
 },
 "sf36": {
  "type": "sections",
  "options": [
   3,
   3,
   3,
   3,
   3,
   3,
   3,
   3,
   3,
   3,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   6,
   6,
   6,
   6,
   5,
   5,
   6,
   5,
   6,
   6,
   6,
   6,
   6,
   5,
   5,
   5,
   5,
   5
  ]
 },
 "masq": {
  "type": "likert",
  "options": [
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5,
   5
  ]
 }
};
const ICT_DISEASE_CATEGORIES = Object.freeze(['Nenhuma','1 doença','2 doenças','3 doenças','4 doenças','5 ou mais doenças']);
const ITEM_HELP = {
 eva:{
  0:'Pense em como está sua dor agora mesmo, neste momento, sem fazer nenhum esforço.',
  1:'Pense no momento em que a dor costuma ficar mais forte no seu dia (para muita gente, é de manhã ao levantar, ou à noite).',
  2:'Pense no momento em que a dor costuma ficar mais fraca, ou quase não aparece.',
  3:'Imagine fazendo a atividade mais pesada do seu trabalho (levantar peso, ficar em pé muito tempo, repetir o mesmo movimento) e dê a nota de dor que você sentiria nessa hora.'
 }
};

const LEGACY_INSTRUMENTS = {
 "odi": {
  "title": "Índice de Incapacidade de Oswestry (ODI)",
  "short": "ODI · coluna lombar",
  "about": "Sobre a parte de baixo das suas costas (lombar).",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "ndi": {
  "title": "Índice de Incapacidade Cervical (NDI)",
  "short": "NDI · coluna cervical",
  "about": "Sobre o seu pescoço.",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "tsk13": {
  "title": "Escala Tampa de Cinesiofobia (TSK-13)",
  "short": "TSK-13 · medo do movimento",
  "about": "Sobre o medo de se movimentar.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "quickdash": {
  "title": "QuickDASH (função do membro superior)",
  "short": "QuickDASH · membro superior",
  "about": "Sobre o seu braço, ombro ou mão.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "whodas": {
  "title": "WHODAS 2.0 (12 itens) — funcionalidade geral",
  "short": "WHODAS 2.0 · funcionalidade global",
  "about": "Sobre suas atividades do dia a dia, de forma geral.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "eva": {
  "title": "END — Escala Numérica de Dor (0 a 10)",
  "short": "END · dor em 4 condições",
  "about": "Sobre a intensidade da sua dor, numa escala de 0 a 10.",
  "type": "sliders",
  "items": [
   "Agora, em repouso (sem fazer esforço)",
   "No pior momento de dor do seu dia",
   "No melhor momento de dor do seu dia",
   "Fazendo um esforço parecido com o do seu trabalho (ex.: levantar peso, ficar em pé bastante tempo, movimentos repetidos)"
  ],
  "intro": "Agora vamos medir sua dor numa escala de 0 a 10, em momentos diferentes. 0 é sem dor nenhuma, 10 é a pior dor que você pode imaginar na vida."
 },
 "dn4": {
  "title": "DN4 — versão entrevista (dor neuropática)",
  "short": "DN4 · qualidade da dor",
  "about": "Sobre como é a sensação da sua dor.",
  "type": "yesno",
  "legacySchemaOnly": true
 },
 "fabq": {
  "title": "FABQ — subescala trabalho",
  "short": "FABQ-trabalho · medo-evitação",
  "about": "Sobre sua opinião sobre trabalho e dor.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "pcs": {
  "title": "PCS (Pain Catastrophizing Scale)",
  "short": "PCS · catastrofização da dor",
  "about": "Sobre os pensamentos que você tem quando sente dor.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "rmdq": {
  "title": "Roland-Morris (RMDQ)",
  "short": "RMDQ · incapacidade lombar leve-moderada",
  "about": "Sobre a parte de baixo das suas costas (lombar), em um jeito mais simples.",
  "type": "yesno",
  "legacySchemaOnly": true
 },
 "mjoa": {
  "title": "mJOA (mielopatia cervical)",
  "short": "mJOA · função motora, sensibilidade e esfíncter",
  "about": "Sobre força, sensibilidade e controle da urina, relacionados ao seu pescoço.",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "psfs": {
  "title": "PSFS (Escala Funcional Específica do Paciente)",
  "short": "PSFS · atividades escolhidas pelo próprio paciente",
  "about": "Sobre atividades que você mesmo escolhe.",
  "type": "psfs",
  "items": [
   "Atividade 1 de 3 — pense em algo que você tem dificuldade de fazer hoje por causa do problema",
   "Atividade 2 de 3",
   "Atividade 3 de 3"
  ],
  "intro": "Agora pense em até 3 atividades do seu dia a dia que ficaram difíceis por causa do problema. Para cada uma, dê uma nota de 0 a 10: 0 é 'não consigo fazer de jeito nenhum', 10 é 'consigo fazer como fazia antes'."
 },
 "wiq": {
  "title": "WIQ (Walking Impairment Questionnaire)",
  "short": "WIQ · caminhada e claudicação",
  "about": "Sobre sua capacidade de caminhar e subir escadas.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "lefs": {
  "title": "LEFS (Lower Extremity Functional Scale)",
  "short": "LEFS · função de quadril, joelho e marcha",
  "about": "Sobre suas pernas (quadril, joelho, marcha).",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "sfi": {
  "title": "SFI-10-Br (Spine Functional Index)",
  "short": "SFI-10 · coluna como unidade única",
  "about": "Sobre a sua coluna inteira (pescoço, meio e lombar juntos).",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "nmq": {
  "title": "Questionário Nórdico de Sintomas Osteomusculares (QNSO/NMQ)",
  "short": "NMQ · mapa corporal de sintomas",
  "about": "Sobre dor em diferentes partes do corpo.",
  "type": "nmq",
  "items": [
   "Pescoço",
   "Ombros",
   "Região torácica (parte de cima das costas)",
   "Cotovelos",
   "Região lombar (parte de baixo das costas)",
   "Punhos e mãos",
   "Quadril e coxas",
   "Joelhos",
   "Tornozelos e pés"
  ],
  "intro": "Estas perguntas são sobre dor, desconforto ou dormência em diferentes partes do corpo — nos últimos 12 meses e nos últimos 7 dias."
 },
 "ict": {
  "title": "ICT (Índice de Capacidade para o Trabalho / WAI)",
  "short": "ICT-WAI · capacidade e prognóstico laboral",
  "about": "Sobre sua capacidade de trabalhar.",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "fiqr": {
  "title": "FIQR (Fibromyalgia Impact Questionnaire — Revised)",
  "short": "FIQR · impacto global da fibromialgia",
  "about": "Sobre o impacto da fibromialgia na sua vida.",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "wpi": {
  "title": "WPI (Widespread Pain Index — critério de fibromialgia)",
  "short": "WPI · mapa corporal de dor (ACR)",
  "about": "Sobre em quais partes do corpo você sente dor.",
  "type": "yesno",
  "legacySchemaOnly": true
 },
 "sss": {
  "title": "SSS (Symptom Severity Scale — companheira do WPI)",
  "short": "SSS · gravidade dos sintomas (ACR)",
  "about": "Sobre a gravidade de alguns sintomas (fadiga, sono, memória).",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "hoos": {
  "title": "Questionário funcional descritivo de quadril (baseado em domínios do HOOS)",
  "short": "Quadril · versão reduzida, não é o HOOS oficial",
  "about": "Sobre o seu quadril.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "koos": {
  "title": "Questionário funcional descritivo de joelho (baseado em domínios do KOOS)",
  "short": "Joelho · versão reduzida, não é o KOOS oficial",
  "about": "Sobre o seu joelho.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "fss": {
  "title": "FSS (Fatigue Severity Scale)",
  "short": "FSS · gravidade da fadiga",
  "about": "Sobre o quanto o cansaço (fadiga) afeta você.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "psqi": {
  "title": "PSQI (Índice de Qualidade do Sono de Pittsburgh)",
  "short": "PSQI · qualidade do sono",
  "about": "Sobre a qualidade do seu sono.",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "hit6": {
  "title": "HIT-6 (Headache Impact Test)",
  "short": "HIT-6 · impacto da dor de cabeça/enxaqueca",
  "about": "Sobre o impacto das suas dores de cabeça.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "fabqpa": {
  "title": "FABQ — subescala atividade física",
  "short": "FABQ-AF · medo-evitação de atividade física",
  "about": "Sobre sua opinião sobre atividade física e dor.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "comi": {
  "title": "COMI-Back (Core Outcome Measures Index)",
  "short": "COMI-Back · desfecho multidimensional de coluna",
  "about": "Sobre a sua coluna, de forma resumida.",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "hads": {
  "title": "HADS (Hospital Anxiety and Depression Scale)",
  "short": "HADS · ansiedade e depressão",
  "about": "Sobre como você tem se sentido emocionalmente.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "csi": {
  "title": "CSI (Central Sensitization Inventory)",
  "short": "CSI · sensibilização central",
  "about": "Sobre sintomas físicos e emocionais diversos.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "orebro": {
  "title": "Örebro (versão curta) — risco de cronificação",
  "short": "Örebro-curto · prognóstico de retorno ao trabalho",
  "about": "Sobre sua dor e sua expectativa sobre o futuro.",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "ess": {
  "title": "ESS (Epworth Sleepiness Scale)",
  "short": "ESS · sonolência diurna",
  "about": "Sobre a chance de você cochilar em situações do dia a dia.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "chalder": {
  "title": "Escala de Fadiga de Chalder",
  "short": "Chalder · fadiga física e mental",
  "about": "Sobre o seu cansaço, separando o físico do mental.",
  "type": "likert",
  "legacySchemaOnly": true
 },
 "sf36": {
  "title": "SF-36 (Medical Outcomes Study 36-Item Short Form)",
  "short": "SF-36 · qualidade de vida em 8 domínios",
  "about": "Sobre sua qualidade de vida em vários aspectos: corpo, emoções, dor, energia e saúde em geral.",
  "type": "sections",
  "legacySchemaOnly": true
 },
 "masq": {
  "title": "MASQ (Multiple Ability Self-Report Questionnaire)",
  "short": "MASQ · queixas cognitivas em 6 domínios",
  "about": "Sobre memória, atenção, linguagem e coordenação no seu dia a dia.",
  "type": "likert",
  "legacySchemaOnly": true
 }
};
/* Formulários atuais. Índices armazenados são zero-based; cada algoritmo faz
   sua própria recodificação. Nunca aplicar estes schemas a versões antigas. */
const CURRENT_VALIDATED_INSTRUMENTS = {};
const sum = a => a.reduce((s,v)=>s+v,0);
const metric = (name,value,max,direction,extra={}) => ({name,value,max,direction,...extra});
const numbers = max => Array.from({length:max+1},(_,i)=>String(i));
function register(key, q, meta){
 q.answerPolicy={allowNull:true,allowNA:false};
 q.short=q.title; q.about=q.about||q.title;
 CURRENT_VALIDATED_INSTRUMENTS[key]=q;
 INSTRUMENT_META[key]={status:'VALID_OFFICIAL',administrationBlocked:false,minAnswered:q.type==='sections'?q.data.length:q.items.length,version:meta.version,licenseStatus:meta.licenseStatus,note:meta.note||'',...meta};
}
register('sfi',{
 title:'SFI-10-Br — Spine Functional Index',type:'likert',
 intro:'Sua coluna pode dificultar a realização de algumas coisas que você normalmente faz. Pense em você nos últimos dias. POR CAUSA DA MINHA COLUNA:',
 items:['Eu evito tarefas pesadas (por ex. limpeza, levantar mais de 5 kg, jardinagem, etc.).','Eu tenho dor/problema quase o tempo todo.','Eu tenho dificuldade com tarefas domésticas ou familiares.','Eu durmo mal.','Eu preciso de ajuda com cuidados pessoais (por ex. com banho e higiene pessoal).','Minhas atividades diárias (trabalho, contato social) estão prejudicadas.','Eu preciso de ajuda ou sou mais lento(a) para me vestir.','Eu tenho dificuldade em ficar sentado(a).','Eu consigo ficar em pé apenas por pouco tempo.','Eu tenho dificuldades para me abaixar (por ex. para pegar um objeto no chão ou colocar as meias).'],
 opts:['NÃO','Parcialmente','SIM'],
 score:a=>({metrics:[metric('SFI-10-Br',100-sum(a)*5,100,'Maior = melhor função')],calculation:{raw:sum(a)/2,formula:'100 − (soma de 0 / 0,5 / 1 × 10)',denominator:10}})
},{version:'SFI-10-Br-Freitas-2024-v1',licenseStatus:'CC_BY_4_0',source:'https://doi.org/10.1186/s12891-024-07406-0',brazilSource:'https://doi.org/10.1186/s12891-024-07406-0',missing:'Coleta completa: 10/10. Não se imputa resposta; o artigo não estabelece regra de imputação.',note:'Freitas et al., 2024; suplemento dos autores. Transposição para telas individuais; redação e alternativas preservadas.'});

const FABQ_ALL=['Minha dor foi causada por atividade física','A atividade física faz minha dor piorar','A atividade física pode afetar minhas costas','Eu não deveria realizar atividades físicas que poderiam fazer a minha dor piorar','Eu não posso realizar atividades físicas que poderiam fazer minha dor piorar','Minha dor foi causada pelo meu trabalho ou por um acidente de trabalho','Meu trabalho agravou minha dor','Eu tenho uma reivindicação de pensão em virtude da minha dor','Meu trabalho é muito pesado para mim','Meu trabalho faz ou poderia fazer minha dor piorar','Meu trabalho pode prejudicar minhas costas','Eu não deveria realizar meu trabalho normal com minha dor atual','Eu não posso realizar meu trabalho normal com minha dor atual','Eu não posso realizar meu trabalho normal até que minha dor seja tratada','Eu não acho que estarei de volta ao trabalho normal dentro de três meses','Eu não acho que algum dia estarei apto para retornar ao meu trabalho'];
const fabqScore=a=>({metrics:[metric('FABQ atividade física',sum([1,2,3,4].map(i=>a[i])),24,'Maior = mais crenças de medo e evitação'),metric('FABQ trabalho',sum([5,6,8,9,10,11,14].map(i=>a[i])),42,'Maior = mais crenças de medo e evitação')],calculation:{physicalItems:[2,3,4,5],workItems:[6,7,9,10,11,12,15],excludedItems:[1,8,13,14,16]}});
register('fabq',{
 title:'FABQ-Brasil — atividade física e trabalho',type:'likert',items:FABQ_ALL,
 opts:['0 — Discordo completamente','1 — Discordo razoavelmente','2 — Discordo ligeiramente','3 — Não sei dizer','4 — Concordo ligeiramente','5 — Concordo razoavelmente','6 — Concordo completamente'],
 intro:'Nos itens 1 a 5, informe quanto as atividades físicas como fletir o tronco, levantar, caminhar ou dirigir afetam ou afetariam sua dor nas costas. Nos itens 6 a 16, informe quanto o seu trabalho normal afeta ou afetaria sua dor nas costas.',score:fabqScore
},{version:'FABQ-Brasil-Abreu-2008-16-v1',licenseStatus:'PUBLISHED_CC_BY_FORM',source:'https://doi.org/10.1016/0304-3959(93)90127-B',brazilSource:'https://doi.org/10.1590/S0102-311X2008000300015',missing:'Coleta completa dos 16 itens; não há imputação nesta implementação.',note:'Abreu et al., 2008, tabela 1. Sem total combinado e sem faixas de gravidade.'});

register('rmdq',{
 title:'RMDQ — Roland-Morris Brasil (24 itens)',type:'yesno',
 intro:'Pense em você hoje. Responda Sim apenas à frase que tiver certeza que descreve você hoje. Se a frase não descreve você, responda Não. A validação original brasileira utilizou entrevista; o profissional pode acompanhar a aplicação.',
 items:['Fico em casa a maior parte do tempo por causa de minhas costas.','Mudo de posição freqüentemente tentando deixar minhas costas confortáveis.','Ando mais devagar que o habitual por causa de minhas costas.','Por causa de minhas costas eu não estou fazendo nenhum dos meus trabalhos que geralmente faço em casa.','Por causa de minhas costas, eu uso o corrimão para subir escadas.','Por causa de minhas costas, eu me deito para descansar mais freqüentemente.','Por causa de minhas costas, eu tenho que me apoiar em alguma coisa para me levantar de uma cadeira normal.','Por causa de minhas costas, tento conseguir com que outras pessoas façam as coisas por mim.','Eu me visto mais lentamente que o habitual por causa de minhas costas.','Eu somente fico em pé por períodos curtos de tempo por causa de minhas costas.','Por causa de minhas costas evito me abaixar ou me ajoelhar.','Encontro dificuldades em me levantar de uma cadeira por causa de minhas costas.','As minhas costas doem quase que o tempo todo.','Tenho dificuldade em me virar na cama por causa das minhas costas.','Meu apetite não é muito bom por causa das dores em minhas costas.','Tenho problemas para colocar minhas meias (ou meia calça) por causa das dores em minhas costas.','Caminho apenas curtas distâncias por causa de minhas dores nas costas.','Não durmo tão bem por causa de minhas costas.','Por causa de minhas dores nas costas, eu me visto com ajuda de outras pessoas.','Fico sentado a maior parte do dia por causa de minhas costas.','Evito trabalhos pesados em casa por causa de minhas costas.','Por causa das dores em minhas costas, fico mais irritado e mal humorado com as pessoas do que o habitual.','Por causa de minhas costas, eu subo escadas mais vagarosamente do que o habitual.','Fico na cama a maior parte do tempo por causa de minhas costas.'],
 score:a=>({metrics:[metric('RMDQ',sum(a),24,'Maior = maior limitação relacionada às costas')],calculation:{positiveAnswers:sum(a),denominator:24}})
},{version:'RMDQ-Brasil-Nusbaum-2001-24-v1',licenseStatus:'PUBLIC_DOMAIN',source:'https://www.sralab.org/rehabilitation-measures/roland-morris-disability-questionnaire',brazilSource:'https://doi.org/10.1590/S0100-879X2001000200007',missing:'Exige 24 respostas explícitas; campo vazio não é Não.',note:'Redação do apêndice de Nusbaum et al. Preservada sem extrapolar para incapacidade laboral.'});

register('eva',{
 title:'END — Escala Numérica de Dor (4 situações)',type:'sliders',
 items:['Agora, em repouso (sem fazer esforço)','No pior momento de dor do seu dia','No melhor momento de dor do seu dia','Fazendo um esforço parecido com o do seu trabalho (ex.: levantar peso, ficar em pé bastante tempo, movimentos repetidos)'],
 intro:'Dê uma nota de 0 a 10 para a sua dor em cada situação: 0 = nenhuma dor; 10 = a pior dor imaginável.',
 score:a=>({metrics:[metric('END — repouso',a[0],10,'Maior = maior intensidade da dor'),metric('END — pior momento do dia',a[1],10,'Maior = maior intensidade da dor'),metric('END — melhor momento do dia',a[2],10,'Maior = maior intensidade da dor'),metric('END — esforço semelhante ao trabalho',a[3],10,'Maior = maior intensidade da dor')],calculation:{denominator:10,formula:'Cada situação é uma END independente; não há soma nem média.'},interpretation:'Escala numérica sem faixas universais de gravidade. Cada nota descreve a intensidade autorreferida naquela situação.'})
},{version:'END-0-10-4-situacoes-v2',licenseStatus:'GENERIC_NUMERIC_RATING',source:'https://doi.org/10.1016/j.jpain.2004.10.004',brazilSource:'https://pubmed.ncbi.nlm.nih.gov/18923324/',missing:'Exige as 4 respostas.',note:'Escala numérica de dor de uso livre, aplicada em quatro contextos (repouso, pior e melhor momento do dia, esforço semelhante ao trabalho). Sem faixas universais de gravidade.'});

register('psfs',{
 title:'PSFS — Escala Funcional Específica do Paciente',type:'psfs',items:['Atividade 1','Atividade 2','Atividade 3'],intro:'Identifique três atividades importantes que você não consegue fazer ou tem dificuldade para fazer em consequência do seu problema. Avalie sua capacidade atual: 0 = incapaz de realizar; 10 = capaz de realizar no mesmo nível de antes da lesão ou problema.',
 score:a=>({metrics:[...a.map((v,i)=>metric('Atividade '+(i+1)+' — '+v.activity,v.score,10,'Maior = melhor função')),metric('PSFS — média',sum(a.map(v=>v.score))/3,10,'Maior = melhor função')],calculation:{sum:sum(a.map(v=>v.score)),denominator:3}})
},{version:'PSFS-BR-Costa-2008-three-activities-v1',licenseStatus:'CLINICAL_USE_ATTRIBUTION',source:'https://doi.org/10.3138/ptc.47.4.258',brazilSource:'https://pubmed.ncbi.nlm.nih.gov/18923324/',missing:'Três atividades nomeadas e pontuadas; sem imputação nem exclusão silenciosa de atividade.',note:'Stratford et al.; adaptação brasileira Costa et al., 2008. A seleção de atividades deve corresponder ao problema avaliado.'});

const FSQ_REGIONS=['Lado esquerdo da mandíbula (queixo)','Ombro esquerdo','Braço esquerdo (entre o ombro e o cotovelo esquerdo)','Antebraço esquerdo (entre o cotovelo e a mão esquerda)','Lado direito da mandíbula (queixo)','Ombro direito','Braço direito (entre o ombro e o cotovelo direito)','Antebraço direito (entre o cotovelo e a mão direita)','Quadril esquerdo','Coxa esquerda','Parte inferior da perna esquerda (entre o joelho e o pé esquerdo)','Quadril direito','Coxa direita','Parte inferior da perna direita (entre o joelho e o pé direito)','Pescoço','Parte superior das costas','Parte inferior das costas','Peito (tórax)','Abdome'];
const FSQ_SEVERITY=['Não senti','Sintoma leve ou suave, senti de vez em quando','Sintoma médio, senti frequentemente','Sintoma forte, senti continuamente, atrapalhando a rotina'];
register('wpi',{
 title:'FSQ-Brazil 2016 — WPI + SSS',type:'sections',intro:'Questionário de Pesquisa em Fibromialgia — FSQ-Brazil. Informe dor ou desconforto nos últimos 7 dias. As perguntas de sintomas indicam suas próprias janelas de tempo. Este questionário não estabelece diagnóstico automaticamente.',
 data:[...FSQ_REGIONS.map(t=>['Nos últimos 7 dias, teve dor ou desconforto: '+t+'?',['Não','Sim']]),
 ['Nos últimos 7 DIAS, você sentiu FADIGA OU CANSAÇO?',FSQ_SEVERITY],
 ['Nos últimos 7 DIAS, você teve um SONO NÃO REPARADOR, ACORDOU CANSADO, como se não tivesse dormido o suficiente?',FSQ_SEVERITY],
 ['Nos últimos 7 DIAS, você sentiu DIFICULDADE DE RACIOCÍNIO OU DE MEMÓRIA?',FSQ_SEVERITY],
 ...['Dor de cabeça','Dor ou cólicas em abdome inferior (abaixo do umbigo)','Depressão / tristeza'].map(t=>['Durante os últimos 6 MESES, você sentiu: '+t+'?',['Não','Sim']]),
 ['Considerando todas as perguntas deste questionário, em geral, os sintomas que você sentiu estiveram frequentemente presentes por pelo menos 3 MESES?',['Não','Sim']]],
 score:a=>{
  const wpi=sum(a.slice(0,19)),sss=sum(a.slice(19,25));
  const regions=[[1,2,3],[5,6,7],[8,9,10],[11,12,13],[14,15,16]].filter(g=>g.some(i=>a[i]===1)).length;
  const thresholds=(wpi>=7&&sss>=5)||(wpi>=4&&wpi<=6&&sss>=9),duration=a[25]===1;
  return {metrics:[metric('WPI',wpi,19,'Maior = mais locais de dor'),metric('SSS',sss,12,'Maior = maior gravidade dos sintomas')],interpretation:(thresholds&&regions>=4&&duration?'Critérios numéricos e condições autorreferidas de 2016 atendidos.':'Critérios numéricos e condições autorreferidas de 2016 não atendidos.')+' Não estabelece diagnóstico de fibromialgia automaticamente.',calculation:{generalizedRegions:regions,requiredRegions:4,durationAtLeast3Months:duration,thresholdsMet:thresholds,criteriaYear:2016}};
 }
},{version:'FSQ-Brazil-Daltrozo-2020-ACR2016-v1',licenseStatus:'CC_BY_4_0',source:'https://doi.org/10.1016/j.semarthrit.2016.08.012',brazilSource:'https://doi.org/10.1186/s42358-020-00139-3',missing:'Exige todos os 26 campos. WPI e SSS pertencem à mesma aplicação; nunca combinar registros separados.',note:'Daltrozo, Paupitz e Neves, 2020, figura 1. Mandíbula, tórax e abdome contam no WPI, mas não na distribuição generalizada.'});

register('lefs',{
 title:'LEFS — versão brasileira de Metsavaht (2012)',type:'likert',
 intro:'Estamos interessados em saber se você está tendo alguma dificuldade com as atividades listadas abaixo devido ao seu problema nos membros inferiores para o qual você está procurando tratamento. Hoje, você tem ou teria alguma dificuldade para:',
 items:['Qualquer uma de suas atividades usuais no trabalho, em casa ou na escola.','Seus passatempos habituais, atividades recreativas ou esportivas.','Ultrapassar um obstáculo de 50cm de altura, como entrar ou sair de uma banheira.','Caminhar do quarto à sala.','Colocar o sapato ou as meias.','Ficar agachado (de cócoras).','Levantar um objeto, como uma sacola de compras do chão.','Realizar atividades domiciliares leves.','Realizar atividades domiciliares pesadas.','Entrar ou sair do carro.','Caminhar dois quarteirões.','Caminhar 1 kilômetro.','Subir ou descer 10 degraus (1 lance de escada).','Ficar em pé durante 1 hora.','Ficar sentado durante 1 hora.','Correr em terreno plano.','Correr em terreno acidentado (irregular).','Fazer mudanças bruscas de direção enquanto corre rapidamente.','Dar pulinhos.','Rolar para mudar de lado na cama.'],
 opts:['Extremamente difícil ou incapaz de realizar a atividade','Bastante dificuldade','Dificuldade moderada','Um pouco de dificuldade','Sem dificuldade'],
 score:a=>({metrics:[metric('LEFS',sum(a),80,'Maior pontuação = melhor função')],calculation:{sum:sum(a),denominator:80}})
},{version:'LEFS-BR-Metsavaht-2012-20-v1',licenseStatus:'FREE_CLINICAL_USE',source:'https://www.sralab.org/rehabilitation-measures/lower-extremity-functional-scale',brazilSource:'https://doi.org/10.2519/jospt.2012.4101',missing:'Coleta completa de 20 itens; sem transformar ausência em zero ou normalizar total incompleto.',note:'© Paul Stratford e Jill Binkley. Tradução Metsavaht et al. Uso clínico; não constitui licença de revenda do instrumento.'});

const RAND_FREQ=['Todo o tempo','A maior parte do tempo','Uma boa parte do tempo','Alguma parte do tempo','Uma pequena parte do tempo','Nunca'];
const RAND_TRUE=['Definitivamente verdadeiro','A maioria das vezes verdadeiro','Não sei','A maioria das vezes falso','Definitivamente falso'];
const RAND_PHYS='Durante as últimas 4 semanas, como consequência de sua saúde física: ';
const RAND_EMO='Durante as últimas 4 semanas, como consequência de algum problema emocional (como sentir-se deprimido ou ansioso): ';
const RAND_GROUPS={
 'Capacidade funcional':[3,4,5,6,7,8,9,10,11,12],
 'Limitações por aspectos físicos':[13,14,15,16],
 'Limitações por aspectos emocionais':[17,18,19],
 'Energia/fadiga':[23,27,29,31],
 'Bem-estar emocional':[24,25,26,28,30],
 'Aspectos sociais':[20,32],
 'Dor':[21,22],
 'Saúde geral':[1,33,34,35,36]
};
const RAND_MAPS=Array.from({length:36},(_,i)=>{
 const n=i+1;
 if([1,2,20,22,34,36].includes(n)) return [100,75,50,25,0];
 if(n>=3&&n<=12) return [0,50,100];
 if(n>=13&&n<=19) return [0,100];
 if([21,23,26,27,30].includes(n)) return [100,80,60,40,20,0];
 if([24,25,28,29,31].includes(n)) return [0,20,40,60,80,100];
 return [0,25,50,75,100];
});
register('sf36',{
 title:'RAND 36-Item Health Survey 1.0 — português brasileiro',type:'sections',
 intro:'Esta pesquisa questiona você sobre sua saúde. Responda cada questão. Observe o período indicado em cada pergunta. Desenvolvido na RAND como parte do Medical Outcomes Study. Itens da tradução brasileira de Ciconelli; algoritmo RAND 1.0, validado no Brasil por Lins-Kusterer et al. (2022). Apresentação eletrônica em telas individuais.',
 data:[
 ['Em geral, você diria que sua saúde é:',['Excelente','Muito boa','Boa','Ruim','Muito ruim']],
 ['Comparada a um ano atrás, como você classificaria sua saúde em geral, agora?',['Muito melhor agora do que há um ano atrás','Um pouco melhor agora do que há um ano atrás','Quase a mesma de um ano atrás','Um pouco pior agora do que há um ano atrás','Muito pior agora do que há um ano atrás']],
 ...['Atividades vigorosas, que exigem muito esforço, tais como correr, levantar objetos pesados, participar em esportes árduos','Atividades moderadas, tais como mover uma mesa, passar aspirador de pó, jogar bola, varrer a casa','Levantar ou carregar mantimentos','Subir vários lances de escada','Subir um lance de escada','Curvar-se, ajoelhar-se ou dobrar-se','Andar mais de 1 quilômetro','Andar vários quarteirões','Andar um quarteirão','Tomar banho ou vestir-se'].map(t=>['Atualmente, durante um dia comum, devido a sua saúde, você tem dificuldade para: '+t+'?',['Sim. Dificulta muito','Sim. Dificulta um pouco','Não. Não dificulta de modo algum']]),
 ...['Você diminuiu a quantidade de tempo que se dedicava ao seu trabalho ou a outras atividades?','Realizou menos tarefas do que você gostaria?','Esteve limitado no seu tipo de trabalho ou em outras atividades?','Teve dificuldade de fazer seu trabalho ou outras atividades (p.ex.: necessitou de um esforço extra)?'].map(t=>[RAND_PHYS+t,['Sim','Não']]),
 ...['Você diminuiu a quantidade de tempo que se dedicava ao seu trabalho ou a outras atividades?','Realizou menos tarefas do que você gostaria?','Não trabalhou ou não fez qualquer das atividades com tanto cuidado como geralmente faz?'].map(t=>[RAND_EMO+t,['Sim','Não']]),
 ['Durante as últimas 4 semanas, de que maneira sua saúde física ou problemas emocionais interferiram nas suas atividades sociais normais, em relação a família, vizinhos, amigos ou em grupo?',['De forma nenhuma','Ligeiramente','Moderadamente','Bastante','Extremamente']],
 ['Quanta dor no corpo você teve durante as últimas 4 semanas?',['Nenhuma','Muito leve','Leve','Moderada','Grave','Muito grave']],
 ['Durante as últimas 4 semanas, quanto a dor interferiu com o seu trabalho normal (incluindo tanto o trabalho fora de casa e dentro de casa)?',['De maneira alguma','Um pouco','Moderadamente','Bastante','Extremamente']],
 ...['cheio de vigor, cheio de vontade, cheio de força','uma pessoa muito nervosa','tão deprimido que nada pode animá-lo','calmo ou tranquilo','com muita energia','desanimado e abatido','esgotado','uma pessoa feliz','cansado'].map(t=>['Durante as últimas 4 semanas, quanto tempo você tem se sentido '+t+'?',RAND_FREQ]),
 ['Durante as últimas 4 semanas, quanto do seu tempo a sua saúde física ou problemas emocionais interferiram com as suas atividades sociais (como visitar amigos, parentes, etc.)?',['Todo o tempo','A maior parte do tempo','Alguma parte do tempo','Uma pequena parte do tempo','Nenhuma parte do tempo']],
 ...['Eu costumo adoecer um pouco mais facilmente que as outras pessoas','Eu sou tão saudável quanto qualquer pessoa que eu conheço','Eu acho que a minha saúde vai piorar','Minha saúde é excelente'].map(t=>['O quanto verdadeiro ou falso é: '+t+'?',RAND_TRUE])],
 complete:a=>Object.values(RAND_GROUPS).every(g=>g.some(n=>Number.isInteger(a[n-1]))),
 score:a=>{
  const recoded=a.map((v,i)=>Number.isInteger(v)?RAND_MAPS[i][v]:null);
  const domainCounts={};
  const metrics=Object.entries(RAND_GROUPS).map(([name,indices])=>{const values=indices.map(n=>recoded[n-1]).filter(v=>v!==null);domainCounts[name]={answered:values.length,total:indices.length};return metric(name,sum(values)/values.length,100,'Maior = melhor estado de saúde',{answered:values.length,items:indices.length});});
  return {metrics,calculation:{method:'RAND 1.0: recodificação item a item e média dos itens respondidos em cada domínio',recoded,domainCounts,healthChangeItem2:recoded[1],noGlobalScore:true},interpretation:'O item 2 descreve mudança de saúde e não integra os oito domínios. Não há score global RAND-36 nesta aplicação.'};
 }
},{version:'RAND36-1.0-BR-Ciconelli-LinsKusterer2022-v1',licenseStatus:'RAND_PERMISSION_NO_WRITTEN_LICENSE',minAnswered:8,source:'https://www.rand.org/health/surveys/mos/36-item-short-form/scoring.html',brazilSource:'https://doi.org/10.1590/S0004-2803.202202000-36',missing:'Média dos itens disponíveis por domínio, conforme RAND; exige ao menos um em cada domínio para liberar este relatório. Exibe n/total; nenhuma imputação. Item 2 não entra nos domínios.',note:'RAND Medical Outcomes Study; termos: https://www.rand.org/health/surveys/mos/36-item-short-form/terms.html. A apresentação em telas é uma transposição eletrônica; os testes computacionais não constituem nova validação psicométrica.'});
CURRENT_VALIDATED_INSTRUMENTS.sf36.answerPolicy.allowNA=true;

const WAI_DISEASES=['Lesão nas costas','Lesão nos braços/mãos','Lesão nas pernas/pés','Lesão em outras partes do corpo','Doença da parte superior das costas ou região do pescoço, com dores frequentes','Doença da parte inferior das costas com dores frequentes','Dor nas costas que se irradia para a perna (ciática)','Doença musculoesquelética afetando os membros (braços e pernas) com dores frequentes','Artrite reumatoide','Outra doença musculoesquelética','Hipertensão arterial (pressão alta)','Doença coronariana, dor no peito durante exercício (angina pectoris)','Infarto do miocárdio, trombose coronariana','Insuficiência cardíaca','Outra doença cardiovascular','Infecções repetidas do trato respiratório (incluindo amigdalite, sinusite aguda, bronquite aguda)','Bronquite crônica','Sinusite crônica','Asma','Enfisema','Tuberculose pulmonar','Outra doença respiratória','Distúrbio emocional severo (ex.: depressão severa)','Distúrbio emocional leve (ex.: depressão leve, tensão, ansiedade, insônia)','Problema ou diminuição da audição','Doença ou lesão da visão (não assinale se apenas usa óculos ou lentes de contato de grau)','Doença neurológica (AVC ou derrame, neuralgia, enxaqueca, epilepsia)','Outra doença neurológica ou dos órgãos dos sentidos','Pedras ou doença da vesícula biliar','Doença do pâncreas ou do fígado','Úlcera gástrica ou duodenal','Gastrite ou irritação duodenal','Colite ou irritação do cólon','Outra doença digestiva','Infecção das vias urinárias','Doença dos rins','Doença nos genitais e aparelho reprodutor (p. ex.: problema nas trompas ou na próstata)','Outra doença geniturinária','Alergia, eczema','Outra erupção','Outra doença da pele','Tumor benigno','Tumor maligno (câncer)','Obesidade','Diabetes','Bócio ou outra doença da tireoide','Outra doença endócrina ou metabólica','Anemia','Outra doença do sangue','Defeito de nascimento','Outro problema ou doença'];
const WAI_DETAILS=[3,9,14,21,27,33,37,39,40,42,46,48,50];
const WAI_IMPAIR=['Não há impedimento / Eu não tenho doenças','Eu sou capaz de fazer meu trabalho, mas ele me causa alguns sintomas','Algumas vezes preciso diminuir meu ritmo de trabalho ou mudar meus métodos de trabalho','Frequentemente preciso diminuir meu ritmo de trabalho ou mudar meus métodos de trabalho','Por causa de minha doença sinto-me capaz de trabalhar apenas em tempo parcial','Em minha opinião estou totalmente incapacitado para trabalhar'];
register('ict',{
 title:'ICT / WAI — Índice de Capacidade para o Trabalho',type:'sections',special:{4:'diseases',5:'multi'},
 intro:'Responda sobre seu trabalho atual e sua saúde. A lista de doenças distingue sua opinião de diagnóstico médico. O índice é uma medida de capacidade autorreferida; não determina aptidão ou incapacidade laboral pericial automaticamente.',
 data:[
 ['Seu trabalho exige principalmente:',['Esforço mental','Esforço físico','Esforços físico e mental']],
 ['Suponha que a sua melhor capacidade para o trabalho tem um valor igual a 10 pontos. Numa escala de zero a dez, quantos pontos você daria para a sua capacidade de trabalho atual?',numbers(10)],
 ['Como você classificaria sua capacidade atual para o trabalho em relação às exigências físicas do seu trabalho? (Por exemplo, fazer esforço físico com partes do corpo).',['Muito baixa','Baixa','Moderada','Boa','Muito boa']],
 ['Como você classificaria sua capacidade atual para o trabalho em relação às exigências mentais do seu trabalho? (Por exemplo, interpretar fatos, resolver problemas, decidir a melhor forma de fazer).',['Muito baixa','Baixa','Moderada','Boa','Muito boa']],
 ['Em sua opinião quais das lesões por acidentes ou doenças citadas abaixo você possui ATUALMENTE? Marque também aquelas que foram confirmadas pelo médico.',[]],
 ['Sua lesão ou doença é um impedimento para seu trabalho atual? Você pode marcar mais de uma resposta.',WAI_IMPAIR],
 ['Quantos DIAS INTEIROS você esteve fora do trabalho devido a problema de saúde, consulta médica ou para fazer exame durante os últimos 12 meses?',['Nenhum','Até 9 dias','De 10 a 24 dias','De 25 a 99 dias','100 a 365 dias']],
 ['Considerando sua saúde, você acha que será capaz de DAQUI A 2 ANOS fazer seu trabalho atual?',['É improvável','Não estou muito certo','Bastante provável']],
 ['Você tem conseguido apreciar (se sentir satisfeito com) suas atividades diárias?',['Nunca','Raramente','Às vezes','Quase sempre','Sempre']],
 ['Você tem se sentido ativo e alerta?',['Nunca','Raramente','Às vezes','Quase sempre','Sempre']],
 ['Você tem se sentido cheio de esperança para o futuro?',['Nunca','Raramente','Às vezes','Quase sempre','Continuamente']]],
 validateItem(i,v){
  if(i===4) return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='details,entries'&&Array.isArray(v.entries)&&v.entries.length===51&&v.entries.every(n=>n===null||Number.isInteger(n)&&n>=0&&n<=3)&&!!v.details&&typeof v.details==='object'&&!Array.isArray(v.details)&&Object.entries(v.details).every(([k,t])=>WAI_DETAILS.includes(Number(k))&&String(Number(k))===k&&typeof t==='string'&&t.length<=1000);
  if(i===5) return Array.isArray(v)&&new Set(v).size===v.length&&v.every(n=>Number.isInteger(n)&&n>=0&&n<6);
  return Number.isInteger(v)&&v>=0&&v<this.data[i][1].length;
 },
 isItemComplete(i,v){
  if(v===null||v===undefined) return false;
  if(i===4) return v.entries.every(Number.isInteger)&&WAI_DETAILS.every(n=>v.entries[n]===0||!!v.details[n]?.trim());
  if(i===5) return v.length>0;
  return Number.isInteger(v);
 },
 complete(a){return a.every((v,i)=>this.isItemComplete(i,v));},
 score:a=>{
  const p=a[2]+1,m=a[3]+1,demands=a[0]===0?p*.5+m*1.5:a[0]===1?p*1.5+m*.5:p+m;
  const diseases=a[4].entries.filter(v=>v>=2).length, diseasePoints=[7,5,4,3,2,1][Math.min(5,diseases)];
  const impairment=6-Math.max(...a[5]),mental=sum(a.slice(8)),resources=mental<=3?1:mental<=6?2:mental<=9?3:4;
  const beforeRounding=a[1]+demands+diseasePoints+impairment+(5-a[6])+[1,4,7][a[7]]+resources,raw=Math.round(beforeRounding);
  return {metrics:[metric('ICT/WAI',raw,49,'Maior = melhor capacidade autorreferida para o trabalho')],calculation:{current:a[1],demands,diagnosedDiseases:diseases,diseasePoints,impairment,sickLeave:5-a[6],prognosis:[1,4,7][a[7]],mentalSum:mental,resources,beforeRounding,rounding:'Meio ponto arredondado para o inteiro superior'},interpretation:'Categoria histórica do ICT: '+(raw<=27?'baixa':raw<=36?'moderada':raw<=43?'boa':'ótima')+'. Não equivale a conclusão pericial de aptidão ou incapacidade.'};
 }
},{version:'ICT-BR-Tuomi-51diseases-WAI1998-v1',licenseStatus:'FIOH_OWN_OPERATIONS_PERMITTED',source:'https://www.ttl.fi/en/themes/well-being-at-work-and-work-ability/tyokyky/using-the-work-ability-index-wai',brazilSource:'https://doi.org/10.1590/S0034-89102009005000017',missing:'Exige todos os componentes, 51 marcações da lista e descrição das opções abertas assinaladas. Sem imputação.',note:'Tuomi et al.; versão brasileira reproduzida no anexo A de Castro (UFPE, 2017). Algoritmo do manual WAI 1998; só conta diagnósticos médicos. Uso próprio autorizado pelo FIOH; o método não pode ser vendido como tal.'});

register('csi',{
 title:'BP-CSI — Inventário de Sensibilização Central, parte A',type:'likert',
 intro:'Os sintomas avaliados por este questionário se referem a sua presença diária ou na maioria dos dias dos últimos três meses. Selecione a melhor resposta para cada questão. Parte A: 25 itens; a parte B de diagnósticos não integra esta aplicação nem o escore.',
 items:['Sinto-me cansado(a) ao acordar pela manhã.','Sinto que minha musculatura está enrijecida e dolorida.','Tenho crises de ansiedade.','Costumo apertar (ranger) os dentes.','Tenho diarreia e/ou prisão de ventre.','Preciso de ajuda para fazer as tarefas diárias.','Sou sensível à luminosidade excessiva.','Canso-me facilmente ao realizar atividades diárias que exigem algum esforço físico.','Sinto dor em todo o corpo.','Tenho dores de cabeça.','Sinto desconforto e/ou ardência ao urinar.','Durmo mal.','Tenho dificuldade para me concentrar.','Tenho problemas de pele como ressecamento, coceira e vermelhidão.','O estresse piora meus sintomas.','Me sinto triste ou deprimido(a).','Tenho pouca energia.','Tenho tensão muscular no pescoço e nos ombros.','Tenho dor no queixo.','Fico enjoado(a) e tonto(a) com cheiros como o de perfumes.','Preciso urinar frequentemente.','Quando vou dormir à noite sinto minhas pernas inquietas e desconfortáveis.','Tenho dificuldade para me lembrar das coisas.','Sofri trauma emocional na infância.','Tenho dor na região pélvica.'],
 opts:['Nunca','Raramente','Às vezes','Frequentemente','Sempre'],
 score:a=>({metrics:[metric('BP-CSI — parte A',sum(a),100,'Maior = maior carga de sintomas autorreferidos')],calculation:{sum:sum(a),denominator:100},interpretation:'O escore não estabelece mecanismo de dor nem diagnóstico de sensibilização central isoladamente.'})
},{version:'BP-CSI-Caumo2017-PartA25-v1',licenseStatus:'AUTHOR_DISTRIBUTED_FORM',source:'https://frius.com/questionnaires/',brazilSource:'https://doi.org/10.2147/JPR.S131479',missing:'25/25; sem imputação.',note:'Formulário brasileiro disponibilizado pelo grupo desenvolvedor FRIUS; Caumo et al., UFRGS/HCPA. Sem reprodução da parte B ou classificação diagnóstica automática.'});

register('spadi',{
 title:'SPADI-Brasil — Índice de Dor e Incapacidade do Ombro',type:'likert',
 about:'Sobre dor e dificuldade no ombro afetado, na semana passada.',
 intro:'Pense apenas na SEMANA PASSADA e no seu braço/ombro afetado. Dê uma nota de 0 a 10 para cada pergunta. Use "não se aplica" somente se a atividade não faz parte da sua rotina; se você só não fez por acaso, estime a nota que daria.',
 items:['Qual a intensidade da sua dor quando foi a pior na semana passada?','Durante a semana passada, qual a gravidade da sua dor quando se deitou em cima do braço afetado?','Durante a semana passada, qual a gravidade da sua dor quando tentou pegar algo em uma prateleira alta com o braço afetado?','Durante a semana passada, qual a gravidade da sua dor quando tentou tocar a parte de trás do pescoço com o braço afetado?','Durante a semana passada, qual a gravidade da sua dor quando tentou empurrar algo com o braço afetado?','Durante a semana passada, qual o grau de dificuldade que você teve para lavar seu cabelo com o braço afetado?','Durante a semana passada, qual o grau de dificuldade que você teve para lavar suas costas com o braço afetado?','Durante a semana passada, qual o grau de dificuldade que você teve para vestir uma camiseta ou blusa pela cabeça?','Durante a semana passada, qual o grau de dificuldade que você teve para vestir uma camisa que abotoa na frente?','Durante a semana passada, qual o grau de dificuldade que você teve para vestir suas calças?','Durante a semana passada, qual o grau de dificuldade que você teve para colocar algo em uma prateleira alta com o braço afetado?','Durante a semana passada, qual o grau de dificuldade que você teve para carregar um objeto pesado de 5kg (saco grande de arroz) com o braço afetado?','Durante a semana passada, qual o grau de dificuldade que você teve para retirar algo de seu bolso de trás com o braço afetado?'],
 optsPerItem:[...Array(5).fill(['0 — Sem dor','1','2','3','4','5','6','7','8','9','10 — Pior dor imaginável']),...Array(8).fill(['0 — Sem dificuldade','1','2','3','4','5','6','7','8','9','10 — Não conseguiu fazer'])],
 complete:a=>a.every(v=>Number.isInteger(v)||v==='NA')&&a.slice(0,5).some(Number.isInteger)&&a.slice(5).some(Number.isInteger),
 score:a=>{
  const part=(arr)=>{const v=arr.filter(Number.isInteger);return {sum:sum(v),max:v.length*10,na:arr.length-v.length};};
  const d=part(a.slice(0,5)),i=part(a.slice(5)),t=part(a);
  const pct=x=>x.sum/x.max*100;
  return {metrics:[metric('SPADI — dor',pct(d),100,'Maior = pior (0–100%)',{answered:5-d.na,items:5}),metric('SPADI — incapacidade',pct(i),100,'Maior = pior (0–100%)',{answered:8-i.na,items:8}),metric('SPADI — total',pct(t),100,'Maior = pior (0–100%)',{answered:13-t.na,items:13})],
   calculation:{painSum:d.sum,painMax:d.max,disabilitySum:i.sum,disabilityMax:i.max,totalSum:t.sum,totalMax:t.max,formula:'Soma dos itens ÷ pontuação máxima possível × 100, em cada escala e no total; itens "não se aplica" saem do máximo possível (instrução da versão brasileira).'},
   interpretation:'Sem faixas oficiais de gravidade. Os autores da versão brasileira desaconselham interpretar itens isolados; usar as escalas e o total.'};}
},{version:'SPADI-Brasil-Martins2010-v1',licenseStatus:'CC_BY_NC_ARTICLE',source:'https://doi.org/10.1016/0739-4117(91)90019-S',brazilSource:'https://doi.org/10.1590/S1413-35552010000600012',missing:'Todos os 13 itens com nota ou "não se aplica"; cada escala precisa de pelo menos um item com nota.',minAnswered:0,note:'Itens exatos da versão brasileira (Martins et al., 2010, Rev Bras Fisioter, artigo aberto CC BY-NC). A licença CC BY-NC permite reprodução com atribuição e sem finalidade comercial. Os autores validaram a aplicação por entrevista; no autopreenchimento, a instrução sobre "semana passada" e "não se aplica" foi reforçada.'});
CURRENT_VALIDATED_INSTRUMENTS.spadi.answerPolicy.allowNA=true;

register('whodas',{
 title:'WHODAS 2.0 — versão de 12 itens, auto-administrada',type:'likert',
 about:'Sobre dificuldades nas suas atividades por causa da sua saúde, nos últimos 30 dias.',
 intro:'Este questionário pergunta sobre dificuldades decorrentes de condições de saúde. Condições de saúde incluem doenças ou enfermidades, outros problemas de saúde de curta ou longa duração, lesões, problemas mentais ou emocionais, e problemas com álcool ou drogas. Pense nos últimos 30 dias e responda as questões, pensando sobre quanta dificuldade você tem nas atividades a seguir. Para cada questão, por favor, marque uma resposta.',
 items:['Nos últimos 30 dias, quanta dificuldade você teve em: ficar em pé por longos períodos como 30 minutos?','Nos últimos 30 dias, quanta dificuldade você teve em: cuidar das suas responsabilidades domésticas?','Nos últimos 30 dias, quanta dificuldade você teve em: aprender uma nova tarefa, por exemplo, como chegar a um lugar desconhecido?','Nos últimos 30 dias, quanta dificuldade você teve ao participar em atividades comunitárias (por exemplo, festividades, atividades religiosas ou outra atividade) do mesmo modo que qualquer outra pessoa?','Nos últimos 30 dias, quanto você tem sido emocionalmente afetado por seus problemas de saúde?','Nos últimos 30 dias, quanta dificuldade você teve em: concentrar-se para fazer alguma coisa durante dez minutos?','Nos últimos 30 dias, quanta dificuldade você teve em: andar por longas distâncias como por 1 quilômetro?','Nos últimos 30 dias, quanta dificuldade você teve em: lavar seu corpo inteiro?','Nos últimos 30 dias, quanta dificuldade você teve em: vestir-se?','Nos últimos 30 dias, quanta dificuldade você teve em: lidar com pessoas que você não conhece?','Nos últimos 30 dias, quanta dificuldade você teve em: manter uma amizade?','Nos últimos 30 dias, quanta dificuldade você teve em: seu dia-a-dia no trabalho?'],
 opts:['Nenhuma','Leve','Moderada','Grave','Extrema ou não consegue fazer'],
 complete:a=>a.filter(v=>v===null).length<=1,
 score:a=>{
  const answered=a.filter(Number.isInteger).map(v=>v+1);
  const missing=a.length-answered.length;
  const mean=answered.reduce((s,v)=>s+v,0)/answered.length;
  const total=answered.reduce((s,v)=>s+v,0)+(missing?mean:0);
  return {metrics:[metric('WHODAS 2.0 (12 itens) — pontuação simples',total,60,'Maior = maior dificuldade (mínimo 12)',{min:12,answered:answered.length,items:12})],
   calculation:{sum:answered.reduce((s,v)=>s+v,0),imputedItems:missing,imputedValue:missing?mean:null,formula:'Soma dos 12 itens (Nenhuma=1 … Extrema=5); com 1 item em branco, ele recebe a média dos outros 11 (regra do manual da OMS). Com 2 ou mais em branco, não há escore.'},
   interpretation:'Pontuação simples do manual da OMS (12–60). O próprio manual adverte que a pontuação simples é específica da amostra e não deve ser comparada entre populações; não há faixas oficiais de gravidade para ela. A pontuação complexa (0–100, baseada em teoria de resposta ao item) não é calculada aqui.'};}
},{version:'WHODAS2-12itens-auto-OMS-UFTM2015-v1',licenseStatus:'WHO_OFFICIAL_PT_BR_MANUAL',source:'https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health/who-disability-assessment-schedule',brazilSource:'ISBN 978-85-62599-51-4 (OMS/UFTM, 2015)',missing:'No máximo 1 item em branco (imputado pela média dos demais); 2 ou mais em branco = sem escore.',minAnswered:11,note:'Texto da versão de 12 itens auto-administrada do manual oficial em português (OMS 2010; tradução autorizada UFTM, Castro & Leite, 2015). As perguntas H1–H3 (número de dias), que não entram no escore, não foram incluídas. A OMS pede solicitação de permissão (permissions@who.int) para reprodução.'});

register('phq9',{
 title:'PHQ-9 — Questionário sobre a Saúde do Paciente (depressão)',type:'likert',
 about:'Sobre como você tem se sentido emocionalmente nas últimas duas semanas.',
 intro:'Durante as duas últimas semanas, com que frequência você foi incomodado/a por qualquer um dos problemas abaixo?',
 items:['Pouco interesse ou pouco prazer em fazer as coisas','Se sentir “para baixo”, deprimido/a ou sem perspectiva','Dificuldade para pegar no sono ou permanecer dormindo, ou dormir mais do que de costume','Se sentir cansado/a ou com pouca energia','Falta de apetite ou comendo demais','Se sentir mal consigo mesmo/a — ou achar que você é um fracasso ou que decepcionou sua família ou você mesmo/a','Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão','Lentidão para se movimentar ou falar, a ponto das outras pessoas perceberem? Ou o oposto – estar tão agitado/a ou irrequieto/a que você fica andando de um lado para o outro muito mais do que de costume','Pensar em se ferir de alguma maneira ou que seria melhor estar morto/a'],
 opts:["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"],
 score:a=>{const s=sum(a);const band=s<=4?'sintomas mínimos (0–4)':s<=9?'sintomas leves (5–9)':s<=14?'sintomas moderados (10–14)':s<=19?'sintomas moderadamente graves (15–19)':'sintomas graves (20–27)';
  return {metrics:[metric('PHQ-9',s,27,'Maior = maior intensidade de sintomas depressivos')],calculation:{sum:s,formula:'Soma dos 9 itens (0–3 cada)',denominator:27},
   interpretation:'Faixa descrita pelos autores (Kroenke et al., 2001): '+band+'. Instrumento de rastreio; não estabelece diagnóstico isoladamente.'+(a[8]>0?' ATENÇÃO: item 9 (pensamentos de se ferir ou de morte) respondido acima de zero — requer avaliação clínica direta e orientação de busca de cuidado em saúde mental.':'')};}
},{version:'PHQ9-ptBR-Pfizer-Santos2013-v1',licenseStatus:'PUBLIC_DOMAIN',source:'https://www.phqscreeners.com',brazilSource:'https://doi.org/10.1590/0102-311X00144612',missing:'9/9; sem imputação.',note:'Domínio público: os autores/Pfizer dispensam permissão para reproduzir, traduzir e exibir. Versão brasileira validada por Santos et al. (2013). A 10ª pergunta (impacto funcional), que não entra no escore, não foi incluída.'});

register('gad7',{
 title:'GAD-7 — Escala de Ansiedade Generalizada',type:'likert',
 about:'Sobre preocupação e ansiedade nas últimas duas semanas.',
 intro:'Durante as duas últimas semanas, com que frequência você foi incomodado/a por qualquer um dos problemas abaixo?',
 items:['Sentir-se nervoso, ansioso ou no limite','Não ser capaz de parar ou controlar a preocupação','Preocupar-se muito com coisas diferentes','Problemas para relaxar','Sentir-se tão inquieto a ponto de ser difícil ficar parado','Tornar-se facilmente aborrecido ou irritado','Sentir medo, como se algo terrível pudesse acontecer'],
 opts:["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"],
 score:a=>{const s=sum(a);const band=s<=4?'sintomas mínimos (0–4)':s<=9?'sintomas leves (5–9)':s<=14?'sintomas moderados (10–14)':'sintomas graves (15–21)';
  return {metrics:[metric('GAD-7',s,21,'Maior = maior intensidade de sintomas ansiosos')],calculation:{sum:s,formula:'Soma dos 7 itens (0–3 cada)',denominator:21},
   interpretation:'Faixa descrita pelos autores (Spitzer et al., 2006): '+band+'. Ponto de corte de rastreio positivo proposto pelos autores: ≥10. Instrumento de rastreio; não estabelece diagnóstico isoladamente.'};}
},{version:'GAD7-ptBR-Pfizer-Moreno2016-v1',licenseStatus:'PUBLIC_DOMAIN',source:'https://www.phqscreeners.com',brazilSource:'https://doi.org/10.9788/TP2016.1-25',missing:'7/7; sem imputação.',note:'Domínio público: os autores/Pfizer dispensam permissão para reproduzir, traduzir e exibir. Versão brasileira estudada por Moreno et al. (2016). A 8ª pergunta (impacto funcional), que não entra no escore, não foi incluída.'});

register('tsk13',{
 title:'TSK-13 Brasil — Escala Tampa de Cinesiofobia',type:'likert',
 intro:'Indique o quanto você concorda com cada afirmação. Versão de 13 itens; a evidência brasileira específica citada para esta versão foi obtida em adultos com enxaqueca.',
 items:['Tenho medo de me machucar, se eu fizer exercícios.','Se eu tentasse superar esse medo, minha dor aumentaria.','Meu corpo está dizendo que alguma coisa muito errada está acontecendo comigo.','As pessoas não estão levando minha condição médica a sério.','A lesão colocou meu corpo em risco para o resto da minha vida.','A dor sempre significa que o meu corpo está machucado.','Tenho medo de que eu possa me machucar acidentalmente.','A atitude mais segura que posso tomar para prevenir a piora da minha dor é, simplesmente, ser cuidadoso para não fazer nenhum movimento desnecessário.','Eu não teria tanta dor se algo realmente perigoso não estivesse acontecendo no meu corpo.','A dor me avisa quando devo parar o exercício para eu não me machucar.','Não é realmente seguro para uma pessoa, com problemas iguais aos meus, ser ativo fisicamente.','Não posso fazer todas as coisas que as pessoas normais fazem, pois me machuco facilmente.','Ninguém deveria fazer exercícios, quando está com dor.'],
 opts:['Discordo totalmente','Discordo parcialmente','Concordo parcialmente','Concordo totalmente'],
 score:a=>({metrics:[metric('TSK-13',sum(a)+13,52,'Maior = maior medo do movimento',{min:13})],calculation:{originalItemNumbers:[1,2,3,5,6,7,9,10,11,13,14,15,17],reversedItems:[],formula:'Soma de 13 respostas recodificadas para 1–4'},interpretation:'Sem ponto de corte universal. A versão de 13 itens exclui os quatro itens reversos da TSK-17.'})
},{version:'TSK13-BR-Siqueira2007-migraine2024-v1',licenseStatus:'PUBLISHED_CC_BY_FORM',source:'https://doi.org/10.1590/S1413-78522007000100004',brazilSource:'https://pmc.ncbi.nlm.nih.gov/articles/PMC11327810/',missing:'13/13; sem imputação.',note:'Texto brasileiro de Siqueira et al.; seleção de 13 itens conforme estudo de 2024 em enxaqueca. Não extrapolar a validade para toda população pericial.'});

register('dn4',{
 title:'DN4-interview — 7 itens',type:'yesno',
 intro:'Responda sobre a mesma região dolorosa em todas as questões. Os três primeiros itens descrevem características da dor; os quatro últimos, sintomas associados nessa região. Esta aplicação não inclui exame sensitivo.',
 items:['A sua dor tem a característica: queimação?','A sua dor tem a característica: sensação de frio dolorosa?','A sua dor tem a característica: choque elétrico?','Há formigamento na mesma região da dor?','Há alfinetada e agulhada na mesma região da dor?','Há dormência na mesma região da dor?','Há coceira na mesma região da dor?'],
 score:a=>({metrics:[metric('DN4-interview',sum(a),7,'Maior = mais descritores neuropáticos')],calculation:{positiveAnswers:sum(a),cutoff:3},interpretation:sum(a)>=3?'Resultado sugestivo de componente neuropático (≥ 3/7); não estabelece diagnóstico.':'Abaixo do ponto de corte de 3/7; não exclui componente neuropático.'})
},{version:'DN4i-BR-7-fracture2024-v1',licenseStatus:'CLINICAL_TOOL_SFETD',source:'https://www.sfetd-douleur.org/outils-specifiques/',brazilSource:'https://doi.org/10.1055/s-0044-1779686',missing:'7/7; sem imputação.',note:'DN4i: apenas entrevista, sem os três itens de exame do DN4 completo. Estudo brasileiro de 2024 após cirurgia de fratura; não confundir corte ≥3/7 com ≥4/10.'});

const WIQ_WEIGHTS=[[20,50,150,300,600,900,1500],[1.5,2,3,5],[12,24,36]];
register('wiq',{
 title:'WIQ Brasil — distância, velocidade e escadas',type:'likert',
 intro:'Informe o grau de dificuldade no último mês. Nas questões de distância, considere superfície plana, sem parar para descansar. Nas questões de velocidade, considere caminhar um quarteirão. Nas questões de escadas, considere subir sem parar para descansar. Esta aplicação contém os 14 itens dos três domínios funcionais pontuados.',
 items:['Caminhar em lugares fechados, como dentro de casa?','Caminhar 5 metros?','Caminhar 45 metros (meio quarteirão)?','Caminhar 90 metros (um quarteirão)?','Caminhar 180 metros (dois quarteirões)?','Caminhar 270 metros (três quarteirões)?','Caminhar 450 metros (cinco quarteirões)?','Caminhar um quarteirão lentamente (2,4 km/h)?','Caminhar um quarteirão em velocidade média (3,2 km/h)?','Caminhar um quarteirão rapidamente (4,8 km/h)?','Correr um quarteirão (8 km/h)?','Subir um lance de escada (8 degraus)?','Subir dois lances de escada (16 degraus)?','Subir três lances de escada (24 degraus)?'],
 opts:['Nenhuma','Leve','Razoável','Muita','Incapaz'],
 score:a=>{
  const groups=[a.slice(0,7),a.slice(7,11),a.slice(11,14)],names=['WIQ distância','WIQ velocidade','WIQ escadas'];
  const numerators=groups.map((g,d)=>sum(g.map((v,i)=>(4-v)*WIQ_WEIGHTS[d][i]))),denominators=WIQ_WEIGHTS.map(w=>4*sum(w));
  return {metrics:numerators.map((v,i)=>metric(names[i],v/denominators[i]*100,100,'Maior = melhor capacidade de marcha')),calculation:{numerators,denominators,weights:WIQ_WEIGHTS,noGlobalScore:true}};
 }
},{version:'WIQ-BR-RittiDias2009-functional14-v1',licenseStatus:'PUBLISHED_CC_BY_FORM',source:'https://doi.org/10.1590/S0066-782X2009000200011',brazilSource:'https://doi.org/10.1590/S0066-782X2009000200011',missing:'14/14 nos domínios funcionais; sem imputação.',note:'Preserva as distâncias publicadas na versão brasileira, inclusive 5 m no segundo item. Não inclui o bloco descritivo de diagnóstico diferencial; não produz total WIQ.'});

const NMQ_FIELDS={y12:'Nos últimos 12 meses, você teve problemas (como dor, formigamento/dormência) nesta região?',impede:'Nos últimos 12 meses, você foi impedido(a) de realizar atividades normais (por exemplo: trabalho, atividades domésticas e de lazer) por causa desse problema nesta região?',care:'Nos últimos 12 meses, você consultou algum profissional da área da saúde (médico, fisioterapeuta) por causa dessa condição nesta região?',y7:'Nos últimos 7 dias, você teve algum problema nesta região?'};
register('nmq',{
 title:'QNSO / NMQ — sintomas por região',type:'nmq',
 intro:'Responda às quatro perguntas para cada região do corpo. Considere os períodos indicados em cada pergunta. O questionário não gera score global nem diagnóstico.',
 items:['Pescoço','Ombros','Parte superior das costas','Cotovelos','Punhos/mãos','Parte inferior das costas','Quadris/coxas','Joelhos','Tornozelos/pés'],
 validateItem:(i,v)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='care,impede,y12,y7'&&Object.keys(NMQ_FIELDS).every(f=>v[f]===null||v[f]===0||v[f]===1),
 isItemComplete:(i,v)=>!!v&&Object.keys(NMQ_FIELDS).every(f=>v[f]===0||v[f]===1),
 complete(a){return a.every((v,i)=>this.isItemComplete(i,v));},
 score:a=>({metrics:[],calculation:{noGlobalScore:true,regions:cloneAnswers(a)},interpretation:'Resultado por região e período, sem soma global.'})
},{version:'NMQ-BR-BarrosAlexandre2003-9x4-v1',licenseStatus:'PUBLISHED_ACADEMIC_CLINICAL_FORM',source:'https://doi.org/10.1016/0003-6870(87)90010-X',brazilSource:'https://doi.org/10.1046/j.1466-7657.2003.00188.x',missing:'Exige quatro respostas explícitas por região; ausências não são convertidas em Não.',note:'Versão brasileira de nove regiões e quatro questões. Não confundir com o agrupamento de sete regiões de Pinheiro et al. (2002).'});

register('chalder',{
 title:'CFQ-11 Brasil — Chalder (bimodal)',type:'likert',
 intro:'Gostaríamos de saber se você tem tido algum problema de cansaço, fraqueza ou falta de energia NO ÚLTIMO MÊS. Se você vem se sentindo cansado há muito tempo, compare seu estado atual com a última vez que se sentiu bem.',
 items:['Você tem problema de cansaço ou fraqueza?','Você precisa descansar mais?','Você se sente sonolento?','Você tem dificuldade para começar suas atividades?','Você sente falta de energia?','Você está com pouca força muscular?','Você se sente fraco?','Você tem dificuldade para se concentrar?','Você troca as palavras sem querer quando está falando?','Você acha difícil encontrar as palavras certas?','Como está sua memória?'],
 optsPerItem:Array.from({length:11},(_,i)=>[5,10].includes(i)?['Melhor que de costume','Como de costume','Pior que de costume','Muito pior que de costume']:['Menos que de costume','Como de costume','Mais que de costume','Muito mais que de costume']),
 score:a=>({metrics:[metric('CFQ-11 — bimodal',sum(a.map(v=>v>=2?1:0)),11,'Maior = mais sintomas de fadiga')],calculation:{recoding:[0,0,1,1],cutoff:4,method:'Bimodal; não é a soma Likert 0–33'},interpretation:sum(a.map(v=>v>=2?1:0))>=4?'≥4/11: rastreio positivo para fadiga substancial no contexto de atenção primária estudado por Cho et al.; não diagnostica síndrome de fadiga crônica.':'<4/11: abaixo do ponto de corte de Cho et al. para atenção primária; não exclui doença.'})
},{version:'CFQ11-BR-Cho2007-bimodal-v1',licenseStatus:'FREE_USE_ACR_REVIEW',source:'https://www.researchgate.net/publication/276206042_Brazilian_Portuguese_Version_of_Chalder_Fatigue_Questionnaire',brazilSource:'https://doi.org/10.1016/j.jpsychores.2006.10.018',missing:'11/11; sem imputação.',note:'Formulário disponibilizado pelo autor Joshua Hyong-Jin Cho. Escore dos 11 itens de fadiga, sem questões complementares de mialgia/duração. Uso gratuito descrito em doi:10.1002/acr.24246; não afirma domínio público.'});
register('comi',{
 title:'COMI lombar — português brasileiro',type:'sections',
 intro:'Problemas de coluna podem levar a dor nas costas e/ou nas pernas e nádegas, assim como distúrbios sensoriais tais como formigamento, pontadas ou dormência nessas regiões. Observe o período indicado: uma semana para dor/função/qualidade de vida e quatro semanas para restrição de atividades. Escalas de dor: 0 = sem dor; 10 = a pior dor que você pode imaginar.',
 data:[
 ['Qual dos seguintes problemas o incomoda mais?',['Dor nas costas','Dor na perna/nádega','Distúrbios sensoriais nas costas, pernas ou nádegas (formigamento, pontadas, dormência)','Nenhuma das acima']],
 ['Quão severa foi a sua dor nas costas na semana passada?',numbers(10)],
 ['Quão severa foi a sua dor na perna na semana passada?',numbers(10)],
 ['Durante a semana passada, quanto o seu problema nas costas interferiu no seu trabalho normal (incluindo trabalho fora de casa e as atividades domésticas)?',['Não interferiu','Um pouco','Moderadamente','Muito','Extremamente']],
 ['Se você tivesse que passar o resto da sua vida com os sintomas que você tem agora, como você se sentiria a respeito?',['Muito satisfeito','Um pouco satisfeito','Nem satisfeito, nem insatisfeito','Um pouco insatisfeito','Muito insatisfeito']],
 ['Por favor, pense sobre a semana passada. Como você avaliaria a sua qualidade de vida?',['Muito boa','Boa','Moderada','Ruim','Muito ruim']],
 ['Durante as últimas quatro semanas, em quantos dias você diminuiu as atividades que você geralmente faz (trabalho, tarefas domésticas, escola, lazer) por causa do seu problema nas costas?',['Nenhum','Entre 1 e 7 dias','Entre 8 e 14 dias','Entre 15 e 21 dias','Mais do que 21 dias']],
 ['Durante as últimas quatro semanas, por quantos dias o seu problema nas costas lhe impediu de fazer algo (trabalho, escola, tarefas domésticas)?',['Nenhum','Entre 1 e 7 dias','Entre 8 e 14 dias','Entre 15 e 21 dias','Mais do que 21 dias']]],
 score:a=>{
  const domains=[Math.max(a[1],a[2]),a[3]*2.5,a[4]*2.5,a[5]*2.5,(a[6]+a[7])*1.25];
  return {metrics:[metric('COMI lombar',sum(domains)/5,10,'Maior = maior impacto dos problemas lombares')],calculation:{domains,denominator:5,pain:'Máximo entre dor nas costas e perna',disability:'Média dos dois itens de restrição, após recodificação 0–10',excluded:[1]},interpretation:'Sem categorias universais de gravidade. Não equivale a incapacidade laboral.'};
 }
},{version:'COMI-back-BR-Damasceno2012-SpineTango-v1',licenseStatus:'EUROSPINE_CLINICAL_DOWNLOAD',source:'https://www.eurospine.org/quality-assurance/spine-tango-registry/faq-and-resources/clinical-forms/',brazilSource:'https://doi.org/10.1007/s00586-011-2100-3',missing:'Todos os sete itens pontuados mais o item descritivo inicial; sem normalização de formulário incompleto.',note:'Formulário de autoavaliação COMI lombar 2012, distribuído pela EUROSPINE para prática clínica. Sete itens pontuados em cinco domínios, mais o item descritivo 1; exclui perguntas pós-tratamento. © MEMdoc 2012.'});

const OREBRO_RANGE=(low,high)=>numbers(10).map((v,i)=>i===0?'0 — '+low:i===10?'10 — '+high:v);
register('orebro',{
 title:'ÖMPSQ-short Brasil — Örebro, 10 itens',type:'sections',
 intro:'Estas perguntas e afirmações se aplicam se você tem queixas ou dores na coluna, ombros ou pescoço. Leia e responda cada questão com cuidado. Responda todas as questões. Observe os períodos e os extremos de cada escala. O questionário deve ser discutido com o profissional, item por item.',
 data:[
 ['Há quanto tempo você vem apresentando essa dor?',['0–1 semanas','2–3 semanas','4–5 semanas','6–7 semanas','8–9 semanas','10–11 semanas','12–23 semanas','24–35 semanas','36–52 semanas','Mais de 52 semanas']],
 ['Como você classificaria a dor que você tem tido durante a última semana?',OREBRO_RANGE('sem dor','pior possível')],
 ['Eu posso realizar trabalho leve por uma hora.',OREBRO_RANGE('não posso realizar por causa da dor','posso realizar, pois a dor não me atrapalha')],
 ['Eu consigo dormir à noite.',OREBRO_RANGE('não posso realizar por causa da dor','posso realizar, pois a dor não me atrapalha')],
 ['Qual o nível de estresse ou ansiedade você sentiu na semana passada?',OREBRO_RANGE('totalmente calmo e relaxado','estressado e ansioso como eu nunca havia me sentido')],
 ['Quanto vem lhe incomodando o fato de estar se sentindo deprimido na semana passada?',OREBRO_RANGE('nem um pouco','extremamente')],
 ['Na sua opinião, qual o risco da sua atual dor se tornar persistente?',OREBRO_RANGE('sem risco','risco muito alto')],
 ['Em sua estimativa, quais são as chances de que você estará apto a trabalhar em três meses?',OREBRO_RANGE('sem chance','chance muito grande')],
 ['Um aumento da dor é um sinal de que eu deveria parar de fazer o que eu estou fazendo até que a dor diminua.',OREBRO_RANGE('discordo completamente','concordo completamente')],
 ['Eu não deveria realizar minhas atividades normais, inclusive trabalhar, com a minha dor atual.',OREBRO_RANGE('discordo completamente','concordo completamente')]],
 score:a=>{
  const recoded=a.map((v,i)=>i===0?v+1:[2,3,7].includes(i)?10-v:v),raw=sum(recoded);
  return {metrics:[metric('ÖMPSQ-short',raw,100,'Maior = maior risco prognóstico estimado',{min:1})],calculation:{recoded,reversedItems:[3,4,8],durationScoring:'Categorias 1–10',cutoff:'>50'},interpretation:(raw>50?'Acima de 50: maior risco estimado.':'De 1 a 50: menor risco estimado.')+' Classificação de triagem, com possibilidade de falsos positivos e negativos; não determina incapacidade ou afastamento individual.'};
 }
},{version:'OMPSQ-short-BR-Fagundes2015-10-v1',licenseStatus:'OWNER_FREE_CLINICAL_COPIES',source:'https://www.oru.se/english/research/research-environments/hs/champ/questionnaires/',brazilSource:'https://doi.org/10.1007/s11136-015-0998-3',missing:'10/10; nenhuma normalização ou imputação.',note:'Fagundes et al., 2015. Formulário brasileiro conferido no apêndice de Silva (UNESP, 2019), p. 74 do PDF: https://repositorio.unesp.br/server/api/core/bitstreams/d07f3ee2-9684-4125-b689-de0a58974141/content . Preserva categorias de duração brasileiras e prognóstico de três meses. Permissão de cópias clínicas: FAQ de Steven Linton/Örebro University. Apresentação eletrônica; respostas individuais sempre disponíveis ao profissional.'});


/* Exigências específicas não afetam os formulários habilitados.
   Habilitar outro instrumento exige registrar sua versão/formulário e testes,
   não apenas alterar uma flag. Não há chave de licença fictícia. */
const INSTRUMENT_REQUIREMENTS={
 odi:['LICENSE_REQUIRED','ODI 2.0 brasileiro, 10 seções','https://eprovide.mapi-trust.org/instruments/oswestry-disability-index','https://pubmed.ncbi.nlm.nih.gov/17304141/','Obter autorização de incorporação eletrônica e a versão brasileira correspondente. Não substituir silenciosamente a versão 2.0 validada pela 2.1b.'],
 ndi:['LICENSE_REQUIRED','NDI brasileiro, 10 itens','https://eprovide.mapi-trust.org/instruments/neck-disability-index','https://doi.org/10.1097/01.brs.0000221989.53069.16','A incorporação em software depende da autorização do titular/MAPI; uso clínico de cópia não autoriza presumir distribuição eletrônica.'],
 quickdash:['LICENSE_REQUIRED','QuickDASH Brasil, 11 itens','https://dash.iwh.on.ca/faq','https://doi.org/10.1590/1413-785220182601179785','O IWH solicita contato para incorporação em prontuário/software. Obter a autorização aplicável; formulário e algoritmo são distintos da versão legada.'],
 whodas:['LICENSE_REQUIRED','WHODAS 2.0, 12 itens; simple scoring','https://www.who.int/classifications/international-classification-of-functioning-disability-and-health/who-disability-assessment-schedule','https://pmc.ncbi.nlm.nih.gov/articles/PMC6001571/','A OMS exige licença para reprodução eletrônica/software. A forma antiga sem o item de concentração não pode ser reutilizada.'],
 pcs:['LICENSE_REQUIRED','BP-PCS, 13 itens','https://www.phenxtoolkit.org/protocols/view/860201','https://doi.org/10.1111/j.1526-4637.2012.01492.x','Protocolo PhenX indica autorização obrigatória via MAPI. Obter a licença e o formulário brasileiro autorizado.'],
 fiqr:['UNAVAILABLE','FIQR Brasil, 21 itens','https://eprovide.mapi-trust.org/instruments/revised-fibromyalgia-impact-questionnaire','https://doi.org/10.1080/09638288.2016.1207106','FIQR é gratuito para uso clínico/acadêmico; a obtenção de traduções é direcionada à MAPI. Não foi obtido o formulário brasileiro autorizado correspondente à validação citada. Não se presume exigência de licença paga.'],
 hoos:['UNAVAILABLE','HOOS completo, 40 itens','https://eprovide.mapi-trust.org/instruments/hip-disability-and-osteoarthritis-outcome-score','https://doi.org/10.1055/s-0039-1691764','Distribuição transferida para MAPI em 2023, com condições atualizadas. Não foi possível acessar o texto dessas condições nem o formulário brasileiro distribuído atualmente; não se afirma aqui exigência comprovada de licença. Os itens abreviados antigos não constituem HOOS.'],
 koos:['LICENSE_REQUIRED','KOOS completo, 42 itens','https://www.koos.nu/faq.html','https://doi.org/10.1007/s00167-022-06911-w','O titular exige permissão para uso, também em versão eletrônica, via MAPI. Obter a tradução brasileira licenciada; não usar redução própria.'],
 psqi:['LICENSE_REQUIRED','PSQI-BR, 19 itens autorrespondidos','https://www.sleep.pitt.edu/psqi','https://doi.org/10.1016/j.sleep.2010.04.020','University of Pittsburgh exige solicitação para qualquer uso; uso clínico/comercial tem condições próprias. Não reutilizar o resumo legado de sete perguntas.'],
 hit6:['LICENSE_REQUIRED','HIT-6 Brasil, 6 itens','https://www.qualitymetric.com/wp-content/uploads/2023/11/QM_HIT-6_Guide_Final.pdf','https://doi.org/10.1111/head.14049','QualityMetric exige licença, inclusive clínica. Obter autorização para apresentação eletrônica do formulário brasileiro.'],
 hads:['LICENSE_REQUIRED','HADS brasileira, 14 itens','https://www.gl-education.com/products/hospital-anxiety-depression-scale/','https://doi.org/10.1590/S0004-282X1995000300004','Formulários protegidos; reprodução exige permissão da GL. Alternativas específicas por item devem vir da versão brasileira autorizada.'],
 ess:['LICENSE_REQUIRED','ESS-BR, 8 itens','https://epworthsleepinessscale.com/licenses/','https://doi.org/10.1590/S1806-37132009000900009','Obter licença da ESS para sua incorporação e reprodução no sistema, nas condições do titular.'],
 mjoa:['UNAVAILABLE','mJOA Brasil — 18 pontos','https://doi.org/10.6061/clinics/2017(02)08','https://doi.org/10.1016/j.wneu.2018.05.173','Versão brasileira avaliada por profissional, com domínios neurológicos. O link de autorresposta não substitui a avaliação clínica; requer fluxo de aplicação pelo examinador.'],
 masq:['UNAVAILABLE','MASQ original: 38 itens, 5 domínios','https://repository.niddk.nih.gov/media/studies/mapp2sps/Forms/MAPPII_MASQ_v1.0.20141109.pdf','https://doi.org/10.1016/j.jbspin.2010.01.005','A estrutura antiga de 30 itens/seis domínios não corresponde ao MASQ. A adaptação multilíngue localizada não estabelece validação psicométrica brasileira; falta uma versão brasileira aplicável documentada.'],
 fss:['UNAVAILABLE','FSS brasileira, 9 itens','https://member.thoracic.org/members/assemblies/assemblies/srn/questionaires/fss.php','https://doi.org/10.1590/S0004-282X2012000700005','As fontes brasileiras localizadas divergem na redação e janela temporal do formulário. O texto exato da validação adotada ainda precisa ser obtido; não se presume restrição de licença para uso clínico gratuito.'],
};
Object.entries(INSTRUMENT_REQUIREMENTS).forEach(([k,[status,version,source,brazilSource,note]])=>{
 if(!CURRENT_VALIDATED_INSTRUMENTS[k])INSTRUMENT_META[k]={status,version,source,brazilSource,note,administrationBlocked:true,licenseStatus:status==='LICENSE_REQUIRED'?'OWNER_AUTHORIZATION_REQUIRED':'NOT_A_LICENSE_BLOCK',minAnswered:null};
});
for(const [alias,target] of Object.entries(ASSIGNMENT_ALIASES))INSTRUMENT_META[alias]={...INSTRUMENT_META[target],status:'UNAVAILABLE',administrationBlocked:true,note:'Nova aplicação integrada em '+target+'. O histórico desta chave permanece separado.'};

const QUESTIONNAIRES={...LEGACY_INSTRUMENTS,...CURRENT_VALIDATED_INSTRUMENTS};

const QORDER = ["odi","ndi","tsk13","quickdash","spadi","whodas","eva","dn4","fabq","pcs","rmdq","mjoa","psfs","wiq","lefs","sfi","nmq","ict","fiqr","wpi","sss","hoos","koos","fss","psqi","hit6","fabqpa","comi","hads","phq9","gad7","csi","orebro","ess","chalder","sf36","masq"];

/* Autotestes executáveis sem rede. Fixtures não utilizam o próprio algoritmo
   como oráculo. Para executar no navegador: ?devtest=1. */
function testFixture(k,level=0){
 const q=CURRENT_VALIDATED_INSTRUMENTS[k],len=q.type==='sections'?q.data.length:q.items.length;
 if(k==='ict')return level===0?[2,0,0,0,{entries:Array(51).fill(2),details:Object.fromEntries(WAI_DETAILS.map(i=>[i,'Informado']))},[5],4,0,0,0,0]:level===2?[2,10,4,4,{entries:Array(51).fill(0),details:{}},[0],0,2,4,4,4]:[1,7,3,2,{entries:[2,...Array(50).fill(0)],details:{}},[1],1,1,2,2,2];
 if(k==='psfs')return Array.from({length:3},(_,i)=>({activity:'Atividade '+(i+1),score:level*5,skipped:false}));
 if(k==='nmq')return Array.from({length:9},()=>({y12:level===0?0:1,impede:level===0?0:1,care:level===0?0:1,y7:level===0?0:1}));
 return Array.from({length:len},(_,i)=>{
  const max=q.type==='sections'?q.data[i][1].length-1:q.type==='likert'?(q.optsPerItem?q.optsPerItem[i]:q.opts).length-1:q.type==='yesno'?1:10;
  return level===0?0:level===2?max:Math.floor(max/2);
 });
}
function runSelfTests(){
 let count=0;const failures=[];
 const check=(name,value)=>{count++;if(!value)failures.push(name);};
 const near=(a,b)=>Math.abs(a-b)<1e-9;
 const values=(k,a)=>validateAndScore(k,a).metrics?.map(m=>m.value);
 const expected={orebro:[[31],[50],[70]],
  sfi:[[100],[50],[0]],fabq:[[0,0],[12,21],[24,42]],rmdq:[[0],[0],[24]],eva:[[0,0,0,0],[5,5,5,5],[10,10,10,10]],phq9:[[0],[9],[27]],whodas:[[12],[36],[60]],spadi:[[0,0,0],[50,50,50],[100,100,100]],gad7:[[0],[7],[21]],
  psfs:[[0,0,0,0],[5,5,5,5],[10,10,10,10]],lefs:[[0],[40],[80]],ict:[[7],[35],[49]],csi:[[0],[50],[100]],
  tsk13:[[13],[26],[52]],dn4:[[0],[0],[7]],wiq:[[100,100,100],[50,50,50],[0,0,0]],chalder:[[0],[0],[11]],comi:[[0],[5],[10]],
  sf36:[[0,0,0,50,40,50,100,60],[50,0,0,50,48,50,55,50],[100,100,100,50,60,50,0,40]]
 };
 for(const k of Object.keys(CURRENT_VALIDATED_INSTRUMENTS)){
  const q=CURRENT_VALIDATED_INSTRUMENTS[k];
  check(k+' administrável',canAdministerInstrument(k));
  for(const l of [0,1,2]){
   const a=testFixture(k,l),copy=JSON.stringify(a),r=validateAndScore(k,a);
   check(k+' fixture '+l,r.status==='VALID_OFFICIAL');
   check(k+' entrada preservada '+l,JSON.stringify(a)===copy);
   check(k+' versão '+l,r.instrumentVersion===metaOf(k).version&&r.scoringVersion===SCORING_VERSION);
   check(k+' relatório '+l,effectiveStatus(k,r)==='VALID_OFFICIAL'&&responseLines(k,r).length>3);
   if(expected[k])check(k+' cálculo conhecido '+l,r.metrics.length===expected[k][l].length&&r.metrics.every((m,i)=>near(m.value,expected[k][l][i])));
   for(const m of r.metrics)check(k+' finito/direção '+l,Number.isFinite(m.value)&&m.value>=0&&m.value<=m.max&&!!m.direction);
  }
  const a=testFixture(k,1);
  check(k+' histórico sem versão',effectiveStatus(k,{rawAnswers:a})==='LEGACY_INVALID');
  check(k+' histórico outra versão',effectiveStatus(k,{...validateAndScore(k,a),instrumentVersion:'old'})==='LEGACY_INVALID');
  check(k+' comprimento',validateAndScore(k,a.slice(1)).status==='INVALID_INPUT');
  for(let i=0;i<a.length;i++){
   for(const value of [-1,999,1.2,'0',{},[],true,undefined]){
    const bad=cloneAnswers(a);bad[i]=value;
    if(k==='ict'&&i===5&&Array.isArray(value)&&!value.length)continue;
    check(k+' inválido '+i+' '+JSON.stringify(value),validateAndScore(k,bad).status==='INVALID_INPUT');
   }
   const missing=cloneAnswers(a);missing[i]=null;const r=validateAndScore(k,missing);
   if(k==='sf36'||k==='whodas')check(k+' missing permitido '+i,r.status==='VALID_OFFICIAL');
   else check(k+' missing proibido '+i,r.status==='INCOMPLETE'&&!r.metrics);
  }
  const empty=Array(a.length).fill(null);check(k+' vazio',validateAndScore(k,empty).status==='INCOMPLETE');
  const na=cloneAnswers(a);na[0]='NA';check(k+' NA',validateAndScore(k,na).status===(q.answerPolicy.allowNA?'VALID_OFFICIAL':'INVALID_INPUT'));
  const r=validateAndScore(k,a);r.metrics=[{name:'injetado',value:999,max:999}];check(k+' score adulterado',effectiveStatus(k,r)==='INVALID_INPUT');
 }

 {let w=testFixture('whodas',2);w[0]=null;const r=validateAndScore('whodas',w);check('WHODAS 1 faltante imputado pela média',r.status==='VALID_OFFICIAL'&&near(r.metrics[0].value,60));
  w[1]=null;check('WHODAS 2 faltantes sem escore',validateAndScore('whodas',w).status==='INCOMPLETE');
  let m=testFixture('whodas',0);m[0]=null;m[1]=4;const r2=validateAndScore('whodas',m);check('WHODAS imputação média exata',near(r2.metrics[0].value,(10+5)+(15/11)));}
 let a=Array(36).fill(null);[3,13,17,23,24,20,21,1].forEach(n=>a[n-1]=0);
 check('RAND um item em cada domínio',validateAndScore('sf36',a).status==='VALID_OFFICIAL');a[2]=null;check('RAND domínio vazio',validateAndScore('sf36',a).status==='INCOMPLETE');
 a=testFixture('fabq',0);[0,7,12,13,15].forEach(i=>a[i]=6);check('FABQ exclusões',values('fabq',a).every(v=>v===0));
 a=testFixture('dn4');a[0]=a[1]=a[2]=1;check('DN4 corte 3',validateAndScore('dn4',a).interpretation.startsWith('Resultado sugestivo'));a[2]=0;check('DN4 abaixo corte',validateAndScore('dn4',a).interpretation.startsWith('Abaixo'));
 a=testFixture('chalder');a.fill(1);check('Chalder bimodal normal',values('chalder',a)[0]===0);a.fill(2);check('Chalder bimodal sintomático',values('chalder',a)[0]===11);
 a=testFixture('ict',1);a[0]=0;check('ICT ponderação mental 34',values('ict',a)[0]===34);a[0]=2;check('ICT mista 34',values('ict',a)[0]===34);
 for(let n=0;n<7;n++){a=testFixture('ict',2);a[4].entries.fill(0);for(let i=0;i<n;i++){a[4].entries[i]=2;if(WAI_DETAILS.includes(i))a[4].details[i]='Local';}check('ICT doenças '+n,validateAndScore('ict',a).calculation.diseasePoints===[7,5,4,3,2,1,1][n]);}
 a=testFixture('ict',2);a[4].entries.fill(1);WAI_DETAILS.forEach(i=>a[4].details[i]='Local');check('ICT opinião não é diagnóstico',validateAndScore('ict',a).calculation.diagnosedDiseases===0);
 a=testFixture('ict',2);a[5]=[0,5];check('ICT múltiplas usa pior',validateAndScore('ict',a).calculation.impairment===1);
 a=testFixture('wiq');a.fill(4);a[6]=0;check('WIQ peso distância',near(values('wiq',a)[0],6000/14080*100));
 a=testFixture('comi');a[1]=2;a[2]=8;check('COMI máximo dor',near(values('comi',a)[0],1.6));
 const old={instrumentVersion:'old',rawAnswers:[3],raw:40,pct:80},snapshot=JSON.stringify(old);
 const report=buildReportText({name:'Teste',created_at:'2020-01-01',responses:{ict:old}});
 check('histórico sem cálculo',report.includes('Histórico incompatível')&&!report.includes('40/49')&&JSON.stringify(old)===snapshot);
 check('aliases só atribuição',activeKeys(['fabqpa','fabq','sss','wpi']).join(',')==='fabq,wpi');

 a=[0,0,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,0,0,0,0,5,5,0,0,5,5,0,5,4,4,0,4,0];
 check('RAND máximo em todos os domínios',values('sf36',a).every(v=>v===100));
 a=[4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,5,4,5,0,0,5,5,0,0,5,0,0,0,4,0,4];
 check('RAND mínimo em todos os domínios',values('sf36',a).every(v=>v===0));
 a=Array(24).fill(0).map((v,i)=>i%2);check('RMDQ intermediário 12',values('rmdq',a)[0]===12);
 a=Array(20).fill(0);a[0]=4;a[1]=2;check('LEFS 6/80 sem inversão',values('lefs',a)[0]===6);
 a=testFixture('wpi',0);check('WPI/SSS mínimos',values('wpi',a).join(',')==='0,0');
 a=testFixture('wpi',2);check('WPI/SSS máximos',values('wpi',a).join(',')==='19,12');
 check('FSQ condições completas',validateAndScore('wpi',a).interpretation.includes('2016 atendidos'));
 a[25]=0;check('FSQ duração obrigatória',validateAndScore('wpi',a).interpretation.includes('não atendidos'));
 a=testFixture('wpi',0);[1,5,8,11].forEach(i=>a[i]=1);a[19]=a[20]=a[21]=3;a[25]=1;
 check('FSQ WPI4 SSS9 quatro regiões',validateAndScore('wpi',a).interpretation.includes('2016 atendidos'));
 a[21]=2;check('FSQ WPI4 SSS8 não atende',validateAndScore('wpi',a).interpretation.includes('não atendidos'));
 a=testFixture('wpi',0);[0,1,2,3,4,5,6].forEach(i=>a[i]=1);a[19]=3;a[20]=2;a[25]=1;
 check('FSQ WPI7 SSS5 sem distribuição não atende',validateAndScore('wpi',a).interpretation.includes('não atendidos'));
 check('NMQ nunca soma regiões',validateAndScore('nmq',testFixture('nmq',2)).metrics.length===0);


 a=[0,0,10,10,0,0,0,10,0,0];check('Örebro mínimo 1',values('orebro',a)[0]===1);
 a=[9,10,0,0,10,10,10,0,10,10];check('Örebro máximo 100',values('orebro',a)[0]===100);
 a=[4,5,5,5,5,5,5,5,5,5];check('Örebro corte 50',validateAndScore('orebro',a).interpretation.startsWith('De 1 a 50'));
 a[1]=6;check('Örebro corte 51',validateAndScore('orebro',a).interpretation.startsWith('Acima de 50'));
 const result={count,failed:failures.length,failures};
 if(failures.length)throw new Error('Autotestes: '+failures.join(' | '));
 return result;
}
if(new URLSearchParams(window.location.search).get('devtest')==='1')window.CLINIMETRIC_TEST_RESULT=runSelfTests();

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
 for(const [k,r] of Object.entries(responses)){
  if(!canAdministerInstrument(k)) throw new Error(BLOCKED_MESSAGE);
  if(effectiveStatus(k,r)==='LEGACY_INVALID') throw new Error('Histórico não pode ser sobrescrito por esta rotina.');
  const checked=validateAndScore(k,r.rawAnswers);
  if(checked.status!=='VALID_OFFICIAL') throw new Error('INVALID_INPUT: '+answerErrors(k,r.rawAnswers).join('; '));
  if(state.responsesLocal[k] && effectiveStatus(k,state.responsesLocal[k])==='LEGACY_INVALID') throw new Error('Histórico não pode ser sobrescrito. Gere uma nova atribuição.');
  responses[k]=checked;
 }
 const persisted={...state.responsesLocal,...responses};
 const {data, error} = await supabase.rpc('save_submission_responses', {p_id:id, p_responses:persisted});
 if(error){ alert('Erro ao salvar: '+error.message); throw error; }
 if(data === 0) throw new Error('Nenhum registro atualizado; as respostas não foram confirmadas pelo servidor.');
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

async function dbCreateAssignment(name, phone, assignedKeys){
 if(Array.isArray(assignedKeys)) assignedKeys=[...new Set(assignedKeys.map(k=>ASSIGNMENT_ALIASES[k]||k))];
 if(!Array.isArray(assignedKeys) || !assignedKeys.length || assignedKeys.some(k=>!canAdministerInstrument(k))) throw new Error(BLOCKED_MESSAGE);
 const id = newUuid();
 const {error} = await supabase.from('submissions').insert({id, name, phone, responses:{}, assigned:assignedKeys});
 if(error){ alert('Erro ao gerar link: '+error.message); throw error; }
 return id;
}
async function dbGetAssignment(id){
 const {data, error} = await supabase.rpc('get_assignment', {p_id:id});
 if(error || !data || !data.length) return null;
 return data[0];
}
async function dbAddSlot(slotTimeISO, duration){
 const {error} = await supabase.from('availability_slots').insert({slot_time:slotTimeISO, duration_minutes:duration});
 if(error){ alert('Erro ao adicionar horário: '+error.message); throw error; }
}
async function dbAddSlotsBulk(rows){
 if(!rows.length) return;
 const {error} = await supabase.from('availability_slots').insert(rows);
 if(error){ alert('Erro ao gerar horários: '+error.message); throw error; }
}
// Janelas fixas de atendimento do Gabriel: 08h30–12h00 e 19h00–22h00, em blocos de 10 min.
const AVAILABILITY_WINDOWS = [ {startH:8,startM:30,endH:12,endM:0}, {startH:19,startM:0,endH:22,endM:0} ];
function generateSlotsForDate(dateStr){
 const slots = [];
 AVAILABILITY_WINDOWS.forEach(w=>{
  let cur = new Date(dateStr+'T00:00:00');
  cur.setHours(w.startH, w.startM, 0, 0);
  const end = new Date(dateStr+'T00:00:00');
  end.setHours(w.endH, w.endM, 0, 0);
  while(cur < end){
   slots.push(new Date(cur));
   cur = new Date(cur.getTime() + 10*60000);
  }
 });
 return slots;
}
async function dbListSlots(){
 const {data, error} = await supabase.from('availability_slots').select('*').order('slot_time',{ascending:true});
 if(error){ return []; }
 return data;
}
async function dbDeleteSlot(id){
 const {error} = await supabase.from('availability_slots').delete().eq('id', id);
 if(error){ alert('Erro ao excluir horário: '+error.message); }
}
async function dbGetAvailableSlots(){
 const {data, error} = await supabase.rpc('get_available_slots');
 if(error){ return []; }
 return data || [];
}
async function dbBookSlot(id, name, phone){
 const {data, error} = await supabase.rpc('book_slot', {p_id:id, p_name:name, p_phone:phone});
 if(error){ alert('Erro ao agendar: '+error.message); return 0; }
 return data;
}

/* ---------- App state ---------- */
let state = { view:'landing', patientId:null, patientName:'', responsesLocal:{}, qKey:null, qIndex:0, qAnswers:[], patients:[], openPatient:null, authError:'', openDetails:{}, slots:[], scheduleStep:null, scheduleSlots:[], selectedSlotId:null };
let justDoneTimer = null;
const app = document.getElementById('app');
function render(){ if(['instructions','wizard'].includes(state.view) && !canAdministerInstrument(state.qKey)){ alert(BLOCKED_MESSAGE); state.view='list'; } app.innerHTML = views[state.view](); bind(); }

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
 const keys = activeKeys(state.assignedKeys);
 const rows = keys.map(k=>{
   const done = !!state.responsesLocal[k];
   const qd = QUESTIONNAIRES[k];
   return `<div class="qcard" data-q="${k}">
     <div>
       <div class="qcard-title">${qd.about || qd.title}</div>
       <div class="qcard-sub">${qd.title}</div>
     </div>
     <span class="badge ${done?'badge-done':'badge-pending'}">${done?statusLabel(effectiveStatus(k,state.responsesLocal[k])):'pendente'}</span>
   </div>`;
 }).join('');
 return `
 <div class="topbar"><div class="brand">Olá, ${state.patientName.split(' ')[0]}<small>Escolha um questionário</small></div></div>
 <main>
   <p class="sub">Responda cada um destes. Quando terminar, pode fechar a página — seu fisioterapeuta já recebe os resultados.</p>
   ${(state.assignedKeys||[]).some(k=>!canAdministerInstrument(k))?`<p class="sub">Há instrumentos bloqueados nesta atribuição. ${BLOCKED_MESSAGE} Entre em contato com o profissional responsável.</p>`:''}
   ${rows}
   <button class="btn btn-ghost" id="finishBtn" style="width:100%;margin-top:10px;">Concluir e enviar</button>
 </main>`;
},

instructions(){
 const q = QUESTIONNAIRES[state.qKey];
 return `<div class="topbar"><div class="brand">${q.title}<small>Antes de começar</small></div></div>
 <main>
   <div class="card">
     <p class="sub" style="margin-bottom:14px;">${escapeHtml(q.intro||'Observe o período indicado em cada pergunta.')}</p>
     <p class="sub" style="margin-bottom:14px;">Não existe resposta certa ou errada. Responda com sinceridade, mesmo que a resposta pareça leve ou grave. Observe a janela de tempo de cada instrumento.</p>
     <p class="sub" style="margin-bottom:0;">Se tiver dúvida sobre o que uma pergunta quer dizer, pergunte antes de responder.</p>
     ${state.qKey==='psfs' ? `<div style="margin-top:16px;padding-top:16px;border-top:1px dashed var(--line);"><p class="sub" style="margin-bottom:0;">Pense em atividades do seu dia a dia que ficaram difíceis por causa do seu problema de saúde. Pode ser qualquer coisa: uma tarefa em casa, no trabalho, um hobby, um movimento específico. Escolha as que realmente afetam sua rotina.</p></div>` : ''}
   </div>
   <button class="btn btn-primary" id="startQBtn" style="width:100%;">Entendi, começar</button>
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
 const itemHelp = (ITEM_HELP[state.qKey] && ITEM_HELP[state.qKey][state.qIndex]) || null;
 const helpHtml = itemHelp ? `<p class="sub" style="margin-top:-6px;margin-bottom:16px;">💡 ${itemHelp}</p>` : '';
 const naBtnHtml = q.answerPolicy.allowNA ? `<button class="btn btn-ghost" id="naBtn" style="width:100%;margin-top:14px;font-size:13.5px;">${state.qAnswers[state.qIndex]==='NA'?'✓ Marcado como \"não se aplica\" — toque numa opção acima para responder mesmo assim':'Deixar este item sem resposta'}</button>` : '';
 if(q.special?.[state.qIndex]==='diseases'){
  const v=state.qAnswers[state.qIndex]||{entries:Array(51).fill(null),details:{}};
  body='<div class="qtext">'+escapeHtml(current[0])+'</div><p class="sub">Selecione uma resposta para cada condição. Não deixe condições não existentes sem resposta.</p>'+WAI_DISEASES.map((label,i)=>'<div style="margin:14px 0"><label for="disease-'+i+'">'+(i+1)+'. '+escapeHtml(label)+'</label><select class="disease-select" id="disease-'+i+'" data-index="'+i+'" style="display:block;width:100%;padding:12px"><option value="">Selecione</option>'+['Não possuo','Minha opinião','Diagnóstico médico','Minha opinião e diagnóstico médico'].map((t,n)=>'<option value="'+n+'" '+(v.entries[i]===n?'selected':'')+'>'+t+'</option>').join('')+'</select>'+(WAI_DETAILS.includes(i)&&v.entries[i]>0?'<label>Especifique <input class="disease-detail" data-index="'+i+'" maxlength="1000" value="'+escapeHtml(v.details[i]||'')+'"></label>':'')+'</div>').join('');
 } else if(q.special?.[state.qIndex]==='multi'){
  const v=state.qAnswers[state.qIndex]||[];
  body='<div class="qtext">'+escapeHtml(current[0])+'</div>'+current[1].map((o,i)=>'<button class="multi-opt opt '+(v.includes(i)?'selected':'')+'" data-val="'+i+'" aria-pressed="'+v.includes(i)+'">'+escapeHtml(o)+'</button>').join('');
 }
 else if(q.type==='sections'){
  const [domain, opts] = current;
  body = `<div class="qtext">${domain}</div>` + helpHtml + opts.map((o,i)=>`<button class="opt ${state.qAnswers[state.qIndex]===i?'selected':''}" data-val="${i}">${o}</button>`).join('') + naBtnHtml;
 } else if(q.type==='likert'){
  const opts = q.optsPerItem ? q.optsPerItem[state.qIndex] : q.opts;
  body = `<div class="qtext">${current}</div>` + helpHtml + opts.map((o,i)=>`<button class="opt ${state.qAnswers[state.qIndex]===i?'selected':''}" data-val="${i}">${o}</button>`).join('') + naBtnHtml;
 } else if(q.type==='yesno'){
  body = `<div class="qtext">${current}</div>` + helpHtml + `
   <button class="opt ${state.qAnswers[state.qIndex]===1?'selected':''}" data-val="1">Sim</button>
   <button class="opt ${state.qAnswers[state.qIndex]===0?'selected':''}" data-val="0">Não</button>` + naBtnHtml;
 } else if(q.type==='sliders'){
  const val = state.qAnswers[state.qIndex];
  body = `<div class="qtext">${current}</div>` + helpHtml + `
   <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px;">
    ${[0,1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="opt" data-val="${n}" style="text-align:center;padding:16px 0;margin-bottom:0;font-weight:700;font-size:18px;${val===n?'border-color:var(--navy);background:#EEF1F7;':''}">${n}</button>`).join('')}
   </div>
   <p class="sub" style="margin-bottom:0;">0 = sem dor nenhuma · 10 = a pior dor que você pode imaginar</p>`;
 } else if(q.type==='psfs'){
  const existing = state.qAnswers[state.qIndex] || {activity:'', score:null};
  const skipped = existing.skipped;
  body = `<div class="qtext">${current}</div>
   ${skipped ? `<p class="sub">Você optou por não citar essa atividade. Pode seguir para a próxima tela.</p>` : `
   <label class="field">Nome da atividade</label>
   <input type="text" id="psfsActivity" placeholder="Ex.: subir escadas, carregar sacola de compras..." value="${escapeHtml(existing.activity||'')}">
   <label class="field" style="margin-top:14px;">Nota</label>
   <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px;">
    ${[0,1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="opt psfs-num" data-val="${n}" style="text-align:center;padding:14px 0;margin-bottom:0;font-weight:700;font-size:16px;${existing.score===n?'border-color:var(--navy);background:#EEF1F7;':''}">${n}</button>`).join('')}
   </div>
   <p class="sub" style="margin-bottom:0;">0 = não consigo fazer de jeito nenhum · 10 = consigo fazer como fazia antes</p>
   `}
   ${false ? `<button class="btn btn-ghost" id="psfsSkipBtn" style="width:100%;margin-top:14px;">${skipped?'Na verdade, quero citar uma atividade':'Não tenho mais nenhuma atividade para citar'}</button>` : ''}`;
 } else if(q.type==='nmq'){
  const ex = state.qAnswers[state.qIndex] || {y12:null, impede:null, care:null, y7:null};
  const yn = (field, label)=>`<div style="margin-bottom:16px;">
    <div style="font-size:14px;color:var(--ink);margin-bottom:8px;">${label}</div>
    <button class="opt nmq-opt" data-field="${field}" data-val="1" style="display:inline-block;width:auto;margin:0 8px 0 0;padding:11px 20px;${ex[field]===1?'border-color:var(--navy);background:#EEF1F7;font-weight:600;':''}">Sim</button>
    <button class="opt nmq-opt" data-field="${field}" data-val="0" style="display:inline-block;width:auto;margin:0;padding:11px 20px;${ex[field]===0?'border-color:var(--navy);background:#EEF1F7;font-weight:600;':''}">Não</button>
   </div>`;
  const inner=Object.entries(NMQ_FIELDS).map(([f,t])=>yn(f,t)).join('');
  body = `<div class="qtext">${current}</div>` + inner;
 }
 const value=state.qAnswers[state.qIndex];
 const nextDisabled=!(itemComplete(q,state.qIndex,value)||(value==='NA'&&q.answerPolicy.allowNA));

 return `
 <div class="topbar"><div class="brand">${q.title}<small>${state.qIndex+1} de ${total}</small></div></div>
 <main>
  ${state.qIndex===0 && q.intro ? `<div class="card" style="background:var(--bg);border-style:dashed;font-size:14px;color:var(--muted);line-height:1.5;">${q.intro}</div>` : ''}
  <div class="arcwrap">${arc}<div class="arc-label">${pct}% concluído</div></div>
  ${body}
  <div class="navrow">
   <button class="btn btn-ghost" id="backBtn">${state.qIndex===0?'Cancelar':'Voltar'}</button>
   <button class="btn btn-primary" id="nextBtn" ${nextDisabled?'disabled':''}>${state.qIndex===total-1?'Concluir':'Próxima'}</button>
  </div>
 </main>`;
},

justDone(){
 const keys = activeKeys(state.assignedKeys);
 const remaining = keys.filter(k=>!state.responsesLocal[k]);
 const next = remaining[0];
 return `<div class="topbar"><div class="brand">Gabriel dos Santos<small>Avaliação Funcional</small></div></div>
 <main><div class="center-msg">
   <h1>Respondido com sucesso ✓</h1>
   ${next ? `
     <p class="sub">Muito bem! Agora vamos para o próximo: <strong>${QUESTIONNAIRES[next].title}</strong>.</p>
     <button class="btn btn-primary" id="nextQBtn">Continuar agora</button>
     <button class="btn btn-ghost" id="seeListBtn" style="width:100%;margin-top:10px;">Ver lista completa</button>
   ` : `
     <p class="sub">Você concluiu todos os questionários. Obrigado! Só um instante...</p>
   `}
 </div></main>`;
},

thanks(){
 return `<div class="topbar"><div class="brand">Gabriel dos Santos<small>Avaliação Funcional</small></div></div>
 <main><div class="center-msg">
   <h1>Recebido ✓</h1>
   <p class="sub">Obrigado, ${state.patientName.split(' ')[0]}. Suas respostas foram enviadas para o seu fisioterapeuta.</p>
   ${scheduleWidgetHtml()}
 </div></main>`;
},

invalidLink(){
 return `<div class="topbar"><div class="brand">Gabriel dos Santos<small>Avaliação Funcional</small></div></div>
 <main><div class="center-msg">
   <h1>Link não encontrado</h1>
   <p class="sub">Esse endereço não foi encontrado. Confirme se copiou o link completo, ou entre em contato com seu fisioterapeuta para receber um novo.</p>
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
   const qdef = QUESTIONNAIRES[k] || {title:k};
   const effective=effectiveStatus(k,r);
   const pillsHtml='<span class="pill" style="background:var(--gray-bg);color:var(--gray-txt)">'+statusLabel(effective)+'</span>';
   const detail=scoreLines(k,r).map(escapeHtml).join('<br>');
   const detailKey = p.id+'::'+k;
   const isOpen = !!state.openDetails[detailKey];
   const canExpand = true;
   return `<div class="score-line" style="flex-direction:column;align-items:stretch;">
     <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
       <div><div class="sname">${qdef.title}</div>${(k==='eva'||k==='psfs')?`<div style="margin-top:6px;">${detail}</div>`:`<div class="sdetail">${detail}</div>`}</div>
       <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
         ${pillsHtml}
         ${canExpand?`<button class="del-link" style="color:var(--blue);" data-toggledetail="${detailKey}">${isOpen?'ocultar':'ver respostas'}</button>`:''}
       </div>
     </div>
     ${(canExpand && isOpen) ? renderItemDetail(k, r) : ''}
   </div>`;
  }).join('') || `<p class="sub" style="margin:12px 0;">Nenhum questionário respondido ainda.</p>`;
  const actionsHtml = keys.length ? `<div style="display:flex;gap:8px;margin-bottom:14px;">
      <button class="btn btn-ghost" style="flex:1;" data-copyreport="${p.id}">📋 Copiar tudo</button>
      <button class="btn btn-ghost" style="flex:1;" data-downloadreport="${p.id}">⬇ Baixar .txt</button>
    </div>` : '';
  return `<div class="patient-row">
    <div class="patient-head" data-toggle="${p.id}">
      <div><div class="patient-name">${p.name}</div><div class="patient-meta">${new Date(p.created_at).toLocaleString('pt-BR')} · ${keys.length}/${(p.assigned && p.assigned.length) ? p.assigned.length : QORDER.length} questionários</div></div>
      <button class="del-link" data-del="${p.id}">excluir</button>
    </div>
    <div class="patient-body ${open?'open':''}">${actionsHtml}${inner}</div>
  </div>`;
 }).join('');
 const now = new Date();
 const upcomingSlots = (state.slots||[]).filter(s=>new Date(s.slot_time) >= now);
 const slotsHtml = upcomingSlots.length ? upcomingSlots.map(s=>{
  const when = new Date(s.slot_time).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  const status = s.booked_by_name ? `Agendado — ${s.booked_by_name} (${s.booked_by_phone||'sem telefone'})` : 'Disponível';
  const statusColor = s.booked_by_name ? 'var(--r3-txt)' : 'var(--r1-txt)';
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px dashed var(--line);">
    <div><div style="font-size:13.5px;font-weight:600;">${when}</div><div style="font-size:12.5px;color:${statusColor};">${status}</div></div>
    <button class="del-link" data-delslot="${s.id}">excluir</button>
  </div>`;
 }).join('') : `<p class="sub" style="margin:8px 0 0;">Nenhum horário cadastrado ainda.</p>`;
 return `<div class="topbar"><div class="brand">Painel do profissional<small>${state.patients.length} pacientes registrados</small></div>
   <button class="mode-toggle" id="logoutBtn">Sair</button></div>
 <main>
   <div class="card">
     <label class="field">Agenda de teleconsultas (até 10 min)</label>
     <p class="sub" style="margin-bottom:10px;">Suas janelas fixas de atendimento: 8h30–12h e 19h–22h. Escolha uma data e gere os horários de 10 em 10 minutos automaticamente.</p>
     <div style="display:flex;gap:10px;margin-bottom:10px;">
       <input type="date" id="bulkDate" style="flex:1;padding:13px 14px;border:1.5px solid var(--line);border-radius:10px;font-family:'Inter';font-size:15px;">
       <button class="btn btn-primary" id="genDayBtn" style="white-space:nowrap;">Gerar esse dia</button>
     </div>
     <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;">
       <span style="font-size:13.5px;color:var(--muted);">ou gere vários dias de uma vez:</span>
       <input type="number" id="bulkDays" min="1" max="30" value="7" style="width:60px;padding:10px;border:1.5px solid var(--line);border-radius:10px;text-align:center;">
       <span style="font-size:13.5px;color:var(--muted);">dias</span>
       <button class="btn btn-ghost" id="genRangeBtn" style="white-space:nowrap;">Gerar</button>
     </div>
     <details style="margin-bottom:14px;">
       <summary style="cursor:pointer;font-size:13px;color:var(--blue);">Adicionar um horário específico (fora do padrão)</summary>
       <div style="display:flex;gap:10px;margin-top:10px;">
         <input type="datetime-local" id="newSlotTime" style="flex:1;padding:13px 14px;border:1.5px solid var(--line);border-radius:10px;font-family:'Inter';font-size:15px;">
         <button class="btn btn-ghost" id="addSlotBtn" style="white-space:nowrap;">+ Adicionar</button>
       </div>
     </details>
     ${slotsHtml}
   </div>
   <div class="card">
     <label class="field">Gerar link para um paciente específico</label>
     <input type="text" id="newName" placeholder="Nome completo do paciente">
     <input type="tel" id="newPhone" placeholder="Telefone (opcional)">
     <label class="field" style="margin-top:4px;">Questionários deste caso</label>
     <div style="position:relative;margin-bottom:10px;">
       <input type="text" id="qSearch" placeholder="Buscar questionário (ex.: joelho, sono, trabalho)..." style="width:100%;font-family:'Inter';font-size:14.5px;padding:12px 14px 12px 38px;border:1.5px solid var(--line);border-radius:10px;">
       <span style="position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:15px;color:var(--muted);pointer-events:none;">🔍</span>
     </div>
     <div style="display:flex;gap:10px;margin-bottom:10px;">
       <button class="btn btn-ghost" id="markAllBtn" style="flex:1;font-size:13px;padding:10px;">Marcar todos</button>
       <button class="btn btn-ghost" id="unmarkAllBtn" style="flex:1;font-size:13px;padding:10px;">Desmarcar todos</button>
     </div>
     <div style="margin-bottom:16px;max-height:360px;overflow-y:auto;">
       ${activeKeys().map(k=>`<label class="qcheck-row" data-search="${(QUESTIONNAIRES[k].title+' '+(QUESTIONNAIRES[k].about||'')).toLowerCase()}" style="display:flex;align-items:center;gap:10px;padding:9px 0;font-size:14.5px;border-bottom:1px dashed var(--line);">
         <input type="checkbox" class="qcheck" value="${k}" ${canAdministerInstrument(k)?'checked':'disabled'} style="width:18px;height:18px;flex-shrink:0;">
         <span><strong>${QUESTIONNAIRES[k].title}</strong><br><span style="color:var(--muted);font-size:12.5px;">${canAdministerInstrument(k)?(QUESTIONNAIRES[k].about||''):administrationLabel(k)}</span></span>
       </label>`).join('')}
       <p class="sub" id="qSearchEmpty" style="display:none;margin:10px 0 0;">Nenhum questionário encontrado com esse termo.</p>
     </div>
     <details style="margin-bottom:16px"><summary>Condições de uso dos demais instrumentos</summary>${QORDER.filter(k=>!canAdministerInstrument(k)&&!ASSIGNMENT_ALIASES[k]).map(k=>`<p><strong>${escapeHtml(LEGACY_INSTRUMENTS[k]?.title||k)}</strong>: ${escapeHtml(metaOf(k).note)} <a href="${escapeHtml(metaOf(k).source)}" target="_blank" rel="noopener noreferrer">Fonte</a></p>`).join('')}</details><button class="btn btn-primary" id="genLinkBtn">Gerar link</button>
     <div id="linkResult" style="display:none;margin-top:14px;padding:14px;background:var(--bg);border-radius:10px;">
       <div id="linkText" style="font-family:'IBM Plex Mono',monospace;font-size:12px;word-break:break-all;"></div>
       <button class="btn btn-ghost" id="copyLinkBtn" style="width:100%;margin-top:10px;">Copiar link</button>
     </div>
   </div>
   <div style="display:flex;gap:10px;margin-bottom:18px;">
     <input class="searchbar" id="search" placeholder="Buscar por nome..." value="${state._search||''}" style="margin-bottom:0;flex:1;">
     <button class="btn btn-ghost" id="refreshBtn" style="white-space:nowrap;">↻ Atualizar</button>
   </div>
   ${filtered.length? rows : `<div class="empty">Nenhum paciente encontrado.<br>Envie o link desta página para o paciente responder.</div>`}
 </main>`;
}
};

function scheduleWidgetHtml(){
 if(state.scheduleStep==='no'){
  return `<p class="sub" style="margin-top:18px;">Sem problema, obrigado!</p>`;
 }
 if(state.scheduleStep==='done'){
  const slot = state.scheduleSlots.find(s=>s.id===state.selectedSlotId);
  const when = slot ? new Date(slot.slot_time).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '';
  return `<div class="card" style="margin-top:18px;text-align:left;">
    <p class="sub" style="margin-bottom:0;">Teleconsulta agendada para <strong>${when}</strong>. Você vai receber a chamada nesse horário.</p>
  </div>`;
 }
 if(state.scheduleStep==='slots'){
  if(!state.scheduleSlots.length){
   return `<div class="card" style="margin-top:18px;text-align:left;"><p class="sub" style="margin-bottom:0;">Não há horários disponíveis no momento. Fale direto com seu fisioterapeuta.</p></div>`;
  }
  const byDate = {};
  state.scheduleSlots.forEach(s=>{
   const d = new Date(s.slot_time);
   const dateLabel = d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});
   byDate[dateLabel] = byDate[dateLabel] || [];
   byDate[dateLabel].push(s);
  });
  const groups = Object.keys(byDate).map(dateLabel=>{
   const btns = byDate[dateLabel].map(s=>{
    const timeLabel = new Date(s.slot_time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return `<button class="opt" data-slot="${s.id}" style="display:inline-block;width:auto;margin:0 8px 8px 0;padding:10px 16px;">${timeLabel}</button>`;
   }).join('');
   return `<div style="margin-bottom:10px;"><div style="font-size:12.5px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">${dateLabel}</div><div>${btns}</div></div>`;
  }).join('');
  return `<div class="card" style="margin-top:18px;text-align:left;">
    <label class="field">Escolha um horário</label>
    ${groups}
  </div>`;
 }
 if(state.scheduleStep==='phone'){
  const slot = state.scheduleSlots.find(s=>s.id===state.selectedSlotId);
  const when = slot ? new Date(slot.slot_time).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '';
  return `<div class="card" style="margin-top:18px;text-align:left;">
    <p class="sub">Horário escolhido: <strong>${when}</strong></p>
    <label class="field">Seu telefone com WhatsApp</label>
    <input type="tel" id="schedPhone" placeholder="(00) 00000-0000">
    <button class="btn btn-primary" id="confirmScheduleBtn" style="width:100%;">Confirmar agendamento</button>
  </div>`;
 }
 return `<div class="card" style="margin-top:18px;text-align:left;">
   <p class="sub" style="margin-bottom:14px;">Antes de você sair: você teria interesse em uma teleconsulta rápida (até 10 minutos) comigo?</p>
   <div style="display:flex;gap:10px;">
     <button class="btn btn-primary" id="schedYesBtn" style="flex:1;">Sim, quero agendar</button>
     <button class="btn btn-ghost" id="schedNoBtn" style="flex:1;">Não, obrigado</button>
   </div>
 </div>`;
}

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
 if(justDoneTimer){ clearTimeout(justDoneTimer); justDoneTimer=null; }

 if(state.view==='thanks'){
  if(!state.scheduleStep){
   $('schedYesBtn') && ($('schedYesBtn').onclick = async ()=>{
    state.scheduleSlots = await dbGetAvailableSlots();
    state.scheduleStep = 'slots';
    render();
   });
   $('schedNoBtn') && ($('schedNoBtn').onclick = ()=>{ state.scheduleStep='no'; render(); });
  } else if(state.scheduleStep==='slots'){
   document.querySelectorAll('[data-slot]').forEach(el=>{
    el.onclick = ()=>{ state.selectedSlotId = el.dataset.slot; state.scheduleStep='phone'; render(); };
   });
  } else if(state.scheduleStep==='phone'){
   $('confirmScheduleBtn').onclick = async ()=>{
    const phone = $('schedPhone').value.trim();
    if(!phone){ $('schedPhone').style.borderColor='#C00000'; return; }
    $('confirmScheduleBtn').disabled = true; $('confirmScheduleBtn').textContent='Agendando...';
    const affected = await dbBookSlot(state.selectedSlotId, state.patientName, phone);
    if(!affected){
     alert('Esse horário acabou de ser escolhido por outra pessoa. Escolha outro, por favor.');
     state.scheduleSlots = await dbGetAvailableSlots();
     state.scheduleStep = 'slots';
     render();
     return;
    }
    state.scheduleStep = 'done';
    render();
   };
  }
 }

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
    if(!canAdministerInstrument(k)){ alert(BLOCKED_MESSAGE); return; }
    state.qKey=k; state.qIndex=0;
    const q = QUESTIONNAIRES[k];
    const len = q.type==='sections'? q.data.length : q.items.length;
    const existing = state.responsesLocal[k];
    if(existing && effectiveStatus(k,existing)==='LEGACY_INVALID'){ alert('Aplicação histórica incompatível com a versão atual — respostas preservadas apenas descritivamente. Solicite uma nova atribuição ao profissional.'); return; }
    state.qAnswers = existing && Array.isArray(existing.rawAnswers) ? cloneAnswers(existing.rawAnswers) : new Array(len).fill(null);
    state.view='instructions'; render();
   };
  });
  $('finishBtn').onclick = ()=>{ state.view='thanks'; render(); };
 }

 if(state.view==='instructions'){
  $('startQBtn').onclick = ()=>{ if(!canAdministerInstrument(state.qKey)){ alert(BLOCKED_MESSAGE); return; } state.view='wizard'; render(); };
 }

 if(state.view==='wizard'){
  const q = QUESTIONNAIRES[state.qKey];
  const total = q.type==='sections'? q.data.length : q.items.length;
  if(q.special?.[state.qIndex]==='diseases'){
   if(!state.qAnswers[state.qIndex])state.qAnswers[state.qIndex]={entries:Array(51).fill(null),details:{}};
   document.querySelectorAll('.disease-select').forEach(el=>el.onchange=()=>{
    const a=state.qAnswers[state.qIndex],i=Number(el.dataset.index);
    a.entries[i]=el.value===''?null:Number(el.value);
    if(!a.entries[i])delete a.details[i];
    render();
   });
   document.querySelectorAll('.disease-detail').forEach(el=>el.oninput=()=>{
    state.qAnswers[state.qIndex].details[el.dataset.index]=el.value;
    $('nextBtn').disabled=!itemComplete(q,state.qIndex,state.qAnswers[state.qIndex]);
   });
  } else if(q.special?.[state.qIndex]==='multi'){
   if(!state.qAnswers[state.qIndex])state.qAnswers[state.qIndex]=[];
   document.querySelectorAll('.multi-opt').forEach(el=>el.onclick=()=>{
    const a=state.qAnswers[state.qIndex],n=Number(el.dataset.val);
    state.qAnswers[state.qIndex]=a.includes(n)?a.filter(v=>v!==n):[...a,n].sort((a,b)=>a-b);render();
   });
  }
 else if(q.type==='psfs'){
   if(!state.qAnswers[state.qIndex]) state.qAnswers[state.qIndex] = {activity:'', score:null, skipped:false};
   const activityInput = $('psfsActivity');
   if(activityInput){
    activityInput.oninput = ()=>{
     state.qAnswers[state.qIndex].activity = activityInput.value;
     const ok = activityInput.value.trim().length>0 && state.qAnswers[state.qIndex].score!==null && state.qAnswers[state.qIndex].score!==undefined;
     $('nextBtn').disabled = !ok;
    };
   }
   document.querySelectorAll('.psfs-num').forEach(el=>{
    el.onclick = ()=>{ state.qAnswers[state.qIndex].score = parseInt(el.dataset.val); render(); };
   });
   $('psfsSkipBtn') && ($('psfsSkipBtn').onclick = ()=>{
    state.qAnswers[state.qIndex].skipped = !state.qAnswers[state.qIndex].skipped;
    render();
   });
  } else if(q.type==='nmq'){
   if(!state.qAnswers[state.qIndex]) state.qAnswers[state.qIndex] = {y12:null, impede:null, care:null, y7:null};
   document.querySelectorAll('.nmq-opt').forEach(el=>{
    el.onclick = ()=>{
     const field = el.dataset.field;
     state.qAnswers[state.qIndex][field] = parseInt(el.dataset.val);
     render();
    };
   });
  } else {
   document.querySelectorAll('.opt').forEach(el=>{ el.onclick = ()=>{ state.qAnswers[state.qIndex] = parseInt(el.dataset.val); render(); }; });
   $('naBtn') && ($('naBtn').onclick = ()=>{
    state.qAnswers[state.qIndex] = (state.qAnswers[state.qIndex]==='NA') ? null : 'NA';
    render();
   });
  }
  $('backBtn').onclick = ()=>{ if(state.qIndex===0){ state.view='list'; render(); } else { state.qIndex--; render(); } };
  $('nextBtn').onclick = async ()=>{
   if(state.qIndex < total-1){ state.qIndex++; render(); return; }
   const result = validateAndScore(state.qKey, state.qAnswers);
   if(!canAdministerInstrument(state.qKey)){ alert(BLOCKED_MESSAGE); return; }
   if(result.status!=='VALID_OFFICIAL'){ alert(STATUS_MESSAGES[result.status]+' '+answerErrors(state.qKey,state.qAnswers).join('; ')); return; }
   $('nextBtn').disabled = true; $('nextBtn').textContent='Salvando...';
   try { await dbSaveResponses(state.patientId, {[state.qKey]:result}); }
   catch(error){ console.error(error); $('nextBtn').disabled=false; $('nextBtn').textContent='Concluir'; return; }
   state.responsesLocal[state.qKey] = result;
   state.view='justDone'; render();
  };
 }

 if(state.view==='justDone'){
  const keys = activeKeys(state.assignedKeys);
  const remaining = keys.filter(k=>!state.responsesLocal[k]);
  const next = remaining[0];
  if(next){
   const goNext = ()=>{
    if(justDoneTimer){ clearTimeout(justDoneTimer); justDoneTimer=null; }
    state.qKey = next; state.qIndex = 0;
    const q2 = QUESTIONNAIRES[next];
    const len2 = q2.type==='sections'? q2.data.length : q2.items.length;
    state.qAnswers = new Array(len2).fill(null);
    state.view='instructions'; render();
   };
   $('nextQBtn').onclick = goNext;
   $('seeListBtn').onclick = ()=>{ if(justDoneTimer){ clearTimeout(justDoneTimer); justDoneTimer=null; } state.view='list'; render(); };
   justDoneTimer = setTimeout(goNext, 2600);
  } else {
   justDoneTimer = setTimeout(()=>{ state.view='thanks'; render(); }, 2200);
  }
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
   state.slots = await dbListSlots();
   state.view='dashboard'; render();
  };
 }

 if(state.view==='dashboard'){
  $('logoutBtn').onclick = async ()=>{ await authLogout(); state.view='landing'; render(); };
  $('genDayBtn').onclick = async ()=>{
   const dateStr = $('bulkDate').value;
   if(!dateStr){ $('bulkDate').style.borderColor='#C00000'; return; }
   const existing = new Set((state.slots||[]).map(s=>new Date(s.slot_time).getTime()));
   const rows = generateSlotsForDate(dateStr).filter(d=>!existing.has(d.getTime())).map(d=>({slot_time:d.toISOString(), duration_minutes:10}));
   $('genDayBtn').disabled = true; $('genDayBtn').textContent = 'Gerando...';
   await dbAddSlotsBulk(rows);
   state.slots = await dbListSlots();
   render();
  };
  $('genRangeBtn').onclick = async ()=>{
   const startStr = $('bulkDate').value || new Date().toISOString().slice(0,10);
   const days = Math.max(1, Math.min(30, parseInt($('bulkDays').value)||1));
   const existing = new Set((state.slots||[]).map(s=>new Date(s.slot_time).getTime()));
   let rows = [];
   for(let i=0;i<days;i++){
    const d = new Date(startStr+'T00:00:00');
    d.setDate(d.getDate()+i);
    const ds = d.toISOString().slice(0,10);
    generateSlotsForDate(ds).forEach(dt=>{ if(!existing.has(dt.getTime())) rows.push({slot_time:dt.toISOString(), duration_minutes:10}); });
   }
   $('genRangeBtn').disabled = true; $('genRangeBtn').textContent = 'Gerando...';
   await dbAddSlotsBulk(rows);
   state.slots = await dbListSlots();
   render();
  };
  $('addSlotBtn').onclick = async ()=>{
   const val = $('newSlotTime').value;
   if(!val){ return; }
   $('addSlotBtn').disabled = true;
   await dbAddSlot(new Date(val).toISOString(), 10);
   state.slots = await dbListSlots();
   $('addSlotBtn').disabled = false;
   render();
  };
  document.querySelectorAll('[data-delslot]').forEach(el=>{
   el.onclick = async (e)=>{
    e.stopPropagation();
    if(!confirm('Excluir este horário da agenda?')) return;
    await dbDeleteSlot(el.dataset.delslot);
    state.slots = await dbListSlots();
    render();
   };
  });
  $('markAllBtn').onclick = ()=>{
   document.querySelectorAll('.qcheck-row').forEach(el=>{
    if(el.style.display !== 'none'){ if(!el.querySelector('.qcheck').disabled) el.querySelector('.qcheck').checked = true; }
   });
  };
  $('unmarkAllBtn').onclick = ()=>{
   document.querySelectorAll('.qcheck-row').forEach(el=>{
    if(el.style.display !== 'none'){ el.querySelector('.qcheck').checked = false; }
   });
  };
  $('qSearch').oninput = ()=>{
   const term = $('qSearch').value.trim().toLowerCase();
   let anyVisible = false;
   document.querySelectorAll('.qcheck-row').forEach(el=>{
    const match = !term || el.dataset.search.includes(term);
    el.style.display = match ? 'flex' : 'none';
    if(match) anyVisible = true;
   });
   $('qSearchEmpty').style.display = anyVisible ? 'none' : 'block';
  };
  $('genLinkBtn').onclick = async ()=>{
   const name = $('newName').value.trim();
   if(!name){ $('newName').style.borderColor='#C00000'; return; }
   const checked = Array.from(document.querySelectorAll('.qcheck:checked')).map(el=>el.value).filter(canAdministerInstrument);
   if(!checked.length){ alert('Selecione ao menos um questionário para este paciente.'); return; }
   $('genLinkBtn').disabled = true; $('genLinkBtn').textContent = 'Gerando...';
   const id = await dbCreateAssignment(name, $('newPhone').value.trim(), checked);
   const link = window.location.origin + window.location.pathname + '?p=' + id;
   $('linkResult').style.display = 'block';
   $('linkText').textContent = link;
   $('genLinkBtn').disabled = false; $('genLinkBtn').textContent = 'Gerar link';
   state.patients = await dbListAll();
  };
  $('copyLinkBtn') && ($('copyLinkBtn').onclick = ()=>{
   navigator.clipboard.writeText($('linkText').textContent).then(()=>{
    $('copyLinkBtn').textContent = 'Copiado ✓';
    setTimeout(()=>{ if($('copyLinkBtn')) $('copyLinkBtn').textContent='Copiar link'; }, 2000);
   });
  });
  $('refreshBtn').onclick = async ()=>{
   $('refreshBtn').textContent='Atualizando...';
   state.patients = await dbListAll();
   state.slots = await dbListSlots();
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
  document.querySelectorAll('[data-toggledetail]').forEach(el=>{
   el.onclick = (e)=>{
    e.stopPropagation();
    const key = el.dataset.toggledetail;
    state.openDetails[key] = !state.openDetails[key];
    render();
   };
  });
  document.querySelectorAll('[data-copyreport]').forEach(el=>{
   el.onclick = (e)=>{
    e.stopPropagation();
    const p = state.patients.find(pp=>pp.id===el.dataset.copyreport);
    if(!p) return;
    navigator.clipboard.writeText(buildReportText(p)).then(()=>{
     const original = el.textContent;
     el.textContent = 'Copiado ✓';
     setTimeout(()=>{ el.textContent = original; }, 2000);
    });
   };
  });
  document.querySelectorAll('[data-downloadreport]').forEach(el=>{
   el.onclick = (e)=>{
    e.stopPropagation();
    const p = state.patients.find(pp=>pp.id===el.dataset.downloadreport);
    if(!p) return;
    const text = buildReportText(p);
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'avaliacao-'+p.name.trim().toLowerCase().replace(/[^a-z0-9]+/gi,'-')+'.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
   };
  });
 }
}

/* ---------- Inicialização: se já houver sessão salva, pula direto pro painel ---------- */
window.addEventListener?.('beforeunload',e=>{if(state.view==='wizard'&&state.qAnswers.some(isAnswered)){e.preventDefault();e.returnValue='';}});
(async function init(){
 const params = new URLSearchParams(window.location.search);
 const pid = params.get('p');
 if(pid){
  const row = await dbGetAssignment(pid);
  if(!row){ state.view='invalidLink'; render(); return; }
  state.patientId = pid;
  state.patientName = row.name;
  state.assignedKeys = (row.assigned && row.assigned.length) ? row.assigned : null;
  state.responsesLocal = row.responses || {};
  state.view = 'list';
  render();
  return;
 }
 const user = await authCurrentUser();
 if(user){
  state.patients = await dbListAll();
  state.slots = await dbListSlots();
  state.view='dashboard';
 }
 render();
})();

})();
