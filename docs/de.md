# BYD

## Überblick

Diese Integration bringt Ihre BYD-Fahrzeuge über die Cloud der internationalen **BYD**-App (nicht die App für China) in Gladys: Batterie, Reichweite, Laden, Verriegelung, Türen, Fenster, Klimatisierung, Reifendruck, Warnungen und Position. Mit der Fernsteuerungs-PIN der App kann Gladys das Fahrzeug auch ver- und entriegeln, das Klima starten oder stoppen, die Lichter blinken lassen und „Fahrzeug finden“ auslösen.

BYD veröffentlicht keine API: Die Integration spricht das Protokoll der App, nach der freien Bibliothek pyBYD (die die Home-Assistant-Integration nutzt). BYD kann es jederzeit ändern.

## Voraussetzungen

- Gladys Assistant 5.1.1 oder neuer.
- Ein BYD-Fahrzeug, verbunden mit der BYD-App, sowie E-Mail-Adresse und Passwort des App-Kontos.
- Empfohlen: ein zweites BYD-Konto, mit dem das Fahrzeug geteilt wird (Teilen erfolgt in der App). Die App kann Ihr Telefon abmelden, wenn Gladys sich mit demselben Konto anmeldet.
- Für Befehle: die 6-stellige **Fernsteuerungs-PIN**, die das von Gladys genutzte Konto in der BYD-App festgelegt hat (ein geteiltes Konto legt seine eigene fest).

## Konfiguration

| Feld                  | Bedeutung                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| E-Mail-Adresse        | Das Konto der BYD-App.                                                                             |
| Passwort              | Sein Passwort, als Geheimnis gespeichert.                                                          |
| Land des Kontos       | Zweibuchstabencode des Landes, in dem das Konto angelegt wurde (DE, AT, CH…): bestimmt den Server. |
| Fernsteuerungs-PIN    | Die 6 Ziffern der App. Leer: nur Lesen.                                                            |
| Abfrageintervall      | 5 bis 480 Minuten (Standard 15). Jedes Lesen weckt das Fahrzeug und kostet etwas Batterie.         |
| Klimatemperatur       | 15 bis 31 °C, beim Start des Klimas aus Gladys angefordert.                                        |
| Klimadauer            | 10, 15, 20, 25 oder 30 Minuten.                                                                    |
| Radius um das Zuhause | Unter dieser Entfernung zu einem Haus in Gladys (mit Position) ist das Fahrzeug zu Hause.          |
| Sprache der Texte     | Sprache der Namen, Zustände und Szenen-Zusammenfassungen.                                          |

Speichern und dann **Verbindung testen** klicken: Es listet die Fahrzeuge des Kontos auf.

## Verwendung

### Geräte

Fügen Sie unter **Entdecken** Ihre Fahrzeuge hinzu. Jedes Fahrzeug bietet die Funktionen an, die es meldet: Batterie, elektrische Reichweite (und Kraftstoff bei Plug-in-Hybriden), Kilometerstand, Ladekabel, Ladestatus, Zeit bis voll geladen, Innentemperatur, Verriegelung, Türen und Kofferraum, Fenster, Klimatisierung, Druck der vier Reifen (in bar), Warnungen und Entfernung von zu Hause. Scannen Sie nach einer ersten Fahrt erneut, wenn eine Funktion fehlt.

Verriegelung und Klima sind Befehle: Sie benötigen die PIN. Ein Befehl wird im Hintergrund gesendet; das Fahrzeug antwortet innerhalb einer Minute und wird 30 Sekunden später erneut gelesen.

### Dashboard-Widget

Das Widget **BYD-Fahrzeug** zeigt das Bild des Modells, Batterie, Reichweite, Verriegelung, Öffnungen, Laden, Innentemperatur, Klima, Position, Warnungen und das Alter der Daten, mit Tasten zum Ver- oder Entriegeln, Klima starten oder stoppen, Lichtsignal und Karte.

![Zwei Karten des BYD-Widgets: ein Fahrzeug lädt zu Hause, eines parkt in der Stadt (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-byd/main/docs/assets/widgets.de.png)

### Szenen

Auslöser: ver- oder entriegelt, verriegelt, aber offen, Laden gestartet oder beendet, Kabel ein- oder ausgesteckt, zu Hause angekommen oder abgefahren, Warnleuchte an, Kontoproblem. Aktionen: Befehl senden (wartet auf das Fahrzeug), Fahrzeugstatus lesen.

- Wenn das Fahrzeug zu Hause ankommt → senden „Fahrzeug anstecken: {{triggerEvent.data.battery_level}} %“.
- Wenn das Fahrzeug verriegelt, aber offen ist → {{triggerEvent.data.summary}} senden.
- Jeden Werktag um 7:40 → den Befehl „Klimatisierung starten“ senden.

### Transport

Alles läuft über die BYD-Cloud Ihrer Region (Abzeichen **Cloud**). Ein oranger Punkt bedeutet, dass BYD das Fahrzeug als offline sieht: Die Werte können veraltet sein.

## Fehlerbehebung

- **Anmeldung abgelehnt**: E-Mail-Adresse, Passwort und Land prüfen. Nach einer Ablehnung wartet die Integration 15 Minuten (dann 30, bis zu 4 Stunden) vor einem neuen Versuch, damit BYD das Konto nicht sperrt; Speichern der Konfiguration versucht es sofort erneut.
- **PIN abgelehnt**: Alle Befehle stoppen, bis Sie die PIN in der Konfiguration ändern. Wiederholte falsche PINs sperren die Fernsteuerung des Fahrzeugs für den Tag.
- **Ihr Telefon wurde abgemeldet**: Nutzen Sie ein zweites Konto, mit dem das Fahrzeug geteilt wird.
- **Veraltete Werte, „Fahrzeug offline“**: Das Fahrzeug hat keinen Mobilfunk (Tiefgarage) oder schläft tief; Befehle können bis zur Wiederverbindung fehlschlagen.
- **Ein Wert fehlt oder wirkt falsch**: In der Konfiguration auf **Diagnose** klicken und die Zeilen mit „BYD diagnostic“ aus dem Tab Protokolle in ein GitHub-Issue kopieren (VIN, Kennzeichen und Position sind entfernt).
