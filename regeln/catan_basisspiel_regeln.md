# CATAN – Das Spiel (Basisspiel, 3–4 Spieler) – Regelwerk, maschinenlesbar aufbereitet

> Zweck: Kompakte, eindeutige Regelbeschreibung für KI-Agenten / Spiel-Engines.
> Das Gegenstück mit identischem Inhalt als strukturierte Daten ist
> [`catan_basisspiel_regeln.json`](catan_basisspiel_regeln.json).
> Regel-IDs (z. B. `R-SETUP-03`) sind in beiden Dateien identisch.
> Jede Regel verweist über `[Qx]` auf die Quelle (siehe Abschnitt „Quellen“).

## 0. Konventionen

- **MUSS / DARF / DARF NICHT** sind normativ.
- Regelstand: **6. Edition (2025)** gemäß [Q1]. Abweichungen der deutschen Ausgabe 2015 [Q3][Q4] sind als `EDITION-DIFF` markiert.
- Begriffe (DE ↔ EN, 2025):

| Deutsch | Englisch (6. Ed. 2025) | Englisch (bis 2020) | ID |
|---|---|---|---|
| Landfeld | terrain hex | terrain hex | `hex` |
| Kreuzung | intersection | intersection | `vertex` |
| Weg | edge | path | `edge` |
| Siedlung | settlement | settlement | `settlement` |
| Stadt | city | city | `city` |
| Straße | road | road | `road` |
| Hafen (3:1 / 2:1) | port | harbor | `port` |
| Räuber | robber | robber | `robber` |
| Entwicklungskarte | development card | development card | `dev_card` |
| Längste Handelsstraße | Longest Route | Longest Road | `longest_road` |
| Größte Rittermacht | Largest Army | Largest Army | `largest_army` |
| Erfindung | Invention | Year of Plenty | `year_of_plenty` |
| Straßenbau | Road Building | Road Building | `road_building` |
| Monopol | Monopoly | Monopoly | `monopoly` |
| Siegpunkt (SP) | victory point (VP) | victory point | `vp` |

## 1. Spielmaterial [Q1][Q3]

| Material | Anzahl |
|---|---|
| Landfelder | 19: Wald 4, Weideland 4, Ackerland 4, Hügelland 3, Gebirge 3, Wüste 1 |
| Rahmenteile (Meer) | 6, mit insgesamt 9 Häfen (5 × Spezialhafen 2:1 – je einer pro Rohstoff, 4 × 3:1) |
| Rohstoffkarten | 95 (je 19 Holz, Lehm, Wolle, Getreide, Erz) |
| Entwicklungskarten | 25: Ritter 14, Fortschritt 6 (je 2 × Straßenbau, Erfindung, Monopol), Siegpunkt 5 |
| Zahlenchips | 18: 2×1, 3×2, 4×2, 5×2, 6×2, 8×2, 9×2, 10×2, 11×2, 12×1 (keine 7) |
| Sonderkarten | Längste Handelsstraße (2 SP), Größte Rittermacht (2 SP) |
| Spielfiguren pro Farbe | 5 Siedlungen, 4 Städte, 15 Straßen (4 Farben) |
| Sonstiges | 1 Räuber, 2 Würfel, 4 Baukostenkarten |

### Landschaft → Rohstoff

| Landfeld | Rohstoff |
|---|---|
| Wald | Holz |
| Hügelland | Lehm |
| Weideland | Wolle |
| Ackerland | Getreide |
| Gebirge | Erz |
| Wüste | – (kein Ertrag, kein Zahlenchip) |

### Spielfeld-Topologie (abgeleitet, nicht aus der Anleitung)

Hexagonales Feld mit Radius 2 → **19 Landfelder, 54 Kreuzungen, 72 Wege** (per Skript berechnet).
Jede Kreuzung grenzt an 1–3 Landfelder; jeder Weg verbindet genau 2 Kreuzungen.

## 2. Spielziel [Q1]

- `R-GOAL-01`: Wer **während seines eigenen Zuges** **≥ 10 Siegpunkte** hat, gewinnt sofort; das Spiel endet unmittelbar.
- `R-GOAL-02`: Ein Spieler kann **nicht** im Zug eines anderen Spielers gewinnen (Siegbedingung wird nur für den aktiven Spieler geprüft) [Q1][Q3].

### Siegpunkte

| Quelle | SP |
|---|---|
| Siedlung | 1 |
| Stadt | 2 |
| Längste Handelsstraße | 2 |
| Größte Rittermacht | 2 |
| Siegpunktkarte (Entwicklungskarte) | 1 je Karte |
| Straße | 0 |

## 3. Aufbau

### 3.1 Startaufstellung für Einsteiger [Q1][Q4]
- `R-SETUP-01`: Feste Abbildung in der Anleitung (nicht textuell beschrieben; Koordinaten **nicht** in diesem Datensatz enthalten).
- Jeder Spieler erhält Startrohstoffe für seine markierte (zweite) Siedlung (1 Karte je angrenzendem Landfeld).

### 3.2 Variabler Aufbau [Q1][Q2][Q3]
- `R-SETUP-02`: Rahmenteile beliebig/zufällig zusammensetzen (2015/2020: separate Hafenplättchen zufällig verteilen [Q2]).
- `R-SETUP-03`: Landfelder gemischt und zufällig in den Rahmen legen.
- `R-SETUP-04`: Zahlenchips mit Buchstabenseite nach oben in alphabetischer Reihenfolge (A–R) legen, an einem beliebigen **Eckfeld** beginnend, **gegen den Uhrzeigersinn** spiralförmig zur Mitte; **Wüste überspringen**; danach umdrehen.
- `R-SETUP-05` (Alternative [Q2]): Vollständig zufällige Zahlenverteilung erlaubt, aber **rote Zahlen (6 und 8) dürfen nicht auf benachbarten Feldern liegen**.
- `R-SETUP-06`: Räuber startet auf der **Wüste**.
- `R-SETUP-07`: Rohstoffkarten nach Sorte offen als Vorrat; Entwicklungskarten gemischt, verdeckt.
- `R-SETUP-08`: Bei 3 Spielern wird eine Farbe nicht genutzt.

### 3.3 Gründungsphase (Startaufstellung, variabler Aufbau) [Q1][Q3]
- `R-SETUP-10`: Jeder würfelt mit 2 Würfeln; höchste Augenzahl = Startspieler. (Gleichstand: nicht geregelt → erneut würfeln, *Annahme*.)
- `R-SETUP-11` Runde 1: Im Uhrzeigersinn setzt jeder 1 Siedlung auf eine freie Kreuzung + 1 angrenzende Straße.
- `R-SETUP-12` Runde 2: **In umgekehrter Reihenfolge** (letzter Spieler zuerst, Startspieler zuletzt) setzt jeder 1 weitere Siedlung + 1 an **diese** Siedlung angrenzende Straße. Die zweite Siedlung muss nicht mit der ersten verbunden sein.
- `R-SETUP-13`: Die **Abstandsregel** (`R-BUILD-11`) gilt auch in der Gründungsphase.
- `R-SETUP-14`: Nach Setzen der **zweiten** Siedlung erhält der Spieler je 1 Rohstoffkarte pro angrenzendem Landfeld (Wüste: nichts).
- `R-SETUP-15`: Der Startspieler beginnt anschließend den ersten regulären Zug.

## 4. Zugablauf [Q1]

Reihenfolge der Spieler: **im Uhrzeigersinn**. Ein Zug besteht aus:

1. **Produktionsphase**
   1. *(optional)* 1 Entwicklungskarte ausspielen (zählt als die eine Karte dieses Zuges).
   2. **Würfeln** (Pflicht): Summe zweier W6.
   3. Bei 2–6, 8–12: Erträge verteilen (`R-PROD-*`). Bei 7: Räuber-Ablauf (`R-SEVEN-*`).
2. **Aktionsphase** – beliebig oft und in beliebiger Reihenfolge, solange Ressourcen reichen:
   - Handeln (`R-TRADE-*`)
   - Bauen / Entwicklungskarte kaufen (`R-BUILD-*`)
   - 1 Entwicklungskarte ausspielen, falls nicht schon vor dem Würfeln geschehen
3. Zug beenden → linker Nachbar ist am Zug.

`EDITION-DIFF` (DE 2015 [Q3][Q4]): Feste Reihenfolge **Würfeln → Handeln → Bauen**; Handel und Bau getrennt.
Die Aufhebung der Trennung ist dort als empfohlene Variante für Erfahrene beschrieben („Handeln und Bauen – Trennung aufgehoben“), bei der ein im Zug gebauter Hafen sofort genutzt werden darf. Ohne Variante gilt: ein soeben gebauter Hafen ist erst im nächsten Zug nutzbar [Q3].

## 5. Produktion [Q1][Q3]

- `R-PROD-01`: Jedes Landfeld, dessen Zahlenchip der Würfelsumme entspricht, produziert.
- `R-PROD-02`: Jede angrenzende Siedlung erhält **1**, jede angrenzende Stadt **2** Karten des entsprechenden Rohstoffs (alle Spieler, nicht nur der aktive).
- `R-PROD-03`: Ein Feld mit dem **Räuber produziert nicht**.
- `R-PROD-04` (Vorratsmangel): Reicht der Vorrat eines Rohstoffs nicht für alle Ansprüche, erhält **niemand** diesen Rohstoff – **außer** es ist nur **ein** Spieler betroffen: dieser erhält den Rest des Vorrats [Q1][Q2].

### Würfelwahrscheinlichkeiten (2W6, berechnet)

| Summe | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Kombinationen (von 36) | 1 | 2 | 3 | 4 | 5 | 6 | 5 | 4 | 3 | 2 | 1 |

Die Punkte („Pips“) auf den Zahlenchips entsprechen der Zahl der Kombinationen [Q2].

## 6. Eine 7 wird gewürfelt [Q1][Q3]

- `R-SEVEN-01`: Kein Feld produziert.
- `R-SEVEN-02`: Jeder Spieler mit **> 7 Rohstoffkarten** wählt **⌊n/2⌋** davon aus und legt sie in den Vorrat ab (z. B. 9 → 4 ablegen). Entwicklungskarten zählen **nicht** mit.
- `R-SEVEN-03`: Der aktive Spieler **MUSS** den Räuber auf ein **anderes** Landfeld versetzen (Wüste ist zulässig, *da „beliebiges anderes Landfeld“* [Q3]).
- `R-SEVEN-04`: Er raubt **1 zufällige Rohstoffkarte** (verdeckt gezogen) von einem Spieler, der eine Siedlung/Stadt an diesem Feld hat; bei mehreren wählt er das Opfer. Hat dort niemand (anderes) ein Gebäude, entfällt der Raub. (Raub bei sich selbst: nicht vorgesehen, Opfer ist ein *Mitspieler* [Q4].) Hat das Opfer keine Rohstoffkarten, wird nichts geraubt (*Ableitung*).
- `R-SEVEN-05`: Danach geht der Zug mit der Aktionsphase weiter.

## 7. Handel [Q1][Q2][Q3]

- `R-TRADE-01`: Nur der **aktive Spieler** darf handeln; Mitspieler dürfen nur mit ihm, **nicht untereinander** handeln.
- `R-TRADE-02` Binnenhandel: Konditionen frei verhandelbar.
- `R-TRADE-03`: **Verschenken verboten** (kein 0:n-Tausch); Tausch gleicher Rohstoffe verboten (z. B. 3 Erz gegen 1 Erz).
- `R-TRADE-04`: Entwicklungskarten dürfen **nicht** gehandelt oder verschenkt werden.
- `R-TRADE-05` Seehandel ohne Hafen: **4 gleiche → 1 beliebige** (anderer Rohstoff [Q1]).
- `R-TRADE-06` 3:1-Hafen: Mit Siedlung/Stadt an einer der 2 Kreuzungen des Hafens: **3 gleiche → 1 beliebige**.
- `R-TRADE-07` 2:1-Spezialhafen: **2 des abgebildeten Rohstoffs → 1 beliebige**. Gilt **nur** für diesen Rohstoff (kein 3:1 für andere Rohstoffe).
- `R-TRADE-08`: Seehandel beliebig oft, auch mehrfach (z. B. 4 Holz → 2 Karten am Holz-2:1-Hafen).

## 8. Bauen [Q1][Q3][Q4]

### Baukosten

| Objekt | Kosten | SP | Limit pro Spieler |
|---|---|---|---|
| Straße | 1 Holz + 1 Lehm | 0 | 15 |
| Siedlung | 1 Holz + 1 Lehm + 1 Wolle + 1 Getreide | 1 | 5 (auf dem Brett gleichzeitig) |
| Stadt | 3 Erz + 2 Getreide | 2 | 4 |
| Entwicklungskarte | 1 Erz + 1 Wolle + 1 Getreide | – | solange Stapel reicht |

### Straße
- `R-BUILD-01`: Auf einem **freien Weg**; je Weg max. 1 Straße (auch an der Küste).
- `R-BUILD-02`: Muss an eine **eigene** Straße, Siedlung oder Stadt anschließen.
- `R-BUILD-03`: Darf **nicht** über eine Kreuzung mit **fremder** Siedlung/Stadt hinweg fortgesetzt werden.

### Siedlung
- `R-BUILD-10`: Auf einer **freien Kreuzung**, die an mindestens **1 eigene Straße** grenzt (außer in der Gründungsphase).
- `R-BUILD-11` **Abstandsregel**: Keine der (bis zu 3) benachbarten Kreuzungen darf eine Siedlung oder Stadt (egal welcher Farbe) tragen.
- `R-BUILD-12`: Sind alle 5 Siedlungen verbaut, muss erst eine zur Stadt ausgebaut werden.

### Stadt
- `R-BUILD-20`: Nur als **Ausbau einer eigenen Siedlung**; die Siedlung geht in den Vorrat des Spielers zurück und ist wieder verbaubar.
- `R-BUILD-21`: Städte und Straßen bleiben bis Spielende liegen.

### Entwicklungskarte kaufen
- `R-BUILD-30`: Oberste Karte des verdeckten Stapels; geheim halten.
- `R-BUILD-31`: Leerer Stapel → kein Kauf mehr; ausgespielte Karten kommen nie zurück.

## 9. Entwicklungskarten [Q1][Q2][Q3]

- `R-DEV-01`: Pro Zug **max. 1** Entwicklungskarte (Ritter **oder** Fortschritt) ausspielen; zu jedem Zeitpunkt des eigenen Zuges, **auch vor dem Würfeln**.
- `R-DEV-02`: **Nicht** im selben Zug ausspielen, in dem sie gekauft wurde.
- `R-DEV-03` Ausnahme Siegpunktkarten: Beliebig viele, auch im Kaufzug, dürfen aufgedeckt werden – **nur** um damit 10 SP zu erreichen und zu gewinnen. Sonst bleiben sie verdeckt.
- `R-DEV-04`: Entwicklungskarten zählen nicht zum Handkartenlimit bei der 7 und können nicht geraubt werden.

| Karte | Anzahl | Effekt |
|---|---|---|
| Ritter | 14 | Räuber versetzen + rauben wie `R-SEVEN-03/04`; Karte bleibt offen liegen. **Kein** Abwerfen bei >7 Karten. |
| Straßenbau | 2 | 2 Straßen kostenlos nach normalen Bauregeln bauen. |
| Erfindung | 2 | 2 beliebige Rohstoffkarten (gleich oder verschieden) aus dem Vorrat nehmen. |
| Monopol | 2 | Einen Rohstoff nennen; alle Mitspieler geben **alle** Karten dieses Rohstoffs ab. |
| Siegpunkt | 5 | 1 SP, verdeckt bis zum Sieg. |

## 10. Sonderkarten [Q1][Q2][Q3]

### Größte Rittermacht (2 SP)
- `R-ARMY-01`: Der **erste** Spieler mit **3 ausgespielten Rittern** erhält sie.
- `R-ARMY-02`: Hat ein anderer Spieler **mehr** ausgespielte Ritter als der Besitzer, erhält er sie **sofort**. Gleichstand → Besitzer behält sie.

### Längste Handelsstraße (2 SP)
- `R-ROAD-01`: Der **erste** Spieler mit einem **durchgehenden Straßenzug ≥ 5** Straßen erhält sie. Gezählt wird der längste **einfache** Pfad (Abzweigungen zählen nicht; jede Straße höchstens einmal).
- `R-ROAD-02`: Baut ein anderer Spieler einen **längeren** Straßenzug, erhält er sie sofort. Gleichstand → Besitzer behält sie.
- `R-ROAD-03`: Eine **fremde** Siedlung/Stadt auf einer Kreuzung unterbricht den Straßenzug; **eigene** Gebäude unterbrechen nicht.
- `R-ROAD-04` Nach Unterbrechung:
  - Besitzer weiterhin (mit-)längster → behält die Karte.
  - Besitzer nicht mehr am längsten und **mehrere** Spieler gleichauf → Karte wird **beiseite gelegt**.
  - Niemand hat mehr ≥ 5 → Karte wird beiseite gelegt.
  - Sie kommt zurück, sobald **genau ein** Spieler den längsten Straßenzug (≥ 5) hat.

## 11. Spielende [Q1][Q3]
- `R-END-01`: Erreicht der aktive Spieler zu irgendeinem Zeitpunkt seines Zuges ≥ 10 SP (inkl. aufgedeckter Siegpunktkarten), endet das Spiel sofort mit seinem Sieg.

## 12. Bekannte Regellücken / Annahmen für eine Engine

| ID | Thema | Status |
|---|---|---|
| `GAP-01` | Gleichstand beim Startspieler-Wurf | nicht geregelt; Annahme: Beteiligte würfeln erneut |
| `GAP-02` | Zahlenchip-Buchstabe → Zahl (A–R) | nicht im PDF-Text; nur auf den Chips abgebildet. Im JSON als `verified: false` hinterlegt |
| `GAP-03` | Koordinaten der Einsteiger-Aufstellung | nur als Bild in den Anleitungen; nicht übernommen |
| `GAP-04` | Räuber auf die Wüste zurück | nicht explizit verboten („beliebiges anderes Landfeld“) → erlaubt |
| `GAP-05` | Handelsangebote außerhalb des eigenen Zuges | Mitspieler dürfen dem aktiven Spieler Angebote machen [Q3 Taktik] |

## Quellen

Alle Quellen sind **offizielle Veröffentlichungen** des Rechteinhabers (CATAN GmbH / Kosmos / CATAN Studio), abgerufen am 2026-10-30.

- **[Q1]** CATAN GmbH / CATAN Studio: *CATAN – The Game, Rulebook*, 6. Edition, v6.250401, © 2025. https://www.catan.com/sites/default/files/2025-03/CN3081%20CATAN%E2%80%93The%20Game%20Rulebook%20secure%20%281%29.pdf
- **[Q2]** CATAN Studio: *CATAN – Game Rules & Almanac (3–4 Players)*, 2020. https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf
- **[Q3]** Kosmos: *CATAN – Das Spiel, Almanach*, Regelstand Januar 2015. https://www.catan.de/sites/default/files/2021-07/Catan_Basisspiel_Almanach.pdf
- **[Q4]** Kosmos: *CATAN – Das Spiel, Jubiläumsausgabe (25 Jahre), Spielanleitung*. https://www.catan.de/sites/default/files/2021-07/695217_catan_basisjubi25_manual_web_0.pdf
- Übersichtsseite der offiziellen Regeln: https://www.catan.com/understand-catan/game-rules
