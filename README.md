# FidUP! — PWA cifrata (iPhone e Android, senza App Store)

Web app installabile (PWA) che fa una sola cosa: conservare le carte fedeltà.

- **Solo locale**: i dati restano nel browser del telefono (IndexedDB) e non c'è nessun server.
- **Cifratura**: AES-256-GCM. La chiave deriva dalla password con PBKDF2-SHA256 (600.000 iterazioni). Sul disco finisce solo il testo cifrato; la chiave resta in memoria e non è esportabile.
- **Backup cifrato**: il file di backup è l'archivio cifrato stesso, quindi Google o Microsoft non possono leggerlo.
- **Offline**: un service worker mette l'app in cache.
- **Scansione**: fotocamera o foto. Su Android usa il `BarcodeDetector` nativo, su iPhone la libreria ZXing inclusa.
- **Formati**: EAN-13, EAN-8, UPC-A/E, Code 128, Code 39, ITF, Codabar, QR, oppure solo numero.
- **Blocco automatico** quando l'app va in background, con tempo configurabile.

## 1. Pubblicazione gratuita su HTTPS (obbligatorio)

Fotocamera e Web Crypto funzionano solo su HTTPS. La strada più semplice è **GitHub Pages**:

1. Crea un repository su GitHub (es. `fidup`) e caricaci il contenuto di questa cartella.
2. Vai su *Settings → Pages → Source: Deploy from branch → main / root*.
3. L'app sarà su `https://TUOUTENTE.github.io/fidup/`.

In alternativa vanno bene Netlify, Cloudflare Pages o Vercel (basta trascinare la cartella).
Non c'è nessun processo di build: sono file statici.

## 2. Installazione sul telefono

- **iPhone** (Safari): apri l'URL, tocca **Condividi → Aggiungi alla schermata Home**.
  Va aperta **sempre dall'icona**, perché Safari e l'app installata hanno archivi separati.
- **Android** (Chrome): menu ⋮ → **Installa app** / *Aggiungi a schermata Home*.

## 3. Backup su Google Drive / OneDrive

### Opzione A: senza configurazione (consigliata)
*Impostazioni → Esporta backup* apre il foglio di condivisione del sistema:
- iPhone: **Salva su File → Google Drive / OneDrive**, se le loro app sono installate. In alternativa puoi condividere direttamente all'app Drive o OneDrive.
- Android: **Drive** o **OneDrive** dal menu di condivisione.

Per il ripristino usa *Importa backup da file*: il selettore file di iOS e Android mostra anche Drive e OneDrive.

### Opzione B: collegamento diretto (pulsanti ⬆️/⬇️)
Serve registrare gratis un ID client e inserirlo in `config.js`.

**Google Drive**
1. https://console.cloud.google.com → crea un progetto → *API e servizi → Libreria* → abilita **Google Drive API**.
2. *Schermata consenso OAuth*: tipo "Esterno", aggiungi lo scope `.../auth/drive.file` e aggiungi te stesso come utente di test.
3. *Credenziali → Crea ID client OAuth → Applicazione web*:
   - Origini JavaScript autorizzate: `https://TUOUTENTE.github.io`
   - URI di reindirizzamento autorizzati: `https://TUOUTENTE.github.io/fidup/`
4. Copia l'ID client in `googleClientId`.

L'app vede **solo i file che ha creato lei** (scope `drive.file`). Il backup è `fidup-backup.json`.

**OneDrive**
1. https://portal.azure.com → *Microsoft Entra ID → Registrazioni app → Nuova registrazione*.
   - Tipi di account: "account personali Microsoft e account in qualsiasi organizzazione".
   - URI di reindirizzamento: piattaforma **Applicazione a pagina singola (SPA)**, `https://TUOUTENTE.github.io/fidup/`
2. *Autorizzazioni API → Microsoft Graph → delegate →* `Files.ReadWrite.AppFolder`.
3. Copia l'"ID applicazione (client)" in `microsoftClientId`.

Il backup finisce in `OneDrive/App/<nome app>/fidup-backup.json`.

I token di accesso restano solo in `sessionStorage`, durano circa 1 ora e non vengono mai salvati in modo permanente.

## 4. E i Comandi Rapidi di iPhone?

Non servono. La PWA installata dalla schermata Home si comporta già come un'app senza passare dall'App Store.
C'è un limite: un comando rapido "Apri URL" apre **Safari**, non la PWA, e Safari ha un archivio dati separato.
Per questo i Comandi Rapidi non sono adatti a gestire i dati.
Puoi usarli solo come scorciatoia generica, mentre l'icona sulla Home resta la via corretta.

Apple Wallet richiederebbe pass `.pkpass` firmati con un certificato Apple Developer (99 €/anno), quindi non rientra nello scopo "senza pubblicare".

## 5. Note di sicurezza

- **Password dimenticata = dati persi** (by design). Usa una passphrase lunga, perché il backup sta nel cloud e potrebbe subire un attacco offline.
- iOS non cancella i dati delle PWA installate in Home dopo 7 giorni di inattività (quella regola riguarda i siti in Safari). Fai comunque backup periodici.
- CSP restrittiva: script solo dal proprio dominio, connessioni solo verso le API Google e Microsoft.
- Dopo una modifica ai file aumenta la versione in `sw.js` (`CACHE`) così i telefoni scaricano l'aggiornamento.

## Struttura

```
index.html  styles.css  app.js  config.js  sw.js  manifest.webmanifest
icons/      vendor/ (JsBarcode, qrcode-generator, ZXing; tutte licenze MIT/Apache-2.0)
```

Test locale: `python3 -m http.server 8000` → http://localhost:8000 (localhost conta come contesto sicuro).
