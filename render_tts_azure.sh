#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${AZURE_TTS_KEY:-}" || -z "${AZURE_TTS_REGION:-}" ]]; then
  echo "Defina AZURE_TTS_KEY e AZURE_TTS_REGION, ex: export AZURE_TTS_KEY=...; export AZURE_TTS_REGION=brazilsouth"
  exit 1
fi
mkdir -p tts/out
for f in tts/VO_*.ssml; do
  base="$(basename "$f" .ssml)"
  echo "Renderizando $base.wav ..."
  curl -sS -X POST "https://${AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"     -H "Ocp-Apim-Subscription-Key: ${AZURE_TTS_KEY}"     -H "Content-Type: application/ssml+xml"     -H "X-Microsoft-OutputFormat: riff-24khz-16bit-mono-pcm"     --data-binary @"$f"     --output "tts/out/${base}.wav"
done
echo "Concluído. Arquivos em tts/out/"
