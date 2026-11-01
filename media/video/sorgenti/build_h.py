import json, subprocess
V = json.load(open('voice_h.json'))
FPS = 30; XF = 0.6; LEAD = 0.8; TAIL = 2.8; PAD = 0.9
D = []
for i, v in enumerate(V):
    d = v['dur'] + PAD + (LEAD if i == 0 else 0) + (TAIL if i == len(V) - 1 else 0)
    D.append(round(d, 2))
starts = []; t = 0
for i, d in enumerate(D):
    starts.append(round(t, 3)); t += d - XF
total = round(sum(D) - XF * (len(D) - 1), 2)
print('durate slide', D, 'totale', total)
cmd = ['ffmpeg', '-y', '-v', 'error']
for i, d in enumerate(D): cmd += ['-loop', '1', '-framerate', str(FPS), '-t', str(d), '-i', f'slide{i}.png']
for i in range(len(V)): cmd += ['-i', f'h_v{i}.wav']
cmd += ['-i', 'music.wav']
n = len(D); f = []
for i, d in enumerate(D):
    frames = int(d * FPS)
    zin = i % 2 == 0  # alterna zoom in / zoom out
    z = f"1+0.05*on/{frames}" if zin else f"1.05-0.05*on/{frames}"
    f.append(f"[{i}:v]scale=2160:3840,zoompan=z='{z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps={FPS},format=yuv420p,setsar=1[z{i}]")
prev = 'z0'; off = 0
for i in range(1, n):
    off = round(off + D[i - 1] - XF, 3)
    f.append(f"[{prev}][z{i}]xfade=transition=fade:duration={XF}:offset={off}[x{i}]"); prev = f'x{i}'
f.append(f"[{prev}]fade=t=in:st=0:d=0.6,fade=t=out:st={total-0.8}:d=0.8[vout]")
# voce: ogni frase all'inizio della sua slide (+0.35 s)
for i in range(len(V)):
    ms = int((starts[i] + 0.35 + (LEAD if i == 0 else 0)) * 1000)
    f.append(f"[{n+i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
f.append(''.join(f'[a{i}]' for i in range(len(V))) + f"amix=inputs={len(V)}:normalize=0,apad=whole_dur={total},asplit=2[voice][key]")
# musica: livello di sottofondo, si abbassa quando parla la voce
m = n + len(V)
f.append(f"[{m}:a]atrim=0:{total},volume=0.32,afade=t=out:st={total-3}:d=3[mus]")
f.append("[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[duck]")
f.append("[duck][voice]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
cmd += ['-filter_complex', ';'.join(f), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', '-t', str(total), 'fidup-presentazione-voce.mp4']
subprocess.run(cmd, check=True)
print('ok')
