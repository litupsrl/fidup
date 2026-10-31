/*! FidUP! — Copyright LITUP S.r.l.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * Required Notice: Copyright LITUP S.r.l. (https://github.com/litupsrl/fidup)
 * https://polyformproject.org/licenses/noncommercial/1.0.0 */
'use strict';

/* Catalogo locale delle catene: serve solo a suggerire nome e colore quando si aggiunge una carta.
   Nessun dato esce dal telefono.
   - n: nome mostrato
   - c: colore indicativo della carta (modificabile dall'utente; scelto scuro per leggere il testo bianco)
   - k: parole chiave per riconoscere la catena dal sito web contenuto in un QR code e dagli alias
   I nomi sono marchi dei rispettivi titolari; non vengono usati loghi. */
window.CHAINS = [
  // Supermercati e ipermercati
  { n: 'Esselunga', c: '#C8102E', k: ['esselunga', 'fidaty'] },
  { n: 'Coop', c: '#D50F25', k: ['coop', 'ecoop', 'coopfirenze', 'novacoop', 'coopalleanza3', 'coopalleanza30'] },
  { n: 'Conad', c: '#D2001E', k: ['conad'] },
  { n: 'Carrefour', c: '#004E9F', k: ['carrefour'] },
  { n: 'Lidl', c: '#0050AA', k: ['lidl', 'lidlplus'] },
  { n: 'Eurospin', c: '#00539F', k: ['eurospin'] },
  { n: 'Pam Panorama', c: '#C8102E', k: ['pampanorama', 'pam', 'panorama'] },
  { n: 'Despar', c: '#C8102E', k: ['despar', 'interspar', 'eurospar'] },
  { n: 'Bennet', c: '#C8102E', k: ['bennet'] },
  { n: 'Iper La grande i', c: '#B5121B', k: ['iper', 'lagrandei'] },
  { n: 'Famila', c: '#C8102E', k: ['famila'] },
  { n: 'MD', c: '#B5121B', k: ['mdspa', 'mdiscount'] },
  { n: 'Penny', c: '#B5121B', k: ['penny'] },
  { n: 'Aldi', c: '#0F2D69', k: ['aldi'] },
  { n: 'Crai', c: '#C8102E', k: ['crai'] },
  { n: 'Tigros', c: '#B5121B', k: ['tigros'] },
  { n: 'Unes', c: '#00843D', k: ['unes'] },
  { n: 'Il Gigante', c: '#00703C', k: ['ilgigante'] },
  { n: 'Sigma', c: '#C8102E', k: ['supersigma', 'sigma'] },
  { n: 'Gruppo Végé', c: '#00703C', k: ['vege', 'gruppovege'] },
  { n: 'NaturaSì', c: '#4E7D2A', k: ['naturasi'] },
  { n: 'Todis', c: '#B5121B', k: ['todis'] },
  { n: 'Prix', c: '#B5121B', k: ['prix', 'prixquality'] },
  // Casa, bricolage, sport
  { n: 'IKEA', c: '#0058A3', k: ['ikea', 'ikeafamily'] },
  { n: 'Decathlon', c: '#0072AE', k: ['decathlon'] },
  { n: 'Leroy Merlin', c: '#4E8A1C', k: ['leroymerlin'] },
  { n: 'Bricocenter', c: '#C8102E', k: ['bricocenter'] },
  { n: 'Brico io', c: '#C25E00', k: ['bricoio'] },
  { n: 'OBI', c: '#C25E00', k: ['obi', 'obiitalia'] },
  { n: 'Maisons du Monde', c: '#3A3A3A', k: ['maisonsdumonde'] },
  { n: 'Arcaplanet', c: '#C8102E', k: ['arcaplanet'] },
  { n: 'Maxi Zoo', c: '#004B87', k: ['maxizoo'] },
  // Elettronica
  { n: 'MediaWorld', c: '#C8102E', k: ['mediaworld'] },
  { n: 'Unieuro', c: '#1D3E8F', k: ['unieuro'] },
  { n: 'Euronics', c: '#00529B', k: ['euronics'] },
  { n: 'Expert', c: '#C8102E', k: ['expert', 'expertonline'] },
  { n: 'Trony', c: '#C8102E', k: ['trony'] },
  // Libri
  { n: 'laFeltrinelli', c: '#C8102E', k: ['lafeltrinelli', 'feltrinelli'] },
  { n: 'Mondadori Store', c: '#C8102E', k: ['mondadoristore', 'mondadori'] },
  { n: 'Giunti al Punto', c: '#C8102E', k: ['giuntialpunto', 'giunti'] },
  // Profumerie e cura persona
  { n: 'Douglas', c: '#1D5C57', k: ['douglas'] },
  { n: 'Sephora', c: '#1A1A1A', k: ['sephora'] },
  { n: 'KIKO Milano', c: '#1A1A1A', k: ['kikocosmetics', 'kiko'] },
  { n: 'Tigotà', c: '#B0005F', k: ['tigota'] },
  { n: 'Acqua & Sapone', c: '#C8102E', k: ['acquaesapone'] },
  { n: 'Bottega Verde', c: '#3F7A23', k: ['bottegaverde'] },
  { n: 'Yves Rocher', c: '#00703C', k: ['yvesrocher'] },
  { n: 'Pinalli', c: '#1A1A1A', k: ['pinalli'] },
  { n: 'Caddy\'s', c: '#B0005F', k: ['caddys'] },
  // Abbigliamento
  { n: 'OVS', c: '#1A1A1A', k: ['ovs'] },
  { n: 'Coin', c: '#1A1A1A', k: ['coin'] },
  { n: 'Upim', c: '#B0005F', k: ['upim'] },
  { n: 'H&M', c: '#C8102E', k: ['hm'] },
  { n: 'Zara', c: '#1A1A1A', k: ['zara'] },
  { n: 'Calzedonia', c: '#1A1A1A', k: ['calzedonia'] },
  { n: 'Intimissimi', c: '#1A1A1A', k: ['intimissimi'] },
  { n: 'Primark', c: '#0077B6', k: ['primark'] },
  // Carburanti e altro
  { n: 'Q8', c: '#00337F', k: ['q8', 'q8star'] },
  { n: 'Esso', c: '#C8102E', k: ['esso'] },
  { n: 'Tamoil', c: '#C8102E', k: ['tamoil'] },
  { n: 'Autogrill', c: '#C8102E', k: ['autogrill'] },
  { n: 'McDonald\'s', c: '#C8102E', k: ['mcdonalds'] }
];

/* Prefissi VERIFICATI dei codici a barre (facoltativo).
   Aggiungere solo prefissi controllati su carte reali, ad esempio:
   { p: '0123', len: 13, n: 'Nome catena' }   // p = cifre iniziali, len = lunghezza del codice (0 = qualsiasi)
   L'app impara comunque da sola dalle carte già salvate dall'utente. */
window.CHAIN_PREFIXES = [];
