# LotoLab — TTS em Nuvem (Azure) — Voz Masculina PT-BR

Este pacote gera os áudios **VO_Site_VSL.wav** e **VO_Ad_30s.wav** na **nuvem**, usando **Azure Speech** com a voz **pt-BR-FranciscoNeural** (masculina).

## Como usar no GitHub (recomendado)
1. Suba esta pasta para o seu repositório (raiz).
2. Em **Settings → Secrets and variables → Actions → New repository secret**:
   - `AZURE_TTS_KEY` = sua chave do Azure Speech
   - `AZURE_TTS_REGION` = ex.: `brazilsouth` (ou `eastus`, etc.)
3. Vá em **Actions** → rode o workflow **Render TTS (Azure)**.
4. Baixe os áudios em **Artifacts** (**LotoLab-VO-WAV**) ou use o commit automático (`tts/out/*.wav`).

## Rodar local (opcional)
```bash
export AZURE_TTS_KEY=SEU_TOKEN
export AZURE_TTS_REGION=brazilsouth
bash render_tts_azure.sh
```
Saída: `tts/out/VO_Site_VSL.wav` e `tts/out/VO_Ad_30s.wav`.

## Ajustar a voz / SSML
- Edite `tts/VO_*.ssml` e troque o `name="pt-BR-FranciscoNeural"` por outra voz do Azure (ex.: `pt-BR-AntonioNeural`).
- Pausas → `<break time='200ms'/>`, ênfases com `<emphasis level="moderate">texto</emphasis>`.

## Importar no CapCut
Use os WAVs gerados + os **SRTs** do pacote CapCut e finalize seus vídeos.
