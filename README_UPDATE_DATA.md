# Atualização de resultados — LotoLab

## Como está agora
- O site lê `data/mega.json` e `data/loto.json`.
- O `tool_pro.html` agora permite usar **TODOS** os concursos (checkbox) e ajusta o **máximo do slider** dinamicamente para o tamanho do dataset.

## Como colocar *todos os concursos* e atualizar diariamente (automático)
1) Coloque estes arquivos no seu repositório Git (o mesmo que está conectado ao Netlify):  
   - `.github/workflows/update_loterias.yml`  
   - `scripts/fetch_loterias_from_caixa.mjs`

2) O workflow roda **todos os dias às 12:05 BRT** (15:05 UTC) e vai:
   - Baixar os CSVs oficiais via endpoint `servicebus2.caixa.gov.br/portaldeloterias/api/resultados/download?modalidade=MEGA_SENA|LOTOFACIL`.
   - Converter para o formato JSON usado no site.
   - Comitar `data/mega.json` e `data/loto.json`. O Netlify atualiza o site automaticamente.

> Observações:
> - Em alguns períodos a CAIXA muda comportamento ou aplica *rate limits*. O script tem **fallback** para ao menos garantir o último concurso.
> - Se preferir **manual**, use `data_builder.html` (CSV → JSON) e publique os arquivos na pasta `/data`.

## Ajustes opcionais
- **Horário**: edite `update_loterias.yml` (`cron`) para outro minúto/horário.
- **Outras loterias**: adicione no array `MODS` no script com o `key` oficial e colunas.
