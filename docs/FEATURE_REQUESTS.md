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

### F-011: Gebäude heißen „Dorf“ und „Stadt“
- **Gewünscht:** 2026-10-30, Simon (aus F-006); entschieden 2026-11-11: Variante 1 (Umbenennen)
- **Status:** Umgesetzt
- **Umsetzung:** Siedlung heißt jetzt **Dorf**, Gutshof heißt **Stadt** (Ausbau eines Dorfes, neues Symbol 🏙️).
  Kosten, Punkte, Produktion und stationäre Truppen unverändert. Auch intern heißen die Gebäude jetzt `dorf` und
  `stadt` (Wunsch Simon). Raumsicherungen mit den alten Bezeichnern werden beim Laden umgerechnet; die Statistik zählt
  Gebäude nur zusammen und ist daher nicht betroffen.

### F-013: Voreingestellte Teams (z. B. 2 gegen 2)
- **Gewünscht:** 2026-11-11, Simon
- **Status:** Umgesetzt
- **Entscheidungen (Simon, 2026-11-11):** Jeder wählt sein Team selbst, der Gastgeber hat ein Veto. Teampunkte
  werden addiert, das Punkteziel entsprechend verschoben. Ein Team ist besiegt, wenn alle Mitglieder besiegt sind.
  Truppen dürfen auf Gebäude des Partners verlegt werden, Angriffe über dessen Schiffe sind erlaubt.
  2:1-Tausch, wenn beide einen Hafen haben. Zugreihenfolge abwechselnd zwischen den Teams.
- **Umsetzung:**
  - Lobby: „Jeder für sich“ oder „Feste Teams“; bis zu 3 Teams (A, B, C), auch ungleich groß.
  - Punkteziel des Teams = Ziel × Teamgröße (Annahme zu „entsprechend verschieben“).
  - 2:1 gilt als **Banktausch** für beide Teammitglieder, sobald jeder von ihnen einen eigenen Hafen hat
    (Annahme – „Tausch im Team“ untereinander ist ohnehin frei verhandelbar).
  - Rohstoffe der Teammitglieder sind sichtbar (Simon, 2026-11-11), die der Gegner weiter nur als Summe.
  - Teammitglieder können sich nicht angreifen. Bauen geht weiter nur neben eigenen Gebäuden und Schiffen.
  - Statistik: Alle Mitglieder des Siegerteams bekommen einen Sieg.
  - Tests: `test/game.test.js` (Abschnitt Teams).

### F-012: Wählbare Siegbedingungen statt fester Rundenzahl
- **Gewünscht:** 2026-11-11, Simon („weder Siedler noch Risiko haben Rundenbegrenzungen“)
- **Status:** Umgesetzt
- **Umsetzung:**
  - Klassisch: Punkteziel 10/12/15/20, gewonnen am Ende des eigenen Zuges.
  - Eroberung: „Punkteziel oder alle Gegner besiegen“ oder „Nur alle Gegner besiegen“. Wer kein Landgebäude mehr
    hat, ist besiegt (der frühere Schutz des letzten Gebäudes entfällt).
  - Rundenlimit nur noch optional (20/30/40 Runden, zusammen mit dem Punkteziel; danach zählen die Punkte).
  - Ohne Limit: Abstimmung „Weiterspielen?“ nach 150 Runden, danach alle 25 Runden; Mehrheit der verbundenen
    Spieler für Beenden beendet das Spiel nach Punkten, Gleichstand = weiter.
  - Statistik speichert Siegbedingung, Grund des Spielendes, gespielte Runden und Sieger.
  - Tests: `test/game.test.js`.

### F-007: Raum-Features, Raumsicherung und Statistik wie bei Ortsraten
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Umgesetzt
- **Umsetzung:** Spieler entfernen, Host-Übergabe nach 15 s, „Nochmal spielen“ per Abstimmung, nur ein aktiver Tab
  pro Spieler, Raumsicherung im Branch `statistik` bei Deploys, Statistikseite mit Rekorden. Tests:
  `test/game.test.js`, `test/stats.test.js`, `test/server.test.js`.

### F-006: Stationäre Truppen, Wachturm und Limes
- **Gewünscht:** 2026-10-30, Simon
- **Status:** Umgesetzt
- **Umsetzung:** Jedes Landgebäude hat eine feste Besatzung (Dorf 1, Stadt 2, Wachturm 2, Limes 3, sonst 1).
  Wachturm: +1 Verteidigung für eigene Nachbargebäude. Limes: schirmt eigene Nachbargebäude ab, bis er fällt.
  Offene Fragen dazu: F-010; F-011 umgesetzt.

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
