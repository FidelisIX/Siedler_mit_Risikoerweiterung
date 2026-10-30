# Archipel

Online-Multiplayer-Aufbauspiel für 2–6 Spieler im Browser. Server: Node.js + Express + Socket.IO,
Client: reines HTML/CSS/JavaScript mit SVG-Hexkarte. Der Server prüft alle Spielregeln.

## Spielregeln (Kurzfassung)

- **Ziel:** Nach einer festen Rundenzahl (8, 12 oder 16, wählt der Gastgeber) gewinnt, wer die meisten Punkte hat.
  Gleichstand: mehr Rohstoffe.
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

**Hinweis:** Spielstände liegen nur im Arbeitsspeicher. Bei einem Neustart oder Redeploy – und beim
Free-Plan auch beim Einschlafen nach Inaktivität – gehen laufende Spiele verloren.

## Struktur

```
server/map.js     Karten: Inselgenerator, Vorlagen, Regionen, Prüfung eigener Karten
server/game.js    Spiellogik und Regeln
server/index.js   HTTP- und Socket.IO-Server, Räume
public/           Browser-Client (index.html, client.js), Karteneditor (editor.html, editor.js), hex.js
test/             Tests der Spiellogik (node:test)
```
