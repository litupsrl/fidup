import json, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
N = 'Fid-ap'
lines = [
  f"Ecco {N}: tutte le tue carte fedeltà, in un'unica app.",
  "Basta portafogli pieni di tessere. Le tue carte sono sempre con te, sul telefono.",
  f"Apri {N}, e mostri il codice alla cassa con un tocco. Le carte che usi di più sono sempre in cima.",
  f"Per aggiungerne una, inquadra il codice a barre, oppure scatta una foto: {N} riconosce anche il nome del negozio.",
  "Nessuna registrazione. Nessun dato in claud. Nessun tipo di profilazione. Tutto resta cifrato sul tuo dispositivo, e funziona anche offline.",
  "Cambi telefono? Fai un backup cifrato, che solo tu puoi aprire.",
  f"{N} è gratuita. Inquadra il cu erre cod, e aggiungila alla schermata Home.",
]
out = []
for i, t in enumerate(lines):
    a, sr = k.create(t, voice='if_sara', speed=0.98, lang='it')
    # piccolo margine di silenzio
    a = np.concatenate([np.zeros(int(sr * 0.15), dtype=a.dtype), a, np.zeros(int(sr * 0.25), dtype=a.dtype)])
    a = (a / max(1e-6, float(np.abs(a).max())) * 0.89).astype(np.float32)
    sf.write(f'v{i}.wav', a, sr, subtype='PCM_24')
    out.append({'i': i, 'text': t, 'dur': round(len(a) / sr, 2), 'peak': round(float(np.abs(a).max()), 3)})
    print(out[-1])
json.dump(out, open('voice.json', 'w'), ensure_ascii=False, indent=1)
