# Genera qr/volantino-<lingua>.html dal volantino italiano (qr/volantino.html). Poi: node qr/render-volantini.js
import json, html
src = open('/home/user/fidup/qr/volantino.html', encoding='utf-8').read()
IT = {
 'h1': "Tutte le tue carte fedeltà", 'h2': "in un'unica app, sempre con te.",
 's1': 'Nessuna registrazione', 's2': 'Nessun dato in cloud', 's3': 'Nessun tipo di profilazione',
 'last': 'Resta tutto sul tuo dispositivo, <span class="hl">funziona anche offline!</span>',
 'scan': 'Inquadra con la fotocamera',
 'ios': 'Safari o Chrome → Condividi → <b>Aggiungi alla schermata Home</b>', 'and': 'Chrome → tocca <b>Installa</b>',
 'note': '* Salvo i backup cifrati che scegli tu di salvare su Google Drive o OneDrive: nessuno, nemmeno Google o Microsoft, può leggerli.',
 'free': 'Gratis <span>·</span> Le carte restano cifrate sul telefono', 'title': 'FidUP! – Volantino', 'lang': 'it'}
T = {
 'en': {'h1': 'All your loyalty cards', 'h2': 'in one app, always with you.', 's1': 'No sign-up', 's2': 'No data in the cloud', 's3': 'No profiling of any kind',
        'last': 'Everything stays on your device, <span class="hl">works offline too!</span>', 'scan': 'Scan with your camera',
        'ios': 'Safari or Chrome → Share → <b>Add to Home Screen</b>', 'and': 'Chrome → tap <b>Install</b>',
        'note': '* Except for the encrypted backups you choose to save to Google Drive or OneDrive: nobody, not even Google or Microsoft, can read them.',
        'free': 'Free <span>·</span> Your cards stay encrypted on your phone', 'title': 'FidUP! – Flyer', 'lang': 'en'},
 'fr': {'h1': 'Toutes vos cartes de fidélité', 'h2': 'dans une seule app, toujours avec vous.', 's1': 'Aucune inscription', 's2': 'Aucune donnée dans le cloud', 's3': 'Aucun profilage',
        'last': 'Tout reste sur votre appareil, <span class="hl">fonctionne même hors ligne !</span>', 'scan': 'Scannez avec l\'appareil photo',
        'ios': 'Safari ou Chrome → Partager → <b>Sur l\'écran d\'accueil</b>', 'and': 'Chrome → touchez <b>Installer</b>',
        'note': '* Sauf les sauvegardes chiffrées que vous choisissez d\'enregistrer sur Google Drive ou OneDrive : personne, pas même Google ou Microsoft, ne peut les lire.',
        'free': 'Gratuit <span>·</span> Vos cartes restent chiffrées sur votre téléphone', 'title': 'FidUP! – Dépliant', 'lang': 'fr'},
 'de': {'h1': 'Alle deine Kundenkarten', 'h2': 'in einer App, immer dabei.', 's1': 'Keine Registrierung', 's2': 'Keine Daten in der Cloud', 's3': 'Keinerlei Profiling',
        'last': 'Alles bleibt auf deinem Gerät, <span class="hl">funktioniert auch offline!</span>', 'scan': 'Mit der Kamera scannen',
        'ios': 'Safari oder Chrome → Teilen → <b>Zum Home-Bildschirm</b>', 'and': 'Chrome → <b>Installieren</b> tippen',
        'note': '* Außer den verschlüsselten Backups, die du selbst in Google Drive oder OneDrive speicherst: Niemand, nicht einmal Google oder Microsoft, kann sie lesen.',
        'free': 'Kostenlos <span>·</span> Deine Karten bleiben verschlüsselt auf dem Handy', 'title': 'FidUP! – Flyer', 'lang': 'de'},
 'es': {'h1': 'Todas tus tarjetas de fidelización', 'h2': 'en una sola app, siempre contigo.', 's1': 'Sin registro', 's2': 'Sin datos en la nube', 's3': 'Sin ningún tipo de perfilado',
        'last': 'Todo se queda en tu dispositivo, <span class="hl">¡funciona también sin conexión!</span>', 'scan': 'Escanea con la cámara',
        'ios': 'Safari o Chrome → Compartir → <b>Añadir a pantalla de inicio</b>', 'and': 'Chrome → toca <b>Instalar</b>',
        'note': '* Salvo las copias de seguridad cifradas que tú decidas guardar en Google Drive u OneDrive: nadie, ni siquiera Google o Microsoft, puede leerlas.',
        'free': 'Gratis <span>·</span> Tus tarjetas permanecen cifradas en tu teléfono', 'title': 'FidUP! – Folleto', 'lang': 'es'},
 'zh': {'h1': '你的所有会员卡', 'h2': '集于一个 App，随时随身。', 's1': '无需注册', 's2': '不在云端存储数据', 's3': '不进行任何用户画像',
        'last': '所有内容都保存在你的设备上，<span class="hl">离线也能使用！</span>', 'scan': '用相机扫描二维码',
        'ios': 'Safari 或 Chrome → 共享 → <b>添加到主屏幕</b>', 'and': 'Chrome → 轻点 <b>安装</b>',
        'note': '* 你自行选择保存到 Google Drive 或 OneDrive 的加密备份除外：任何人，包括 Google 或 Microsoft，都无法读取。',
        'free': '免费 <span>·</span> 会员卡加密保存在你的手机上', 'title': 'FidUP! – 宣传单', 'lang': 'zh-Hans'},
}
def esc_it(s):  # il sorgente contiene gli apostrofi così come sono
    return s
for lang, tr in T.items():
    out = src
    for k, v in IT.items():
        if k == 'lang':
            out = out.replace('<html lang="it">', f'<html lang="{tr["lang"]}">', 1); continue
        assert out.count(v) >= 1, (lang, k, v)
        out = out.replace(v, tr[k])
    out = out.replace('font-family: Inter, "DejaVu Sans", sans-serif;', 'font-family: Inter, "WenQuanYi Zen Hei", "DejaVu Sans", sans-serif;')
    open(f'/home/user/fidup/qr/volantino-{lang}.html', 'w', encoding='utf-8').write(out)
print('ok')
