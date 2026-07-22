import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createWorker } from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const state = { extracting:false, worker:null };
const $ = id => document.getElementById(id);
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u00a0\t]+/g, " ").replace(/\s+/g, " ").trim();
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function selectedPdf(){ return $("cronogramaPdfInput")?.files?.[0] || null; }
function setProgress(stage, percent, detail=""){
  const box=$("cronogramaExtractProgress"); if(box) box.hidden=false;
  if($("cronogramaExtractStage")) $("cronogramaExtractStage").textContent=stage;
  if($("cronogramaExtractPercent")) $("cronogramaExtractPercent").textContent=`${Math.round(percent)}%`;
  if($("cronogramaExtractProgressBar")) $("cronogramaExtractProgressBar").style.width=`${Math.max(0,Math.min(100,percent))}%`;
  if($("cronogramaExtractDetail")) $("cronogramaExtractDetail").textContent=detail;
}
function median(values){ const v=values.filter(Number.isFinite).sort((a,b)=>a-b); return v.length?v[Math.floor(v.length/2)]:12; }
function normalizeDateText(value){ return String(value||"").replace(/[Oo](?=\d|\s*[/.\-])/g,"0").replace(/(?<=\d)[Oo]/g,"0").replace(/\s*([/.\-])\s*/g,"$1").replace(/[–—]/g,"-").replace(/\s+/g," ").trim(); }
function isoDate(d,m,y){ let year=Number(y); if(year<100) year+=year>=70?1900:2000; const dt=new Date(year,Number(m)-1,Number(d),12); if(dt.getFullYear()!==year||dt.getMonth()!==Number(m)-1||dt.getDate()!==Number(d)) return null; return `${String(year).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }

function extractDateRange(value){
  const text=normalizeDateText(value);
  let m=text.match(/\b(\d{1,2})\s*(?:a|ate|até|-)\s*(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/i);
  if(m){ const start=isoDate(m[1],m[3],m[4]), end=isoDate(m[2],m[3],m[4]); if(start&&end) return {start,end,index:m.index??0}; }
  m=text.match(/\b(\d{1,2})[/.\-](\d{1,2})\s*(?:a|ate|até|-)\s*(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/i);
  if(m){ const start=isoDate(m[1],m[2],m[5]), end=isoDate(m[3],m[4],m[5]); if(start&&end) return {start,end,index:m.index??0}; }
  const full=[...text.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/g)];
  if(full.length>=2){ const start=isoDate(full[0][1],full[0][2],full[0][3]), end=isoDate(full[1][1],full[1][2],full[1][3]); if(start&&end) return {start,end,index:full[0].index??0}; }
  if(full.length===1){ const date=isoDate(full[0][1],full[0][2],full[0][3]); if(date) return {start:date,end:date,index:full[0].index??0}; }
  return null;
}

function parseTsv(tsv,pageNumber){
  if(!tsv) return [];
  return String(tsv).split(/\r?\n/).slice(1).map(line=>{
    const c=line.split("\t"); if(c.length<12||c[0]!=="5") return null;
    const text=normalize(c.slice(11).join("\t")); if(!text) return null;
    return {pageNumber,left:Number(c[6]),top:Number(c[7]),width:Number(c[8]),height:Number(c[9]),confidence:Number(c[10]),text};
  }).filter(Boolean);
}

function groupBands(words){
  const tolerance=Math.max(7,median(words.map(w=>w.height))*.7), bands=[];
  words.sort((a,b)=>a.pageNumber-b.pageNumber||a.top-b.top||a.left-b.left).forEach(word=>{
    const center=word.top+word.height/2;
    let band=[...bands].reverse().find(x=>x.pageNumber===word.pageNumber&&Math.abs(x.center-center)<=tolerance);
    if(!band){ band={pageNumber:word.pageNumber,center,words:[]}; bands.push(band); }
    band.words.push(word); band.center=band.words.reduce((s,w)=>s+w.top+w.height/2,0)/band.words.length;
  });
  return bands.map(b=>{
    b.words.sort((a,c)=>a.left-c.left); let cursor=0;
    b.words.forEach(w=>{ w.charStart=cursor; cursor+=w.text.length+1; w.charEnd=cursor-1; });
    b.text=normalizeDateText(b.words.map(w=>w.text).join(" ")); b.top=Math.min(...b.words.map(w=>w.top)); return b;
  }).sort((a,b)=>a.pageNumber-b.pageNumber||a.top-b.top);
}

function isNoise(value){ const t=normalize(value).toLowerCase(); return !t||t.length<3||/^\d+$/.test(t)||/^(cronograma|atividade|atividades|data|periodo|periodo de execucao|inicio|fim|pagina|anexo)$/i.test(t); }
function cleanActivity(value){ return normalize(value).replace(/^\s*(?:item|atividade)?\s*\d{1,2}\s*[.)\-:]?\s*/i,"").replace(/^[|:;,.\-\s]+|[|:;,.\-\s]+$/g,"").trim().slice(0,240); }

function parseBands(bands,source){
  const rows=[];
  bands.forEach((band,index)=>{
    const range=extractDateRange(band.text); if(!range) return;
    const dateWord=band.words.find(w=>/\d{1,2}[/.\-]/.test(w.text));
    const dateLeft=dateWord?.left??Math.max(...band.words.map(w=>w.left));
    let activity=cleanActivity(band.words.filter(w=>w.left<dateLeft-4).map(w=>w.text).join(" "));
    if(!activity||isNoise(activity)){
      const previous=[];
      for(let offset=1;offset<=5;offset+=1){
        const p=bands[index-offset]; if(!p||p.pageNumber!==band.pageNumber||extractDateRange(p.text)) break;
        const text=cleanActivity(p.words.filter(w=>w.left<dateLeft-4).map(w=>w.text).join(" "));
        if(text&&!isNoise(text)) previous.unshift(text);
      }
      activity=cleanActivity(previous.join(" "));
    }
    if(!activity||isNoise(activity)) return;
    if(rows.some(r=>normalize(r.atividade).toLowerCase()===normalize(activity).toLowerCase()&&r.data_inicio===range.start&&r.data_fim===range.end)) return;
    const confidence=band.words.reduce((s,w)=>s+(Number.isFinite(w.confidence)?w.confidence:75),0)/Math.max(band.words.length,1);
    rows.push({atividade:activity,data_inicio:range.start,data_fim:range.end,origem:source,confianca_extracao:Math.max(1,Math.min(99,Math.round(confidence))),pagina:band.pageNumber});
  });
  rows.sort((a,b)=>a.data_inicio.localeCompare(b.data_inicio)||a.data_fim.localeCompare(b.data_fim));
  return rows.map((r,i)=>({...r,ordem:i+1}));
}

async function textLayerWords(pdf){
  const words=[]; let dateCount=0;
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
    setProgress("Lendo texto e posições",5+(pageNumber/pdf.numPages)*30,`Página ${pageNumber} de ${pdf.numPages}`);
    const page=await pdf.getPage(pageNumber), viewport=page.getViewport({scale:1}), content=await page.getTextContent();
    (content.items||[]).forEach(item=>{ const text=normalize(item?.str); if(!text) return; const height=Math.max(Number(item.height||10),8); words.push({pageNumber,left:Number(item.transform?.[4]||0),top:viewport.height-Number(item.transform?.[5]||0)-height,width:Number(item.width||text.length*5),height,confidence:99,text}); dateCount+=(normalizeDateText(text).match(/\d{1,2}[/.\-]\d{1,2}/g)||[]).length; });
  }
  return {words,dateCount};
}
async function getWorker(){
  if(state.worker) return state.worker;
  state.worker=await createWorker("por",1,{logger:m=>{ if(m.status==="recognizing text") setProgress("Executando OCR tabular",42+Number(m.progress||0)*48,"Reconstruindo linhas e colunas do cronograma."); }});
  await state.worker.setParameters({tessedit_pageseg_mode:"11",preserve_interword_spaces:"1"});
  return state.worker;
}
async function ocrWords(pdf){
  const worker=await getWorker(), words=[];
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
    const page=await pdf.getPage(pageNumber), viewport=page.getViewport({scale:2.7}), canvas=document.createElement("canvas"); canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext("2d",{willReadFrequently:true}),viewport}).promise;
    const result=await worker.recognize(canvas,{}, {text:true,tsv:true}); words.push(...parseTsv(result?.data?.tsv,pageNumber)); canvas.width=1;canvas.height=1;
  }
  return words;
}

function editalYear(){ const m=String($("mEdital")?.value||"").match(/\b(20\d{2})\b/); return m?Number(m[1]):null; }
function warningsFor(rows){
  const warnings=[],year=editalYear();
  if(rows.length<3) warnings.push(`Foram identificadas somente ${rows.length} etapa(s). O cronograma pode estar incompleto.`);
  if(!rows.some(r=>normalize(r.atividade).toLowerCase().includes("resultado final"))) warnings.push("Não foi identificada uma etapa de resultado final. Revise o cronograma.");
  rows.forEach((r,i)=>{ if(year&&Number(r.data_inicio.slice(0,4))!==year) warnings.push(`Etapa ${i+1}: data fora do ano ${year}.`); if(r.confianca_extracao<65) warnings.push(`Etapa ${i+1}: confiança baixa (${r.confianca_extracao}%).`); });
  return [...new Set(warnings)];
}
function renderReview(rows,source){
  const review=$("cronogramaExtractReview"); if(!review) return; review.hidden=false;
  $("cronogramaExtractSummary").textContent=`${rows.length} etapa(s) identificada(s) por leitura tabular. Revise antes de aplicar.`;
  $("cronogramaExtractSource").textContent=source==="OCR"?"OCR tabular local":"Tabela do PDF";
  const warnings=warningsFor(rows), box=$("cronogramaExtractWarnings"); box.hidden=!warnings.length; box.innerHTML=warnings.length?`<strong><i class="fa-solid fa-triangle-exclamation"></i> Pontos para revisão</strong><ul>${warnings.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:"";
  $("cronogramaExtractRows").innerHTML=rows.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.atividade)}<small>Página ${r.pagina}</small></td><td>${r.data_inicio.split("-").reverse().join("/")}</td><td>${r.data_fim.split("-").reverse().join("/")}</td><td><span class="cronograma-confidence ${r.confianca_extracao<65?"is-low":""}">${r.confianca_extracao}%</span></td></tr>`).join("");
}

async function extractTable(event){
  const button=event.target?.closest?.("#cronogramaExtractButton"); if(!button||state.extracting) return;
  const file=selectedPdf(); if(!file) return; event.preventDefault(); event.stopImmediatePropagation(); state.extracting=true; button.disabled=true;
  try{
    setProgress("Abrindo PDF",2,"Analisando a estrutura do cronograma.");
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    if(pdf.numPages>20) throw new Error("O PDF possui mais de 20 páginas. Envie somente as páginas do cronograma.");
    const text=await textLayerWords(pdf); let rows=parseBands(groupBands(text.words),"PDF"),source="PDF";
    if(rows.length<3||text.dateCount<3){ setProgress("Tabela digitalizada detectada",40,"Executando OCR com preservação de posição."); const ocrRows=parseBands(groupBands(await ocrWords(pdf)),"OCR"); if(ocrRows.length>=rows.length){ rows=ocrRows;source="OCR"; } }
    if(!rows.length) throw new Error("Nenhuma linha de cronograma foi identificada. Use o preenchimento manual ou envie uma página mais nítida.");
    renderReview(rows,source); setProgress("Extração tabular concluída",100,`${rows.length} etapa(s) encontradas. Revise e aplique ao cronograma.`);
    window.setTimeout(()=>{const box=$("cronogramaExtractProgress");if(box)box.hidden=true;},1200);
  }catch(error){ console.error("Falha na extração tabular:",error); setProgress("Falha na extração",100,error?.message||String(error)); }
  finally{ state.extracting=false;button.disabled=false; }
}
export function initNucleoCronogramaTableExtractor(){ document.addEventListener("click",extractTable,true); }
