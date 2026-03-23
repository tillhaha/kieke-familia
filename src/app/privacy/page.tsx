// src/app/privacy/page.tsx

import styles from "./privacy.module.css"

export const metadata = { title: "Datenschutz – YourKieke" }

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Datenschutzerklärung</h1>

      <section className={styles.section}>
        <h2 className={styles.heading}>1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website ist die unter dem Impressum
          angegebene Person.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>2. Erhobene Daten</h2>
        <p>
          Bei der Anmeldung über Google OAuth werden folgende Daten verarbeitet:
        </p>
        <ul className={styles.list}>
          <li>Name und E-Mail-Adresse (von Google übermittelt)</li>
          <li>Profilbild (von Google übermittelt)</li>
          <li>Google Calendar-Zugriffs- und Refresh-Tokens (für die Kalenderintegration)</li>
        </ul>
        <p>
          Darüber hinaus speichert die Anwendung von Ihnen eingegebene Inhalte wie Wochenpläne,
          Rezepte, Geburtstage und Reisezeiten.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>3. Zweck der Verarbeitung</h2>
        <p>
          Die Daten werden ausschließlich zur Bereitstellung der Funktionen von YourKieke
          verwendet – insbesondere zur Authentifizierung, Familienplanung und Kalenderintegration.
          Eine Weitergabe an Dritte findet nicht statt.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>4. Speicherdauer</h2>
        <p>
          Ihre Daten werden gespeichert, solange Sie die Anwendung nutzen. Auf Anfrage werden
          alle personenbezogenen Daten gelöscht.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>5. Ihre Rechte</h2>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der
          Verarbeitung Ihrer personenbezogenen Daten sowie das Recht auf Datenübertragbarkeit.
          Wenden Sie sich dazu an die im Impressum angegebene Kontaktadresse.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>6. Google OAuth & Calendar</h2>
        <p>
          Diese Anwendung nutzt Google OAuth 2.0 zur Authentifizierung sowie die Google Calendar
          API zur Kalendersynchronisierung. Dabei gelten zusätzlich die{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            Datenschutzbestimmungen von Google
          </a>.
        </p>
      </section>
    </main>
  )
}
