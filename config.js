/*! FidUP! — Copyright LITUP S.r.l.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * Required Notice: Copyright LITUP S.r.l. (https://github.com/litupsrl/fidup)
 * https://polyformproject.org/licenses/noncommercial/1.0.0 */
// Configurazione opzionale per il backup DIRETTO su cloud.
// Senza questi ID funziona comunque il backup tramite "Esporta / Importa file"
// (che su iPhone e Android permette di salvare su Google Drive o OneDrive dal foglio di condivisione).
// Vedi README.md per come ottenere gli ID (gratuiti).
window.APP_CONFIG = {
  // Google Cloud Console → Credenziali → ID client OAuth "Applicazione web"
  googleClientId: '',
  // Microsoft Entra (portal.azure.com) → Registrazioni app → ID applicazione (client), piattaforma "SPA"
  microsoftClientId: '',
  // Nome del file di backup nel cloud
  cloudFileName: 'fidup-backup.json',
  // Indirizzo del profilo iPhone (fidup.mobileconfig). Va ospitato su un server che lo invii con
  // Content-Type "application/x-apple-aspen-config" (es. Cloudflare Pages o Netlify con file _headers).
  // GitHub Pages NON lo fa: lasciare vuoto finché il profilo non è ospitato altrove.
  profileUrl: ''
};
