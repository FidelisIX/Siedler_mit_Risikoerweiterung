# Feature Requests

Wünsche und Ideen für neue Funktionen. Neue Einträge oben bei „Offen“ ergänzen.

**Vorlage für neue Einträge:**

```markdown
### F-XXX: Kurzer Titel
- **Gewünscht:** JJJJ-MM-TT, von wem
- **Status:** Idee / Offene Fragen / Geplant / In Arbeit / Umgesetzt
- **Beschreibung:** Was soll möglich sein, und warum?
- **Offene Fragen:** …
```

---

## Offen

### F-011: Eigene Gebäude „Dorf“ und „Stadt“?
- **Gewünscht:** 2026-10-30, Simon (aus F-006)
- **Status:** Offene Fragen
- **Beschreibung:** In F-006 wurden „Dorf“ als Siedlung und „Stadt“ als Gutshof umgesetzt.
- **Offene Fragen:** Sollen die Gebäude im Spiel so heißen, oder braucht es eigene Gebäude „Dorf“ und „Stadt“?

### F-010: Limes als durchgehende Mauer?
- **Gewünscht:** 2026-10-30, Simon (aus F-006)
- **Status:** Offene Fragen
- **Beschreibung:** Der Limes ist derzeit ein Gebäude auf einem Feld, das die eigenen Nachbargebäude abschirmt.
- **Offene Fragen:** Soll er stattdessen eine Mauer entlang von Feldgrenzen sein, die sich über mehrere Felder ziehen lässt?

### F-009: Balancing nach Testpartien
- **Gewünscht:** 2026-10-30, Claude
- **Status:** Idee
- **Beschreibung:** Kosten, Punkte, Schonfrist, Angriffe pro Zug und Verlustregeln (`BUILDINGS` und `CONQUEST`
  in `server/game.js`) nach den ersten echten Partien überprüfen.

### F-008: Weitere Raum-Features aus Ortsraten
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Idee (bewusst zurückgestellt)
- **Beschreibung:** Countdown vor Spielbeginn, „Alleine spielen“ (bräuchte Computer-Gegner),
  mehr als 6 Spieler (bräuchte größere Karten).

---

## Umgesetzt

### F-007: Raum-Features, Raumsicherung und Statistik wie bei Ortsraten
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Umgesetzt
- **Umsetzung:** Spieler entfernen, Host-Übergabe nach 15 s, „Nochmal spielen“ per Abstimmung, nur ein aktiver Tab
  pro Spieler, Raumsicherung im Branch `statistik` bei Deploys, Statistikseite mit Rekorden. Tests:
  `test/game.test.js`, `test/stats.test.js`, `test/server.test.js`.

### F-006: Stationäre Truppen, Wachturm und Limes
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Umgesetzt
- **Umsetzung:** Jedes Landgebäude hat eine feste Besatzung (Dorf 1, Stadt/Gutshof 2, Wachturm 2, Limes 3, sonst 1).
  Wachturm: +1 Verteidigung für eigene Nachbargebäude. Limes: schirmt eigene Nachbargebäude ab, bis er fällt.
  Offene Fragen dazu: F-010, F-011.

### F-005: Spielvariante „Eroberung“ mit Truppen und Kämpfen
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Umgesetzt
- **Umsetzung:** In der Lobby wählbar; rekrutieren, verlegen, angreifen (auch über eigene Schiffe), Schonfrist
  2 Runden, Übernahme eroberter Gebäude. Regeln im README.

### F-004: Karteneditor
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Umgesetzt
- **Umsetzung:** `/editor.html`: malen, Vorlagen, Speichern im Browser, Export/Import als JSON, Auswahl in der Lobby.

### F-003: Feste und zufällige asymmetrische Karten
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Umgesetzt
- **Umsetzung:** Zufällige Inselgruppe, Kontinent, Vorlagen (Zwillingsinseln, Lagune, Inselkette), eigene Karten;
  Regionen automatisch gleich groß.

### F-002: Wasser mit Häfen, Schiffen und Fischerei
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Umgesetzt
- **Umsetzung:** Wasser als Gelände; Hafen an der Küste, Schiffe verbinden Inseln, Fischerei liefert Nahrung.

### F-001: Online-Multiplayer-Grundspiel für 2–6 Spieler
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Umgesetzt
- **Umsetzung:** Raum-Codes, feste Rundenzahl, Rohstoffe per Regions- und Geländewürfel, Gebäude, Handel,
  Deployment auf Render.
