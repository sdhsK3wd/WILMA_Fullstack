# WILMA Web App: Installations- und Bedienungsanleitung

Dies ist eine vollständige Anleitung für die lokale Installation, den Start und die Bedienung der WILMA Web App.

---

## Anleitung: Installation und Start des Projekts

Diese Anleitung beschreibt die notwendigen Schritte zur lokalen Installation und Ausführung des gelieferten Projekts. Sie richtet sich an Anwender ohne technische Vorkenntnisse und führt detailliert durch den gesamten Prozess.

### 1. Voraussetzungen

Für die erfolgreiche Ausführung des Projekts benötigen Sie folgende Software auf Ihrem Computer. Bitte stellen Sie sicher, dass Sie die hier angegebenen Versionen oder neuere, kompatible Versionen verwenden.

* **Betriebssystem:** Windows 10+ (64-bit), macOS 11+ (Intel oder Apple Silicon), oder eine aktuelle Linux-Distribution.
* **.NET SDK:** Version 8.0.408 (oder höher, kompatibel)
    * Wird für das Haupt-Backend (C#) benötigt.
* **Python:** Version 3.11 (oder höher, kompatibel)
    * Wird für das KI-Backend benötigt.
* **Node.js:** Version 18.17.1 (LTS - Long Term Support) (oder höher, kompatibel)
    * Wird für das Frontend (React) benötigt.
* **Git:** (Optional) Nur zur Versionsverwaltung und zur Überprüfung der Quellcode-Integrität, falls das Projekt nicht als ZIP-Datei geliefert wird.
* **Internetverbindung:** Zum Herunterladen benötigter Abhängigkeiten.
* **Terminal oder Eingabeaufforderung (CMD/PowerShell):** Für die Ausführung der Befehle.

### 2. Programme installieren

Folgen Sie den Anweisungen, um die benötigte Software zu installieren.

#### 2.1 Installation des .NET SDK

1.  Öffnen Sie die Webseite: [https://dotnet.microsoft.com/en-us/download/dotnet/8.0](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
2.  Klicken Sie auf **„Download SDK“** und installieren Sie das Paket gemäß den Anweisungen.
3.  **Überprüfung:** Öffnen Sie ein Terminal (oder die Eingabeaufforderung unter Windows) und geben Sie ein:
    ```bash
    dotnet --version
    ```
    Es sollte die installierte Version (z.B. `8.0.408`) angezeigt werden.

#### 2.2 Installation von Python

1.  Besuchen Sie: [https://www.python.org/downloads/](https://www.python.org/downloads/)
2.  Laden Sie die neueste Version von **Python 3.11** oder höher herunter.
3.  Starten Sie das Installationsprogramm.
4.  **Wichtig:** Achten Sie darauf, die Option **„Add Python to PATH“** während der Installation zu aktivieren, bevor Sie die Installation abschließen. Dies ist entscheidend, damit Python und `pip` korrekt von der Kommandozeile aus erkannt werden.
5.  **Überprüfung:** Öffnen Sie ein **neues** Terminal-Fenster und geben Sie ein:
    ```bash
    python --version
    # Oder:
    python3 --version
    ```
    Es sollte die installierte Python-Version (z.B. `Python 3.11.x`) angezeigt werden.

#### 2.3 Installation von Node.js

1.  Besuchen Sie: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)
2.  Laden Sie die **LTS-Version** (Long Term Support, empfohlen) herunter.
3.  Installieren Sie Node.js, indem Sie den Anweisungen des Installationsprogramms folgen.
4.  **Überprüfung:** Öffnen Sie ein **neues** Terminal-Fenster und geben Sie ein:
    ```bash
    node --version
    npm --version
    ```
    Es sollten die installierten Versionen von Node.js (z.B. `v18.17.1`) und npm angezeigt werden.

### 3. Projekt entpacken

Nachdem Sie die ZIP-Datei des Projekts erhalten haben:

1.  Suchen Sie die ZIP-Datei auf Ihrem Computer.
2.  **Rechtsklick** auf die ZIP-Datei.
3.  Wählen Sie **„Alle extrahieren...“** (Windows) oder **„Hier entpacken“** (macOS/Linux, je nach installiertem Entpackprogramm).
4.  Merken Sie sich den Speicherort des extrahierten Ordners (dies ist Ihr `[PROJEKTWURZEL]`).

### 4. Projekt starten

Die drei Teile des Projekts (Frontend, C# Backend, Python KI-Backend) müssen jeweils in einem separaten Terminal-Fenster gestartet werden. Achten Sie auf die richtige Reihenfolge: zuerst die Backends, dann das Frontend.

**Wichtiger Hinweis zu Pfaden:** Ersetzen Sie in den folgenden Schritten `[PROJEKTWURZEL]` durch den tatsächlichen Pfad, in den Sie das Projekt entpackt haben. Zum Beispiel, wenn Sie das Projekt in `C:\Users\IhrName\Dokumente\WILMA_Projekt` entpackt haben, wäre `[PROJEKTWURZEL]` = `C:\Users\IhrName\Dokumente\WILMA_Projekt`.

#### 4.1 Start des C# Backends (Benutzerdaten und Abstimmungen)

Das C# Backend verwendet den Port `5070` für HTTP-Verbindungen.

1.  Öffnen Sie ein **neues Terminal-Fenster** (oder die Eingabeaufforderung/PowerShell).
2.  Wechseln Sie in das Verzeichnis des C# Backends:
    ```bash
    cd [PROJEKTWURZEL]\WILMA_Backend\WILMABackend
    # Gemäß deiner Ordnerstruktur könnte dies auch z.B. cd [PROJEKTWURZEL]\Bachend sein
    ```
3.  Installieren Sie die Projekt-Abhängigkeiten. Dieser Befehl lädt alle im Projekt definierten Pakete herunter:
    ```bash
    dotnet restore
    ```
4.  Starten Sie den Backend-Server:
    ```bash
    dotnet run
    ```
    Der Server sollte starten und anzeigen, dass er auf `http://localhost:5070` lauscht. Lassen Sie dieses Terminal-Fenster geöffnet.

#### 4.2 Start des Python KI-Backends (Prognosefunktion)

Das Python KI-Backend verwendet den Port `8000`.

1.  Öffnen Sie ein **zweites, neues Terminal-Fenster**.
2.  Wechseln Sie in das Verzeichnis des KI-Backends:
    ```bash
    cd [PROJEKTWURZEL]\WaterflowForecast
    # Dieser Pfad ist korrekt gemäß deiner Ordnerstruktur-Bilder
    ```
3.  **Empfehlung: Virtuelle Umgebung erstellen und aktivieren:**
    * Erstellen Sie eine virtuelle Umgebung (nur einmalig notwendig):
        ```bash
        python -m venv venv
        ```
    * Aktivieren Sie die virtuelle Umgebung:
        * **Windows (PowerShell):**
            ```powershell
            .\venv\Scripts\Activate.ps1
            ```
        * **Windows (Eingabeaufforderung/CMD):**
            ```cmd
            .\venv\Scripts\activate.bat
            ```
        * **macOS / Linux:**
            ```bash
            source venv/bin/activate
            ```
    (Nach der Aktivierung sollte `(venv)` vor Ihrer Kommandozeile erscheinen.)
4.  Installieren Sie die benötigten Python-Bibliotheken (dieser Schritt kann eine Weile dauern):
    ```bash
    pip install -r requirements.txt
    ```
5.  Starten Sie den KI-Server. Da FastAPI verwendet wird, ist der typische Startbefehl:
    ```bash
    uvicorn api:app --reload --port 8000
    ```
    Der Server sollte starten und anzeigen, dass er auf `http://127.0.0.1:8000` lauscht. Lassen Sie dieses Terminal-Fenster geöffnet.

#### 4.3 Start des Frontends (Benutzeroberfläche)

Das React Frontend verwendet den Port `5178`.

1.  Öffnen Sie ein **drittes, neues Terminal-Fenster**.
2.  Wechseln Sie in das Verzeichnis des Frontends:
    ```bash
    cd [PROJEKTWURZEL]\DPA
    # Dieser Pfad ist korrekt gemäß deiner Ordnerstruktur-Bilder (image_034351.png)
    ```
3.  Installieren Sie die notwendigen Node.js-Pakete (dieser Befehl lädt alle in `package.json` definierten Abhängigkeiten herunter und kann einige Minuten dauern):
    ```bash
    npm install
    ```
4.  Starten Sie das Frontend:
    ```bash
    npm run dev
    ```
5.  Öffnen Sie anschließend Ihren Webbrowser und geben Sie folgende Adresse ein:
    ```
    http://localhost:5178
    ```
    Die Anwendung sollte nun im Browser geladen werden.

#### 4.4 Datenbank-Hinweis

* Für das Projekt ist bereits eine SQLite-Datenbank eingerichtet.
* Das C# Backend erstellt automatisch eine neue Datenbankdatei (`WilmaDB.db`), falls noch keine existiert.
* Die Datei `forecast.db` für die KI-Modelle wird ebenfalls automatisch vom Python Backend erstellt und initialisiert, falls sie nicht vorhanden ist. Standardbehälter werden beim ersten Start hinzugefügt.
* Sie müssen hier nichts weiter unternehmen.

---

## Bedienungseinleitung (Admin Version)

Diese Anleitung beschreibt die Bedienung der WILMA Web App aus der Perspektive eines Administrators und erklärt die wichtigsten Funktionen.

### 1. Allgemeine Informationen

* **Produktname:** WILMA Web App
* **Version:** 1.0
* **Hersteller:** Team WILMA
* **Veröffentlichungsdatum:** 30.05.2025

### 2. Systemanforderungen für den Betrieb

* **Betriebssystem:** Windows 10+, macOS 11+, aktuelle Browser-Versionen (Chrome, Firefox, Edge, Safari)
* **Prozessor:** Dual-Core-Prozessor oder besser
* **Arbeitsspeicher:** Mindestens 4 GB RAM
* **Internetverbindung:** Nur bei Remotezugriff; Lokalbetrieb ist ohne Internetverbindung möglich, solange die Backends und das Frontend lokal laufen.

### 3. Zugang und Anmeldung

1.  Stellen Sie sicher, dass sowohl das C# Backend, das Python KI-Backend als auch das React Frontend lokal auf Ihrem Rechner gestartet sind (siehe "Anleitung: Installation und Start des Projekts").
2.  Öffnen Sie Ihren Webbrowser und navigieren Sie zu: `http://localhost:5178`
3.  **Login:** Geben Sie Ihre registrierten Zugangsdaten (E-Mail-Adresse und Passwort) in die entsprechenden Felder ein und klicken Sie auf **„Anmelden“**.
    * **Passwort vergessen / zurücksetzen:** Sollten Sie Ihr Passwort vergessen haben, klicken Sie auf der Anmeldeseite auf den Link „Passwort vergessen?“. Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen des Passworts zu erhalten, und folgen Sie den Anweisungen.

### 4. Überblick über die Benutzeroberfläche

Nach dem Login gelangen Sie auf die Homepage. Die Navigation erfolgt über eine linke Seitenleiste, die verschiedene Module und Funktionen anbietet.

### 5. Funktionen der WILMA Web App

Die WILMA Web App bietet verschiedene Module zur Verwaltung von Benutzerdaten, Durchführung von Abstimmungen, Analyse von Wasserverbrauchsdaten und Systemüberwachung.

#### 5.1 Homepage

* **Begrüßung:** Die Homepage begrüßt Sie persönlich mit einer zufälligen Begrüßung und zeigt Ihren Benutzernamen und Ihre Rolle an.
* **Schnellzugriff:** Sie bietet Kacheln für den schnellen Zugriff auf die wichtigsten Funktionen der Anwendung.

#### 5.2 Authentifizierung und Benutzerverwaltung (Admin-Funktionen)

Als Administrator haben Sie erweiterte Rechte zur Benutzerverwaltung.

* **Benutzerliste:**
    * Navigieren Sie über die linke Seitenleiste zu **„Benutzerverwaltung“ > „Benutzerliste“**.
    * Hier sehen Sie eine Übersicht aller registrierten Benutzer im System.
    * **Filtern und Suchen:** Nutzen Sie das Suchfeld und den Rollenfilter (Admin / User), um spezifische Benutzer schnell zu finden.
    * **Benutzer löschen:** Klicken Sie auf das Mülleimer-Symbol ($\small\texttt{<DeleteIcon/>}$) neben einem Benutzer, um diesen zu löschen. Bestätigen Sie die Aktion im Dialogfenster.
        * **Hinweis:** Administratoren können sich nicht selbst oder andere Administratoren über diese Funktion löschen.
* **Benutzer erstellen:**
    * Navigieren Sie über die linke Seitenleiste zu **„Benutzerverwaltung“ > „Benutzer erstellen“**.
    * Füllen Sie die Felder für Benutzername, E-Mail-Adresse, Passwort und wählen Sie die Rolle (`User` oder `Admin`) aus.
    * Ihre Admin-E-Mail-Adresse wird zur Authentifizierung der Erstellung verwendet und ist vorausgefüllt.
    * Klicken Sie auf **„Benutzer erstellen“**, um den neuen Benutzer im System anzulegen.

#### 5.3 Profilverwaltung

* **Mein Profil:**
    * Navigieren Sie über die linke Seitenleiste zu **„Profil“ > „Mein Profil“**.
    * Hier sehen Sie Ihre grundlegenden Informationen: Benutzername, E-Mail-Adresse und Rolle.
    * **Profilbild ändern:** Klicken Sie auf Ihr aktuelles Profilbild. Es öffnet sich ein Dateiauswahl-Dialog. Wählen Sie ein neues Bild aus, um es hochzuladen und Ihr Profilbild zu aktualisieren.
    * **Kontaktdaten bearbeiten:** Klicken Sie auf den Button **„Profil bearbeiten“**.
        * In dem erscheinenden Dialog können Sie Ihre Telefonnummer und Ihren Standort hinzufügen oder aktualisieren.
        * Klicken Sie auf **„Speichern“**, um die Änderungen zu übernehmen.
* **Einstellungen:**
    * Navigieren Sie über die linke Seitenleiste zu **„Profil“ > „Einstellungen“**.
    * **Design (Dark Mode):** Schalten Sie den Schalter neben „Dunkelmodus“ um, um zwischen hellem und dunklem Design zu wechseln.
    * **Sprache:** Wählen Sie Ihre bevorzugte Sprache (Deutsch oder Englisch) für die Benutzeroberfläche.
    * **Passwort ändern:** Klicken Sie auf den Button **„Passwort ändern“**. Dies leitet Sie zur „Passwort vergessen?“-Funktion weiter, wo Sie Ihr Passwort zurücksetzen können.

#### 5.4 Abstimmungen (Polls)

* **Abstimmungen anzeigen:**
    * Navigieren Sie über die linke Seitenleiste zu **„Abstimmungen“**.
    * Hier sehen Sie eine Liste aller aktiven Abstimmungen. Für bereits abgeschlossene Abstimmungen oder solche, an denen Sie bereits teilgenommen haben, werden Ihnen die Ergebnisse angezeigt.
* **An einer Abstimmung teilnehmen:**
    * Wählen Sie die gewünschte Option in einer Abstimmung aus, für die Sie noch nicht abgestimmt haben.
    * Klicken Sie anschließend auf **„Abstimmen“**, um Ihre Stimme abzugeben. Sie können nur einmal pro Abstimmung abstimmen.
* **Neue Abstimmung erstellen (Admin-Funktion):**
    * Als Administrator sehen Sie auf der Abstimmungsübersicht den Button **„Neue Abstimmung erstellen“**. Klicken Sie darauf.
    * Geben Sie einen Titel und optional eine Beschreibung für die Abstimmung ein.
    * Fügen Sie die Abstimmungsoptionen hinzu, jede in einer neuen Zeile.
    * Klicken Sie auf **„Erstellen“**, um die Abstimmung zu veröffentlichen.
* **Abstimmung löschen (Admin-Funktion):**
    * Neben jeder Abstimmung finden Sie (als Admin) ein **Mülleimer-Symbol** ($\small\texttt{<DeleteIcon/>}$). Klicken Sie darauf, um die Abstimmung zu löschen.
    * Bestätigen Sie die Aktion im erscheinenden Dialog.

#### 5.5 Prognose (Dashboard)

* **Dashboard-Übersicht:**
    * Navigieren Sie über die linke Seitenleiste zu **„Prognose“ > „Analyse“**.
    * Im oberen Bereich des Dashboards können Sie einen **„Behälter“** (z.B. „HB/DST Kleinhadersdorf (M616.F1)“), eine **„Prognosedauer“** (z.B. „30 Tage“) und ein **„Modell“** (Prophet oder TensorFlow) auswählen.
    * Der Graph zeigt historische Daten und die generierte Prognose basierend auf Ihren Auswahlen.
* **Daten hochladen (Admin-Funktion):**
    * Wählen Sie den Behälter aus, für den Sie Daten hochladen möchten.
    * Klicken Sie im Bereich „CSV-Daten hochladen“ auf **„Datei auswählen“**, um eine CSV-Datei von Ihrem Computer auszuwählen.
        * **Anforderungen an die CSV-Datei:** Die Datei muss Spalten für Datum (z.B. `Date`, `Datum`, `Zeitstempel`, `ds`) und Wert (z.B. `Value`, `Wert`, `Verbrauch`, `y`) enthalten.
    * Nachdem die Datei ausgewählt und lokal validiert wurde, klicken Sie auf **„Datei hochladen“**. Die Daten werden in die Datenbank importiert.
* **Behälterverwaltung (Admin-Funktion):**
    * Im Bereich „Behälterverwaltung“ können Sie Wasserbehälter hinzufügen, bearbeiten oder löschen.
    * **Neuen Behälter hinzufügen:** Klicken Sie auf **„Neuen Behälter hinzufügen“**, geben Sie im Dialog einen eindeutigen Namen für den Behälter ein und klicken Sie auf **„Hinzufügen“**.
    * **Behälter bearbeiten:** Klicken Sie auf das Stift-Symbol ($\small\texttt{<EditIcon/>}$) neben einem Behälter. Geben Sie den neuen Namen ein und klicken Sie auf **„Speichern“**.
    * **Behälter löschen:** Klicken Sie auf das Mülleimer-Symbol ($\small\texttt{<DeleteIcon/>}$) neben einem Behälter. Bestätigen Sie im Dialog.
        * **Hinweis:** Standardbehälter (die beim ersten Start der App automatisch hinzugefügt wurden) können nicht gelöscht werden.
* **Anomalie-Analyse (Admin-Funktion):**
    * Klicken Sie im Bereich „Administratoren-Aktionen“ auf **„Anomalien analysieren und markieren“**. Das System identifiziert automatisch auffällige Datenpunkte (Anomalien) in den historischen Daten des ausgewählten Behälters.
    * Im Graphen werden die als Anomalie identifizierten Punkte rot dargestellt.
    * **Manuelle Anomalie-Markierung:** Bewegen Sie den Mauszeiger über einen Datenpunkt im Graphen. Im Tooltip erscheint ein Symbol ($\small\texttt{<MarkAsNotAnomalyIcon/>}$), mit dem Sie den Status eines Datenpunkts als Anomalie manuell ändern können (z.B. eine markierte Anomalie als „nicht-Anomalie“ setzen).
* **Daten bereinigen (Admin-Funktion):**
    * Klicken Sie im Bereich „Administratoren-Aktionen“ auf **„Daten bereinigen“**.
    * Diese Funktion füllt fehlende Werte (NaNs) in den historischen Daten des ausgewählten Behälters mittels linearer Interpolation.

#### 5.6 System-Logs (Admin-Funktion)

* **Logs anzeigen:**
    * Navigieren Sie über die linke Seitenleiste zu **„System“ > „Logs“**.
    * Hier werden alle Systemereignisse, Benutzeraktionen und Fehler protokolliert.
    * **Filtern:** Sie können die angezeigten Logs nach Level (INFO, WARN, ERROR, DEBUG), Benutzer oder einem spezifischen Datumsbereich filtern.
    * **Details anzeigen:** Klicken Sie auf den Pfeil ($\small\texttt{<ExpandMoreIcon/>}$) neben einem Log-Eintrag, um weitere Details zu einem Ereignis einzusehen, falls vorhanden.
