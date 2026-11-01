import json, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
N = 'Fid-up'
lines = [
  f"Meet {N}: all your loyalty cards, in one app.",
  "No more wallets stuffed with cards. Your cards are always with you, right on your phone.",
  f"Open {N}, and show your code at the checkout with a single tap. The cards you use most are always on top.",
  f"To add one, scan the barcode, or take a photo: {N} even recognizes the store name.",
  "No sign-up. No data in the cloud. No profiling of any kind. Everything stays encrypted on your device, and it works offline too.",
  "Changing phones? Make an encrypted backup that only you can open.",
  f"{N} is free. Scan the QR code, and add it to your Home Screen.",
]
out = []
for i, t in enumerate(lines):
    a, sr = k.create(t, voice='af_heart', speed=1.0, lang='en-us')
    # piccolo margine di silenzio
    a = np.concatenate([np.zeros(int(sr * 0.15), dtype=a.dtype), a, np.zeros(int(sr * 0.25), dtype=a.dtype)])
    a = (a / max(1e-6, float(np.abs(a).max())) * 0.89).astype(np.float32)
    sf.write(f'en_v{i}.wav', a, sr, subtype='PCM_24')
    out.append({'i': i, 'text': t, 'dur': round(len(a) / sr, 2), 'peak': round(float(np.abs(a).max()), 3)})
    print(out[-1])
json.dump(out, open('voice_en.json', 'w'), ensure_ascii=False, indent=1)
