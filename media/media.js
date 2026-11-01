/*! FidUP! — Copyright LITUP S.r.l. · SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 */
// Pagina Media: testi nelle 6 lingue di FidUP!, lingua dal browser (o quella scelta nell'app), volantino della lingua in cima.
'use strict';
(function () {
  const APP = '<a href="https://litupsrl.github.io/fidup/">litupsrl.github.io/fidup</a>';
  const M = {
    it: { qr: 'QR code', logo: 'Logo', title: 'FidUP! – Media', sub: 'Volantini, QR code e logo per far conoscere FidUP!', flyers: 'Volantini',
      flyersLead: 'Formato A4. Il <b>PDF</b> è per la stampa, il <b>PNG</b> per social e messaggi. Tocca l\'anteprima per aprire il PDF.',
      assets: 'QR code e logo', assetsLead: 'Il QR code porta a ' + APP + '. Per la stampa usa i file <b>SVG</b>, che restano nitidi a qualsiasi dimensione.',
      logoNeg: 'Logo negativo', icon: 'Icona dell\'app',
      colors: 'Colori: nero <b>#3A3A3A</b> · verde <b>#B1C900</b>. Il nome dell\'app si scrive sempre <b>FidUP!</b>',
      cta: '<b>FidUP!</b> — nessuna registrazione, nessun dato in cloud, nessun tipo di profilazione.', open: 'Apri l\'app →',
      footer: '© LITUP S.r.l. · Il nome e il logo FidUP! sono di LITUP S.r.l. · <a href="../LICENSE.md">Licenza del software</a>' },
    en: { qr: 'QR code', logo: 'Logo', title: 'FidUP! – Media', sub: 'Flyers, QR code and logos to share FidUP!', flyers: 'Flyers',
      flyersLead: 'A4 format. The <b>PDF</b> is for printing, the <b>PNG</b> for social media and messages. Tap the preview to open the PDF.',
      assets: 'QR code and logos', assetsLead: 'The QR code leads to ' + APP + '. For printing use the <b>SVG</b> files, which stay sharp at any size.',
      logoNeg: 'Negative logo', icon: 'App icon',
      colors: 'Colours: black <b>#3A3A3A</b> · green <b>#B1C900</b>. The app name is always written <b>FidUP!</b>',
      cta: '<b>FidUP!</b> — no sign-up, no data in the cloud, no profiling of any kind.', open: 'Open the app →',
      footer: '© LITUP S.r.l. · The FidUP! name and logo belong to LITUP S.r.l. · <a href="../LICENSE.md">Software licence</a>' },
    fr: { qr: 'QR code', logo: 'Logo', title: 'FidUP! – Médias', sub: 'Dépliants, QR code et logos pour faire connaître FidUP!', flyers: 'Dépliants',
      flyersLead: 'Format A4. Le <b>PDF</b> est destiné à l\'impression, le <b>PNG</b> aux réseaux sociaux et aux messages. Touchez l\'aperçu pour ouvrir le PDF.',
      assets: 'QR code et logos', assetsLead: 'Le QR code mène à ' + APP + '. Pour l\'impression, utilisez les fichiers <b>SVG</b>, qui restent nets à toutes les tailles.',
      logoNeg: 'Logo négatif', icon: 'Icône de l\'app',
      colors: 'Couleurs : noir <b>#3A3A3A</b> · vert <b>#B1C900</b>. Le nom de l\'app s\'écrit toujours <b>FidUP!</b>',
      cta: '<b>FidUP!</b> — aucune inscription, aucune donnée dans le cloud, aucun profilage.', open: 'Ouvrir l\'app →',
      footer: '© LITUP S.r.l. · Le nom et le logo FidUP! appartiennent à LITUP S.r.l. · <a href="../LICENSE.md">Licence du logiciel</a>' },
    de: { qr: 'QR-Code', logo: 'Logo', title: 'FidUP! – Medien', sub: 'Flyer, QR-Code und Logos, um FidUP! bekannt zu machen', flyers: 'Flyer',
      flyersLead: 'Format A4. Das <b>PDF</b> ist zum Drucken, das <b>PNG</b> für soziale Medien und Nachrichten. Tippe auf die Vorschau, um das PDF zu öffnen.',
      assets: 'QR-Code und Logos', assetsLead: 'Der QR-Code führt zu ' + APP + '. Verwende zum Drucken die <b>SVG</b>-Dateien, sie bleiben in jeder Größe scharf.',
      logoNeg: 'Logo negativ', icon: 'App-Symbol',
      colors: 'Farben: Schwarz <b>#3A3A3A</b> · Grün <b>#B1C900</b>. Der App-Name wird immer <b>FidUP!</b> geschrieben',
      cta: '<b>FidUP!</b> — keine Registrierung, keine Daten in der Cloud, keinerlei Profiling.', open: 'App öffnen →',
      footer: '© LITUP S.r.l. · Name und Logo FidUP! gehören LITUP S.r.l. · <a href="../LICENSE.md">Softwarelizenz</a>' },
    es: { qr: 'Código QR', logo: 'Logotipo', title: 'FidUP! – Medios', sub: 'Folletos, código QR y logotipos para dar a conocer FidUP!', flyers: 'Folletos',
      flyersLead: 'Formato A4. El <b>PDF</b> es para imprimir, el <b>PNG</b> para redes sociales y mensajes. Toca la vista previa para abrir el PDF.',
      assets: 'Código QR y logotipos', assetsLead: 'El código QR lleva a ' + APP + '. Para imprimir usa los archivos <b>SVG</b>, que se mantienen nítidos a cualquier tamaño.',
      logoNeg: 'Logotipo en negativo', icon: 'Icono de la app',
      colors: 'Colores: negro <b>#3A3A3A</b> · verde <b>#B1C900</b>. El nombre de la app se escribe siempre <b>FidUP!</b>',
      cta: '<b>FidUP!</b> — sin registro, sin datos en la nube, sin ningún tipo de perfilado.', open: 'Abrir la app →',
      footer: '© LITUP S.r.l. · El nombre y el logotipo FidUP! pertenecen a LITUP S.r.l. · <a href="../LICENSE.md">Licencia del software</a>' },
    zh: { qr: '二维码', logo: '标志', title: 'FidUP! – 宣传资料', sub: '用于推广 FidUP! 的宣传单、二维码和标志', flyers: '宣传单',
      flyersLead: 'A4 尺寸。<b>PDF</b> 用于打印，<b>PNG</b> 用于社交媒体和消息。轻点预览图即可打开 PDF。',
      assets: '二维码和标志', assetsLead: '二维码链接到 ' + APP + '。打印时请使用 <b>SVG</b> 文件，任何尺寸都保持清晰。',
      logoNeg: '反白标志', icon: 'App 图标',
      colors: '颜色：黑色 <b>#3A3A3A</b> · 绿色 <b>#B1C900</b>。App 名称始终写作 <b>FidUP!</b>',
      cta: '<b>FidUP!</b> — 无需注册，不在云端存储数据，不进行任何用户画像。', open: '打开 App →',
      footer: '© LITUP S.r.l. · FidUP! 名称和标志归 LITUP S.r.l. 所有 · <a href="../LICENSE.md">软件许可证</a>' }
  };
  const LANGS = Object.keys(M);
  function detect() {
    const saved = localStorage.getItem('lang'); // stessa scelta fatta nell'app (stesso sito)
    if (LANGS.includes(saved)) return saved;
    for (const l of navigator.languages || [navigator.language || '']) { const p = String(l).slice(0, 2).toLowerCase(); if (LANGS.includes(p)) return p; }
    return 'en';
  }
  function apply(l) {
    const d = M[l];
    document.documentElement.lang = l === 'zh' ? 'zh-Hans' : l;
    document.title = d.title;
    document.querySelectorAll('[data-m]').forEach((el) => { if (d[el.dataset.m]) el.innerHTML = d[el.dataset.m]; });
    document.getElementById('lang').value = l;
    // volantino nella lingua scelta per primo, poi gli altri nell'ordine abituale
    const grid = document.querySelector('.grid');
    const items = [...grid.querySelectorAll('.item')].sort((a, b) => (b.dataset.lang === l) - (a.dataset.lang === l) || LANGS.indexOf(a.dataset.lang) - LANGS.indexOf(b.dataset.lang));
    items.forEach((it) => grid.append(it));
  }
  document.getElementById('lang').addEventListener('change', (e) => { localStorage.setItem('lang', e.target.value); apply(e.target.value); });
  apply(detect());
})();
