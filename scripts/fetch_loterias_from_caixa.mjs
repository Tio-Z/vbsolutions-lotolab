// scripts/fetch_loterias_from_caixa.mjs
// Baixa arquivos oficiais de resultados e converte para o formato do LotoLab.
// Estratégia 1 (preferida): endpoint de download de resultados por modalidade (CSV zip) do Portal (servicebus2).
// Estratégia 2 (fallback): consulta incremental concurso a concurso (mais lenta).
// OBS: este script roda no GitHub Actions (server-side), evitando CORS.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import zlib from 'node:zlib';

const outDir = 'data';
fs.mkdirSync(outDir, { recursive: true });

const MODS = [
  { key: 'MEGA_SENA', out: path.join(outDir, 'mega.json'), columns: ['concurso','data','d1','d2','d3','d4','d5','d6'] },
  { key: 'LOTOFACIL', out: path.join(outDir, 'loto.json'), columns: ['concurso','data', ...Array.from({length:15}, (_,i)=>'n'+(i+1))] }
];

async function downloadTo(file, url){
  console.log('Baixando', url);
  execSync(`curl -L --retry 3 --fail -o ${file} "${url}"`, { stdio: 'inherit' });
}

function parseCsv(txt){
  const rows = txt.trim().split(/\r?\n/).map(r => r.split(';').map(c => c.trim()));
  const head = rows.shift();
  return { head, rows };
}

for (const mod of MODS){
  let csvTxt = '';
  try {
    // Estratégia 1: arquivo completo CSV do endpoint "resultados/download"
    const tmp = `tmp_${mod.key}.zip`;
    const url = `https://servicebus2.caixa.gov.br/portaldeloterias/api/resultados/download?modalidade=${mod.key}`;
    await downloadTo(tmp, url);
    // Descompactar (ZIP pode conter um CSV; usar unzip nativo)
    execSync(`bsdtar -xvf ${tmp} -C .`, { stdio: 'inherit' });
    // Acha o primeiro CSV
    const files = fs.readdirSync('.').filter(f => f.toLowerCase().includes(mod.key.toLowerCase()) && f.toLowerCase().endsWith('.csv'));
    if (!files.length) throw new Error('CSV não encontrado no ZIP');
    csvTxt = fs.readFileSync(files[0], 'utf8');
    // Limpa tmp
    fs.unlinkSync(tmp);
    try { fs.unlinkSync(files[0]); } catch{}
  } catch(err){
    console.warn('Falhou download ZIP oficial, tentando fallback incremental...', err.message);
    // Estratégia 2 (mínima): baixa apenas o último e sai (evita quebrar pipeline). Você pode expandir com loop por concurso.
    const urlLast = `https://servicebus2.caixa.gov.br/portaldeloterias/api/${mod.key.toLowerCase()}/`;
    await downloadTo('last.json', urlLast);
    const last = JSON.parse(fs.readFileSync('last.json', 'utf8'));
    const { numero, dataApuracao, dezenasSorteadasOrdemSorteio } = last;
    const arr = [numero, dataApuracao, ...dezenasSorteadasOrdemSorteio];
    const head = mod.columns;
    const rows = [arr];
    const payload = {
      lottery: mod.key,
      last_update_brt: new Date().toISOString().replace('T',' ').slice(0,19),
      headers: head,
      rows: rows
    };
    fs.writeFileSync(mod.out, JSON.stringify(payload, null, 2));
    continue;
  }

  // Converte CSV -> JSON padrão
  const { head, rows } = parseCsv(csvTxt);
  const headLower = head.map(h => h.toLowerCase());
  function mapRow(cols){
    // Detecta colunas de dezenas
    const numbers = cols.filter(x => /^\d+$/.test(x)).map(x => Number(x));
    // Tenta extrair concurso e data
    let concurso = Number(cols.find((c,i)=> headLower[i].includes('concurso') ));
    let data = cols.find((c,i)=> headLower[i].includes('data') );
    if (!data) data = cols.find((c,i)=> headLower[i].includes('apuracao') || headLower[i].includes('sorteio'));
    // Normaliza data para YYYY-MM-DD
    if (data && /\d{2}\/\d{2}\/\d{4}/.test(data)){
      const [d,m,y] = data.split('/'); data = `${y}-${m}-${d}`;
    }
    return [concurso, data, ...numbers];
  }
  const mapped = rows.map(mapRow).filter(r => r[0] && r.length>=3);
  const payload = {
    lottery: mod.key,
    last_update_brt: new Date().toISOString().replace('T',' ').slice(0,19),
    headers: mod.columns,
    rows: mapped
  };
  fs.writeFileSync(mod.out, JSON.stringify(payload, null, 2));
  console.log('Escrito', mod.out, 'com', mapped.length, 'concursos.');
}

console.log('Concluído.');
