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
  cloudFileName: 'fidup-backup.json'
};
