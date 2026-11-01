# Presentazione video FidUP!

`../fidup-presentazione.mp4`: 1080×1920 (verticale), 46 s, H.264 + AAC, volume -16 LUFS (standard social).

Come è fatta:
- **Voce**: Kokoro-82M (licenza Apache-2.0), voce italiana `if_sara`, generata in locale con `voice.py`.
  Il nome è scritto "Fid-ap" per ottenere la pronuncia corretta.
- **Musica**: composta via codice con `music.py` (nessun campione o brano di terzi).
- **Slide**: `slides.html` disegnate con il browser (`slides.js`); lo screenshot dell'app ha i numeri delle carte oscurati.
- **Montaggio**: `build.py` (ffmpeg): zoom lento, dissolvenze, musica che si abbassa quando parla la voce.

Per rigenerare servono `kokoro-onnx`, il modello `kokoro-v1.0.onnx` e `voices-v1.0.bin` (release GitHub di kokoro-onnx), ffmpeg e Playwright.
Le immagini usate dalle slide (logo, QR) sono in `brand/` e `qr/`.
