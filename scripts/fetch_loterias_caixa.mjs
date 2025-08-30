// scripts/fetch_loterias_caixa.mjs
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

async function getJSON(url){
  const res = await fetch(url, { headers: { 'Accept': 'application/json, text/plain, */*' } });
  if(!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const ct = res.headers.get('content-type') || '';
  if(!ct.includes('json')) {
    try { return await res.json(); } catch { return {}; }
  }
  return await res.json();
}

function sanitizeCombo(xs, max){ 
  const arr = (xs||[]).map(x=> +String(x).replace(/\D+/g,'')).filter(n=> n>=1 && n<=max);
  const uniq = Array.from(new Set(arr)).sort((a,b)=>a-b);
  return uniq;
}

async function fromAPI(mod){
  const base = `https://servicebus2.caixa.gov.br/portaldeloterias/api/${mod.api}`;
  const latest = await getJSON(base);
  const lastNum = +latest?.numero || +latest?.numeroConcurso || +latest?.concurso || 0;
  if(!lastNum) throw new Error('Sem número do último concurso');
  const combos = [];
  for(let n=lastNum;n>=1;n--){
    try{
      const j = await getJSON(`${base}/${n}`);
      const raw = (j.listaDezenas || j.dezenas || j.numeros || j.resultado || []);
      const combo = sanitizeCombo(raw, mod.max);
      if(combo.length === mod.picks) combos.push(combo);
      if(n % 60 === 0) await wait(150);
    }catch(e){
      if(n < lastNum-8) break;
    }
  }
  if(combos.length < 10) throw new Error('Poucos concursos via API');
  return combos.reverse();
}

async function download(url, toFile){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const ab = await res.arrayBuffer();
  fs.writeFileSync(toFile, Buffer.from(ab));
  return toFile;
}

function parseZipHTML(zipPath, mod){
  const zip = new AdmZip(zipPath);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `loto_${mod.key}_`));
  zip.extractAllTo(temp, true);
  const files = fs.readdirSync(temp).filter(f => /\.htm[l]?$/i.test(f));
  if(!files.length) throw new Error('ZIP sem HTML interno');
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
  if(uniq.length < 10) throw new Error('Poucos concursos do ZIP');
  return uniq;
}

async function fromZIP(mod){
  const url = `https://servicebus2.caixa.gov.br/portaldeloterias/api/resultados/download?modalidade=${mod.label}`;
  const zipFile = path.join(os.tmpdir(), `${mod.key}.zip`);
  await download(url, zipFile);
  return parseZipHTML(zipFile, mod);
}

async function run(){
  if(!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive:true });
  for(const mod of MODS){
    let combos = [];
    try{
      combos = await fromAPI(mod);
      console.log(`✔ ${mod.key}: ${combos.length} via API`);
    }catch(e){
      console.warn(`API falhou para ${mod.key}:`, e.message);
      combos = await fromZIP(mod);
      console.log(`✔ ${mod.key}: ${combos.length} via ZIP`);
    }
    fs.writeFileSync(path.join(OUT, mod.out), JSON.stringify(combos));
  }
  console.log('OK: data atualizada.');
}
run().catch(err=>{ console.error(err); process.exit(1); });
