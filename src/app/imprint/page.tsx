// src/app/imprint/page.tsx

import styles from "./imprint.module.css"

export const metadata = { title: "Impressum – YourKieke" }

export default function ImprintPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Impressum</h1>

      <section className={styles.section}>
        <h2 className={styles.heading}>Angaben gemäß § 5 TMG</h2>
        <p>
          <strong>Till Harnos</strong><br />
          Geibelstr. 9<br />
          81679 München<br />
          Deutschland
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Kontakt</h2>
        <p>E-Mail: tillharnos@gmail.com</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>Till Harnos</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Haftung für Inhalte</h2>
        <p>
          Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
          Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Haftung für Links</h2>
        <p>
          Diese Website enthält Links zu externen Websites Dritter, auf deren Inhalte kein Einfluss
          besteht. Daher kann für diese fremden Inhalte keine Gewähr übernommen werden.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Urheberrecht</h2>
        <p>
          Die durch den Seitenbetreiber erstellten Inhalte und Werke auf dieser Website unterliegen
          dem deutschen Urheberrecht.
        </p>
      </section>
    </main>
  )
}
