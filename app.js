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
function dn4Band(raw){
  if(raw>=3) return {label:'Sugestivo de dor neuropática', txt:'var(--r3-txt)', bg:'var(--r3-bg)'};
  return {label:'Não sugestivo', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
}
function csiBand(raw){
  if(raw>=60) return {label:'Extrema', txt:'var(--r4-txt)', bg:'var(--r4-bg)'};
  if(raw>=50) return {label:'Grave', txt:'var(--r3-txt)', bg:'var(--r3-bg)'};
  if(raw>=40) return {label:'Moderada', txt:'var(--r2-txt)', bg:'var(--r2-bg)'};
  if(raw>=30) return {label:'Leve', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
  return {label:'Subclínica', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
}
function orebroBand(raw){
  if(raw>=50) return {label:'Alto risco de cronificação', txt:'var(--r3-txt)', bg:'var(--r3-bg)'};
  if(raw>=40) return {label:'Risco moderado', txt:'var(--r2-txt)', bg:'var(--r2-bg)'};
  return {label:'Baixo risco', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
}
function essBand(raw){
  if(raw>=16) return {label:'Sonolência excessiva grave', txt:'var(--r4-txt)', bg:'var(--r4-bg)'};
  if(raw>=10) return {label:'Sonolência diurna excessiva', txt:'var(--r3-txt)', bg:'var(--r3-bg)'};
  return {label:'Dentro da faixa normal', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
}
function mjoaBand(raw, maxPossible){
  const scaled = maxPossible ? (raw/maxPossible)*18 : raw;
  if(scaled>=15) return {label:'Mielopatia leve', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
  if(scaled>=12) return {label:'Mielopatia moderada', txt:'var(--r2-txt)', bg:'var(--r2-bg)'};
  return {label:'Mielopatia grave', txt:'var(--r3-txt)', bg:'var(--r3-bg)'};
}
function ictBand(total){
  if(total>=44) return {label:'Excelente', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
  if(total>=37) return {label:'Boa', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
  if(total>=28) return {label:'Moderada', txt:'var(--r2-txt)', bg:'var(--r2-bg)'};
  return {label:'Baixa (recomenda-se restaurar a capacidade)', txt:'var(--r3-txt)', bg:'var(--r3-bg)'};
}
function psfsItemBand(v){
  if(v>=7) return {label:'Preservada', txt:'var(--r1-txt)', bg:'var(--r1-bg)'};
  if(v>=4) return {label:'Moderada', txt:'var(--r2-txt)', bg:'var(--r2-bg)'};
  return {label:'Grave', txt:'var(--r3-txt)', bg:'var(--r3-bg)'};
}
function pillHtml(band){ return `<span class="pill" style="color:${band.txt};background:${band.bg}">${band.label}</span>`; }
// Uma resposta é "válida para contagem" se não for null/undefined e não for o marcador
// especial 'NA' (usado quando a pessoa marca "Não se aplica a mim / pular esta pergunta").
function isAnswered(v){ return v!==null && v!==undefined && v!=='NA'; }

function renderItemDetail(k, r){
 const q = QUESTIONNAIRES[k];
 const ans = r.rawAnswers;
 if(!ans) return '<p class="sub" style="margin:6px 0;">Sem detalhe item a item disponível.</p>';
 let rows = [];
 if(q.type==='sections'){
  rows = q.data.map((sec,i)=>{
   const [domain, opts] = sec;
   const v = ans[i];
   const txt = v==='NA' ? '<span style="color:var(--muted)">não se aplica / pulou</span>' : ((v!==null && v!==undefined) ? opts[v] : '<span style="color:var(--muted)">não respondido</span>');
   return `<div style="padding:9px 0;border-bottom:1px dashed var(--line);"><div style="font-weight:600;font-size:13px;">${domain}</div><div style="font-size:13px;color:var(--ink);margin-top:2px;">${txt}</div></div>`;
  });
 } else if(q.type==='likert'){
  rows = q.items.map((item,i)=>{
   const opts = q.optsPerItem ? q.optsPerItem[i] : q.opts;
   const v = ans[i];
   const txt = v==='NA' ? '<span style="color:var(--muted)">não se aplica / pulou</span>' : ((v!==null && v!==undefined) ? opts[v] : '<span style="color:var(--muted)">não respondido</span>');
   return `<div style="padding:9px 0;border-bottom:1px dashed var(--line);"><div style="font-size:13px;color:var(--muted);">${item}</div><div style="font-size:13px;font-weight:600;margin-top:2px;">${txt}</div></div>`;
  });
 } else if(q.type==='yesno'){
  rows = q.items.map((item,i)=>{
   const v = ans[i];
   const txt = v==='NA' ? '<span style="color:var(--muted)">não se aplica / pulou</span>' : ((v===1) ? 'Sim' : (v===0 ? 'Não' : '<span style="color:var(--muted)">não respondido</span>'));
   return `<div style="padding:9px 0;border-bottom:1px dashed var(--line);display:flex;justify-content:space-between;gap:14px;"><div style="font-size:13px;">${item}</div><div style="font-size:13px;font-weight:600;white-space:nowrap;">${txt}</div></div>`;
  });
 } else if(q.type==='nmq'){
  const yn=(v)=> v===1?'Sim':(v===0?'Não':'—');
  rows = q.items.map((region,i)=>{
   const a = ans[i];
   if(!a || a.y12===null || a.y12===undefined) return `<div style="padding:9px 0;border-bottom:1px dashed var(--line);"><div style="font-weight:600;font-size:13px;">${region}</div><div style="font-size:13px;color:var(--muted);">não respondido</div></div>`;
   return `<div style="padding:9px 0;border-bottom:1px dashed var(--line);"><div style="font-weight:600;font-size:13px;">${region}</div><div style="font-size:12.5px;color:var(--ink);margin-top:2px;">12 meses: ${yn(a.y12)} · Impediu atividade: ${yn(a.impede)} · Últimos 7 dias: ${yn(a.y7)}</div></div>`;
  });
 }
 if(!rows.length) return '';
 return `<div style="margin-top:6px;padding-top:2px;">${rows.join('')}</div>`;
}

function buildReportText(p){
 const lines = [];
 lines.push('AVALIAÇÃO FUNCIONAL — '+p.name);
 lines.push('Registro criado em: '+new Date(p.created_at).toLocaleString('pt-BR'));
 lines.push('');
 const keys = Object.keys(p.responses||{});
 if(!keys.length){ lines.push('Nenhum questionário respondido ainda.'); return lines.join('\n'); }
 keys.forEach(k=>{
  const r = p.responses[k];
  const qdef = QUESTIONNAIRES[k];
  const ans = r.rawAnswers;
  lines.push('='.repeat(60));
  lines.push(qdef.title);
  lines.push('='.repeat(60));

  if(k==='eva'){
   qdef.items.forEach((label,i)=>{ lines.push(label+': '+(r.answers[i]??'-')+'/10'); });
  } else if(k==='psfs'){
   (r.activities||[]).forEach(a=>{ if(a && !a.skipped && a.activity) lines.push((a.activity||'(sem nome)')+': '+(a.score??'-')+'/10'); });
  } else if(k==='dn4'){
   lines.push('Resultado: '+r.raw+'/7 itens positivos (corte usual: \u22653/7 sugere dor neuropática)');
   lines.push('');
   qdef.items.forEach((item,i)=>{
    const v = ans ? ans[i] : null;
    lines.push(item+' '+(v===1?'Sim':(v===0?'Não':'(não respondido)')));
   });
  } else if(k==='mjoa'){
   const band = mjoaBand(r.raw, r.maxPossible);
   lines.push('Resultado: '+r.raw+'/'+(r.maxPossible||18)+' pontos — '+band.label);
   lines.push('');
   qdef.data.forEach((sec,i)=>{
    const [domain, opts] = sec;
    const v = ans ? ans[i] : null;
    lines.push(domain+': '+((isAnswered(v))?opts[v]:'(não respondido)'));
   });
  } else if(k==='nmq'){
   lines.push('Resultado: '+r.y12count+' regiões com sintoma nos últimos 12 meses · '+r.y7count+' nos últimos 7 dias · '+r.impedeCount+' com impacto funcional');
   if(r.regions && r.regions.length) lines.push('Regiões afetadas: '+r.regions.join(', '));
   lines.push('');
   qdef.items.forEach((region,i)=>{
    const a = ans ? ans[i] : null;
    const yn=(v)=> v===1?'Sim':(v===0?'Não':'—');
    if(!a || a.y12===null || a.y12===undefined){ lines.push(region+': não respondido'); return; }
    lines.push(region+' — 12 meses: '+yn(a.y12)+' · Impediu atividade: '+yn(a.impede)+' · Últimos 7 dias: '+yn(a.y7));
   });
  } else if(k==='ict'){
   if(r.incomplete || r.raw===null){
    lines.push('Resultado: '+r.n+'/11 itens respondidos — incompleto. O cálculo do total oficial do WAI exige os 11 itens respondidos (nenhum como "não se aplica"). Complete todos os itens para obter a classificação.');
   } else {
    const band = ictBand(r.raw);
    lines.push('Resultado: '+r.raw+'/49 pontos — '+band.label+' (referência oficial: 7-27 baixa, 28-36 moderada, 37-43 boa, 44-49 excelente).');
   }
   lines.push('');
   qdef.data.forEach((sec,i)=>{
    const [domain, opts] = sec;
    const v = ans ? ans[i] : null;
    lines.push(domain+': '+(v==='NA'?'(não se aplica / pulou)':(isAnswered(v)?opts[v]:'(não respondido)')));
   });
  } else if(k==='wpi'){
   lines.push('Resultado: WPI = '+r.raw+'/19 regiões com dor na última semana. Critério ACR de fibromialgia: WPI \u22657 (com SSS \u22655) OU WPI 4-6 (com SSS \u22659) — ver resultado do SSS.');
   lines.push('');
   qdef.items.forEach((region,i)=>{
    const v = ans ? ans[i] : null;
    lines.push(region+': '+(v===1?'Sim':(v===0?'Não':'(não respondido)')));
   });
  } else if(k==='sss'){
   lines.push('Resultado: SSS = '+r.raw+'/12 pontos. Critério ACR de fibromialgia: SSS \u22655 (com WPI \u22657) OU SSS \u22659 (com WPI 4-6) — ver resultado do WPI.');
   lines.push('');
   qdef.data.forEach((sec,i)=>{
    const [domain, opts] = sec;
    const v = ans ? ans[i] : null;
    lines.push(domain+': '+((isAnswered(v))?opts[v]:'(não respondido)'));
   });
  } else if(k==='hads'){
   lines.push('Resultado: Ansiedade = '+r.anxSum+'/21 pontos · Depressão = '+r.depSum+'/21 pontos. Referência usual por subescala: 0-7 normal, 8-10 leve/limítrofe, \u226511 clinicamente significativo.');
   lines.push('');
   qdef.items.forEach((item,i)=>{
    const v = ans ? ans[i] : null;
    lines.push((i<7?'[Ansiedade] ':'[Depressão] ')+item+' '+((isAnswered(v))?qdef.opts[v]:'(não respondido)'));
   });
  } else if(k==='csi'){
   const band = csiBand(r.raw);
   lines.push('Resultado: '+r.raw+'/100 pontos — Sensibilização central: '+band.label+' (referência: <30 subclínica, 30-39 leve, 40-49 moderada, 50-59 grave, \u226560 extrema).');
   lines.push('');
   qdef.items.forEach((item,i)=>{
    const v = ans ? ans[i] : null;
    lines.push(item+' '+((isAnswered(v))?qdef.opts[v]:'(não respondido)'));
   });
  } else if(k==='orebro'){
   const band = orebroBand(r.raw);
   lines.push('Resultado: '+r.raw+'/100 (normalizado) — '+band.label+' (referência aproximada: \u226550 alto risco de cronificação/não retorno ao trabalho). ATENÇÃO: os pontos de corte oficiais do Örebro foram validados sobre a soma bruta dos itens originais; aqui o resultado foi normalizado para 0-100 pela pontuação máxima possível — trate como aproximação e não como o escore oficial exato.');
   lines.push('');
   qdef.data.forEach((sec,i)=>{
    const [domain, opts] = sec;
    const v = ans ? ans[i] : null;
    lines.push(domain+': '+((isAnswered(v))?opts[v]:'(não respondido)'));
   });
  } else if(k==='ess'){
   const band = essBand(r.raw);
   lines.push('Resultado: '+r.raw+'/24 pontos — '+band.label+' (referência: 0-9 normal, 10-15 sonolência excessiva, \u226516 grave).');
   lines.push('');
   qdef.items.forEach((item,i)=>{
    const v = ans ? ans[i] : null;
    lines.push(item+' '+((isAnswered(v))?qdef.opts[v]:'(não respondido)'));
   });
  } else if(k==='chalder'){
   lines.push('Resultado: Fadiga física = '+r.physSum+'/21 pontos · Fadiga mental = '+r.mentSum+'/12 pontos (total '+r.raw+'/33).');
   lines.push('');
   qdef.items.forEach((item,i)=>{
    const v = ans ? ans[i] : null;
    lines.push((i<7?'[Física] ':'[Mental] ')+item+' '+((isAnswered(v))?qdef.opts[v]:'(não respondido)'));
   });
  } else {
   const band = cifBand(r.pct);
   let summary = 'Resultado: '+r.pct.toFixed(0)+'% — '+band.label+' (qualificador CIF '+band.q+')';
   if(k==='pcs'){ summary += ' · '+r.raw+'/52 pontos (corte clínico usual: \u226530)'; }
   if(k==='fabq'){ summary += ' · '+r.raw+'/42 pontos (corte usual: \u226534)'; }
   if(k==='fabqpa'){ summary += ' · '+r.raw+'/24 pontos'; }
   if(k==='rmdq'){ summary += ' · '+r.raw+'/24 itens marcados'; }
   if(k==='hit6'){ summary += ' · '+r.raw+' pontos, soma simplificada (o escore oficial usa pesos por item — confira antes de citar categoria de impacto no laudo)'; }
   if(k==='comi'){ summary += ' · '+r.raw+'/'+r.maxPossible+' pontos'; }
   lines.push(summary);
   lines.push('');
   if(qdef.type==='sections'){
    qdef.data.forEach((sec,i)=>{
     const [domain, opts] = sec;
     const v = ans ? ans[i] : null;
     lines.push(domain+': '+(v==='NA'?'(não se aplica / pulou)':(isAnswered(v)?opts[v]:'(não respondido)')));
    });
   } else if(qdef.type==='likert'){
    qdef.items.forEach((item,i)=>{
     const opts = qdef.optsPerItem ? qdef.optsPerItem[i] : qdef.opts;
     const v = ans ? ans[i] : null;
     lines.push(item+' '+(v==='NA'?'(não se aplica / pulou)':(isAnswered(v)?opts[v]:'(não respondido)')));
    });
   } else if(qdef.type==='yesno'){
    qdef.items.forEach((item,i)=>{
     const v = ans ? ans[i] : null;
     lines.push(item+' '+(v==='NA'?'(não se aplica / pulou)':(v===1?'Sim':(v===0?'Não':'(não respondido)'))));
    });
   }
  }
  lines.push('');
 });
 return lines.join('\n');
}

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

const DN4_ITEMS = [
 "A dor tem sensação de queimação?",
 "A dor dá sensação de frio dolorido?",
 "A dor vem em choques elétricos?",
 "A dor é acompanhada de formigamento?",
 "A dor é acompanhada de alfinetadas e agulhadas?",
 "A dor é acompanhada de dormência?",
 "A dor é acompanhada de coceira?"
];

const FABQ_TRABALHO_ITEMS = [
 "Minha dor foi causada por atividade física no trabalho ou por um acidente no trabalho.",
 "A atividade física agrava minha dor.",
 "Eu tenho o direito de receber compensação financeira pela minha dor relacionada ao trabalho.",
 "Meu trabalho é fisicamente pesado demais para mim.",
 "Meu trabalho piora, ou pioraria, minha dor.",
 "Meu trabalho pode causar dano à minha coluna/ao meu corpo.",
 "Eu não deveria fazer meu trabalho normal com a minha dor atual."
];
const FABQ_OPTS = ["0 — Discordo totalmente","1","2","3 — Neutro","4","5","6 — Concordo totalmente"];

const PCS_ITEMS = [
 "Fico preocupado(a) o tempo todo pensando se a dor vai passar.",
 "Sinto que não consigo mais suportar.",
 "É terrível e acho que a dor nunca vai melhorar.",
 "É horrível e sinto que a dor domina completamente minha vida.",
 "Sinto que não aguento mais.",
 "Tenho medo de que a dor piore.",
 "Fico pensando em outras situações em que senti dor.",
 "Desejo ansiosamente que a dor desapareça.",
 "Não consigo tirar a dor da cabeça.",
 "Fico pensando o tempo todo em quanto isso dói.",
 "Fico pensando o tempo todo em como eu quero que a dor pare.",
 "Não há nada que eu possa fazer para reduzir a intensidade da dor.",
 "Fico pensando se pode acontecer algo grave comigo por causa da dor."
];
const PCS_OPTS = ["0 — Nunca","1 — Poucas vezes","2 — Moderadamente","3 — Muitas vezes","4 — Sempre"];

const RMDQ_ITEMS = [
 "Fico em casa a maior parte do tempo por causa da minha coluna.",
 "Mudo de posição frequentemente tentando deixar minha coluna confortável.",
 "Ando mais devagar que o normal por causa da minha coluna.",
 "Por causa da minha coluna, não estou fazendo nenhum dos trabalhos que costumo fazer em casa.",
 "Por causa da minha coluna, uso o corrimão para subir escadas.",
 "Por causa da minha coluna, deito-me para descansar mais frequentemente.",
 "Por causa da minha coluna, preciso me apoiar em algo para me levantar de uma poltrona.",
 "Por causa da minha coluna, peço para outras pessoas fazerem coisas por mim.",
 "Visto-me mais devagar que o normal por causa da minha coluna.",
 "Só fico em pé por curtos períodos de tempo por causa da minha coluna.",
 "Por causa da minha coluna, tento não me abaixar ou ajoelhar.",
 "Sinto dificuldade em me levantar de uma cadeira por causa da minha coluna.",
 "Minha coluna dói quase o tempo todo.",
 "Tenho dificuldade em me virar na cama por causa da minha coluna.",
 "Meu apetite não é muito bom por causa da dor na minha coluna.",
 "Tenho problemas para colocar as meias por causa da dor na minha coluna.",
 "Só consigo andar distâncias curtas por causa da dor na minha coluna.",
 "Durmo pior por causa da minha coluna.",
 "Por causa da dor na minha coluna, preciso de ajuda para me vestir.",
 "Fico sentado a maior parte do dia por causa da minha coluna.",
 "Evito trabalhos pesados em casa por causa da minha coluna.",
 "Por causa da dor na coluna, fico mais irritado(a) e mal-humorado(a) com as pessoas do que o normal.",
 "Por causa da minha coluna, subo escadas mais devagar que o normal.",
 "Fico na cama a maior parte do tempo por causa da minha coluna."
];

const MJOA_MAX = [5,7,3,3];
const MJOA_SECTIONS = [
 ["Função motora dos membros superiores (mãos e braços)",[
  "Não consigo mover as mãos de forma alguma",
  "Não consigo me alimentar sozinho(a) ou usar talheres por dormência/fraqueza nas mãos, mas consigo mover as mãos",
  "Consigo segurar objetos como talheres, mas não consigo usá-los por dormência/fraqueza",
  "Consigo segurar talheres, mas não uso bem por dormência/fraqueza",
  "Consigo usar as mãos com leve falta de jeito",
  "Nenhuma dificuldade"]],
 ["Função motora dos membros inferiores (pernas)",[
  "Perda completa de movimento e sensibilidade nas pernas",
  "Sensibilidade preservada, mas não consigo mover as pernas",
  "Consigo mover as pernas, mas não consigo andar",
  "Consigo andar em piso plano com apoio (bengala ou muleta)",
  "Consigo subir e/ou descer escadas com apoio no corrimão",
  "Falta de estabilidade moderada a importante, mas consigo subir/descer escadas sem corrimão",
  "Leve falta de estabilidade, mas ando de forma suave e sem ajuda",
  "Nenhuma dificuldade"]],
 ["Sensibilidade nas mãos e braços",[
  "Perda completa de sensibilidade nas mãos",
  "Perda importante de sensibilidade, ou dor",
  "Perda leve de sensibilidade",
  "Sensibilidade normal"]],
 ["Controle da urina (função esfincteriana)",[
  "Não consigo urinar por vontade própria (retenção completa)",
  "Dificuldade importante para urinar (retenção acentuada, esforço para urinar, ou perdas urinárias)",
  "Dificuldade leve a moderada (urgência, aumento da frequência, hesitação)",
  "Normal"]]
];

const PSFS_STEPS = [
 "Atividade 1 de 3 — pense em algo que você tem dificuldade de fazer hoje por causa do problema",
 "Atividade 2 de 3",
 "Atividade 3 de 3"
];

const WIQ_ABILITY_OPTS = ["Incapaz de fazer","Muita dificuldade","Dificuldade moderada","Pouca dificuldade","Nenhuma dificuldade"];
const WIQ_ITEMS = [
 "Andar dentro de casa, de um cômodo a outro.",
 "Andar cerca de 50 metros (por exemplo, até o portão de casa e voltar).",
 "Andar cerca de 150 metros (mais ou menos meio quarteirão).",
 "Andar cerca de 300 metros (mais ou menos um quarteirão).",
 "Andar cerca de 900 metros (mais ou menos três quarteirões).",
 "Andar bem devagar.",
 "Andar num ritmo normal.",
 "Andar rápido.",
 "Correr uma curta distância.",
 "Subir 1 andar de escada.",
 "Subir 2 andares de escada.",
 "Subir 3 andares de escada."
];

const LEFS_OPTS = ["Dificuldade extrema ou incapaz de fazer","Muita dificuldade","Dificuldade moderada","Pouca dificuldade","Nenhuma dificuldade"];
const LEFS_ITEMS = [
 "Qualquer uma das suas atividades domésticas habituais.",
 "Seus hobbies, atividades recreativas ou esportes.",
 "Entrar ou sair de dentro de um carro.",
 "Caminhar de um cômodo a outro da casa.",
 "Colocar ou tirar meias.",
 "Agachar-se.",
 "Levantar um objeto do chão, como uma sacola de compras.",
 "Realizar atividades domésticas leves.",
 "Realizar atividades domésticas pesadas.",
 "Entrar ou sair da banheira/box do banho.",
 "Andar cerca de 300 metros.",
 "Subir ou descer cerca de 10 degraus (mais ou menos um lance de escada).",
 "Ficar em pé por 1 hora.",
 "Ficar sentado(a) por 1 hora.",
 "Correr em terreno plano.",
 "Correr em terreno irregular.",
 "Fazer curvas ou mudar de direção rapidamente enquanto anda ou corre.",
 "Pular.",
 "Rolar na cama.",
 "Sua atividade de trabalho habitual, do jeito que você normalmente faz."
];

const SFI_SECTIONS = [
 ["Intensidade da dor na coluna (do pescoço até a lombar), no momento",[
  "Não sinto dor na coluna",
  "A dor é leve",
  "A dor é moderada",
  "A dor é intensa",
  "A dor é a pior imaginável"]],
 ["Cuidados pessoais (vestir-se, lavar-se, calçar-se)",[
  "Nenhuma dificuldade por causa da coluna",
  "Um pouco de dificuldade, mas consigo fazer sozinho(a)",
  "Preciso de mais tempo ou de algum cuidado extra",
  "Preciso de ajuda em parte das tarefas",
  "Preciso de ajuda para a maioria das tarefas"]],
 ["Levantar objetos do chão",[
  "Nenhuma dificuldade por causa da coluna",
  "Um pouco de dificuldade com objetos pesados",
  "Dificuldade moderada, evito objetos pesados",
  "Só consigo levantar objetos leves",
  "Não consigo levantar nada do chão"]],
 ["Andar",[
  "A coluna não me impede de andar qualquer distância",
  "A coluna me impede de andar longas distâncias",
  "A coluna me impede de andar distâncias moderadas",
  "A coluna me impede de andar mesmo distâncias curtas",
  "Praticamente não consigo andar por causa da coluna"]],
 ["Sentar",[
  "Consigo sentar o tempo que quiser sem problema",
  "Consigo sentar por longos períodos, com algum desconforto",
  "A dor me impede de sentar por mais de 1 hora",
  "A dor me impede de sentar por mais de 30 minutos",
  "A dor me impede quase totalmente de sentar"]],
 ["Ficar em pé",[
  "Consigo ficar em pé o tempo que quiser sem problema",
  "Consigo ficar em pé por longos períodos, com algum desconforto",
  "A dor me impede de ficar em pé por mais de 1 hora",
  "A dor me impede de ficar em pé por mais de 30 minutos",
  "A dor me impede quase totalmente de ficar em pé"]],
 ["Dormir",[
  "Meu sono nunca é perturbado pela dor na coluna",
  "Meu sono é ocasionalmente perturbado",
  "Meu sono é perturbado com frequência",
  "Durmo poucas horas por causa da dor",
  "A dor me impede quase totalmente de dormir"]],
 ["Atividades sociais e de lazer",[
  "Minha vida social é normal, sem limitação pela coluna",
  "Minha vida social é normal, mas com algum desconforto",
  "Reduzi algumas atividades sociais/de lazer por causa da coluna",
  "Reduzi bastante minhas atividades sociais/de lazer",
  "Praticamente não tenho vida social por causa da coluna"]],
 ["Viajar (dirigir, andar de carro ou ônibus)",[
  "Consigo viajar para qualquer lugar sem problema",
  "Consigo viajar, mas com algum desconforto",
  "A dor limita viagens mais longas",
  "A dor limita até viagens curtas",
  "A dor praticamente me impede de viajar"]],
 ["Capacidade de realizar seu trabalho habitual",[
  "Nenhuma limitação da coluna para o trabalho",
  "Pequena limitação, consigo fazer quase tudo",
  "Limitação moderada, preciso adaptar tarefas",
  "Limitação importante, faço poucas das tarefas habituais",
  "Não consigo realizar o trabalho habitual por causa da coluna"]]
];

const NMQ_REGIONS = ["Pescoço","Ombros","Região torácica (parte de cima das costas)","Cotovelos","Região lombar (parte de baixo das costas)","Punhos e mãos","Quadril e coxas","Joelhos","Tornozelos e pés"];

const ICT_SECTIONS = [
 ["As exigências do seu trabalho são, principalmente:",[
  "Principalmente mentais","Principalmente físicas","Tanto mentais quanto físicas, igualmente"]],
 ["Capacidade atual para o trabalho, comparada à melhor capacidade de toda a sua vida (0 a 10)",[
  "0 — Totalmente incapaz de trabalhar","1","2","3","4","5 — Capacidade moderada","6","7","8","9","10 — Capacidade no seu melhor momento de vida"]],
 ["Capacidade de trabalho em relação às exigências físicas do seu trabalho",[
  "Muito baixa","Baixa","Moderada","Boa","Muito boa"]],
 ["Capacidade de trabalho em relação às exigências mentais do seu trabalho",[
  "Muito baixa","Baixa","Moderada","Boa","Muito boa"]],
 ["Número de doenças atuais diagnosticadas por um médico",[
  "Nenhuma","1 doença","2 ou 3 doenças","4 ou mais doenças"]],
 ["Seu problema de saúde é um obstáculo para o seu trabalho atual?",[
  "Não há obstáculo / não tenho doenças",
  "Consigo fazer meu trabalho, mas ele me causa alguns sintomas",
  "Às vezes preciso reduzir o ritmo ou mudar a forma de trabalhar",
  "Frequentemente preciso reduzir o ritmo ou mudar a forma de trabalhar",
  "Por causa da doença, só consigo trabalhar em tempo parcial",
  "Na minha opinião, sou totalmente incapaz de trabalhar"]],
 ["Quantos dias inteiros você ficou afastado do trabalho por um problema de saúde nos últimos 12 meses?",[
  "Nenhum dia","Até 9 dias","De 10 a 24 dias","De 25 a 99 dias","De 100 a 365 dias"]],
 ["Você acredita que, do ponto de vista da sua saúde, conseguirá fazer seu trabalho atual dentro de 2 anos?",[
  "Pouco provável","Não tenho certeza","Relativamente certo que sim"]],
 ["Nos últimos tempos, você tem conseguido sentir prazer nas suas atividades diárias habituais?",[
  "Nunca","Raramente","Às vezes","Frequentemente","Sempre"]],
 ["Nos últimos tempos, você tem se sentido ativo(a) e alerta?",[
  "Nunca","Raramente","Às vezes","Frequentemente","Sempre"]],
 ["Nos últimos tempos, você tem se sentido cheio(a) de esperança em relação ao futuro?",[
  "Nunca","Raramente","Às vezes","Frequentemente","Sempre"]]
];

/* ---- FIQR (Fibromyalgia Impact Questionnaire — Revised) ---- */
const FIQR_FUNC_OPTS = ["0 — Nenhuma dificuldade","1","2","3","4","5 — Dificuldade moderada","6","7","8","9","10 — Não consigo fazer"];
const FIQR_IMPACT_OPTS = ["0 — Nada","1","2","3","4","5 — Moderadamente","6","7","8","9","10 — Totalmente"];
const FIQR_SYMPTOM_OPTS = ["0 — Nenhum(a)","1","2","3","4","5 — Moderado(a)","6","7","8","9","10 — O pior possível"];
const FIQR_ITEMS = [
 ["Fazer compras",FIQR_FUNC_OPTS],
 ["Lavar e passar roupa",FIQR_FUNC_OPTS],
 ["Preparar refeições",FIQR_FUNC_OPTS],
 ["Lavar louça à mão, passar pano ou aspirar",FIQR_FUNC_OPTS],
 ["Arrumar a cama",FIQR_FUNC_OPTS],
 ["Andar longas distâncias",FIQR_FUNC_OPTS],
 ["Visitar amigos ou familiares",FIQR_FUNC_OPTS],
 ["Fazer atividades ao ar livre (jardim, caminhada)",FIQR_FUNC_OPTS],
 ["Trocar de posição na cama para dormir",FIQR_FUNC_OPTS],
 ["O quanto a fibromialgia te impede de atingir seus objetivos pessoais e profissionais",FIQR_IMPACT_OPTS],
 ["O quanto você se sente sobrecarregado(a) ou estressado(a) por causa da fibromialgia",FIQR_IMPACT_OPTS],
 ["Dor",FIQR_SYMPTOM_OPTS],
 ["Falta de energia (fadiga)",FIQR_SYMPTOM_OPTS],
 ["Rigidez",FIQR_SYMPTOM_OPTS],
 ["Qualidade do sono (sono não reparador)",FIQR_SYMPTOM_OPTS],
 ["Depressão",FIQR_SYMPTOM_OPTS],
 ["Problemas de memória",FIQR_SYMPTOM_OPTS],
 ["Ansiedade",FIQR_SYMPTOM_OPTS],
 ["Sensibilidade ao toque",FIQR_SYMPTOM_OPTS],
 ["Equilíbrio",FIQR_SYMPTOM_OPTS],
 ["Sensibilidade a ruído, luz, frio ou perfume",FIQR_SYMPTOM_OPTS]
];

/* ---- WPI (Widespread Pain Index — critério ACR de fibromialgia) ---- */
const WPI_REGIONS = [
 "Ombro esquerdo","Ombro direito","Braço (parte de cima) esquerdo","Braço (parte de cima) direito",
 "Antebraço esquerdo","Antebraço direito","Quadril/nádega/trocânter esquerdo","Quadril/nádega/trocânter direito",
 "Mandíbula esquerda","Mandíbula direita","Tórax","Abdome","Pescoço","Costas (parte de cima)","Costas (parte de baixo)",
 "Coxa esquerda","Coxa direita","Perna esquerda (abaixo do joelho)","Perna direita (abaixo do joelho)"
];

/* ---- SSS (Symptom Severity Scale — companheira do WPI) ---- */
const SSS_SCALE_OPTS = ["Nenhum problema","Leve ou ocasional","Moderado, presente na maior parte do tempo","Severo, generalizado, constante, prejudica muito a vida"];
const SSS_OTHER_OPTS = ["Nenhum desses sintomas (nos últimos 6 meses)","Poucos desses sintomas","Um número moderado desses sintomas","Muitos desses sintomas"];
const SSS_SECTIONS = [
 ["Fadiga",SSS_SCALE_OPTS],
 ["Sono não reparador (dormir e não sentir que descansou)",SSS_SCALE_OPTS],
 ["Sintomas cognitivos (memória, concentração, \"névoa mental\")",SSS_SCALE_OPTS],
 ["Outros sintomas nos últimos 6 meses (dor de cabeça, dor/cólica abdominal, depressão, e outros sintomas somáticos)",SSS_OTHER_OPTS]
];

/* ---- HOOS (quadril) e KOOS (joelho) — mesma escala de dificuldade ---- */
const JOINT_DIFF_OPTS = ["Nenhuma dificuldade","Dificuldade leve","Dificuldade moderada","Dificuldade grave","Dificuldade extrema / incapaz"];
const HOOS_ITEMS = [
 "Dor ao girar/pivotear apoiado no quadril",
 "Dor ao ficar com o quadril totalmente esticado",
 "Dor ao subir ou descer escadas",
 "Dor à noite, na cama, por causa do quadril",
 "Rigidez no quadril ao acordar de manhã",
 "Amplitude de movimento limitada no quadril",
 "Ruídos ou estalos no quadril",
 "Descer escadas",
 "Subir escadas",
 "Levantar-se de uma posição sentada",
 "Ficar em pé por longos períodos",
 "Calçar meias ou sapatos",
 "Correr",
 "Agachar-se",
 "Dificuldade em geral com o quadril nas suas atividades do dia a dia",
 "Falta de confiança no seu quadril"
];
const KOOS_ITEMS = [
 "Dor ao girar/pivotear apoiado no joelho",
 "Dor ao ficar com o joelho totalmente esticado",
 "Dor ao subir ou descer escadas",
 "Dor à noite, na cama, por causa do joelho",
 "Rigidez no joelho ao acordar de manhã",
 "Inchaço no joelho",
 "Sensação de estalos ou crepitação no joelho",
 "Descer escadas",
 "Subir escadas",
 "Levantar-se de uma posição sentada",
 "Ficar em pé por longos períodos",
 "Agachar-se",
 "Correr",
 "Ajoelhar-se",
 "Dificuldade em geral com o joelho nas suas atividades do dia a dia",
 "Falta de confiança no seu joelho"
];

/* ---- FSS (Fatigue Severity Scale) ---- */
const FSS_OPTS = ["1 — Discordo totalmente","2","3","4 — Neutro","5","6","7 — Concordo totalmente"];
const FSS_ITEMS = [
 "Minha motivação é menor quando estou com fadiga.",
 "O exercício físico me deixa fatigado(a).",
 "Fico facilmente fatigado(a).",
 "A fadiga interfere no meu funcionamento físico.",
 "A fadiga me causa problemas frequentes.",
 "A fadiga impede que eu mantenha um funcionamento físico contínuo.",
 "A fadiga interfere na realização de certas tarefas e responsabilidades.",
 "A fadiga é um dos meus três sintomas mais incapacitantes.",
 "A fadiga interfere no meu trabalho, na família ou na vida social."
];

/* ---- PSQI (Índice de Qualidade do Sono de Pittsburgh) — 7 componentes ---- */
const PSQI_SECTIONS = [
 ["Como você classificaria a qualidade geral do seu sono?",[
  "Muito boa","Boa","Ruim","Muito ruim"]],
 ["Nas últimas semanas, quanto tempo você geralmente demora para pegar no sono?",[
  "15 minutos ou menos","16 a 30 minutos","31 a 60 minutos","Mais de 60 minutos"]],
 ["Quantas horas de sono de verdade (não só na cama) você tem, em geral, por noite?",[
  "Mais de 7 horas","6 a 7 horas","5 a 6 horas","Menos de 5 horas"]],
 ["Quantas vezes por semana seu sono foi realmente eficiente, com poucas interrupções?",[
  "A maioria das noites","Bastante frequente","Às vezes","Raramente ou nunca"]],
 ["Com que frequência algo perturba seu sono (acordar de madrugada, ir ao banheiro, sentir frio/calor, dor, pesadelos)?",[
  "Nenhuma vez nas últimas semanas","Menos de 1 vez por semana","1 a 2 vezes por semana","3 ou mais vezes por semana"]],
 ["Com que frequência você usa algum remédio (com ou sem receita) para conseguir dormir?",[
  "Nenhuma vez nas últimas semanas","Menos de 1 vez por semana","1 a 2 vezes por semana","3 ou mais vezes por semana"]],
 ["Com que frequência você tem dificuldade de ficar acordado(a) durante atividades do dia (dirigir, comer, socializar) ou falta de entusiasmo para fazer as coisas?",[
  "Nenhuma vez nas últimas semanas","Menos de 1 vez por semana","1 a 2 vezes por semana","3 ou mais vezes por semana"]]
];

/* ---- HIT-6 (Headache Impact Test) ---- */
const HIT6_OPTS = ["Nunca","Raramente","Algumas vezes","Muito frequentemente","Sempre"];
const HIT6_ITEMS = [
 "Quando você tem dor de cabeça, a intensidade da dor é forte?",
 "As dores de cabeça limitam sua capacidade de realizar atividades diárias habituais (trabalho, escola, casa, social)?",
 "Quando você tem dor de cabeça, você deseja se deitar?",
 "Nas últimas 4 semanas, você se sentiu cansado(a) demais para trabalhar ou fazer atividades diárias por causa da dor de cabeça?",
 "Nas últimas 4 semanas, você se sentiu enjoado(a) ou irritado(a) por causa da dor de cabeça?",
 "Nas últimas 4 semanas, as dores de cabeça limitaram sua capacidade de se concentrar no trabalho ou em atividades diárias?"
];

/* ---- FABQ-PA (subescala de atividade física, complementar à subescala de trabalho já existente) ---- */
const FABQ_PA_ITEMS = [
 "Minha dor foi causada por atividade física.",
 "A atividade física agrava minha dor.",
 "A atividade física poderia prejudicar minha coluna.",
 "Eu não deveria fazer atividades físicas que agravem minha dor."
];

/* ---- COMI-Back (Core Outcome Measures Index) ---- */
const COMI_MAX = [10,10,4,4,4,3,1];
const COMI_SECTIONS = [
 ["Intensidade da dor nas costas na última semana (0 a 10)",[
  "0 — Nenhuma dor","1","2","3","4","5 — Dor moderada","6","7","8","9","10 — A pior dor imaginável"]],
 ["Intensidade da dor na perna (se houver) na última semana (0 a 10)",[
  "0 — Nenhuma dor","1","2","3","4","5 — Dor moderada","6","7","8","9","10 — A pior dor imaginável"]],
 ["Nas duas últimas semanas, quanto sua dor nas costas interferiu nas suas atividades diárias habituais?",[
  "Nada","Um pouco","Moderadamente","Bastante","Extremamente"]],
 ["Como você avalia seu bem-estar geral relacionado ao seu problema de coluna, na última semana?",[
  "Muito bom","Bom","Regular","Ruim","Muito ruim"]],
 ["Como você avalia sua qualidade de vida em geral, na última semana?",[
  "Muito boa","Boa","Regular","Ruim","Muito ruim"]],
 ["Quantos dias você ficou afastado do trabalho ou de suas atividades habituais por causa da coluna, nos últimos 6 meses?",[
  "Nenhum dia","1 a 7 dias","8 a 30 dias","Mais de 30 dias"]],
 ["Você mudou de emprego ou de tarefas de trabalho por causa da sua coluna?",[
  "Não","Sim"]]
];

/* ---- HADS (Hospital Anxiety and Depression Scale) ---- */
const HADS_OPTS = ["Nunca","Raramente","Às vezes","Frequentemente"];
const HADS_ITEMS = [
 "Eu me sinto tenso(a) ou contraído(a).",
 "Sinto uma espécie de medo, como se algo ruim fosse acontecer.",
 "Fico preocupado(a) com pensamentos ruins.",
 "Consigo ficar sentado(a) tranquilamente e me sentir relaxado(a).",
 "Sinto uma espécie de aperto ou desconforto no estômago.",
 "Sinto-me inquieto(a), como se não pudesse ficar parado(a).",
 "Tenho sensações repentinas de pânico.",
 "Ainda sinto prazer nas coisas que eu costumava gostar de fazer.",
 "Sou capaz de rir e ver o lado divertido das coisas.",
 "Sinto-me alegre(a).",
 "Sinto-me mais lento(a), como se fizesse tudo mais devagar que antes.",
 "Perdi o interesse em cuidar da minha aparência.",
 "Aguardo as coisas com prazer e entusiasmo.",
 "Consigo apreciar um bom livro, programa de rádio ou TV."
];
const HADS_REVERSE = [3,7,8,9,12,13];

/* ---- CSI (Central Sensitization Inventory) — Parte A, 25 itens ---- */
const CSI_OPTS = ["Nunca","Raramente","Às vezes","Frequentemente","Sempre"];
const CSI_ITEMS = [
 "Sinto dor no corpo.",
 "Sinto-me cansado(a) com facilidade.",
 "Não durmo bem.",
 "Sinto dor de cabeça tensional.",
 "Sinto dor ou queimação ao urinar.",
 "Não me sinto descansado(a) pela manhã, mesmo após dormir muitas horas.",
 "Sinto dores musculares generalizadas pelo corpo.",
 "Tenho cólicas ou dor abdominal.",
 "Sinto-me deprimido(a).",
 "Tenho pouca energia.",
 "Sinto tensão nos músculos do pescoço e ombros.",
 "Sinto dor na mandíbula.",
 "Alguns cheiros, como perfumes, me deixam tonto(a) ou enjoado(a).",
 "Preciso urinar frequentemente.",
 "Minhas pernas ficam inquietas quando estou tentando dormir.",
 "Tenho dificuldade de concentração.",
 "Já tive uma lesão do tipo \"chicote\" (movimento brusco de pescoço, como em acidente de carro).",
 "Minha pele fica facilmente irritada quando algo toca nela.",
 "Tenho crises de pânico.",
 "Sinto ansiedade.",
 "Bebidas alcoólicas me deixam muito mal.",
 "Quando criança, sofri algum tipo de abuso físico ou emocional.",
 "Sinto dor nas articulações.",
 "Sinto que algo não está bem no meu corpo, sem saber exatamente o quê.",
 "Sofro de dor crônica em alguma parte do corpo."
];

/* ---- Örebro Musculoskeletal Pain Screening Questionnaire — versão curta (10 itens, 0 a 10) ---- */
const OREBRO_SCALE_RISK = ["0 — Nenhuma chance","1","2","3","4","5 — Chance moderada","6","7","8","9","10 — Certeza absoluta"];
const OREBRO_SCALE_PAIN = ["0 — Nenhuma dor","1","2","3","4","5 — Dor moderada","6","7","8","9","10 — A pior dor possível"];
const OREBRO_SCALE_INTERFERE = ["0 — Nada","1","2","3","4","5 — Moderadamente","6","7","8","9","10 — Totalmente"];
const OREBRO_SCALE_MOOD = ["0 — Nem um pouco","1","2","3","4","5 — Moderadamente","6","7","8","9","10 — Extremamente"];
const OREBRO_SECTIONS = [
 ["Em quantos dos últimos 7 dias você conseguiu realizar suas atividades normais (trabalho, casa, lazer), mesmo com dor?",[
  "0 — Nenhum dia","1","2","3","4","5 — Metade dos dias","6","7 — Todos os dias"]],
 ["Qual foi a intensidade média da sua dor na última semana?",OREBRO_SCALE_PAIN],
 ["Qual foi a intensidade da sua dor no pior momento do último mês?",OREBRO_SCALE_PAIN],
 ["Quantas vezes, nos últimos 3 meses, você teve episódios de dor como o atual?",[
  "Nenhuma vez, é a primeira vez","Uma vez antes","2 a 5 vezes","Mais de 5 vezes","A dor está sempre presente"]],
 ["Na sua opinião, qual é a chance de sua dor atual se tornar persistente (permanente)?",OREBRO_SCALE_RISK],
 ["Na sua opinião, qual é a chance de você conseguir voltar ao seu trabalho normal dentro dos próximos meses?",OREBRO_SCALE_RISK],
 ["O quanto a dor interferiu no seu trabalho ou nas suas atividades diárias na última semana?",OREBRO_SCALE_INTERFERE],
 ["O quanto você se sentiu triste ou deprimido(a) por causa da dor na última semana?",OREBRO_SCALE_MOOD],
 ["O quanto a tensão ou a ansiedade te afetou na última semana?",OREBRO_SCALE_MOOD],
 ["O quanto você acha que deveria evitar suas atividades normais (trabalho, esforço físico) por medo de piorar a dor ou se machucar?",OREBRO_SCALE_INTERFERE]
];

/* ---- ESS (Epworth Sleepiness Scale) ---- */
const ESS_OPTS = ["0 — Nenhuma chance de cochilar","1 — Pequena chance de cochilar","2 — Chance moderada de cochilar","3 — Alta chance de cochilar"];
const ESS_ITEMS = [
 "Sentado(a) e lendo",
 "Assistindo TV",
 "Sentado(a), inativo(a), em um lugar público (ex.: teatro, reunião, palestra)",
 "Como passageiro(a) de carro, andando por 1 hora sem parar",
 "Deitado(a) para descansar à tarde, quando as circunstâncias permitem",
 "Sentado(a) e conversando com alguém",
 "Sentado(a) calmamente depois de um almoço sem álcool",
 "No carro, parado(a) por alguns minutos no trânsito"
];

/* ---- Escala de Fadiga de Chalder (11 itens: 7 física + 4 mental) ---- */
const CHALDER_OPTS = ["Menos que o normal","Igual ao normal","Mais que o normal","Muito mais que o normal"];
const CHALDER_ITEMS = [
 "Você tem tido problemas de cansaço?",
 "Você precisa descansar mais?",
 "Você se sente sonolento(a) ou com vontade de dormir?",
 "Você tem dificuldade para começar as coisas?",
 "Você está com pouca força ou energia?",
 "Você se sente fraco(a)?",
 "Você tem dificuldade para terminar coisas que começou, por falta de energia?",
 "Você tem dificuldade de concentração?",
 "Você tem dificuldade para encontrar a palavra certa ao falar?",
 "Como está sua memória, no geral?",
 "Você comete erros bobos com mais frequência que o normal?"
];

// Explicações extras para perguntas mais técnicas/abstratas, mostradas em texto simples
// embaixo da pergunta. Indexado por [chave do questionário][índice da pergunta, 0-based].
const ITEM_HELP = {
 eva: {
  0: 'Pense em como está sua dor agora mesmo, neste momento, sem fazer nenhum esforço.',
  1: 'Pense no momento em que a dor costuma ficar mais forte no seu dia (para muita gente, é de manhã ao levantar, ou à noite).',
  2: 'Pense no momento em que a dor costuma ficar mais fraca, ou quase não aparece.',
  3: 'Imagine fazendo a atividade mais pesada do seu trabalho (levantar peso, ficar em pé muito tempo, repetir o mesmo movimento) e dê a nota de dor que você sentiria nessa hora.'
 },
 ict: {
  0: 'Pense no que você mais faz no seu trabalho no dia a dia.',
  8: 'Isso é sobre se sentir bem ao fazer as coisas que você gosta — não é sobre o problema de saúde.',
  9: 'Sentir-se "alerta" é estar atento, desperto, sem sonolência ou lentidão mental.',
  10: 'Isso é sobre o seu sentimento em relação ao futuro em geral, não sobre o problema de saúde específico.'
 },
 mjoa: {
  3: 'Essa pergunta é sobre o controle da urina (bexiga) — é uma pergunta padrão de avaliação neurológica, não precisa se sentir desconfortável em responder.'
 },
 tsk13: {
  4: 'Esta frase está no sentido contrário das outras — leia com calma antes de responder.'
 },
 fabq: {
  2: 'Isso pergunta sobre sua opinião/crença, não sobre o que você sente fisicamente.'
 },
 fabqpa: {
  0: 'Isso pergunta sobre sua opinião/crença, não sobre o que você sente fisicamente.'
 },
 pcs: {
  0: 'Isso é sobre os pensamentos que passam pela sua cabeça quando dói, não sobre a dor em si.'
 },
 csi: {
  16: 'Uma lesão do tipo "chicote" é quando o pescoço é jogado bruscamente pra frente e pra trás, como costuma acontecer em batidas de carro por trás.'
 },
 orebro: {
  0: 'Conte quantos dias, dos últimos 7, você conseguiu fazer suas atividades normais — mesmo sentindo dor.',
  3: 'Pense em quantas vezes esse tipo de dor já apareceu antes, nos últimos 3 meses.'
 }
};

const QUESTIONNAIRES = {
 odi: { title:"Índice de Incapacidade de Oswestry (ODI)", short:"ODI · coluna lombar", about:"Sobre a parte de baixo das suas costas (lombar).", type:"sections", data:ODI_SECTIONS,
  intro:"Estas perguntas são sobre a parte de baixo das suas costas (a coluna lombar) e como a dor atrapalha o seu dia a dia. Escolha a frase que mais parece com a sua situação hoje — não existe resposta certa ou errada.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*5))*100:0, raw:sum, n:a.length}; } },
 ndi: { title:"Índice de Incapacidade Cervical (NDI)", short:"NDI · coluna cervical", about:"Sobre o seu pescoço.", type:"sections", data:NDI_SECTIONS,
  intro:"Estas perguntas são sobre o seu pescoço e como a dor atrapalha o seu dia a dia. Escolha a frase que mais parece com a sua situação hoje.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*5))*100:0, raw:sum, n:a.length}; } },
 tsk13: { title:"Escala Tampa de Cinesiofobia (TSK-13)", short:"TSK-13 · medo do movimento", about:"Sobre o medo de se movimentar.", type:"likert", items:TSK13_ITEMS, opts:TSK13_OPTS,
  intro:"Estas perguntas não são sobre a dor em si — são sobre o que passa pela sua cabeça quando pensa em se movimentar ou fazer esforço. Responda com o que faz mais sentido pra você, sem pensar demais.",
  score(answers){ let sum=0,n=0; answers.forEach((v,i)=>{ if(isAnswered(v)){ n++; const val=v+1; sum += TSK13_REVERSE.includes(i)?(5-val):val; }}); return {pct:n?((sum-n)/(n*3))*100:0, raw:sum, n}; } },
 quickdash: { title:"QuickDASH (função do membro superior)", short:"QuickDASH · membro superior", about:"Sobre o seu braço, ombro ou mão.", type:"likert",
  items:QUICKDASH_ITEMS.map(i=>i[0]), optsPerItem:QUICKDASH_ITEMS.map(i=>i[1]),
  intro:"Estas perguntas são sobre dificuldades para usar o braço, o ombro ou a mão em tarefas simples do dia a dia.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); if(!a.length) return {pct:0,raw:0,n:0}; const sum=a.reduce((s,v)=>s+(v+1),0); const mean=sum/a.length; return {pct:((mean-1)/4)*100, raw:sum, n:a.length}; } },
 whodas: { title:"WHODAS 2.0 (12 itens) — funcionalidade geral", short:"WHODAS 2.0 · funcionalidade global", about:"Sobre suas atividades do dia a dia, de forma geral.", type:"likert", items:WHODAS_ITEMS, opts:WHODAS_OPTS,
  intro:"Estas perguntas são sobre o quanto seu problema de saúde dificulta atividades do seu dia a dia, de forma mais geral.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*4))*100:0, raw:sum, n:a.length}; } },
 eva: { title:"Escala Visual Analógica de Dor (EVA)", short:"EVA · dor em 4 condições", about:"Sobre a intensidade da sua dor.", type:"sliders",
  items:["Agora, em repouso (sem fazer esforço)","No pior momento de dor do seu dia","No melhor momento de dor do seu dia","Fazendo um esforço parecido com o do seu trabalho (ex.: levantar peso, ficar em pé bastante tempo, movimentos repetidos)"],
  intro:"Agora vamos medir sua dor numa régua de 0 a 10, em momentos diferentes. 0 é sem dor nenhuma, 10 é a pior dor que você já sentiu na vida.",
  score(answers){ return {answers}; } },
 dn4: { title:"DN4 — versão entrevista (dor neuropática)", short:"DN4 · qualidade da dor", about:"Sobre como é a sensação da sua dor.", type:"yesno", items:DN4_ITEMS,
  intro:"Estas perguntas são sobre como é a sensação da sua dor (se ela parece queimação, choque, formigamento, e coisas do tipo). Responda Sim ou Não pro que você realmente sente.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:0, raw:sum, n:a.length}; } },
 fabq: { title:"FABQ — subescala trabalho", short:"FABQ-trabalho · medo-evitação", about:"Sobre sua opinião sobre trabalho e dor.", type:"likert", items:FABQ_TRABALHO_ITEMS, opts:FABQ_OPTS,
  intro:"Estas perguntas são sobre a sua opinião a respeito do seu trabalho e da sua dor — não é sobre o que você sente no corpo, é sobre o que você pensa e acredita.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*6))*100:0, raw:sum, n:a.length}; } },
 pcs: { title:"PCS (Pain Catastrophizing Scale)", short:"PCS · catastrofização da dor", about:"Sobre os pensamentos que você tem quando sente dor.", type:"likert", items:PCS_ITEMS, opts:PCS_OPTS,
  intro:"Estas perguntas são sobre os pensamentos que passam pela sua cabeça quando você sente dor. Não existe resposta certa ou errada, responda com o que é mais parecido com você.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*4))*100:0, raw:sum, n:a.length}; } },
 rmdq: { title:"Roland-Morris (RMDQ)", short:"RMDQ · incapacidade lombar leve-moderada", about:"Sobre a parte de baixo das suas costas (lombar), em um jeito mais simples.", type:"yesno", items:RMDQ_ITEMS,
  intro:"Estas são frases sobre o seu dia a dia por causa da dor na coluna. Marque Sim se a frase descreve como você está hoje, ou Não se ela não descreve.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/a.length)*100:0, raw:sum, n:a.length}; } },
 mjoa: { title:"mJOA (mielopatia cervical)", short:"mJOA · função motora, sensibilidade e esfíncter", about:"Sobre força, sensibilidade e controle da urina, relacionados ao seu pescoço.", type:"sections", data:MJOA_SECTIONS,
  intro:"Estas perguntas são sobre força, sensibilidade e controle da urina — coisas que podem ser afetadas quando há compressão na coluna do pescoço. Escolha a frase que mais parece com a sua situação hoje.",
  score(answers){
   let raw=0, maxPossible=0, n=0;
   answers.forEach((v,i)=>{ if(isAnswered(v)){ raw+=v; maxPossible+=MJOA_MAX[i]; n++; } });
   const pct = maxPossible ? 100-((raw/maxPossible)*100) : 0;
   return {pct, raw, n, maxPossible};
  } },
 psfs: { title:"PSFS (Escala Funcional Específica do Paciente)", short:"PSFS · atividades escolhidas pelo próprio paciente", about:"Sobre atividades que você mesmo escolhe.", type:"psfs", items:PSFS_STEPS,
  intro:"Agora pense em até 3 atividades do seu dia a dia que ficaram difíceis por causa do problema. Para cada uma, dê uma nota de 0 a 10: 0 é 'não consigo fazer de jeito nenhum', 10 é 'consigo fazer como fazia antes'.",
  score(answers){ return {activities: answers}; } },
 wiq: { title:"WIQ (Walking Impairment Questionnaire)", short:"WIQ · caminhada e claudicação", about:"Sobre sua capacidade de caminhar e subir escadas.", type:"likert", items:WIQ_ITEMS, opts:WIQ_ABILITY_OPTS,
  intro:"Estas perguntas são sobre sua capacidade de caminhar e subir escadas — distâncias e velocidades diferentes. Escolha a opção que mais parece com o que você consegue fazer hoje.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); const pct=a.length?100-((sum/(a.length*4))*100):0; return {pct, raw:sum, n:a.length}; } },
 lefs: { title:"LEFS (Lower Extremity Functional Scale)", short:"LEFS · função de quadril, joelho e marcha", about:"Sobre suas pernas (quadril, joelho, marcha).", type:"likert", items:LEFS_ITEMS, opts:LEFS_OPTS,
  intro:"Estas perguntas são sobre atividades do dia a dia que dependem das suas pernas — agachar, subir escada, ficar em pé, andar, entre outras. Escolha a opção que mais parece com o que você consegue fazer hoje.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); const pct=a.length?100-((sum/(a.length*4))*100):0; return {pct, raw:sum, n:a.length}; } },
 sfi: { title:"SFI-10-Br (Spine Functional Index)", short:"SFI-10 · coluna como unidade única", about:"Sobre a sua coluna inteira (pescoço, meio e lombar juntos).", type:"sections", data:SFI_SECTIONS,
  intro:"Estas perguntas são sobre a sua coluna como um todo — pescoço, meio das costas e parte de baixo das costas juntos, não separados. Escolha a frase que mais parece com a sua situação hoje.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*4))*100:0, raw:sum, n:a.length}; } },
 nmq: { title:"Questionário Nórdico de Sintomas Osteomusculares (QNSO/NMQ)", short:"NMQ · mapa corporal de sintomas", about:"Sobre dor em diferentes partes do corpo.", type:"nmq", items:NMQ_REGIONS,
  intro:"Estas perguntas são sobre dor, desconforto ou dormência em diferentes partes do corpo — nos últimos 12 meses e nos últimos 7 dias.",
  score(answers){
   let y12count=0, y7count=0, impedeCount=0, n=0; const regions=[];
   answers.forEach((a,i)=>{
    if(a && a.y12!==null && a.y12!==undefined){
     n++;
     if(a.y12===1){ y12count++; regions.push(NMQ_REGIONS[i]); if(a.impede===1) impedeCount++; if(a.y7===1) y7count++; }
    }
   });
   return {y12count, y7count, impedeCount, n, regions};
  } },
 ict: { title:"ICT (Índice de Capacidade para o Trabalho / WAI)", short:"ICT-WAI · capacidade e prognóstico laboral", about:"Sobre sua capacidade de trabalhar.", type:"sections", data:ICT_SECTIONS,
  intro:"Estas perguntas são sobre sua capacidade de trabalhar hoje, comparada a outros momentos da sua vida, e sobre doenças e afastamentos recentes.",
  score(answers){
   const v = answers;
   const n = v.filter(x=>x!==null&&x!==undefined&&x!=='NA').length;
   if(n < 11) return {raw:null, n, incomplete:true};
   const demandType = v[0];
   const item1 = v[1];
   const physPts = v[2]+1, mentPts = v[3]+1;
   let item2;
   if(demandType===0) item2 = physPts*0.5 + mentPts*1.5;
   else if(demandType===1) item2 = physPts*1.5 + mentPts*0.5;
   else item2 = physPts + mentPts;
   const diseaseTable = [7,5,3,1];
   const item3 = diseaseTable[v[4]];
   const item4 = 6 - v[5];
   const item5 = 5 - v[6];
   const prognosisTable = [1,4,7];
   const item6 = prognosisTable[v[7]];
   const mrSum = v[8] + v[9] + v[10];
   const item7 = mrSum<=3?1:(mrSum<=6?2:(mrSum<=9?3:4));
   const total = Math.round(item1 + item2 + item3 + item4 + item5 + item6 + item7);
   return {raw:total, n, incomplete:false};
  } },
 fiqr: { title:"FIQR (Fibromyalgia Impact Questionnaire — Revised)", short:"FIQR · impacto global da fibromialgia", about:"Sobre o impacto da fibromialgia na sua vida.", type:"sections", data:FIQR_ITEMS,
  intro:"Estas perguntas são sobre como a fibromialgia afeta suas atividades, seu bem-estar geral e seus sintomas. Para cada uma, escolha o número de 0 a 10 que melhor descreve você nos últimos 7 dias.",
  score(answers){
   const func = answers.slice(0,9).filter(v=>isAnswered(v));
   const imp = answers.slice(9,11).filter(v=>isAnswered(v));
   const sym = answers.slice(11,21).filter(v=>isAnswered(v));
   const funcSum = func.reduce((s,v)=>s+v,0), impSum = imp.reduce((s,v)=>s+v,0), symSum = sym.reduce((s,v)=>s+v,0);
   const total = (funcSum/3) + impSum + (symSum/2);
   const n = func.length+imp.length+sym.length;
   return {pct: total, raw: total, n};
  } },
 wpi: { title:"WPI (Widespread Pain Index — critério de fibromialgia)", short:"WPI · mapa corporal de dor (ACR)", about:"Sobre em quais partes do corpo você sente dor.", type:"yesno", items:WPI_REGIONS,
  intro:"Nesta última semana, você teve dor em cada uma destas regiões do corpo? Responda Sim ou Não para cada uma. Esse instrumento, junto com o próximo (SSS), compõe o critério diagnóstico oficial de fibromialgia (ACR 2010/2016).",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {raw:sum, n:a.length}; } },
 sss: { title:"SSS (Symptom Severity Scale — companheira do WPI)", short:"SSS · gravidade dos sintomas (ACR)", about:"Sobre a gravidade de alguns sintomas (fadiga, sono, memória).", type:"sections", data:SSS_SECTIONS,
  intro:"Estas perguntas são sobre a gravidade de alguns sintomas nos últimos dias/meses. Junto com o WPI (mapa de dor), formam o critério diagnóstico oficial de fibromialgia.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {raw:sum, n:a.length}; } },
 hoos: { title:"HOOS (Hip disability and Osteoarthritis Outcome Score)", short:"HOOS · quadril", about:"Sobre o seu quadril.", type:"likert", items:HOOS_ITEMS, opts:JOINT_DIFF_OPTS,
  intro:"Estas perguntas são sobre dor, rigidez e dificuldade para usar o seu quadril em atividades do dia a dia.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*4))*100:0, raw:sum, n:a.length}; } },
 koos: { title:"KOOS (Knee injury and Osteoarthritis Outcome Score)", short:"KOOS · joelho", about:"Sobre o seu joelho.", type:"likert", items:KOOS_ITEMS, opts:JOINT_DIFF_OPTS,
  intro:"Estas perguntas são sobre dor, rigidez e dificuldade para usar o seu joelho em atividades do dia a dia.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*4))*100:0, raw:sum, n:a.length}; } },
 fss: { title:"FSS (Fatigue Severity Scale)", short:"FSS · gravidade da fadiga", about:"Sobre o quanto o cansaço (fadiga) afeta você.", type:"likert", items:FSS_ITEMS, opts:FSS_OPTS,
  intro:"Estas perguntas são sobre o quanto a fadiga (cansaço) afeta sua vida. Escolha o quanto você concorda com cada frase.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+(v+1),0); const mean=a.length?sum/a.length:0; const pct=a.length?((mean-1)/6)*100:0; return {pct, raw:sum, n:a.length, mean}; } },
 psqi: { title:"PSQI (Índice de Qualidade do Sono de Pittsburgh)", short:"PSQI · qualidade do sono", about:"Sobre a qualidade do seu sono.", type:"sections", data:PSQI_SECTIONS,
  intro:"Estas perguntas são sobre a qualidade do seu sono nas últimas semanas.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*3))*100:0, raw:sum, n:a.length}; } },
 hit6: { title:"HIT-6 (Headache Impact Test)", short:"HIT-6 · impacto da dor de cabeça/enxaqueca", about:"Sobre o impacto das suas dores de cabeça.", type:"likert", items:HIT6_ITEMS, opts:HIT6_OPTS,
  intro:"Estas perguntas são sobre o quanto as dores de cabeça ou enxaquecas afetam seu dia a dia.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*4))*100:0, raw:sum, n:a.length}; } },
 fabqpa: { title:"FABQ — subescala atividade física", short:"FABQ-AF · medo-evitação de atividade física", about:"Sobre sua opinião sobre atividade física e dor.", type:"likert", items:FABQ_PA_ITEMS, opts:FABQ_OPTS,
  intro:"Estas perguntas são sobre a sua opinião a respeito de atividade física e da sua dor — não é sobre o que você sente no corpo, é sobre o que você pensa e acredita. É a mesma lógica do questionário sobre trabalho que talvez você já tenha respondido, mas agora sobre atividade física em geral.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*6))*100:0, raw:sum, n:a.length}; } },
 comi: { title:"COMI-Back (Core Outcome Measures Index)", short:"COMI-Back · desfecho multidimensional de coluna", about:"Sobre a sua coluna, de forma resumida.", type:"sections", data:COMI_SECTIONS,
  intro:"Estas perguntas são sobre dor, bem-estar e o impacto do seu problema de coluna no trabalho e na vida, de forma resumida.",
  score(answers){
   let raw=0, maxPossible=0, n=0;
   answers.forEach((v,i)=>{ if(isAnswered(v)){ raw+=v; maxPossible+=COMI_MAX[i]; n++; } });
   return {pct: maxPossible?(raw/maxPossible)*100:0, raw, n, maxPossible};
  } },
 hads: { title:"HADS (Hospital Anxiety and Depression Scale)", short:"HADS · ansiedade e depressão", about:"Sobre como você tem se sentido emocionalmente.", type:"likert", items:HADS_ITEMS, opts:HADS_OPTS,
  intro:"Estas perguntas são sobre como você tem se sentido emocionalmente nos últimos dias. Não é sobre o problema físico, é sobre o seu estado de humor.",
  score(answers){
   let sum=0, n=0, anxSum=0, anxN=0, depSum=0, depN=0;
   answers.forEach((v,i)=>{
    if(isAnswered(v)){
     n++;
     const val = HADS_REVERSE.includes(i) ? (3-v) : v;
     sum += val;
     if(i<7){ anxSum+=val; anxN++; } else { depSum+=val; depN++; }
    }
   });
   return {pct: n?(sum/(n*3))*100:0, raw:sum, n, anxSum, anxN, depSum, depN};
  } },
 csi: { title:"CSI (Central Sensitization Inventory)", short:"CSI · sensibilização central", about:"Sobre sintomas físicos e emocionais diversos.", type:"likert", items:CSI_ITEMS, opts:CSI_OPTS,
  intro:"Estas perguntas são sobre sintomas físicos e emocionais que você pode ter sentido recentemente. Algumas parecem não ter relação direta com o seu problema principal — responda igual assim, com sinceridade.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*4))*100:0, raw:sum, n:a.length}; } },
 orebro: { title:"Örebro (versão curta) — risco de cronificação", short:"Örebro-curto · prognóstico de retorno ao trabalho", about:"Sobre sua dor e sua expectativa sobre o futuro.", type:"sections", data:OREBRO_SECTIONS,
  intro:"Estas perguntas são sobre a sua dor, seu humor e sua própria expectativa sobre o futuro. Elas ajudam a estimar o risco de a situação se prolongar, não descrevem só o que você sente hoje.",
  score(answers){
   const OREBRO_MAX = [7,10,10,4,10,10,10,10,10,10];
   let raw=0, maxPossible=0, n=0;
   answers.forEach((v,i)=>{ if(isAnswered(v)){ raw+=v; maxPossible+=OREBRO_MAX[i]; n++; } });
   const scaled = maxPossible ? (raw/maxPossible)*100 : 0;
   return {pct:scaled, raw:Math.round(scaled), n, maxPossible};
  } },
 ess: { title:"ESS (Epworth Sleepiness Scale)", short:"ESS · sonolência diurna", about:"Sobre a chance de você cochilar em situações do dia a dia.", type:"likert", items:ESS_ITEMS, opts:ESS_OPTS,
  intro:"Estas perguntas são sobre a chance de você cochilar ou pegar no sono em situações comuns do dia a dia — não é sobre estar cansado(a), é sobre realmente cochilar.",
  score(answers){ const a=answers.filter(v=>isAnswered(v)); const sum=a.reduce((s,v)=>s+v,0); return {pct:a.length?(sum/(a.length*3))*100:0, raw:sum, n:a.length}; } },
 chalder: { title:"Escala de Fadiga de Chalder", short:"Chalder · fadiga física e mental", about:"Sobre o seu cansaço, separando o físico do mental.", type:"likert", items:CHALDER_ITEMS, opts:CHALDER_OPTS,
  intro:"Estas perguntas são sobre cansaço (fadiga) — algumas sobre o corpo, outras sobre a cabeça (concentração, memória). Compare com o que era normal pra você antes do problema.",
  score(answers){
   const phys = answers.slice(0,7).filter(v=>isAnswered(v));
   const ment = answers.slice(7,11).filter(v=>isAnswered(v));
   const physSum = phys.reduce((s,v)=>s+v,0), mentSum = ment.reduce((s,v)=>s+v,0);
   const n = phys.length+ment.length;
   const sum = physSum+mentSum;
   return {pct:n?(sum/(n*3))*100:0, raw:sum, n, physSum, physN:phys.length, mentSum, mentN:ment.length};
  } }
};
const QORDER = ["odi","ndi","tsk13","quickdash","whodas","eva","dn4","fabq","pcs","rmdq","mjoa","psfs","wiq","lefs","sfi","nmq","ict","fiqr","wpi","sss","hoos","koos","fss","psqi","hit6","fabqpa","comi","hads","csi","orebro","ess","chalder"];

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
 const {data, error} = await supabase.rpc('save_submission_responses', {p_id:id, p_responses:responses});
 if(error){ alert('Erro ao salvar: '+error.message); throw error; }
 if(data === 0){ alert('Aviso técnico: nenhuma linha foi encontrada para atualizar (id: '+id+').'); }
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
 const keys = state.assignedKeys || QORDER;
 const rows = keys.map(k=>{
   const done = !!state.responsesLocal[k];
   const qd = QUESTIONNAIRES[k];
   return `<div class="qcard" data-q="${k}">
     <div>
       <div class="qcard-title">${qd.about || qd.title}</div>
       <div class="qcard-sub">${qd.title}</div>
     </div>
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

instructions(){
 const q = QUESTIONNAIRES[state.qKey];
 return `<div class="topbar"><div class="brand">${q.title}<small>Antes de começar</small></div></div>
 <main>
   <div class="card">
     <p class="sub" style="margin-bottom:14px;">Responda pensando em como você está agora, nas últimas semanas — não em como era antes do problema começar, e não em como imagina que vai ficar no futuro.</p>
     <p class="sub" style="margin-bottom:14px;">Não existe resposta certa ou errada. Responda com sinceridade, mesmo que a resposta pareça leve ou grave. O importante é que reflita exatamente o que você sente e consegue fazer hoje.</p>
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
 const naBtnHtml = `<button class="btn btn-ghost" id="naBtn" style="width:100%;margin-top:14px;font-size:13.5px;">${state.qAnswers[state.qIndex]==='NA'?'✓ Marcado como \"não se aplica\" — toque numa opção acima para responder mesmo assim':'Não sei responder / não se aplica a mim'}</button>`;
 if(q.type==='sections'){
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
   <p class="sub" style="margin-bottom:0;">0 = sem dor nenhuma · 10 = a pior dor que você já sentiu</p>`;
 } else if(q.type==='psfs'){
  const existing = state.qAnswers[state.qIndex] || {activity:'', score:null};
  const skipped = existing.skipped;
  body = `<div class="qtext">${current}</div>
   ${skipped ? `<p class="sub">Você optou por não citar essa atividade. Pode seguir para a próxima tela.</p>` : `
   <label class="field">Nome da atividade</label>
   <input type="text" id="psfsActivity" placeholder="Ex.: subir escadas, carregar sacola de compras..." value="${existing.activity||''}">
   <label class="field" style="margin-top:14px;">Nota</label>
   <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px;">
    ${[0,1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="opt psfs-num" data-val="${n}" style="text-align:center;padding:14px 0;margin-bottom:0;font-weight:700;font-size:16px;${existing.score===n?'border-color:var(--navy);background:#EEF1F7;':''}">${n}</button>`).join('')}
   </div>
   <p class="sub" style="margin-bottom:0;">0 = não consigo fazer de jeito nenhum · 10 = consigo fazer como fazia antes</p>
   `}
   ${state.qIndex>0 ? `<button class="btn btn-ghost" id="psfsSkipBtn" style="width:100%;margin-top:14px;">${skipped?'Na verdade, quero citar uma atividade':'Não tenho mais nenhuma atividade para citar'}</button>` : ''}`;
 } else if(q.type==='nmq'){
  const ex = state.qAnswers[state.qIndex] || {y12:null, impede:null, y7:null};
  const yn = (field, label)=>`<div style="margin-bottom:16px;">
    <div style="font-size:14px;color:var(--ink);margin-bottom:8px;">${label}</div>
    <button class="opt nmq-opt" data-field="${field}" data-val="1" style="display:inline-block;width:auto;margin:0 8px 0 0;padding:11px 20px;${ex[field]===1?'border-color:var(--navy);background:#EEF1F7;font-weight:600;':''}">Sim</button>
    <button class="opt nmq-opt" data-field="${field}" data-val="0" style="display:inline-block;width:auto;margin:0;padding:11px 20px;${ex[field]===0?'border-color:var(--navy);background:#EEF1F7;font-weight:600;':''}">Não</button>
   </div>`;
  let inner = yn('y12','Nos últimos 12 meses, você teve dor, desconforto ou dormência nessa região?');
  if(ex.y12===1){
   inner += yn('impede','Isso impediu suas atividades normais (trabalho, casa ou lazer) em algum momento?');
   inner += yn('y7','Você teve esse problema nos últimos 7 dias?');
  } else if(ex.y12===0){
   inner += `<p class="sub" style="margin-top:-6px;">Como você respondeu "Não", pode seguir para a próxima região.</p>`;
  }
  body = `<div class="qtext">${current}</div>` + inner;
 }
 const psfsAns = state.qAnswers[state.qIndex];
 const psfsOk = q.type==='psfs' && psfsAns && (psfsAns.skipped || (psfsAns.activity && psfsAns.activity.trim() && psfsAns.score!==null && psfsAns.score!==undefined));
 const nmqEx = state.qAnswers[state.qIndex];
 const nmqOk = q.type==='nmq' && nmqEx && nmqEx.y12!==null && (nmqEx.y12===0 || (nmqEx.impede!==null && nmqEx.y7!==null));
 let nextDisabled;
 if(q.type==='psfs') nextDisabled = !psfsOk;
 else if(q.type==='nmq') nextDisabled = !nmqOk;
 else nextDisabled = (state.qAnswers[state.qIndex]===null||state.qAnswers[state.qIndex]===undefined);
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
 const keys = state.assignedKeys || QORDER;
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
   const qdef = QUESTIONNAIRES[k];
   let pillsHtml='', detail='';
   if(k==='eva'){
    detail = qdef.items.map((label,i)=>{
     const v = r.answers[i]; const b = evaBand(v??0);
     return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span>${label}</span><span class="pill" style="color:${b.txt};background:${b.bg}">${v??'-'}/10</span></div>`;
    }).join('');
    pillsHtml = `<span class="pill" style="background:var(--gray-bg);color:var(--gray-txt)">4 condições</span>`;
   } else if(k==='psfs'){
    detail = (r.activities||[]).map((a,i)=>{
     if(!a || a.skipped || !a.activity) return '';
     const b = psfsItemBand(a.score??0);
     return `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:13px;"><span>${a.activity||'(sem nome)'}</span><span class="pill" style="color:${b.txt};background:${b.bg}">${a.score??'-'}/10</span></div>`;
    }).join('');
    pillsHtml = `<span class="pill" style="background:var(--gray-bg);color:var(--gray-txt)">${(r.activities||[]).filter(a=>a && !a.skipped && a.activity).length} atividades</span>`;
   } else if(k==='dn4'){
    const band = dn4Band(r.raw);
    pillsHtml = pillHtml(band);
    detail = `${r.raw}/7 itens positivos (corte usual: ≥3/7 sugere dor neuropática)`;
   } else if(k==='mjoa'){
    const band = mjoaBand(r.raw, r.maxPossible);
    pillsHtml = pillHtml(band);
    detail = `${r.raw}/${r.maxPossible||18} pontos · ${r.n} domínios respondidos (≥15 leve · 12-14 moderada · ≤11 grave, escala de 18)`;
   } else if(k==='nmq'){
    pillsHtml = `<span class="pill" style="background:var(--gray-bg);color:var(--gray-txt)">${r.y12count} regiões</span>`;
    detail = `${r.y12count} regiões com sintoma nos últimos 12 meses · ${r.y7count} nos últimos 7 dias · ${r.impedeCount} com impacto funcional${r.regions&&r.regions.length?(' — '+r.regions.join(', ')):''}`;
   } else if(k==='ict'){
    if(r.incomplete || r.raw===null){
     pillsHtml = `<span class="pill" style="background:var(--gray-bg);color:var(--gray-txt)">incompleto</span>`;
     detail = `${r.n}/11 itens respondidos — o cálculo do total do WAI exige os 11 itens respondidos (sem "não se aplica"); complete todos para ver a classificação`;
    } else {
     const band = ictBand(r.raw);
     pillsHtml = pillHtml(band);
     detail = `${r.raw}/49 pontos — referência: 7-27 baixa, 28-36 moderada, 37-43 boa, 44-49 excelente`;
    }
   } else if(k==='wpi'){
    const wpiHigh = r.raw>=7;
    pillsHtml = `<span class="pill" style="color:${wpiHigh?'var(--r3-txt)':'var(--r1-txt)'};background:${wpiHigh?'var(--r3-bg)':'var(--r1-bg)'}">WPI ${r.raw}/19</span>`;
    detail = `${r.raw} regiões com dor na última semana. Critério ACR de fibromialgia: WPI ≥7 (com SSS ≥5) ou WPI 4-6 (com SSS ≥9) — ver resultado do SSS`;
   } else if(k==='sss'){
    const sssHigh = r.raw>=5;
    pillsHtml = `<span class="pill" style="color:${sssHigh?'var(--r3-txt)':'var(--r1-txt)'};background:${sssHigh?'var(--r3-bg)':'var(--r1-bg)'}">SSS ${r.raw}/12</span>`;
    detail = `${r.raw} pontos. Critério ACR de fibromialgia: SSS ≥5 (com WPI ≥7) ou SSS ≥9 (com WPI 4-6) — ver resultado do WPI`;
   } else if(k==='hads'){
    const anxBand = r.anxSum>=11?{txt:'var(--r3-txt)',bg:'var(--r3-bg)',label:'Clinicamente significativa'}:(r.anxSum>=8?{txt:'var(--r2-txt)',bg:'var(--r2-bg)',label:'Leve/limítrofe'}:{txt:'var(--r1-txt)',bg:'var(--r1-bg)',label:'Normal'});
    const depBand = r.depSum>=11?{txt:'var(--r3-txt)',bg:'var(--r3-bg)',label:'Clinicamente significativa'}:(r.depSum>=8?{txt:'var(--r2-txt)',bg:'var(--r2-bg)',label:'Leve/limítrofe'}:{txt:'var(--r1-txt)',bg:'var(--r1-bg)',label:'Normal'});
    pillsHtml = `<span class="pill" style="color:${anxBand.txt};background:${anxBand.bg}">Ansiedade ${r.anxSum}/21</span> <span class="pill" style="color:${depBand.txt};background:${depBand.bg};margin-left:4px;">Depressão ${r.depSum}/21</span>`;
    detail = `Ansiedade: ${anxBand.label} · Depressão: ${depBand.label} (referência: 0-7 normal, 8-10 leve, ≥11 clinicamente significativo, por subescala)`;
   } else if(k==='csi'){
    const band = csiBand(r.raw);
    pillsHtml = pillHtml(band);
    detail = `${r.raw}/100 pontos (referência: &lt;30 subclínica, 30-39 leve, 40-49 moderada, 50-59 grave, ≥60 extrema)`;
   } else if(k==='orebro'){
    const band = orebroBand(r.raw);
    pillsHtml = pillHtml(band);
    detail = `${r.raw}/100 normalizado (referência aproximada: ≥50 alto risco — escore oficial validado sobre soma bruta, aqui normalizado; trate como aproximação)`;
   } else if(k==='ess'){
    const band = essBand(r.raw);
    pillsHtml = pillHtml(band);
    detail = `${r.raw}/24 pontos (referência: 0-9 normal, 10-15 sonolência excessiva, ≥16 grave)`;
   } else if(k==='chalder'){
    pillsHtml = `<span class="pill" style="background:var(--gray-bg);color:var(--gray-txt)">Física ${r.physSum}/21</span> <span class="pill" style="background:var(--gray-bg);color:var(--gray-txt);margin-left:4px;">Mental ${r.mentSum}/12</span>`;
    detail = `Fadiga física: ${r.physSum}/21 · Fadiga mental: ${r.mentSum}/12 (total ${r.raw}/33)`;
   } else {
    const band = cifBand(r.pct);
    pillsHtml = pillHtml(band) + ` <span class="pill" style="background:var(--gray-bg);color:var(--gray-txt);margin-left:4px;">CIF ${band.q}</span>`;
    detail = `${r.pct.toFixed(0)}% · ${r.n} itens respondidos`;
    if(k==='pcs'){ detail += ` · ${r.raw}/52 pontos (corte clínico usual: ≥30)`; }
    if(k==='fabq'){ detail += ` · ${r.raw}/42 pontos (corte usual: ≥34, alto medo-evitação)`; }
    if(k==='fabqpa'){ detail += ` · ${r.raw}/24 pontos`; }
    if(k==='rmdq'){ detail += ` · ${r.raw}/24 itens marcados`; }
    if(k==='hit6'){ detail += ` · ${r.raw} pontos, soma simplificada (escore oficial usa pesos por item — confira antes de citar no laudo)`; }
    if(k==='comi'){ detail += ` · ${r.raw}/${r.maxPossible} pontos`; }
   }
   const detailKey = p.id+'::'+k;
   const isOpen = !!state.openDetails[detailKey];
   const canExpand = (k!=='eva' && k!=='psfs');
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
     <div style="margin-bottom:16px;max-height:360px;overflow-y:auto;">
       ${QORDER.map(k=>`<label class="qcheck-row" data-search="${(QUESTIONNAIRES[k].title+' '+(QUESTIONNAIRES[k].about||'')).toLowerCase()}" style="display:flex;align-items:center;gap:10px;padding:9px 0;font-size:14.5px;border-bottom:1px dashed var(--line);">
         <input type="checkbox" class="qcheck" value="${k}" checked style="width:18px;height:18px;flex-shrink:0;">
         <span><strong>${QUESTIONNAIRES[k].title}</strong><br><span style="color:var(--muted);font-size:12.5px;">${QUESTIONNAIRES[k].about||''}</span></span>
       </label>`).join('')}
       <p class="sub" id="qSearchEmpty" style="display:none;margin:10px 0 0;">Nenhum questionário encontrado com esse termo.</p>
     </div>
     <button class="btn btn-primary" id="genLinkBtn">Gerar link</button>
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
    state.qKey=k; state.qIndex=0;
    const q = QUESTIONNAIRES[k];
    const len = q.type==='sections'? q.data.length : q.items.length;
    const existing = state.responsesLocal[k];
    state.qAnswers = existing && existing.rawAnswers ? existing.rawAnswers.slice() : new Array(len).fill(null);
    state.view='instructions'; render();
   };
  });
  $('finishBtn').onclick = ()=>{ state.view='thanks'; render(); };
 }

 if(state.view==='instructions'){
  $('startQBtn').onclick = ()=>{ state.view='wizard'; render(); };
 }

 if(state.view==='wizard'){
  const q = QUESTIONNAIRES[state.qKey];
  const total = q.type==='sections'? q.data.length : q.items.length;
  if(q.type==='psfs'){
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
   if(!state.qAnswers[state.qIndex]) state.qAnswers[state.qIndex] = {y12:null, impede:null, y7:null};
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
   const result = q.score(state.qAnswers);
   result.rawAnswers = state.qAnswers.slice();
   result.completedAt = Date.now();
   state.responsesLocal[state.qKey] = result;
   $('nextBtn').disabled = true; $('nextBtn').textContent='Salvando...';
   await dbSaveResponses(state.patientId, state.responsesLocal);
   state.view='justDone'; render();
  };
 }

 if(state.view==='justDone'){
  const keys = state.assignedKeys || QORDER;
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
   const checked = Array.from(document.querySelectorAll('.qcheck:checked')).map(el=>el.value);
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
