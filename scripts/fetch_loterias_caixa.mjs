// scripts/fetch_loterias_caixa.mjs (FIX14d aggregator)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
import AdmZip from 'adm-zip';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data');

const MODS = [
  { key:'mega', label:'MEGA_SENA', api:'megasena', picks:6, max:60, out:'mega.json' },
  { key:'loto', label:'LOTOFACIL', api:'lotofacil', picks:15, max:25, out:'loto.json' },
];

function readJsonSafe(file){ try{ return JSON.parse(fs.readFileSync(file,'utf8')); }catch(e){ return []; } }
function writeJsonSafe(file, arr){ fs.writeFileSync(file, JSON.stringify(arr)); }

async function getJSON(url){
  const res = await fetch(url, { headers: { 'Accept': 'application/json, text/plain, */*' } });
  if(!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.json();
}
function sanitizeCombo(xs, max){ const arr = (xs||[]).map(x=> +String(x).replace(/\D+/g,'')).filter(n=> n>=1 && n<=max); const uniq = Array.from(new Set(arr)).sort((a,b)=>a-b); return uniq; }

async function apiLatestNum(mod){
  const base = `https://servicebus2.caixa.gov.br/portaldeloterias/api/${mod.api}`;
  const latest = await getJSON(base);
  return +latest?.numero || +latest?.numeroConcurso || +latest?.concurso || 0;
}
async function apiCombosRange(mod, from, to){
  const base = `https://servicebus2.caixa.gov.br/portaldeloterias/api/${mod.api}`;
  const combos = [];
  for(let n=to; n>=from; n--){
    try{
      const j = await getJSON(`${base}/${n}`);
      const raw = (j.listaDezenas || j.dezenas || j.numeros || j.resultado || []);
      const combo = sanitizeCombo(raw, mod.max);
      if(combo.length === mod.picks) combos.push(combo);
      if(n % 30 === 0) await wait(120);
    }catch(e){ /* ignore */ }
  }
  return combos.reverse();
}

async function fallbackZIP(mod){
  const url = `https://servicebus2.caixa.gov.br/portaldeloterias/api/resultados/download?modalidade=${mod.label}`;
  const zipFile = path.join(os.tmpdir(), `${mod.key}.zip`);
  const res = await fetch(url); if(!res.ok) throw new Error(`ZIP HTTP ${res.status}`);
  const ab = await res.arrayBuffer(); fs.writeFileSync(zipFile, Buffer.from(ab));
  const zip = new AdmZip(zipFile);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `loto_${mod.key}_`));
  zip.extractAllTo(temp, true);
  const files = fs.readdirSync(temp).filter(f => /\.htm[l]?$/i.test(f));
  if(!files.length) return [];
  const html = fs.readFileSync(path.join(temp, files[0]), 'utf8');
  const text = html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ');
  const nums = (text.match(/\b\d{1,2}\b/g)||[]).map(Number).filter(n=>n>=1 && n<=mod.max);
  const combos = [];
  for(let i=0;i+mod.picks<=nums.length;i++){
    const take = nums.slice(i,i+mod.picks);
    const u = Array.from(new Set(take));
    if(u.length===mod.picks){ combos.push(u.sort((a,b)=>a-b)); i += mod.picks-1; }
  }
  const seen=new Set(), uniq=[]; for(const c of combos){const k=c.join('-'); if(!seen.has(k)){seen.add(k); uniq.push(c);}}
  return uniq;
}

function mergeUnique(oldArr, newArr){
  const seen = new Set((oldArr||[]).map(c=>c.join('-')));
  const out = Array.isArray(oldArr)? oldArr.slice() : [];
  for(const c of (newArr||[])){
    const k = Array.isArray(c)? c.join('-') : '';
    if(k && !seen.has(k)){out.push(c); seen.add(k);}
  }
  return out;
}

async function run(){
  if(!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive:true });
  for(const mod of MODS){
    const file = path.join(OUT, mod.out);
    const existing = readJsonSafe(file);
    let result = Array.isArray(existing) ? existing.slice() : [];
    try{
      const latest = await apiLatestNum(mod);
      if(!latest){ throw new Error('sem latest'); }
      const from = Math.max(1, latest - 60);
      const combos = await apiCombosRange(mod, from, latest);
      if(combos.length) result = mergeUnique(result, combos);
      if(result.length < 10){ throw new Error('insuficiente'); }
    }catch(e){
      try{
        const z = await fallbackZIP(mod);
        if(z.length) result = mergeUnique(result, z);
      }catch(err){ /* falhou ZIP */ }
    }
    const finalOut = (result && result.length) ? result : existing;
    writeJsonSafe(file, finalOut);
    console.log(`✔ ${mod.key}: ${finalOut.length} concursos no arquivo`);
  }
  console.log('OK: atualização concluída.');
}
run().catch(err=>{ console.error(err); process.exit(1); });
