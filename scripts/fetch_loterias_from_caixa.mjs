// scripts/fetch_loterias_from_caixa.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const outDir = 'data';
fs.mkdirSync(outDir, { recursive: true });

const MODS = [
  { key: 'MEGA_SENA', out: path.join(outDir, 'mega.json'), columns: ['concurso','data','d1','d2','d3','d4','d5','d6'] },
  { key: 'LOTOFACIL', out: path.join(outDir, 'loto.json'), columns: ['concurso','data', ...Array.from({length:15}, (_,i)=>'n'+(i+1))] }
];

function downloadTo(file, url){
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
    const tmp = `tmp_${mod.key}.zip`;
    const url = `https://servicebus2.caixa.gov.br/portaldeloterias/api/resultados/download?modalidade=${mod.key}`;
    downloadTo(tmp, url);
    execSync(`bsdtar -xvf ${tmp} -C .`, { stdio: 'inherit' });
    const files = fs.readdirSync('.').filter(f => f.toLowerCase().includes(mod.key.toLowerCase()) && f.toLowerCase().endsWith('.csv'));
    if (!files.length) throw new Error('CSV não encontrado no ZIP');
    csvTxt = fs.readFileSync(files[0], 'utf8');
    fs.unlinkSync(tmp);
    try { fs.unlinkSync(files[0]); } catch{}
  } catch(err){
    console.warn('Falhou ZIP oficial, fallback incremental mínimo...', err.message);
    const urlLast = `https://servicebus2.caixa.gov.br/portaldeloterias/api/${mod.key.toLowerCase()}/`;
    downloadTo('last.json', urlLast);
    const last = JSON.parse(fs.readFileSync('last.json', 'utf8'));
    const { numero, dataApuracao, dezenasSorteadasOrdemSorteio } = last;
    const arr = [numero, dataApuracao, ...(dezenasSorteadasOrdemSorteio||[])];
    const payload = {
      lottery: mod.key,
      last_update_brt: new Date().toISOString().replace('T',' ').slice(0,19),
      headers: mod.columns,
      rows: [arr]
    };
    fs.writeFileSync(mod.out, JSON.stringify(payload, null, 2));
    continue;
  }

  const { head, rows } = parseCsv(csvTxt);
  const headLower = head.map(h => h.toLowerCase());
  function mapRow(cols){
    const numbers = cols.filter(x => /^\d+$/.test(x)).map(Number);
    let concurso = Number(cols.find((c,i)=> headLower[i].includes('concurso') ));
    let data = cols.find((c,i)=> headLower[i].includes('data') ) || cols.find((c,i)=> headLower[i].includes('apuracao') || headLower[i].includes('sorteio'));
    if (data && /\d{2}\/\d{2}\/\d{4}/.test(data)){ const [d,m,y]=data.split('/'); data=`${y}-${m}-${d}`; }
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
