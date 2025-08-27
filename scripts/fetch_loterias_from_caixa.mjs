// scripts/fetch_loterias_from_caixa.mjs
// Corrigido: usa 'unzip' em vez de bsdtar, endpoints corretos, headers e fallback robusto.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const outDir = 'data';
fs.mkdirSync(outDir, { recursive: true });

const MODS = [
  { key: 'MEGASENA', lot: 'MEGA_SENA', out: path.join(outDir, 'mega.json'), columns: ['concurso','data','d1','d2','d3','d4','d5','d6'] },
  { key: 'LOTOFACIL', lot: 'LOTOFACIL', out: path.join(outDir, 'loto.json'), columns: ['concurso','data', ...Array.from({length:15}, (_,i)=>'n'+(i+1))] }
];

function sh(cmd, opts={}){
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts });
}

function downloadTo(file, url){
  console.log('Baixando', url);
  const headers = [
    "-H 'Accept: application/json, text/plain, */*'",
    "-H 'x-requested-with: XMLHttpRequest'",
    "-H 'Referer: https://loterias.caixa.gov.br'"
  ].join(' ');
  sh(`bash -lc "curl -sSL --fail ${headers} -o ${file} \"${url}\"" `);
}

function unzipFirstCsv(zipFile){
  const list = sh(`bash -lc "unzip -Z -1 ${zipFile}"`).split(/\r?\n/).filter(Boolean);
  const csv = list.find(f => f.toLowerCase().endsWith('.csv'));
  if(!csv) throw new Error('CSV não encontrado no ZIP');
  const buf = execSync(`bash -lc "unzip -p ${zipFile} \"${csv.replace(/"/g,'\\\"')}\""`, {encoding: 'buffer'});
  return buf.toString('utf8');
}

function parseCsv(txt){
  const rows = txt.trim().split(/\r?\n/).map(r => r.split(';').map(c => c.trim()));
  const head = rows.shift();
  return { head, rows };
}

function mapRowGeneric(headLower, cols){
  // dezenas = todos os valores numéricos do registro
  const numbers = cols.map(x => x.replace(/\D+/g,''))
                      .filter(x => x.length>0)
                      .map(Number)
                      .filter(n => !Number.isNaN(n));
  let concurso = Number(cols.find((c,i)=> headLower[i] && headLower[i].includes('concurso') ));
  let data = cols.find((c,i)=> headLower[i] && (headLower[i].includes('data') || headLower[i].includes('apuracao') || headLower[i].includes('sorteio')) );
  if (data && /\d{2}\/\d{2}\/\d{4}/.test(data)){
    const [d,m,y] = data.split('/'); data = `${y}-${m}-${d}`;
  }
  return [concurso, data, ...numbers];
}

for (const mod of MODS){
  try {
    // Estratégia 1: CSV completo via download oficial (ZIP)
    const tmp = `tmp_${mod.key}.zip`;
    const url = `https://servicebus2.caixa.gov.br/portaldeloterias/api/resultados/download?modalidade=${mod.key}`;
    downloadTo(tmp, url);
    const csvTxt = unzipFirstCsv(tmp);
    const { head, rows } = parseCsv(csvTxt);
    const headLower = (head||[]).map(h => (h||'').toLowerCase());
    const mapped = rows.map(cols => mapRowGeneric(headLower, cols)).filter(r => r[0] && r.length>=3);
    const payload = {
      lottery: mod.lot,
      last_update_brt: new Date().toISOString().replace('T',' ').slice(0,19),
      headers: mod.columns,
      rows: mapped
    };
    fs.writeFileSync(mod.out, JSON.stringify(payload, null, 2));
    try { fs.unlinkSync(tmp); } catch{}
    console.log('Escrito', mod.out, 'com', mapped.length, 'concursos (via ZIP).');
    continue; // próximo mod
  } catch(err){
    console.warn(`[${mod.key}] Falhou ZIP oficial, tentando fallback incremental mínimo...`, err.message);
  }

  // Estratégia 2: último resultado (para não quebrar build)
  try{
    const lastFile = `last_${mod.key}.json`;
    const urlLast = `https://servicebus2.caixa.gov.br/portaldeloterias/api/${mod.key.toLowerCase() === 'megasena' ? 'megasena' : 'lotofacil'}`;
    downloadTo(lastFile, urlLast);
    const last = JSON.parse(fs.readFileSync(lastFile, 'utf8'));
    const numero = Number(last.numero || last.concurso || last.numeroConcurso);
    const dataAp = last.dataApuracao || last.data || last.dataSorteio;
    const dezenas = last.dezenasSorteadasOrdemSorteio || last.listaDezenas || last.dezenas || last.dezenasSorteadas || [];
    const arr = [numero, dataAp, ...dezenas];
    const payload = {
      lottery: mod.lot,
      last_update_brt: new Date().toISOString().replace('T',' ').slice(0,19),
      headers: mod.columns,
      rows: [arr]
    };
    fs.writeFileSync(mod.out, JSON.stringify(payload, null, 2));
    console.log('Escrito', mod.out, 'via fallback (1 concurso).');
  }catch(e){
    console.error(`[${mod.key}] Fallback também falhou:`, e.message);
    process.exitCode = 1;
  }
}

console.log('Concluído.');
