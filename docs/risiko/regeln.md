# RISIKO – Spielregeln (maschinenlesbar)

Grundlage ist die aktuelle offizielle Ausgabe **Hasbro RISIKO B7404 (© 2015, deutsch)** [S1].
Die gleichen Daten liegen strukturiert in [`regeln.json`](regeln.json). Bei Widersprüchen gilt die JSON-Datei.

**Konventionen für KI/Parser**

- IDs sind englisch in `snake_case` (z. B. `north_africa`), Anzeigenamen deutsch.
- `[Sx]` verweist auf die Quellenliste am Ende.
- **⚠ Nicht belegt** kennzeichnet Angaben, die nicht in der Primärquelle stehen. Diese nicht als gesichert behandeln.
- Invariante während des ganzen Spiels: **Jedes Gebiet hat immer mindestens 1 Einheit.**

## 1. Material [S1]

| Teil | Anzahl |
|---|---|
| Spielplan | 6 Kontinente, 42 Gebiete |
| Armeen | 5, je 40 Infanterie, 12 Kavallerie, 8 Artillerie |
| Einheitenwerte | Infanterie = 1, Kavallerie = 5, Artillerie = 10 (jederzeit wertgleich tauschbar) |
| Karten | 56 = 42 Gebietskarten + 2 Joker + 12 Missionskarten |
| Würfel | 3 rote (Angreifer), 2 blaue (Verteidiger), W6 |

- Gebietskarten tragen je ein Symbol: Infanterie, Kavallerie oder Artillerie. Joker zeigen alle drei.
- ⚠ Nicht belegt: welches Gebiet welches Symbol hat (steht nur auf den Karten).
- ⚠ Nicht belegt: alle 5 Armeefarben. Im Text kommen blau, gelb, orange und grün vor.
- Reichen die Figuren nicht, darf man Ersatz verwenden; der Vorrat gilt als unbegrenzt (FAQ der Anleitung).

## 2. Spielvarianten [S1]

| Variante | Spieler | Ziel |
|---|---|---|
| Auftrags-RISIKO | 3–5 | Als Erster die geheime Mission erfüllen |
| Klassisches RISIKO | 3–5 | Alle 42 Gebiete besetzen |
| RISIKO-Duell | 2 | Alle Gebiete des Gegners erobern (mit neutraler Armee) |
| Turbo-RISIKO | 3–5 | Alle gegnerischen Hauptquartiere erobern, eigenes halten |

## 3. Aufbau [S1]

**Startinfanterie:** 3 Spieler = 35, 4 Spieler = 30, 5 Spieler = 25, Duell = 40.

**Auftrags-RISIKO**

1. Ein Spieler wird „General“. Er entfernt die Missionskarten nicht vertretener Farben.
2. Jeder erhält verdeckt 1 Missionskarte. Der Rest kommt ungesehen in die Box.
3. Joker aus den Gebietskarten nehmen. Die 42 Gebietskarten mischen und vollständig verteilen. Bei 4–5 Spielern erhalten zwei Spieler eine Karte mehr.
4. Jeder setzt 1 Infanterie auf jedes seiner Gebiete.
5. Reihum (der Jüngste beginnt) setzt jeder 1 weitere Infanterie auf ein eigenes Gebiet, bis alle Starteinheiten stehen.
6. Gebietskarten und Joker mischen. Das ist der verdeckte Zugstapel.
7. Jeder würfelt einmal. Die höchste Zahl beginnt, dann geht es im Uhrzeigersinn weiter.

**Klassisches RISIKO:** Der höchste Wurf setzt 1 Infanterie auf ein freies Gebiet, dann reihum, bis alle 42 besetzt sind. Danach reihum die restlichen Einheiten setzen. Missionskarten werden entfernt. Wer die erste Einheit gesetzt hat, beginnt.

## 4. Zugablauf [S1]

Jeder Zug hat drei Phasen in fester Reihenfolge:

1. **Verstärkung** (Pflicht)
2. **Angriff** (optional)
3. **Truppenbewegung** (optional)

Danach ist der linke Nachbar am Zug.

### 4.1 Verstärkung

```
verstärkung = max(3, floor(eigene_gebiete / 3))
            + Summe(Bonus aller Kontinente, die zu Zugbeginn komplett eigen sind)
            + Werte eingetauschter Kartensätze
```

- Beispiele: 11 Gebiete = 3, 14 = 4, 17 = 5.
- Gilt auch im ersten Zug. Die Einheiten werden frei auf eigene Gebiete verteilt.

**Kontinentbonus** [S3][S6] (B7404 verweist auf die Zahlen auf dem Spielplan):

| Kontinent | ID | Gebiete | Bonus |
|---|---|---|---|
| Nordamerika | `north_america` | 9 | 5 |
| Südamerika | `south_america` | 4 | 2 |
| Europa | `europe` | 7 | 5 |
| Afrika | `africa` | 6 | 3 |
| Asien | `asia` | 12 | 7 |
| Australien | `australia` | 4 | 2 |

### 4.2 Gebietskarten und Kartentausch

- **Ziehen:** Wer im Zug mindestens 1 Gebiet erobert hat, zieht am Ende der Angriffsphase genau **1** Karte. Mehr Eroberungen bringen keine weiteren Karten.
- **Gültige Sätze:** 3× dasselbe Symbol, je 1× alle drei Symbole, oder 2× dasselbe Symbol + Joker.
  - ⚠ Nicht belegt: ob andere Joker-Kombinationen (z. B. 2 verschiedene + Joker) erlaubt sind.
- **Wann:** Zu Beginn des eigenen Zugs. Die einzige Ausnahme ist das Ausschalten eines Gegners (siehe 4.3).
- **Pflicht:** Bei 5 oder 6 Karten muss ein Satz getauscht werden. Ein zweiter Satz darf zusätzlich getauscht werden.
- **Werte:** Der Zähler gilt für alle Spieler gemeinsam, nicht pro Spieler.

| Satz-Nr. im Spiel | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | n ≥ 6 |
|---|---|---|---|---|---|---|---|---|---|
| Einheiten | 4 | 6 | 8 | 10 | 12 | 15 | 20 | 25 | 5n − 15 |

- **Bonus für eigene Gebiete:** Zeigt eine eingetauschte Karte ein eigenes Gebiet, gibt es +2 Einheiten, die direkt auf dieses Gebiet kommen.
  - ⚠ Mehrdeutig: Der Text sagt nicht, ob das pro Karte oder einmal pro Satz bzw. Zug gilt.

### 4.3 Angriff

**Voraussetzungen**

- Das Ziel gehört einem Gegner und ist benachbart (über eine Grenze oder Seestraße).
- Im Angriffsgebiet stehen mindestens 2 Einheiten.
- Es wird immer nur ein Gebiet aus einem Gebiet heraus angegriffen.

**Würfel**

- Angreifer: 1–3 Würfel, höchstens (Einheiten im Angriffsgebiet − 1).
- Verteidiger: 1 oder 2 Würfel nach eigener Wahl, höchstens so viele wie Einheiten im Gebiet.

**Auswertung**

1. Beide würfeln gleichzeitig.
2. Die Würfel jeder Seite werden absteigend sortiert und paarweise verglichen.
3. Überzählige niedrigste Würfel zählen nicht.
4. Je Paar gilt: Ist der Angreiferwürfel höher, verliert der Verteidiger 1 Einheit. Sonst, **auch bei Gleichstand**, verliert der Angreifer 1 Einheit.
5. Pro Wurf gehen höchstens 2 Einheiten verloren.

```
function battle(attRoll, defRoll):
  a = sort_desc(attRoll); d = sort_desc(defRoll)
  lossA = lossD = 0
  for i in 0 .. min(len(a), len(d)) - 1:
    if a[i] > d[i]: lossD += 1 else: lossA += 1
  return (lossA, lossD)
```

**Weitere Regeln**

- **Wiederholen:** Man darf beliebig oft angreifen, auch nach einer Niederlage und auf verschiedene Ziele.
- **Erobern:** Ist die letzte Verteidigungseinheit entfernt, ziehen die überlebenden Angreifer ein. Optional kommen weitere Einheiten aus dem Angriffsgebiet nach. Mindestens 1 Einheit bleibt im Angriffsgebiet.
  - Die Ausgabe 1999 verlangt zusätzlich: mindestens so viele Einheiten einziehen, wie Würfel im letzten Angriff geworfen wurden [S3].
- **Gegner ausschalten:** Der Eroberer erhält alle Gebietskarten des Ausgeschiedenen.
  - Hat er danach 6 oder mehr Karten, tauscht er sofort Sätze, bis höchstens 4 Karten übrig sind.
  - Hat er weniger als 6, tauscht er erst zu Beginn seines nächsten Zugs.

**Wahrscheinlichkeiten je Wurf** (exakt durch Aufzählung aller Kombinationen berechnet, stimmt mit [S8] überein):

| Angreifer | Verteidiger | Verteidiger verliert alles | Unentschieden (1:1) | Angreifer verliert alles |
|---|---|---|---|---|
| 1 | 1 | 15/36 ≈ 41,7 % | – | 21/36 ≈ 58,3 % |
| 1 | 2 | 55/216 ≈ 25,5 % | – | 161/216 ≈ 74,5 % |
| 2 | 1 | 125/216 ≈ 57,9 % | – | 91/216 ≈ 42,1 % |
| 2 | 2 | 295/1296 ≈ 22,8 % | 420/1296 ≈ 32,4 % | 581/1296 ≈ 44,8 % |
| 3 | 1 | 855/1296 ≈ 66,0 % | – | 441/1296 ≈ 34,0 % |
| 3 | 2 | 2890/7776 ≈ 37,2 % | 2611/7776 ≈ 33,6 % | 2275/7776 ≈ 29,3 % |

### 4.4 Truppenbewegung

Einmal pro Zug, auch ohne vorherigen Angriff, dürfen beliebig viele Einheiten aus **einem** eigenen Gebiet in **ein** anderes eigenes Gebiet ziehen.

- Beide Gebiete müssen über eine durchgehende Kette eigener Gebiete verbunden sein. Der Weg darf nicht durch fremde Gebiete führen.
- Alle bewegten Einheiten kommen im selben Zielgebiet an.
- Mindestens 1 Einheit bleibt im Ausgangsgebiet.

## 5. Variantenregeln [S1]

### 5.1 Auftrags-RISIKO

- **Sieg:** Wer seine Mission erfüllt und die Karte vorzeigt, gewinnt sofort.
- **Hilfe anderer zählt:** Vernichtet ein anderer Spieler die Ziel-Armee, ist die Mission trotzdem erfüllt.
- **Eigene Farbe:** Lautet die Mission „Vernichte Armee X“ und man ist selbst X, gilt stattdessen: 24 Gebiete eigener Wahl erobern.
- **Belegter Kartentext (B7404):** „Vernichten Sie die ORANGE Armee. Wenn Sie selbst diese Armee sind, heißt Ihr Ziel: Erobern Sie 24 GEBIETE Ihrer Wahl.“
- ⚠ Nicht belegt: der vollständige Text aller 12 B7404-Missionen.

Zur Orientierung die Missionen älterer Ausgaben [S7] (14 Karten bei 6 Farben):

- Vernichte Armee *Farbe* (eine Karte je Farbe)
- Erobere Asien und Südamerika
- Erobere Asien und Afrika
- Erobere Nordamerika und Afrika
- Erobere Nordamerika und Australien
- Erobere Europa, Südamerika und einen dritten Kontinent nach Wahl
- Erobere Europa, Australien und einen dritten Kontinent nach Wahl
- Besetze 18 Gebiete mit je mindestens 2 Einheiten
- Besetze 24 Gebiete

### 5.2 RISIKO-Duell (2 Spieler)

**Aufbau**

1. Jeder Spieler wählt eine Farbe, eine dritte Farbe wird die neutrale Armee. Jede Armee erhält 40 Infanterie.
2. Missionskarten und Joker entfernen. Die 42 Gebietskarten in 3 Stapel zu je 14 teilen: Spieler A, Spieler B, Neutral.
3. Auf jedes Gebiet aller drei Stapel kommt 1 Infanterie.
4. Abwechselnd setzt jeder Spieler 2 eigene Einheiten (auf 1 oder 2 eigene Gebiete) und 1 neutrale Einheit (auf ein neutrales Gebiet nach Wahl), bis alle Starteinheiten stehen.
5. Gebietskarten und Joker mischen. Ab hier gelten die klassischen Regeln.

**Neutrale Armee**

- Sie greift nicht an, erhält keine Verstärkung und bewegt sich nicht.
- Wird sie angegriffen, würfelt der andere Spieler für sie.
- Für den Sieg müssen neutrale Gebiete nicht erobert werden.

### 5.3 Turbo-RISIKO

**Aufbau:** Wie klassisch. Dann wählt jeder geheim ein eigenes Gebiet als Hauptquartier (HQ), legt dessen Karte verdeckt vor sich, und alle decken gleichzeitig auf.

**Regeln**

- Wer ein gegnerisches HQ erobert, legt dessen Karte offen vor sich.
- Wer sein eigenes HQ verliert, gibt die Karte ab, scheidet aber **nicht** aus.
- HQ-Karten dürfen nicht eingetauscht werden.

**Kurzvariante:** Bei 4 Spielern reichen 2 gegnerische HQ plus das eigene, bei 5 Spielern 3 gegnerische HQ plus das eigene.

### 5.4 Wahlregel „Parker 1975“: drei Verteidigungswürfel

Lässt sich mit jeder der Varianten 5.1–5.3 und dem klassischen Spiel kombinieren. JSON: `variants.defender_three_dice`.

**Änderung gegenüber 4.3:** Der Verteidiger würfelt mit 1, 2 oder 3 Würfeln nach eigener Wahl, höchstens so vielen, wie Einheiten im Gebiet stehen. Alle anderen Regeln bleiben gleich.

**Herkunft**

- Deutsche Schmidt-Ausgabe (vermutlich späte 60er) und Parker-Ausgabe ab 1975 [S9][S10].
- Ab etwa 1982 nur noch 2 Verteidigungswürfel [S10].
- Im Ausland z. B. im italienischen *RisiKo!* und im brasilianischen *War!* [S7].

**⚠ Nicht belegt**

- Ab wie vielen Einheiten 3 Würfel erlaubt waren. Die Grenze „höchstens so viele wie Einheiten“ übernimmt nur die heutige Regel.
- Wer bei Gleichstand gewann. Hier gilt wie heute: der Verteidiger.
- Die übrigen Regeln der Ausgabe 1975 (Kartentausch, Missionen). Die Wahlregel ändert deshalb nur die Würfelzahl.

**Wahrscheinlichkeiten je Wurf** (exakt berechnet, Gleichstand für den Verteidiger):

| Angreifer | Verteidiger | Verteidiger verliert alles | Teilverluste | Angreifer verliert alles |
|---|---|---|---|---|
| 1 | 3 | 225/1296 ≈ 17,4 % | – | 1071/1296 ≈ 82,6 % |
| 2 | 3 | 979/7776 ≈ 12,6 % | 1:1 1981/7776 ≈ 25,5 % | 4816/7776 ≈ 61,9 % |
| 3 | 3 | 6420/46656 ≈ 13,8 % | A1/V2 10017/46656 ≈ 21,5 %; A2/V1 12348/46656 ≈ 26,5 % | 17871/46656 ≈ 38,3 % |

**Auswirkung:** Bei 3 gegen 3 verliert der Angreifer im Schnitt 1,89 Einheiten pro Wurf, der Verteidiger 1,11. Das sind 1,71 Angreiferverluste je Verteidigerverlust, bei 3 gegen 2 sind es nur 0,85. Angriffe werden also etwa doppelt so teuer.

## 6. Spielplan: Gebiete und Nachbarschaften

Alle Verbindungen gelten in beide Richtungen. Landgrenzen und Seestraßen sind nicht unterschieden. Es gibt **83 Verbindungen**.

**Prüfungen**

- Die Zahl von 83 Angriffswegen stimmt mit [S5] überein.
- Die Außengrenzgebiete je Kontinent stimmen mit [S6] überein: NA 3, SA 2, EU 4, AF 3, AS 5, AU 1.
- Gebietszahlen je Kontinent stimmen mit [S3] und [S4] überein.
- ⚠ Nicht gegen den physischen B7404-Spielplan geprüft.
- Die 40th Anniversary Edition hatte keine Verbindung Ostafrika–Naher Osten (laut [S5] ein Druckfehler).

¹ Deutscher Name nicht in einer deutschen Anleitung gefunden. Er ist an die gängige Bezeichnung angelehnt. In älteren Ausgaben heißen z. B. Nordafrika „Nordwestafrika“ und Nordeuropa „Mitteleuropa“ [S3][S4].

### Nordamerika (`north_america`) – Bonus 5, 9 Gebiete

| ID | Gebiet | Nachbarn |
|---|---|---|
| `alaska` | Alaska | `northwest_territory`, `alberta`, `kamchatka` |
| `northwest_territory` | Nordwest-Territorium | `alaska`, `alberta`, `ontario`, `greenland` |
| `greenland` | Grönland ¹ | `northwest_territory`, `ontario`, `quebec`, `iceland` |
| `alberta` | Alberta | `alaska`, `northwest_territory`, `ontario`, `western_united_states` |
| `ontario` | Ontario | `northwest_territory`, `alberta`, `greenland`, `quebec`, `western_united_states`, `eastern_united_states` |
| `quebec` | Quebec | `ontario`, `greenland`, `eastern_united_states` |
| `western_united_states` | Weststaaten | `alberta`, `ontario`, `eastern_united_states`, `central_america` |
| `eastern_united_states` | Oststaaten | `western_united_states`, `ontario`, `quebec`, `central_america` |
| `central_america` | Mittelamerika ¹ | `western_united_states`, `eastern_united_states`, `venezuela` |

### Südamerika (`south_america`) – Bonus 2, 4 Gebiete

| ID | Gebiet | Nachbarn |
|---|---|---|
| `venezuela` | Venezuela | `central_america`, `peru`, `brazil` |
| `peru` | Peru ¹ | `venezuela`, `brazil`, `argentina` |
| `brazil` | Brasilien | `venezuela`, `peru`, `argentina`, `north_africa` |
| `argentina` | Argentinien ¹ | `peru`, `brazil` |

### Europa (`europe`) – Bonus 5, 7 Gebiete

| ID | Gebiet | Nachbarn |
|---|---|---|
| `iceland` | Island ¹ | `greenland`, `great_britain`, `scandinavia` |
| `great_britain` | Großbritannien | `iceland`, `scandinavia`, `northern_europe`, `western_europe` |
| `scandinavia` | Skandinavien | `iceland`, `great_britain`, `northern_europe`, `ukraine` |
| `northern_europe` | Nordeuropa ¹ | `great_britain`, `scandinavia`, `ukraine`, `southern_europe`, `western_europe` |
| `western_europe` | Westeuropa | `great_britain`, `northern_europe`, `southern_europe`, `north_africa` |
| `southern_europe` | Südeuropa | `western_europe`, `northern_europe`, `ukraine`, `middle_east`, `egypt`, `north_africa` |
| `ukraine` | Ukraine | `scandinavia`, `northern_europe`, `southern_europe`, `middle_east`, `afghanistan`, `ural` |

### Afrika (`africa`) – Bonus 3, 6 Gebiete

| ID | Gebiet | Nachbarn |
|---|---|---|
| `north_africa` | Nordafrika | `brazil`, `western_europe`, `southern_europe`, `egypt`, `east_africa`, `congo` |
| `egypt` | Ägypten | `north_africa`, `southern_europe`, `middle_east`, `east_africa` |
| `east_africa` | Ostafrika | `egypt`, `north_africa`, `congo`, `south_africa`, `madagascar`, `middle_east` |
| `congo` | Kongo | `north_africa`, `east_africa`, `south_africa` |
| `south_africa` | Südafrika ¹ | `congo`, `east_africa`, `madagascar` |
| `madagascar` | Madagaskar ¹ | `south_africa`, `east_africa` |

### Asien (`asia`) – Bonus 7, 12 Gebiete

| ID | Gebiet | Nachbarn |
|---|---|---|
| `ural` | Ural ¹ | `ukraine`, `siberia`, `china`, `afghanistan` |
| `siberia` | Sibirien ¹ | `ural`, `yakutsk`, `irkutsk`, `mongolia`, `china` |
| `yakutsk` | Jakutien ¹ | `siberia`, `irkutsk`, `kamchatka` |
| `kamchatka` | Kamtschatka | `yakutsk`, `irkutsk`, `mongolia`, `japan`, `alaska` |
| `irkutsk` | Irkutsk | `siberia`, `yakutsk`, `kamchatka`, `mongolia` |
| `mongolia` | Mongolei | `siberia`, `irkutsk`, `kamchatka`, `japan`, `china` |
| `japan` | Japan ¹ | `kamchatka`, `mongolia` |
| `afghanistan` | Afghanistan | `ukraine`, `ural`, `china`, `india`, `middle_east` |
| `china` | China | `afghanistan`, `ural`, `siberia`, `mongolia`, `siam`, `india` |
| `middle_east` | Naher Osten | `ukraine`, `southern_europe`, `egypt`, `east_africa`, `afghanistan`, `india` |
| `india` | Indien | `middle_east`, `afghanistan`, `china`, `siam` |
| `siam` | Siam | `india`, `china`, `indonesia` |

### Australien (`australia`) – Bonus 2, 4 Gebiete

| ID | Gebiet | Nachbarn |
|---|---|---|
| `indonesia` | Indonesien | `siam`, `new_guinea`, `western_australia` |
| `new_guinea` | Neuguinea ¹ | `indonesia`, `western_australia`, `eastern_australia` |
| `western_australia` | Westaustralien ¹ | `indonesia`, `new_guinea`, `eastern_australia` |
| `eastern_australia` | Ostaustralien ¹ | `new_guinea`, `western_australia` |

## 7. Unterschiede zwischen Ausgaben

| Thema | B7404 (2015) | Andere Ausgaben | Quelle |
|---|---|---|---|
| Verteidigungswürfel | max. 2, frei wählbar | Schmidt (späte 60er) und Parker ab 1975: bis 3 (Wahlregel 5.4); 1999: 2 Würfel erst ab 3 Einheiten im Gebiet; RisiKo! (IT) und War! (BR): bis 3 | [S3][S6][S7][S9][S10] |
| Kartentausch | 4, 6, 8, 10, 12, 15, dann +5, global | Ältere und Deluxe-Ausgaben: feste Werte je Symbolkombination | [S4][S6] |
| Missionskarten | 12 Karten, 5 Farben | 1999: 14 Karten bei 6 Farben; 2004: 28 Karten, 4 Missionen pro Spieler | [S3][S4][S7] |
| Spielerzahl | 2–5 | 1999: 2–6 | [S1][S3] |
| Begriffe | Erobern, Angreifer, Verteidiger | 1999/2004: Befreien, Befreier, Besatzer | [S3][S4] |

## 8. Quellen

| # | Quelle | Vertrauenswürdigkeit |
|---|---|---|
| S1 | [Hasbro RISIKO Regelbuch B7404, © 2015, deutsch](https://consumercare.hasbro.com/api/download/B7404_de-de) | hoch: offizielle Herstelleranleitung, Primärquelle |
| S2 | [Gleiche Anleitung, Druck 0216, bei Spielezar](https://www.spielezar.ch/modules/genzo_zar/views/pdf/spielregeln-risiko.pdf) | hoch: Spiegel der Herstelleranleitung |
| S3 | [Hasbro RISIKO – Das große Strategie-Spiel, 1999](https://www.spiele4us.de/wp-content/uploads/2022/10/risiko-das-grosse-strategie-spiel-gebraucht-g003201160.pdf) | hoch: Herstelleranleitung (ältere Ausgabe) |
| S4 | [Hasbro RISIKO Kommandobuch, 2004](https://www.spiele4us.de/wp-content/uploads/2022/10/risiko-classic-gebraucht_g003201340.pdf) | hoch: Herstelleranleitung (ältere Ausgabe) |
| S5 | [Wikipedia (en): Risk (game)](https://en.wikipedia.org/wiki/Risk_(game)) | mittel: Tertiärquelle |
| S6 | [Wikipedia (de): Risiko (Spiel)](https://de.wikipedia.org/wiki/Risiko_(Spiel)) | mittel: Tertiärquelle |
| S7 | [Risk FAQ v5.61, University of Kent](https://www.kent.ac.uk/ims/personal/odl/riskfaq.htm) | mittel: Fan-FAQ, Stand 2006 |
| S8 | [Osborne, J. A. (2003): Markov Chains for the RISK Board Game Revisited. *Mathematics Magazine* 76(2), 129–135](https://doi.org/10.1080/0025570X.2003.11953165) | hoch: begutachtete Fachzeitschrift der Mathematical Association of America |
| S9 | [Spielemuseum Ludomu: Risiko (alte Ausgabe)](https://www.reich-der-spiele.de/ludomu/risiko) | mittel bis gering: Sammler-Rezension |
| S10 | [Forum spielen.de: Spielanleitung für Risiko von 1975](https://www.spielen.de/forum/viewtopic.php?t=395191) | gering: Nutzerberichte |
