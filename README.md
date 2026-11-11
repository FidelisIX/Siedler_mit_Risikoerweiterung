# Archipel

Online-Multiplayer-Aufbauspiel für 2–6 Spieler im Browser. Server: Node.js + Express + Socket.IO,
Client: reines HTML/CSS/JavaScript mit SVG-Hexkarte. Der Server prüft alle Spielregeln.

## Spielregeln (Kurzfassung)

- **Siegbedingung** (wählt der Gastgeber in der Lobby):
  - **Punkteziel** (10, 12, 15 oder 20 Punkte): Wer es am Ende seines eigenen Zuges erreicht, gewinnt sofort.
  - In der Variante **Eroberung** stattdessen „Punkteziel oder alle Gegner besiegen“ bzw. „Nur alle Gegner besiegen“
    (siehe unten).
  - **Rundenlimit (optional):** 20, 30 oder 40 Runden. Ist bis dahin niemand am Ziel, gewinnt die höchste Punktzahl
    (Gleichstand: mehr Rohstoffe).
  - **Ohne Rundenlimit** wird nach 150 Runden abgestimmt, ob weitergespielt wird, danach alle 25 Runden. Es zählen
    die verbundenen Spieler; die Mehrheit für „Beenden“ beendet das Spiel nach Punkten, bei Gleichstand geht es weiter.
- **Karte:** Hex-Felder (Wald, Steinbruch, Acker, Mine, Ödland, Wasser) in beliebiger Form. Die Landfelder
  werden automatisch in 6 gleich große Regionen geteilt; Wasser gehört zur Region des nächsten Landfelds.
  Karten zur Auswahl in der Lobby:
  - **Zufällige Inselgruppe** (Standard): 2–4 Inseln, bei jedem Spiel neu erzeugt.
  - **Kontinent:** zusammenhängende Landmasse ohne Wasser.
  - **Vorlagen:** Zwillingsinseln, Lagune, Inselkette.
  - **Eigene Karten** aus dem Karteneditor.
- **Aufbau:** Jeder setzt in Schlangenreihenfolge zwei Start-Siedlungen auf freie Landfelder ohne Nachbargebäude.
  Eine Karte braucht mindestens 5 bebaubare Landfelder pro Spieler.
  Startrohstoffe: 2 Holz, 2 Stein, 2 Nahrung, 1 Erz.
- **Würfeln:** Der aktive Spieler wirft den Regionswürfel (1–6) und den Geländewürfel
  (Wald, Steinbruch, Acker, Mine, Stern, Stern).
  - Gebäude in der gewürfelten Region produzieren.
  - Gebäude auf dem gewürfelten Gelände produzieren (überall auf der Karte).
  - Trifft beides zu: doppelt. Bei **Stern** produziert nur die gewürfelte Region, dafür doppelt.
- **Gebäude** (ein Gebäude pro Feld):

  | Gebäude   | Kosten                              | Punkte | Wo?                                          | Wirkung                       |
  |-----------|-------------------------------------|--------|----------------------------------------------|-------------------------------|
  | Siedlung  | 1 Holz, 1 Stein, 1 Nahrung          | 1      | Land                                         | produziert 1                  |
  | Gutshof   | 2 Nahrung, 2 Erz                    | 2      | Ausbau einer eigenen Siedlung                | produziert 2                  |
  | Hafen     | 2 Holz, 1 Stein, 1 Nahrung          | 1      | Land an der Küste                            | produziert 1, Ausgangspunkt für Schiffe |
  | Markt     | 2 Holz, 1 Stein                     | 1      | Land oder Ödland                             | Banktausch 2:1 statt 3:1      |
  | Monument  | 1 Holz, 2 Stein, 1 Nahrung, 2 Erz   | 3      | Land oder Ödland                             | –                             |
  | Schiff    | 1 Holz, 1 Erz                       | 0      | Wasser neben eigenem Hafen oder Schiff       | Reichweite zu anderen Inseln  |
  | Fischerei | 1 Holz, 1 Nahrung                   | 0      | Wasser neben eigenem Landgebäude             | 1 Nahrung, wenn ihre Region gewürfelt wird |

  Landgebäude müssen neben einem eigenen Landgebäude **oder einem eigenen Schiff** stehen – so erreicht man
  andere Inseln. Fischereien verlängern die Reichweite nicht.
- **Handel:** Mit der Bank (3:1, mit Markt 2:1) oder per Angebot an einen Mitspieler.
- **Verbindungsabbruch:** Neu laden verbindet wieder mit dem Raum. Ist der aktive Spieler getrennt,
  können Mitspieler seinen Zug überspringen.

## Räume

- **Spieler entfernen:** Der Gastgeber (👑) entfernt Spieler über das ✕ in der Spielerliste. In der Lobby
  verschwinden sie ganz; im laufenden Spiel bleiben ihre Gebäude stehen und ihre Züge werden übersprungen.
- **Host-Übergabe:** Ist der Gastgeber 15 s lang nicht verbunden, wird der nächste verbundene Spieler Gastgeber.
  Ein kurzes Neuladen der Seite löst keine Übergabe aus.
- **Nochmal spielen:** Am Spielende kann jeder zustimmen (erneut klicken nimmt die Stimme zurück). Haben alle
  verbundenen Spieler zugestimmt, startet die nächste Partie mit denselben Spielern und Einstellungen.
  Der Gastgeber kann auch sofort neu starten oder zurück in die Lobby gehen, um etwas zu ändern.
- **Zweiter Tab:** Pro Spieler ist nur eine Verbindung aktiv. Wer das Spiel in einem weiteren Tab öffnet,
  spielt dort weiter; der alte Tab zeigt „In einem anderen Tab geöffnet“.

## Teams

In der Lobby stellt der Gastgeber **„Feste Teams“** ein (bis zu 3 Teams: A, B, C; auch ungleich, z. B. 2 gegen 1).

- **Teamwahl:** Jeder wählt sein Team selbst; der Gastgeber kann jeden umsetzen (Veto). Gestartet wird erst,
  wenn alle ein Team haben und es mindestens zwei Teams gibt.
- **Zugreihenfolge:** abwechselnd zwischen den Teams (A1, B1, A2, B2 …).
- **Punkteziel:** Die Punkte eines Teams werden addiert; das Ziel wird mit der Teamgröße multipliziert
  (z. B. 12 Punkte → 24 für ein 2er-Team, 12 für einen Einzelspieler). Gewonnen ist am Ende des Zuges
  eines Teammitglieds.
- **Besiegt** ist ein Team erst, wenn alle Mitglieder besiegt sind.
- **Eroberung:** Teammitglieder können sich nicht angreifen, dürfen Truppen auf Gebäude des Partners verlegen und
  über dessen Schiffe angreifen.
- **Handel:** Banktausch 2:1, wenn man selbst und ein Teammitglied je einen Hafen haben.

## Spielvariante „Eroberung“ (Truppen & Kämpfe)

Der Gastgeber wählt in der Lobby die Variante **Klassisch** oder **Eroberung**. In der Eroberung gilt zusätzlich:

- **Truppen** stehen auf eigenen Landgebäuden (max. 6 pro Feld). Jede Start-Siedlung beginnt mit 1 Truppe.
  - **Rekrutieren:** 1 Nahrung + 1 Erz für 1 Truppe auf einem eigenen Landgebäude.
  - **Verlegen:** 1× pro Zug beliebig viele Truppen zu einem erreichbaren eigenen Gebäude.
  - **Angreifen:** ab Runde 3, max. 2× pro Zug, je 1 Nahrung. Ziel ist ein fremdes Landgebäude, das an das
    Ausgangsfeld grenzt oder über eine Kette **eigener Schiffe** erreichbar ist.
- **Stationäre Truppen:** Jedes Landgebäude hat eine feste Besatzung, die nur verteidigt, nie mitzieht und
  nicht verloren geht: Siedlung (Dorf) 1, Gutshof (Stadt) 2, Hafen/Markt/Monument 1, Wachturm 2, Limes 3.
- **Verteidigungsgebäude** (nur in dieser Variante):

  | Gebäude  | Kosten           | Punkte | Wirkung                                                                 |
  |----------|------------------|--------|-------------------------------------------------------------------------|
  | Wachturm | 1 Holz, 2 Stein  | 0      | 2 stationäre Truppen; eigene Nachbargebäude +1 Verteidigung (nicht stapelbar) |
  | Limes    | 1 Holz, 3 Stein  | 0      | 3 stationäre Truppen; eigene Nachbargebäude können erst angegriffen werden, wenn der Limes gefallen ist |

- **Kampf:** Angreifer = eingesetzte Truppen + 1 Würfel. Verteidiger = Truppen + stationäre Truppen
  + Wachturm-Bonus + 1 Würfel. Die höhere Summe gewinnt, bei Gleichstand der Verteidiger.
  - Verlierer: verliert alle beteiligten beweglichen Truppen.
  - Sieger: verliert die Hälfte (aufgerundet) der gegnerischen beweglichen Truppen.
  - Siegt der Angreifer, **übernimmt er das Gebäude** (samt Punkten) mit den überlebenden Truppen.
- **Besiegt** ist, wer kein Landgebäude mehr hat: Seine Züge werden übersprungen. Bleibt nur ein Spieler übrig,
  gewinnt er („alle Gegner besiegen“). Mit „Punkteziel oder alle Gegner besiegen“ gewinnt zusätzlich, wer am Ende
  seines Zuges das Punkteziel erreicht.

Alle Werte stehen gesammelt in `CONQUEST` und `BUILDINGS` in `server/game.js`.

## Karteneditor

Unter `/editor.html` (Link auf der Startseite und in der Lobby):

- Felder mit Pinseln malen (klicken oder ziehen): Wasser, Land (zufällig), feste Gelände, Ödland, Radierer.
- „Küste mit Wasser umranden“ legt einen Wasserring um alle Landfelder.
- Vorlagen als Ausgangspunkt laden, Karten im Browser speichern, als JSON exportieren/importieren.
- In der Lobby wählt der Gastgeber gespeicherte Karten unter „Karte → Aus Editor: …“ aus; alle Mitspieler
  sehen eine Vorschau.

## Lokal starten

```bash
npm install
npm start
```

Dann <http://localhost:3000> öffnen. Tests: `npm test`.

## Deployment auf Render

Das Repo enthält eine `render.yaml` (Blueprint).

1. Auf <https://dashboard.render.com> **New → Blueprint** wählen und dieses Repository verbinden.
2. Render liest `render.yaml` und legt den Web Service `archipel` an (Build: `npm ci`, Start: `npm start`).

Alternativ **New → Web Service** mit denselben Befehlen. Render setzt `PORT` automatisch.

Wichtig zu wissen:

- **Genau eine Instanz** (`numInstances: 1`). Mit mehreren Instanzen würden Spieler desselben Raums auf
  verschiedenen Servern landen.
- **Kostenloser Plan:** Der Dienst schläft nach einer Weile ohne Aufrufe ein; der erste Aufruf danach dauert länger.
- **Ohne `STATS_GITHUB_TOKEN`** liegen Räume und Statistik nur im Arbeitsspeicher und gehen bei jedem Neustart verloren.

## Statistik & Raumsicherung

Wie bei Ortsraten: Über **„📊 Statistik & Rekorde“** (Startseite und Spielende) gibt es Rekorde (beste Partie,
meiste Siege/Partien, meiste Gebäude bzw. Eroberungen in einer Partie, knappster Sieg), eine Spielertabelle und
eine Kartenübersicht, filterbar nach Variante und Spieler. Spieler werden über ihren Namen erkannt
(Groß-/Kleinschreibung egal). Gespeichert werden nur Partien, die bis zum Ende gespielt wurden.

### Speicherung im GitHub-Branch `statistik`

Nach jeder Partie schreibt der Server eine Zeile in `spiele/JJJJ-MM.jsonl` im Branch `statistik` dieses Repos
und liest beim Start alle Partien wieder ein. Der Branch darf nicht der Deploy-Branch sein, sonst würde jede
Partie einen Neustart auslösen; der Server verweigert das.

Einrichtung:

1. Auf GitHub unter **Settings → Developer settings → Personal access tokens → Fine-grained tokens** einen Token
   erstellen: nur für dieses Repository, Berechtigung **Contents: Read and write**, sonst nichts.
2. Auf Render im Service unter **Environment** die Variable `STATS_GITHUB_TOKEN` mit dem Token anlegen.
   Render startet den Dienst danach neu.

### Laufende Spiele überstehen Deploys

Mit gesetztem Token sichert der Server beim Herunterfahren (SIGTERM, z. B. bei einem Deploy auf Render) alle
aktiven Räume in `raeume/<CODE>.json` im Branch `statistik`. Die Browser verbinden sich automatisch neu, der neue
Server stellt die Räume wieder her und die Partie läuft an derselben Stelle weiter. Sicherungen älter als
10 Minuten werden verworfen; Abstürze sind nicht abgedeckt. Sitzungs-Tokens werden nur als SHA-256-Hash gesichert.

| Umgebungsvariable    | Standard                                  | Bedeutung                                         |
|----------------------|-------------------------------------------|---------------------------------------------------|
| `PORT`               | `3000`                                    | HTTP-Port                                         |
| `STATS_GITHUB_TOKEN` | –                                         | Token für Statistik und Raumsicherung             |
| `STATS_REPO`         | `FidelisIX/siedler_mit_risikoerweiterung` | Repo für die Daten                                |
| `STATS_BRANCH`       | `statistik`                               | Datenbranch; darf nicht `main` sein               |
| `STATS_FILE`         | –                                         | Alternativ: lokale Datei (Entwicklung) ohne Token |

## Aufgaben, Bugs und Wünsche

- [docs/OFFENE_AUFGABEN.md](docs/OFFENE_AUFGABEN.md) – To-dos außerhalb des Codes (z. B. Token einrichten)
- [docs/BUGS.md](docs/BUGS.md) – bekannte Fehler und Einschränkungen
- [docs/FEATURE_REQUESTS.md](docs/FEATURE_REQUESTS.md) – Wünsche und Ideen

## Struktur

```
server/map.js     Karten: Inselgenerator, Vorlagen, Regionen, Prüfung eigener Karten
server/game.js    Spiellogik und Regeln
server/index.js   HTTP- und Socket.IO-Server, Räume, Wiederherstellung nach Neustart
server/store.js   Speicherung von Partien und Raumsicherungen (GitHub-Branch, Datei oder Arbeitsspeicher)
server/stats.js   Auswertung: Rekorde, Spielertabelle, Karten
public/           Browser-Client (index.html, client.js), Karteneditor (editor.html, editor.js),
                  Statistik (stats.html, stats-page.js), hex.js
test/             node:test – Spiellogik, Statistik und Socket-Integrationstest
```
