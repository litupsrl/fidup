# Presentazione video FidUP!

- `../fidup-presentazione.mp4`: italiano, 46 s, voce `if_sara`.
- `../fidup-presentazione-voce.mp4`: italiano con **voce registrata** (consigliato), 48 s. Frasi ritagliate dalla registrazione secondo `seg.json`, pulizia leggera (passa-alto, riduzione fruscio, compressione), montaggio con `build_h.py`.
- `../fidup-presentation-en.mp4`: inglese, 45 s, voce `af_heart`; schermate dell'app in inglese con carte dimostrative (`shots_en.js`).

Entrambi 1080×1920 (verticale), H.264 + AAC, volume -16 LUFS (standard social). File con suffisso `_en` = versione inglese.

Come è fatta:
- **Voce**: Kokoro-82M (licenza Apache-2.0), voce italiana `if_sara`, generata in locale con `voice.py`.
  Il nome è scritto "Fid-ap" per ottenere la pronuncia corretta.
- **Musica**: composta via codice con `music.py` (nessun campione o brano di terzi).
- **Slide**: `slides.html` disegnate con il browser (`slides.js`); lo screenshot dell'app ha i numeri delle carte oscurati.
- **Montaggio**: `build.py` (ffmpeg): zoom lento, dissolvenze, musica che si abbassa quando parla la voce.

Per rigenerare servono `kokoro-onnx`, il modello `kokoro-v1.0.onnx` e `voices-v1.0.bin` (release GitHub di kokoro-onnx), ffmpeg e Playwright.
Le immagini usate dalle slide (logo, QR) sono in `brand/` e `qr/`.
