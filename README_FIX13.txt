# LotoLab (FIX13)
- Form Netlify com action relativo e form hidden
- Timer refatorado (mobile OK)
- Gerador PRO com slider dinâmico (5%–100%), “Usar todos”, reload de dados e fallback claro
- /data sem cache via `_headers`
- Checkout com `rel="noopener noreferrer"` + UTM
- GitHub Action com `permissions: contents: write` e coleta diária (API + ZIP fallback)

## Teste rápido
- `/` • `/tool_pro.html` • `/checkout.html` • `/bonus/ok.html`
- Form: enviar e ver em Netlify Forms
- Tool PRO: “Concursos carregados”, Mega↔Loto, slider, gerar combos
