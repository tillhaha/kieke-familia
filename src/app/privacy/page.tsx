// src/app/privacy/page.tsx

import styles from "./privacy.module.css"

export const metadata = { title: "Datenschutzerklärung – YourKieke" }

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Datenschutzerklärung</h1>

      <section className={styles.section}>
        <h2 className={styles.heading}>1. Verantwortlicher</h2>
        <p>
          Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
        </p>
        <p>
          Till Harnos<br />
          Geibelstr. 9<br />
          81679 München<br />
          Deutschland<br />
          E-Mail: tillharnos@gmail.com
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>2. Allgemeines zur Datenverarbeitung</h2>
        <p>
          Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies zur
          Bereitstellung einer funktionsfähigen Anwendung sowie unserer Inhalte und Leistungen
          erforderlich ist. Die Verarbeitung personenbezogener Daten erfolgt regelmäßig nur nach
          Einwilligung des Nutzers. Eine Ausnahme gilt in solchen Fällen, in denen eine vorherige
          Einholung einer Einwilligung aus tatsächlichen Gründen nicht möglich ist und die
          Verarbeitung der Daten durch gesetzliche Vorschriften gestattet ist.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>3. Rechtsgrundlagen der Verarbeitung</h2>
        <p>
          Soweit wir für Verarbeitungsvorgänge personenbezogener Daten eine Einwilligung der
          betroffenen Person einholen, dient Art. 6 Abs. 1 lit. a DSGVO als Rechtsgrundlage.
        </p>
        <p>
          Bei der Verarbeitung von personenbezogenen Daten, die zur Erfüllung eines Vertrages
          erforderlich ist, dessen Vertragspartei die betroffene Person ist, dient Art. 6 Abs. 1
          lit. b DSGVO als Rechtsgrundlage. Dies gilt auch für Verarbeitungsvorgänge, die zur
          Durchführung vorvertraglicher Maßnahmen erforderlich sind.
        </p>
        <p>
          Soweit eine Verarbeitung personenbezogener Daten zur Wahrung eines berechtigten
          Interesses unseres Unternehmens oder eines Dritten erforderlich ist und die Interessen,
          Grundrechte und Grundfreiheiten des Betroffenen das erstgenannte Interesse nicht
          überwiegen, dient Art. 6 Abs. 1 lit. f DSGVO als Rechtsgrundlage für die Verarbeitung.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>4. Hosting und technische Infrastruktur</h2>
        <p>
          Diese Anwendung wird auf Servern der Hetzner Online GmbH, Industriestr. 25, 91710
          Gunzenhausen, Deutschland, betrieben. Die Server befinden sich in einem Rechenzentrum in
          Nürnberg, Deutschland. Hetzner ist nach Art. 28 DSGVO als Auftragsverarbeiter tätig.
          Alle Daten werden ausschließlich innerhalb der Europäischen Union verarbeitet und
          gespeichert.
        </p>
        <p>
          Die Datenbank (PostgreSQL) wird ebenfalls auf denselben Hetzner-Servern betrieben. Es
          findet keine Übermittlung von Datenbankdaten in Drittländer statt.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>5. Anmeldung über Google OAuth 2.0</h2>
        <p>
          Die Anmeldung bei YourKieke erfolgt ausschließlich über Google OAuth 2.0. Es ist keine
          separate Registrierung mit Benutzername und Passwort möglich. Bei der Anmeldung werden
          von Google folgende Daten an uns übermittelt und in unserer Datenbank gespeichert:
        </p>
        <ul className={styles.list}>
          <li>Name (Vor- und Nachname)</li>
          <li>E-Mail-Adresse</li>
          <li>Profilbild (URL)</li>
          <li>Google-Account-ID (zur eindeutigen Identifikation)</li>
          <li>OAuth-Zugriffstoken und Refresh-Token (für die Google Calendar-Integration)</li>
        </ul>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Ihre
          Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO, die Sie durch die Nutzung der
          Google-Anmeldung erteilen.
        </p>
        <p>
          Für die Datenverarbeitung durch Google gilt die{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            Datenschutzerklärung von Google
          </a>.
          Google LLC hat seinen Sitz in den USA. Für Datenübermittlungen in die USA stützen wir
          uns auf die Standardvertragsklauseln der EU-Kommission gemäß Art. 46 Abs. 2 lit. c DSGVO.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>6. Google Calendar-Integration</h2>
        <p>
          YourKieke bietet eine optionale Integration mit Google Calendar. Sofern Sie diese
          Funktion aktivieren, werden folgende Daten verarbeitet:
        </p>
        <ul className={styles.list}>
          <li>
            Liste Ihrer Google Kalender (Kalenderbezeichnungen und -IDs), um Ihnen die Auswahl
            zu ermöglichen
          </li>
          <li>
            Kalenderereignisse (Titel, Datum, Uhrzeit, Ort) der von Ihnen ausgewählten Kalender
            zur Darstellung in der App
          </li>
        </ul>
        <p>
          Die Kalenderauswahl wird in unserer Datenbank gespeichert. Kalenderinhalte werden
          ausschließlich zur Darstellung in der App abgerufen und nicht dauerhaft gespeichert.
          Die Nutzung der Google Calendar API erfolgt auf Grundlage Ihrer ausdrücklichen
          Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Sie können die Kalenderintegration
          jederzeit in den Einstellungen deaktivieren.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>7. Von Ihnen eingegebene Daten</h2>
        <p>
          Im Rahmen der Nutzung von YourKieke speichern wir die von Ihnen aktiv eingegebenen
          Inhalte, insbesondere:
        </p>
        <ul className={styles.list}>
          <li>Wochenpläne und Tagesnotizen (Mahlzeiten, Aktivitäten, Aufenthaltsorte)</li>
          <li>Rezepte und Essenspläne</li>
          <li>Geburtstage von Familienmitgliedern und anderen Personen</li>
          <li>Reisepläne und Abwesenheiten</li>
          <li>Arbeits- und Aufenthaltsorte</li>
          <li>Familienstrukturen und Mitgliederinformationen</li>
        </ul>
        <p>
          Diese Daten werden ausschließlich zur Bereitstellung der Funktionen von YourKieke
          verwendet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>8. KI-gestützte Rezeptverarbeitung (Anthropic)</h2>
        <p>
          YourKieke bietet eine Funktion zur automatischen Strukturierung von Rezepttexten. Wenn
          Sie diese Funktion nutzen, wird der von Ihnen eingegebene Rezepttext an die API von
          Anthropic PBC, 548 Market St, San Francisco, CA 94104, USA, übermittelt, um strukturierte
          Rezeptdaten zu extrahieren.
        </p>
        <p>
          Übermittelt wird ausschließlich der von Ihnen eingegebene Rezepttext. Es werden keine
          personenbezogenen Daten (Name, E-Mail etc.) an Anthropic übermittelt. Die Verarbeitung
          erfolgt auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Da Anthropic
          seinen Sitz in den USA hat, erfolgt eine Datenübermittlung in ein Drittland; wir stützen
          uns dabei auf die Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c
          DSGVO). Die{" "}
          <a
            href="https://www.anthropic.com/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            Datenschutzrichtlinie von Anthropic
          </a>{" "}
          finden Sie auf deren Website.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>9. Cookies und Sitzungsverwaltung</h2>
        <p>
          YourKieke verwendet ausschließlich technisch notwendige Cookies zur Sitzungsverwaltung
          (Session-Cookies). Diese Cookies sind erforderlich, um Sie als angemeldeten Nutzer zu
          erkennen und die Funktionen der Anwendung bereitzustellen. Es werden keine
          Tracking-Cookies, Analyse-Cookies oder Werbecookies eingesetzt.
        </p>
        <p>
          Folgende Cookies werden gesetzt:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>next-auth.session-token</strong> – Authentifizierungs-Session-Token (HttpOnly,
            Secure, läuft mit der Sitzung ab)
          </li>
          <li>
            <strong>next-auth.csrf-token</strong> – CSRF-Schutz-Token (HttpOnly, Secure)
          </li>
        </ul>
        <p>
          Rechtsgrundlage für den Einsatz technisch notwendiger Cookies ist Art. 6 Abs. 1 lit. f
          DSGVO (berechtigtes Interesse an der sicheren und funktionsfähigen Bereitstellung der
          Anwendung).
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>10. Datenweitergabe an Dritte</h2>
        <p>
          Eine Weitergabe Ihrer personenbezogenen Daten an Dritte findet nicht statt, mit Ausnahme
          der in dieser Datenschutzerklärung genannten Dienstleister (Hetzner als Hosting-Anbieter,
          Google für Authentifizierung und Kalender, Anthropic für die optionale
          Rezeptverarbeitung). Eine Weitergabe zu Werbezwecken oder an sonstige Dritte erfolgt
          nicht.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>11. Speicherdauer und Löschung</h2>
        <p>
          Ihre personenbezogenen Daten werden gespeichert, solange Sie die Anwendung aktiv nutzen
          bzw. ein Konto bei YourKieke besitzen. Nicht mehr benötigte Daten werden regelmäßig
          gelöscht.
        </p>
        <p>
          Auf Ihren Wunsch werden alle bei uns gespeicherten personenbezogenen Daten unverzüglich
          und vollständig gelöscht. Wenden Sie sich hierzu per E-Mail an tillharnos@gmail.com.
          Die Löschung umfasst alle Profil-, Familien- und Inhaltsdaten sowie die gespeicherten
          OAuth-Tokens.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>12. Ihre Rechte als betroffene Person</h2>
        <p>
          Sie haben gegenüber uns folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Auskunftsrecht</strong> (Art. 15 DSGVO): Sie können Auskunft über die von uns
            verarbeiteten personenbezogenen Daten verlangen.
          </li>
          <li>
            <strong>Recht auf Berichtigung</strong> (Art. 16 DSGVO): Sie können die Berichtigung
            unrichtiger oder die Vervollständigung unvollständiger Daten verlangen.
          </li>
          <li>
            <strong>Recht auf Löschung</strong> (Art. 17 DSGVO): Sie können die Löschung Ihrer
            personenbezogenen Daten verlangen, sofern keine gesetzlichen Aufbewahrungspflichten
            entgegenstehen.
          </li>
          <li>
            <strong>Recht auf Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO): Sie können
            die Einschränkung der Verarbeitung Ihrer Daten verlangen.
          </li>
          <li>
            <strong>Recht auf Datenübertragbarkeit</strong> (Art. 20 DSGVO): Sie können verlangen,
            dass wir Ihnen Ihre Daten in einem strukturierten, gängigen und maschinenlesbaren
            Format bereitstellen.
          </li>
          <li>
            <strong>Widerspruchsrecht</strong> (Art. 21 DSGVO): Sie können der Verarbeitung Ihrer
            Daten widersprechen, sofern die Verarbeitung auf Art. 6 Abs. 1 lit. f DSGVO beruht.
          </li>
          <li>
            <strong>Recht auf Widerruf der Einwilligung</strong> (Art. 7 Abs. 3 DSGVO): Sofern
            die Verarbeitung auf Ihrer Einwilligung beruht, können Sie diese jederzeit mit Wirkung
            für die Zukunft widerrufen.
          </li>
        </ul>
        <p>
          Zur Ausübung Ihrer Rechte wenden Sie sich bitte an: tillharnos@gmail.com
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>13. Beschwerderecht bei der Aufsichtsbehörde</h2>
        <p>
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung
          Ihrer personenbezogenen Daten durch uns zu beschweren. Die zuständige Aufsichtsbehörde
          für Bayern ist:
        </p>
        <p>
          Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)<br />
          Promenade 18<br />
          91522 Ansbach<br />
          Telefon: +49 (0) 981 180093-0<br />
          Website:{" "}
          <a
            href="https://www.lda.bayern.de"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            www.lda.bayern.de
          </a>
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>14. Datensicherheit</h2>
        <p>
          Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten gegen
          zufällige oder vorsätzliche Manipulationen, Verlust, Zerstörung oder gegen den Zugriff
          unberechtigter Personen zu schützen. Die Übertragung aller Daten zwischen Ihrem Browser
          und unseren Servern erfolgt verschlüsselt über HTTPS (TLS). OAuth-Tokens werden
          ausschließlich serverseitig gespeichert und sind für den Client nicht zugänglich.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>15. Aktualität und Änderung dieser Datenschutzerklärung</h2>
        <p>
          Diese Datenschutzerklärung ist aktuell gültig und hat den Stand März 2026. Durch die
          Weiterentwicklung unserer Anwendung oder aufgrund geänderter gesetzlicher bzw.
          behördlicher Vorgaben kann es notwendig werden, diese Datenschutzerklärung zu ändern.
          Die jeweils aktuelle Datenschutzerklärung kann jederzeit auf dieser Seite abgerufen werden.
        </p>
      </section>
    </main>
  )
}
