# Atualização de resultados — LotoLab

Como está agora
- O site lê `data/mega.json` e `data/loto.json`.
- O `tool_pro.html` permite usar **TODOS** os concursos (checkbox) e ajusta o **máximo do slider** para o tamanho do dataset.

Automação diária (GitHub Actions)
1) Coloque estes arquivos no seu **repositório Git** conectado ao Netlify:
   - `.github/workflows/update_loterias.yml`
   - `scripts/fetch_loterias_from_caixa.mjs`
2) Faça **commit & push**.
3) Em **Actions**, rode manualmente a primeira vez (ou aguarde 12:05 BRT).
4) Confirme se `data/mega.json` e `data/loto.json` cresceram (histórico completo). O Netlify redeploya automático.

Alternativa manual
- Use `data_builder.html` (CSV → JSON) e substitua os arquivos na pasta `/data`.
