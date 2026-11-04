// Rechtliche Seiten. ALLE Texte sind automatisch erstellte ENTWÜRFE und müssen
// vor dem kommerziellen Start anwaltlich geprüft und angepasst werden.
// Unbekannte Unternehmensangaben sind als [Platzhalter] markiert.
import { html, raw, icon, formData, setBusy, formError } from '../ui.js';
import { state } from '../store.js';
import { get, post } from '../api.js';

const PAGES = [
  ['impressum', 'Impressum'],
  ['datenschutz', 'Datenschutzerklärung'],
  ['agb', 'AGB'],
  ['widerruf', 'Widerrufsbelehrung'],
  ['cookies', 'Cookie-Richtlinie'],
  ['urheberrecht', 'Urheberrechtliche Hinweise'],
  ['ki-transparenz', 'KI-Transparenz'],
  ['haftungsausschluss', 'Medizinischer Haftungsausschluss'],
  ['cme-akkreditierung', 'CME-/CPD-Akkreditierung'],
  ['meldung', 'Rechtliche Meldungen & Urheberrechtsverletzungen'],
];

const ph = (s) => html`<span class="ph">${s}</span>`;

function content(page, op, version) {
  const O = {
    name: ph(op.name), address: ph(op.address), rep: ph(op.representative), email: ph(op.email), phone: ph(op.phone),
    register: ph(op.register), vat: ph(op.vatId), dpo: ph(op.dpo),
  };
  switch (page) {
    case 'impressum': return html`
      <h1>Impressum</h1>
      <p>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG) und § 18 Medienstaatsvertrag (MStV)</p>
      <h2>Diensteanbieter</h2>
      <p>${O.name}<br>${O.address}</p>
      <h2>Vertreten durch</h2><p>${O.rep}</p>
      <h2>Kontakt</h2><p>Telefon: ${O.phone}<br>E-Mail: ${O.email}</p>
      <h2>Registereintrag</h2><p>${O.register}</p>
      <h2>Umsatzsteuer-ID</h2><p>${O.vat}</p>
      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2><p>${ph('[Name, Anschrift]')}</p>
      <h2>Berufsrechtliche Angaben</h2>
      <p>Die Plattform vermittelt Fortbildungsinhalte Dritter. Sofern ärztliche Leistungen oder berufsrechtlich relevante Angaben erforderlich werden, sind diese hier zu ergänzen: ${ph('[ggf. Kammer, Berufsbezeichnung, berufsrechtliche Regelungen]')}</p>
      <h2>EU-Streitschlichtung / Verbraucherstreitbeilegung</h2>
      <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. ${ph('[Bitte prüfen und ggf. anpassen, § 36 VSBG]')}</p>`;

    case 'datenschutz': return html`
      <h1>Datenschutzerklärung</h1>
      <p>Stand: ${version}</p>
      <h2>1. Verantwortlicher</h2>
      <p>${O.name}, ${O.address}, E-Mail: ${O.email}</p>
      <h2>2. Datenschutzbeauftragte/r</h2><p>${O.dpo}</p>
      <h2>3. Überblick</h2>
      <p>Wir verarbeiten personenbezogene Daten nur, soweit dies für den Betrieb der Plattform, die Durchführung des Nutzungsvertrags, die Erfüllung gesetzlicher Pflichten oder auf Grundlage Ihrer Einwilligung erforderlich ist (Grundsatz der Datenminimierung, Art. 5 Abs. 1 lit. c DSGVO). Wir setzen keine Werbe-Tracker und keine Drittanbieter-Schriftarten oder -CDNs ein.</p>
      <h2>4. Verarbeitungen im Einzelnen</h2>
      <h3>4.1 Bereitstellung der Website / Server-Logfiles</h3>
      <p>Beim Aufruf werden technisch notwendige Daten (IP-Adresse, Zeitpunkt, angeforderte Ressource, User-Agent) verarbeitet. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (sicherer Betrieb). Speicherdauer: ${ph('[z. B. 7 Tage]')}.</p>
      <h3>4.2 Nutzerkonto</h3>
      <p>Pflichtangaben: Vor- und Nachname, E-Mail-Adresse, Passwort (nur als Hash gespeichert), Land (Lizenzgebiet, Umsatzsteuer), bevorzugte Sprache. Freiwillig: Beruf, Fachgebiet. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
      <h3>4.3 Lernfortschritt, Merkliste, Teilnahmebestätigungen</h3>
      <p>Wiedergabeposition, Fortschritt, zuletzt genutzte Sprache, gespeicherte Kurse und Abschlussnachweise. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Es werden keine Gesundheitsdaten von Patientinnen und Patienten verarbeitet.</p>
      <h3>4.4 Zahlungen und Rechnungen</h3>
      <p>Zahlungen werden über einen Zahlungsdienstleister abgewickelt ${ph('[z. B. Stripe Payments Europe Ltd., Irland]')}. Kartendaten erreichen unsere Server nicht. Rechnungsdaten bewahren wir gemäß § 147 AO / § 257 HGB bis zu 10 Jahre auf (Art. 6 Abs. 1 lit. c DSGVO).</p>
      <h3>4.5 Kontakt-, Partner- und Meldeformulare</h3>
      <p>Die angegebenen Daten verwenden wir ausschließlich zur Bearbeitung Ihres Anliegens (Art. 6 Abs. 1 lit. b bzw. f DSGVO). Löschung nach Abschluss, sofern keine Aufbewahrungspflichten bestehen.</p>
      <h3>4.6 KI-Übersetzung</h3>
      <p>Zur Übersetzung werden ausschließlich die Transkripte der lizenzierten Kursvideos an den KI-Dienstleister ${ph('[z. B. Anthropic]')} übermittelt — keine Nutzerdaten. ${ph('[AVV / Datenübermittlungsgrundlage prüfen]')}</p>
      <h3>4.7 KI-Sprachausgabe im Browser</h3>
      <p>In der Demo-Version wird die KI-Stimme über die Sprachsynthese Ihres Browsers/Betriebssystems erzeugt. Je nach Browser kann der Text der Untertitel dabei an den Sprachdienst des Browserherstellers übertragen werden. Es werden keine personenbezogenen Daten übermittelt.</p>
      <h3>4.8 Cookies und lokale Speicherung</h3>
      <p>Siehe <a href="/legal/cookies">Cookie-Richtlinie</a>. Rechtsgrundlage: § 25 Abs. 2 TDDDG (unbedingt erforderlich) bzw. § 25 Abs. 1 TDDDG i. V. m. Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).</p>
      <h2>5. Empfänger und Auftragsverarbeiter</h2>
      <p>${ph('[Hosting-Anbieter, CDN, Zahlungsdienstleister, E-Mail-Dienst, KI-Dienstleister — jeweils mit Sitz und AVV nach Art. 28 DSGVO aufführen]')}</p>
      <h2>6. Übermittlung in Drittländer</h2>
      <p>Soweit Dienstleister außerhalb des EWR eingesetzt werden, erfolgt die Übermittlung nur auf Grundlage eines Angemessenheitsbeschlusses (z. B. EU-US Data Privacy Framework) oder von Standardvertragsklauseln (Art. 46 DSGVO). ${ph('[konkret ergänzen]')}</p>
      <h2>7. Speicherdauer und Löschkonzept</h2>
      <ul><li>Kontodaten: bis zur Löschung des Kontos</li><li>Sitzungen: max. 30 Tage</li><li>Rechnungen: 10 Jahre (anonymisierte Zuordnung nach Kontolöschung)</li><li>Einwilligungsnachweise: ${ph('[z. B. 3 Jahre]')}</li><li>Audit-Protokolle der Administration: ${ph('[Frist festlegen]')}</li></ul>
      <h2>8. Ihre Rechte</h2>
      <p>Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) sowie das Recht, eine erteilte Einwilligung jederzeit zu widerrufen. Datenexport und Kontolöschung stehen Ihnen direkt in den <a href="/account/settings">Kontoeinstellungen</a> zur Verfügung. Sie können sich bei einer Aufsichtsbehörde beschweren, z. B. ${ph('[zuständige Landesdatenschutzbehörde]')}.</p>
      <h2>9. Sicherheit</h2>
      <p>Verschlüsselte Übertragung (TLS), gehashte Passwörter (scrypt), HttpOnly-Sitzungscookies, Zugriffsrechte nach dem Need-to-know-Prinzip und Protokollierung administrativer Vorgänge.</p>`;

    case 'agb': return html`
      <h1>Allgemeine Geschäftsbedingungen (AGB)</h1>
      <h2>§ 1 Geltungsbereich</h2>
      <p>Diese AGB gelten für alle Verträge zwischen ${O.name} („Anbieter“) und Nutzerinnen und Nutzern („Kunden“) über die Plattform MedTranslate. Abweichende Bedingungen des Kunden gelten nicht.</p>
      <h2>§ 2 Leistungen</h2>
      <p>Der Anbieter gewährt Zugang zu lizenzierten medizinischen Fortbildungsinhalten Dritter, einschließlich KI-generierter Untertitel und Audiospuren. Die fachlichen Inhalte stammen von den jeweiligen Originalanbietern. KI-Übersetzungen werden gekennzeichnet; die Originalfassung ist maßgeblich.</p>
      <h2>§ 3 Zielgruppe</h2><p>Das Angebot richtet sich an Angehörige der Gesundheitsberufe, Personen in Weiterbildung und Studierende. Es ersetzt keine ärztliche Beratung oder Behandlung.</p>
      <h2>§ 4 Vertragsschluss</h2>
      <p>Der Vertrag kommt durch Klick auf den Bestellbutton („zahlungspflichtig bestellen“ bzw. „Subscribe — pay now“) und die Bestätigung durch den Anbieter zustande. ${ph('[Bestellprozess und Korrekturmöglichkeiten nach § 312i BGB beschreiben]')}</p>
      <h2>§ 5 Preise und Zahlung</h2>
      <p>Es gelten die zum Zeitpunkt der Bestellung angezeigten Preise. Für Verbraucher in der EU enthalten die Preise die gesetzliche Umsatzsteuer des Wohnsitzlandes. Abonnements werden im Voraus für den jeweiligen Abrechnungszeitraum berechnet.</p>
      <h2>§ 6 Laufzeit und Kündigung</h2>
      <p>Monatsabonnements verlängern sich jeweils um einen Monat, Jahresabonnements nach Ablauf der Erstlaufzeit auf unbestimmte Zeit mit einer Kündigungsfrist von einem Monat (§ 309 Nr. 9 BGB) ${ph('[Modell prüfen]')}. Die Kündigung ist jederzeit im Kundenkonto oder über die Schaltfläche <a href="/cancel">„Verträge hier kündigen“</a> (§ 312k BGB) möglich.</p>
      <h2>§ 7 Widerrufsrecht</h2><p>Verbrauchern steht ein Widerrufsrecht nach Maßgabe der <a href="/legal/widerruf">Widerrufsbelehrung</a> zu.</p>
      <h2>§ 8 Nutzungsrechte</h2><p>Der Kunde erhält ein einfaches, nicht übertragbares Recht zur persönlichen Nutzung der Inhalte während der Vertragslaufzeit. Download, Weitergabe, Mitschnitt und öffentliche Vorführung sind untersagt.</p>
      <h2>§ 9 CME-/CPD-Punkte</h2><p>Fortbildungspunkte werden nur für Kurse vergeben, die ausdrücklich als akkreditiert gekennzeichnet sind, und nur im dort angegebenen Umfang. Ein Anspruch auf Anerkennung durch eine bestimmte Stelle besteht nicht.</p>
      <h2>§ 10 Haftung</h2><p>${ph('[Haftungsklausel durch Rechtsanwalt formulieren lassen — Haftung für Vorsatz, grobe Fahrlässigkeit, Leben/Körper/Gesundheit unbeschränkt]')}</p>
      <h2>§ 11 Schlussbestimmungen</h2><p>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts; zwingende Verbraucherschutzvorschriften des Aufenthaltsstaates bleiben unberührt.</p>`;

    case 'widerruf': return html`
      <h1>Widerrufsbelehrung</h1>
      <h2>Widerrufsrecht</h2>
      <p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.</p>
      <p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${O.name}, ${O.address}, E-Mail: ${O.email}) mittels einer eindeutigen Erklärung (z. B. per E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das untenstehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p>
      <h2>Folgen des Widerrufs</h2>
      <p>Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben.</p>
      <h2>Vorzeitiges Erlöschen des Widerrufsrechts</h2>
      <p>Bei Verträgen über digitale Inhalte erlischt das Widerrufsrecht, wenn wir mit der Vertragserfüllung begonnen haben, nachdem Sie ausdrücklich zugestimmt haben, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung beginnen, Sie Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der Vertragserfüllung Ihr Widerrufsrecht verlieren, und wir Ihnen eine Bestätigung zur Verfügung gestellt haben (§ 356 Abs. 5 BGB).</p>
      <h2>Muster-Widerrufsformular</h2>
      <p>An ${O.name}, ${O.address}, ${O.email}:<br>Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag über die Bereitstellung der folgenden digitalen Inhalte/Dienstleistung: ___ — Bestellt am: ___ — Name: ___ — Anschrift: ___ — Datum: ___</p>`;

    case 'cookies': return html`
      <h1>Cookie-Richtlinie</h1>
      <p>Wir verwenden so wenig Speicherung auf Ihrem Endgerät wie möglich und keine Cookies von Drittanbietern.</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Typ</th><th>Zweck</th><th>Kategorie</th><th>Dauer</th></tr></thead><tbody>
        <tr><td class="mono">mt_session</td><td>Cookie (HttpOnly)</td><td>Anmeldung / Sitzung</td><td>Unbedingt erforderlich</td><td>30 Tage</td></tr>
        <tr><td class="mono">mt_consent</td><td>localStorage</td><td>Speichert Ihre Datenschutz-Auswahl</td><td>Unbedingt erforderlich</td><td>bis zum Widerruf</td></tr>
        <tr><td class="mono">mt_pref_*</td><td>localStorage</td><td>Player-Sprache, Untertitel-Stil, Fortsetzungsposition (ohne Konto), Währung</td><td>Präferenzen (Einwilligung)</td><td>bis zum Widerruf</td></tr>
      </tbody></table></div>
      <p style="margin-top:16px">Analyse-Werkzeuge sind derzeit nicht im Einsatz. Ihre Auswahl können Sie jederzeit ändern: <button class="link-btn" data-action="cookie-settings">Cookie-Einstellungen öffnen</button>.</p>
      <p>Rechtsgrundlage: § 25 TDDDG, Art. 6 Abs. 1 lit. a DSGVO.</p>`;

    case 'urheberrecht': return html`
      <h1>Urheberrechtliche Hinweise</h1>
      <p>Alle auf MedTranslate veröffentlichten Fortbildungsinhalte sind urheberrechtlich geschützt (UrhG). Die Rechte an den Originalinhalten liegen bei den jeweiligen Anbietern bzw. Urhebern.</p>
      <h2>Lizenzierung</h2>
      <p>Wir veröffentlichen ausschließlich Inhalte, für die uns die erforderlichen Rechte eingeräumt wurden — insbesondere zur Nutzung des Originalvideos, zur KI-gestützten Übersetzung (Bearbeitung, § 23 UrhG), zur Erstellung von Untertiteln und KI-Audiospuren, zur kommerziellen Verwertung, zur öffentlichen Zugänglichmachung (§ 19a UrhG) in den lizenzierten Gebieten sowie zur technischen Speicherung und Verarbeitung. Jede Veröffentlichung wird gegen ein internes Lizenzregister geprüft; ohne vollständige Rechtefreigabe ist eine Veröffentlichung technisch gesperrt.</p>
      <h2>Übersetzungen</h2><p>Übersetzungen und KI-Audiospuren sind Bearbeitungen der Originalwerke und werden nur mit Zustimmung der Rechteinhaber erstellt.</p>
      <h2>Nutzung durch Kunden</h2><p>Eine Vervielfältigung, Weitergabe oder öffentliche Wiedergabe der Inhalte ist nicht gestattet.</p>
      <h2>Rechtsverletzungen melden</h2><p>Wenn Sie der Ansicht sind, dass Inhalte Ihre Rechte verletzen, nutzen Sie bitte unser <a href="/legal/meldung?type=copyright">Meldeformular</a>. Gemeldete Inhalte werden unverzüglich geprüft und bei begründetem Verdacht vorläufig gesperrt (Notice-and-Takedown, Art. 16 DSA).</p>`;

    case 'ki-transparenz': return html`
      <h1>KI-Transparenzinformationen</h1>
      <p>Wir setzen künstliche Intelligenz ein, um medizinische Fortbildungen sprachlich zugänglich zu machen. Wir informieren Sie offen darüber, wo und wie.</p>
      <h2>Wofür wir KI einsetzen</h2>
      <ul><li><b>Übersetzung</b> von Transkripten / Untertiteln (Large Language Model, ${ph('[Anbieter/Modell, z. B. Anthropic Claude]')})</li>
        <li><b>Sprachausgabe</b> (Text-to-Speech) in der Zielsprache — in der Demo über die Sprachsynthese Ihres Browsers</li></ul>
      <h2>Kennzeichnung</h2>
      <p>KI-generierte Untertitel und Audiospuren sind im Player und auf der Kursseite als „AI“ gekennzeichnet, zusammen mit ihrem Prüfstatus („medizinisch geprüft“ / „nicht geprüft“). Synthetische Stimmen werden nicht als echte Personen ausgegeben (Art. 50 EU AI Act, soweit anwendbar).</p>
      <h2>Qualitätskontrolle</h2>
      <p>Vor der Freigabe einer Sprache prüft eine fachlich qualifizierte Person die Übersetzung auf Fachterminologie, Sinntreue und zeitliche Synchronität und dokumentiert ihre Entscheidung. Änderungen am Original setzen alle Übersetzungen automatisch in den Prüfstatus zurück.</p>
      <h2>Grenzen</h2>
      <p>Maschinelle Übersetzungen können trotz Prüfung Fehler enthalten. Maßgeblich ist stets die Originalfassung. Bitte melden Sie Fehler über „Report an error“ auf der Kursseite.</p>
      <h2>Demo-Hinweis</h2>
      <p>Die Übersetzungen der Demo-Kurse wurden <b>nicht</b> medizinisch geprüft und dienen ausschließlich der Vorführung der Plattform.</p>`;

    case 'haftungsausschluss': return html`
      <h1>Medizinischer Haftungsausschluss</h1>
      <p>Die Inhalte auf MedTranslate dienen ausschließlich der Fort- und Weiterbildung von Fachpersonal im Gesundheitswesen. Sie stellen keine medizinische Beratung, Diagnose oder Therapieempfehlung für einzelne Patientinnen und Patienten dar.</p>
      <ul><li>Medizinisches Wissen entwickelt sich ständig weiter. Prüfen Sie Angaben, insbesondere Dosierungen und Grenzwerte, anhand aktueller Leitlinien, Fachinformationen und lokaler Protokolle.</li>
        <li>Die fachliche Verantwortung für die Originalinhalte liegt bei den jeweiligen Anbietern und Referierenden.</li>
        <li>Übersetzungen werden KI-gestützt erstellt; maßgeblich ist die Originalfassung.</li>
        <li>Die Anwendung erlernter Inhalte liegt in der Verantwortung der jeweiligen Fachperson.</li></ul>
      <p>Die Demo-Inhalte dieser Installation sind fiktive Beispielkurse und keine klinische Handlungsempfehlung.</p>`;

    case 'cme-akkreditierung': return html`
      <h1>Informationen zur CME-/CPD-Akkreditierung</h1>
      <p>Fortbildungspunkte werden nicht von MedTranslate, sondern von den zuständigen Stellen vergeben. Wir zeigen für jeden Kurs den tatsächlichen Status an und erfinden keine Punkte oder Zertifizierungen.</p>
      <h2>Übersetzung ist nicht gleich Akkreditierung</h2>
      <p>Eine Akkreditierung gilt für eine bestimmte Fortbildungsmaßnahme, häufig für eine bestimmte Sprache, ein bestimmtes Gebiet und einen bestimmten Zeitraum. Eine Übersetzung führt nicht automatisch zu einer Anerkennung in einem anderen Land oder durch eine andere Stelle.</p>
      <h2>Relevante Systeme (Auswahl)</h2>
      <ul><li><b>Deutschland:</b> Zertifizierung durch die Landesärztekammern (CME-Punkte, Fortbildungsordnung)</li>
        <li><b>USA:</b> ACCME-akkreditierte Anbieter; AMA PRA Category 1 Credit™</li>
        <li><b>Vereinigtes Königreich:</b> CPD-Systeme, u. a. der Royal Colleges</li>
        <li><b>Europa:</b> nationale Systeme; europäische Anerkennung z. B. über UEMS-EACCME®</li>
        <li><b>Weitere:</b> nationale Kammern und Fachgesellschaften</li></ul>
      <h2>Statusanzeige auf der Plattform</h2>
      <ul><li><b>Nicht akkreditiert</b> — keine Punkte; nur Teilnahmenachweis</li>
        <li><b>Akkreditierung beantragt</b> — derzeit keine Punkte</li>
        <li><b>Akkreditiert</b> — mit Angabe der Stelle, Referenznummer, Punktzahl, Gültigkeit und ggf. Sprachfassungen; nur nach Prüfung des Nachweises durch uns</li>
        <li><b>Abgelaufen</b> — keine Punkte mehr</li></ul>
      <p>Die Demo-Kurse dieser Installation sind sämtlich nicht akkreditiert.</p>`;
    default: return null;
  }
}

function reportForm(q) {
  const u = state.user;
  const types = [['copyright', 'Urheberrechtsverletzung / copyright infringement'], ['translation_error', 'Übersetzungsfehler / translation error'], ['medical_content', 'Medizinischer Inhalt / medical content concern'], ['privacy', 'Datenschutz / privacy request'], ['legal', 'Sonstige rechtliche Anfrage / other legal request']];
  return html`
    <h1>Rechtliche Meldungen</h1>
    <p>Kontakt für rechtliche Anfragen, Urheberrechtsverletzungen und inhaltliche Beanstandungen (Meldeverfahren nach Art. 16 DSA). Alternativ per E-Mail: ${ph(state.legalOp?.email || '[E-Mail]')}</p>
    <form class="panel" id="report" novalidate>
      <div class="form-grid">
        <label class="field full"><span>Art der Meldung</span><select name="type">${types.map(([v, l]) => html`<option value="${v}" ${q.type === v ? 'selected' : ''}>${l}</option>`)}</select></label>
        <label class="field"><span>Name</span><input name="name" required maxlength="120" value="${u ? `${u.firstName} ${u.lastName}` : ''}"></label>
        <label class="field"><span>E-Mail</span><input name="email" type="email" required value="${u?.email || ''}"></label>
        <label class="field"><span>Organisation / Rechteinhaber <small>(optional)</small></span><input name="organisation" maxlength="200"></label>
        <label class="field"><span>Betroffener Kurs <small>(Kurs-Kennung, optional)</small></span><input name="courseSlug" maxlength="120" value="${q.course || ''}"></label>
        <label class="field full"><span>URL / Fundstelle <small>(optional)</small></span><input name="referenceUrl" maxlength="500"></label>
        <label class="field full"><span>Beschreibung</span><textarea name="description" required maxlength="6000" rows="6" placeholder="Bitte beschreiben Sie den Sachverhalt so genau wie möglich (bei Übersetzungsfehlern: Zeitpunkt im Video, Sprache, korrekte Formulierung)."></textarea></label>
      </div>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="check" data-gf><input type="checkbox" name="goodFaith"> <span>Ich versichere, dass die Angaben nach bestem Wissen richtig und vollständig sind und ich berechtigt bin, im Namen des Rechteinhabers zu handeln.</span></label>
      <label class="check"><input type="checkbox" name="privacyAccepted" required> <span>Ich habe die <a href="/legal/datenschutz" target="_blank">Datenschutzerklärung</a> gelesen.</span></label>
      <button class="btn btn-primary" type="submit">Meldung absenden</button>
    </form>`;
}

export default {
  title: (ctx) => PAGES.find(([k]) => k === ctx.params.page)?.[1] || 'Rechtliches',
  async render(ctx) {
    const page = ctx.params.page;
    if (!PAGES.some(([k]) => k === page)) { const e = new Error('Seite nicht gefunden.'); e.status = 404; throw e; }
    const { operator, policyVersion } = await get('/api/legal/operator');
    state.legalOp = operator;
    const body = page === 'meldung' ? reportForm(ctx.query) : content(page, operator, policyVersion);
    return html`<div class="container legal-layout">
      <nav class="legal-nav" aria-label="Rechtliches">${PAGES.map(([k, l]) => html`<a href="/legal/${k}" class="${k === page ? 'active' : ''}">${l}</a>`)}</nav>
      <article class="prose" lang="de">
        <div class="draft-banner">${icon('alert', 18)}<span><b>ENTWURF</b> — automatisch erstellter Rechtstext. Vor dem kommerziellen Start muss dieser Text anwaltlich geprüft und angepasst werden. Gelb markierte Angaben sind Platzhalter. <span lang="en">(Draft legal text — requires review by a lawyer before commercial launch.)</span></span></div>
        ${body}
      </article></div>`;
  },
  mount(root) {
    const form = root.querySelector('#report'); if (!form) return;
    const sync = () => { root.querySelector('[data-gf]').hidden = form.type.value !== 'copyright'; };
    form.type.addEventListener('change', sync); sync();
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); formError(form, '');
      const btn = form.querySelector('[type=submit]'); setBusy(btn, true);
      try {
        const r = await post('/api/complaints', formData(form));
        form.innerHTML = String(html`<div class="notice ok">${icon('check', 18)}<span>Vielen Dank. Ihre Meldung ist eingegangen (Referenz <b>${r.reference}</b>). Wir prüfen sie unverzüglich.</span></div>`);
      } catch (err) { formError(form, err.message); setBusy(btn, false); }
    });
  },
};

export { raw };
