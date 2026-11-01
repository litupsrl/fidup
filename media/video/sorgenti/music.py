import numpy as np, soundfile as sf
SR = 44100; BPM = 92; beat = 60 / BPM; bar = 4 * beat
TOTAL = 60.0
n = int(SR * TOTAL); L = np.zeros(n); R = np.zeros(n)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
# progressione: Cmaj7 - Am7 - Fmaj7 - G(add9), 1 battuta ciascuno, ripetuta
prog = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 62]]
def lowpass(x, a):  # filtro passa-basso a un polo
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc += a * (x[i] - acc); y[i] = acc
    return y
t_bar = np.arange(int(SR * bar)) / SR
nb = int(TOTAL / bar) + 1
for b in range(nb):
    chord = prog[b % 4]; s = int(b * bar * SR)
    if s >= n: break
    seg = min(len(t_bar), n - s); t = t_bar[:seg]
    env = np.minimum(1, t / 0.6) * np.minimum(1, (bar - t) / 0.5) * 0.9 + 0.1 * np.minimum(1, t / 0.6)
    for k, m in enumerate(chord):
        f = hz(m + 12)
        for det, ch in ((-0.15, L), (0.15, R)):  # pad leggermente stonato tra i canali = ampiezza
            w = sum(np.sin(2 * np.pi * f * h * (1 + det / 100) * t + k) / h ** 1.6 for h in (1, 2, 3))
            ch[s:s + seg] += 0.035 * env * w
    # basso
    fb = hz(chord[0] - 12)
    benv = np.exp(-t * 1.2) * np.minimum(1, t / 0.02)
    bass = 0.12 * benv * (np.sin(2 * np.pi * fb * t) + 0.25 * np.sin(4 * np.pi * fb * t))
    L[s:s + seg] += bass; R[s:s + seg] += bass
    # arpeggio a crome (pluck morbido)
    notes = [chord[i % 4] + 24 for i in (0, 1, 2, 3, 2, 1, 2, 3)]
    for j, m in enumerate(notes):
        ps = s + int(j * beat / 2 * SR)
        if ps >= n: break
        ln = min(int(SR * 0.9), n - ps); tt = np.arange(ln) / SR
        f = hz(m); e = np.exp(-tt * 5.5) * np.minimum(1, tt / 0.004)
        p = 0.05 * e * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 9))
        pan = 0.35 + 0.3 * ((j % 4) / 3)
        L[ps:ps + ln] += p * (1 - pan); R[ps:ps + ln] += p * pan
# ammorbidisce e aggiunge un riverbero semplice (eco multiple attenuate)
for ch in (L, R):
    ch[:] = lowpass(ch, 0.35)
def reverb(x, sr):
    y = x.copy()
    for d, g in ((0.031, .35), (0.047, .3), (0.071, .25), (0.113, .2), (0.173, .15), (0.257, .1)):
        k = int(d * sr); y[k:] += g * x[:-k]
    return y
L = reverb(L, SR); R = reverb(R[::1], SR)
st = np.stack([L, R], axis=1)
fade = np.ones(n); fi = int(SR * 2.0); fo = int(SR * 4.0)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
st *= fade[:, None]
st = st / np.abs(st).max() * 0.8
sf.write('music.wav', st.astype(np.float32), SR, subtype='PCM_24')
print('musica', TOTAL, 's')
