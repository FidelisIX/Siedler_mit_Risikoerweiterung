# CATAN – Seefahrer (Erweiterung, 3–4 Spieler) – Allgemeine Regeln, maschinenlesbar aufbereitet

> Zweck: Ergänzung zu [`catan_basisspiel_regeln.md`](catan_basisspiel_regeln.md) für KI-Agenten / Spiel-Engines.
> Strukturierte Fassung mit identischen IDs: [`catan_seefahrer_regeln.json`](catan_seefahrer_regeln.json).
> **Umfang:** nur die allgemeinen Regeln, die für alle Szenarien gelten. **Nicht enthalten:** die 8 Szenarien,
> ihre Spielpläne, Siegpunktziele und Sonderregeln sowie das „freie Spiel“ / „New World“.
> Regelstand: **aktuelle Ausgabe 2025** (DE: © 1997, 2025 KOSMOS [S2]; EN: v6.250401 [S1]).

## 0. Verhältnis zum Basisspiel

- `S-BASE-01`: Es gelten alle Regeln des Basisspiels (`R-*`), soweit unten nichts anderes steht [S1][S2].
- Auf Basisregeln, die geändert werden, wird mit **ändert `R-…`** verwiesen.
- Begriffe (neu):

| Deutsch (2025) | Englisch (2025) | ID |
|---|---|---|
| Schiff | ship | `ship` |
| Schiffslinie (offen / geschlossen) | line of ships (open / connecting two buildings) | `ship_line` |
| Wasserweg (Kante zwischen 2 Meerfeldern) | sea edge | `sea_edge` |
| Küste (Kante zwischen Meer- und Landfeld) | coastal edge | `coastal_edge` |
| Seeräuber | pirate | `pirate` |
| Goldfluss | gold field | `gold_field` |
| Meerfeld | sea hex | `sea` |
| Längste Handelsroute | Longest Route | `longest_road` (ID aus Basisspiel beibehalten) |

## 1. Zusätzliches Material [S1][S2]

| Material | Anzahl |
|---|---|
| Rahmenteile | 6 (Basisspiel-Rahmen wird mit der hafenlosen Rückseite verwendet) |
| Sechseckfelder | 30: 19 Meer, je 2 Hügelland, Gebirge, Goldfluss, Wüste, je 1 Ackerland, Wald, Weideland |
| Zahlenchips | 10 zusätzliche (Verteilung nicht aus dem Text extrahierbar) |
| Hafenplättchen | 10: 5 × 3:1, 5 × 2:1 (je einer pro Rohstoff) |
| Schiffe | 60 (15 pro Farbe) |
| Seeräuber | 1 |
| Szenario-Material | Siegpunkt-Chips, Piratenfestungen, Wunder, Große-Mauer/Große-Brücke-Chips u. a. – nur für Szenarien, hier nicht beschrieben |

## 2. Spielziel

- `S-GOAL-01` (ändert `R-GOAL-01`): Die nötige Siegpunktzahl legt das **jeweilige Szenario** fest (nicht fix 10). Wer **an der Reihe** ist und sie erreicht, gewinnt sofort [S1][S2].

## 3. Aufbau [S1][S2]

- `S-SETUP-01`: Rahmen, Land-/Meerfelder, Zahlenchips und Häfen gemäß Szenario-Abbildung. Basis-Rahmenteile mit der **Rückseite** (ohne Häfen) nach oben.
- `S-SETUP-02`: Häfen werden je nach Szenario fest oder zufällig gelegt. Zufällig: vorgeschriebene Hafenplättchen verdeckt mischen, je eines auf einen zufälligen vorgesehenen Platz, dann alle aufdecken.
- `S-SETUP-03` (ändert `R-SETUP-06`): Räuber und Seeräuber starten auf den vom Szenario angegebenen Feldern (Seeräuber: mit X markiertes Meerfeld).
- `S-SETUP-04` (ergänzt `R-SETUP-11/12`): Gründungsphase wie im variablen Aufbau des Basisspiels. Steht die Startsiedlung an der Küste, darf **statt der Straße ein Schiff** auf einen angrenzenden freien Meer-/Küstenweg gesetzt werden.

## 4. Schiffe

### Baukosten

| Objekt | Kosten | SP | Limit pro Spieler |
|---|---|---|---|
| Schiff | 1 Holz + 1 Wolle | 0 | 15 |

Quelle: [S2] („Baukosten: 1 Holz + 1 Wolle“). In [S1] nur als Symbol abgebildet.

### Bauen [S1][S2]
- `S-SHIP-01`: Ein Schiff steht auf einem **Wasserweg** (zwischen zwei Meerfeldern) oder auf einer **Küste** (zwischen Meer- und Landfeld). Nie zwischen zwei Landfeldern.
- `S-SHIP-02` (ändert `R-BUILD-01`): Je Wasserweg max. 1 Schiff; **an der Küste entweder 1 Schiff oder 1 Straße**, nicht beides.
- `S-SHIP-03`: Ein neues Schiff muss an eine **eigene Siedlung/Stadt** oder ein **eigenes Schiff** anschließen. Verzweigungen sind erlaubt.
- `S-SHIP-04`: Ein Schiff darf **nicht direkt an eine Straße** anschließen und umgekehrt. Übergang Straße ↔ Schiff nur über eine eigene **Siedlung/Stadt** an der Kreuzung dazwischen.
- `S-SHIP-05`: Wie bei Straßen darf nicht über eine Kreuzung mit **fremdem Gebäude** hinweg gebaut werden [S1].
- `S-SHIP-06`: Auf den **6 Kanten des Meerfelds mit dem Seeräuber** dürfen keine Schiffe gebaut werden.
- `S-SHIP-07` (ergänzt `R-BUILD-10`): Eine Siedlung darf an einer Kreuzung gebaut werden, die über eine **eigene Schiffslinie** (ausgehend von eigener Siedlung/Stadt) erreicht wird; Abstandsregel gilt weiter.

### Versetzen [S1][S2]
- `S-MOVE-01`: Pro eigenem Zug darf **höchstens 1 Schiff** versetzt werden (in der Aktionsphase [S1]).
- `S-MOVE-02`: Kein Schiff versetzen, das **in diesem Zug gebaut** wurde.
- `S-MOVE-03`: Nur das **offene Ende** einer **offenen** Schiffslinie darf versetzt werden – also ein Schiff, dessen eines Ende **nicht** an ein eigenes Schiff oder eigenes Gebäude grenzt.
- `S-MOVE-04`: Schiffe einer **geschlossenen** Linie (verbindet zwei eigene Siedlungen/Städte) dürfen **nicht** versetzt werden – auch dann nicht, wenn ein Mitspieler auf dieser Linie eine Siedlung baut (die Linie gilt weiter als geschlossen, die Handelsroute aber als unterbrochen).
- `S-MOVE-05`: Kein Schiff auf eine oder von einer Kante des **Seeräuber-Meerfelds** versetzen.
- `S-MOVE-06`: Das versetzte Schiff wird nach den normalen Bauregeln (`S-SHIP-01…06`) neu platziert.

## 5. Seeräuber und Räuber [S1][S2]

- `S-PIRATE-01` (ändert `R-SEVEN-03`): Bei einer **7** wählt der aktive Spieler, ob er den **Räuber oder den Seeräuber** versetzt. Genau eine der beiden Figuren **muss** versetzt werden. Das Abwerfen bei > 7 Karten (`R-SEVEN-02`) bleibt unverändert.
- `S-PIRATE-02`: Der Seeräuber wird auf ein **anderes Meerfeld** oder auf den **Rahmen** gesetzt.
- `S-PIRATE-03`: Steht er auf einem Meerfeld, darf der aktive Spieler einem Spieler mit **mindestens einem Schiff an einer Kante dieses Meerfelds** 1 zufällige Rohstoffkarte rauben; bei mehreren wählt er.
- `S-PIRATE-04`: Wirkung siehe `S-SHIP-06` und `S-MOVE-05` (Bau- und Versetzungsverbot an seinen 6 Kanten). Andere Schiffe sind nicht betroffen.
- `S-ROBBER-01`: Der Räuber darf auf ein beliebiges **Landfeld** versetzt werden, auch über Meer hinweg, sofern das Szenario nichts anderes vorgibt. Sonst gelten die Basisregeln.
- `S-KNIGHT-01` (ändert Ritterkarte): Wer einen **Ritter** spielt, versetzt **wahlweise Räuber oder Seeräuber** mit den jeweiligen Folgen.

## 6. Goldfluss [S1][S2]

- `S-GOLD-01`: Es gibt **keine** Rohstoffkarte „Gold“.
- `S-GOLD-02` (ergänzt `R-PROD-02`): Wird die Zahl eines Goldflusses gewürfelt, erhält jeder Spieler pro angrenzender **Siedlung 1** und pro angrenzender **Stadt 2** Rohstoffkarten **nach Wahl** (Holz, Lehm, Wolle, Getreide, Erz). Bei einer Stadt dürfen die 2 Karten verschieden sein.
- Der Räuber blockiert einen Goldfluss wie jedes andere Landfeld (`R-PROD-03`, *Ableitung*).

## 7. Längste Handelsroute [S1][S2]

- `S-ROUTE-01` (ändert `R-ROAD-01…04`): Für die Sonderkarte zählt der längste durchgehende Zug aus **Straßen und/oder Schiffen** (mind. 5). Die übrigen Regeln (Übernahme, Unterbrechung, Gleichstand) bleiben gleich.
- `S-ROUTE-02`: Straßen und Schiffe gelten nur dann als **verbunden**, wenn an der Übergangskreuzung eine **eigene Siedlung oder Stadt** steht.

## 8. Entwicklungskarten [S1][S2]

- `S-DEV-01` (ändert Straßenbau): **Straßenbau** erlaubt kostenlos 2 Straßen **oder** 2 Schiffe **oder** 1 Straße + 1 Schiff.
- Ritter: siehe `S-KNIGHT-01`.

## 9. Spielende [S1][S2]

- `S-END-01` (ändert `R-END-01`): Das Spiel endet in dem Zug, in dem der **aktive** Spieler die **Szenario-Siegpunktzahl** erreicht.

## 10. Regellücken / Annahmen

| ID | Thema | Status |
|---|---|---|
| `SGAP-01` | Startrohstoffe, wenn die zweite Siedlung an einem Goldfluss steht | nicht allgemein geregelt (oft durch Szenario-Aufbau ausgeschlossen); Annahme: 1 Rohstoff nach Wahl analog `S-GOLD-02` |
| `SGAP-02` | Vorratsmangel bei Gold-Wahl | nicht geregelt; Annahme: `R-PROD-04` gilt je gewähltem Rohstoff |
| `SGAP-03` | Verteilung der 10 zusätzlichen Zahlenchips | nur als Bild; nicht übernommen |
| `SGAP-04` | Ob der Seeräuber auf demselben Meerfeld bleiben darf | nicht geregelt; [S1]: „to the frame or to a new sea hex“ → muss sich bewegen |
| `SGAP-05` | Siegpunkt-Chips (z. B. für Inseln) | szenarioabhängig, nicht Teil der allgemeinen Regeln |

## Quellen

Offizielle Veröffentlichungen des Rechteinhabers, abgerufen am 2026-10-30.

- **[S1]** CATAN GmbH / CATAN Studio: *CATAN – Seafarers Rulebook*, v6.250401, © 2025. https://www.catan.com/sites/default/files/2025-03/CN3083%20CATAN%E2%80%93Seafarers%20Rulebook%202025%20secured%20reduced.pdf
- **[S2]** KOSMOS: *CATAN – Seefahrer, Spielanleitung*, © 1997, 2025, Art.-Nr. 684679. https://cms.kosmos.de/game-instructions/400205684679_CAT_NE_SEE34_Manual_DE_web.pdf
- **[S3]** (ergänzend, ältere Ausgabe) CATAN Studio: *Catan: Seafarers – Game Rules & Scenarios*, 2021. https://www.catan.com/sites/default/files/2021-06/catan-seafarers_2021_rule_book_201201.pdf
- Übersichtsseite: https://www.catan.com/understand-catan/game-rules
