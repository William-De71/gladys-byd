// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback), the four languages of the Gladys interface.
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, text states, widget contents, scene
// summaries, messages of the Configuration screen.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // --- Devices ---------------------------------------------------------------
  deviceName: { en: 'BYD {model}', fr: 'BYD {model}', de: 'BYD {model}', es: 'BYD {model}' },
  featureBatteryLevel: { en: 'Battery', fr: 'Batterie', de: 'Batterie', es: 'Batería' },
  featureBatteryRange: {
    en: 'Electric range',
    fr: 'Autonomie électrique',
    de: 'Elektrische Reichweite',
    es: 'Autonomía eléctrica',
  },
  featureFuelLevel: { en: 'Fuel', fr: 'Carburant', de: 'Kraftstoff', es: 'Combustible' },
  featureFuelRange: {
    en: 'Fuel range',
    fr: 'Autonomie carburant',
    de: 'Kraftstoff-Reichweite',
    es: 'Autonomía de combustible',
  },
  featureOdometer: {
    en: 'Odometer',
    fr: 'Compteur kilométrique',
    de: 'Kilometerstand',
    es: 'Cuentakilómetros',
  },
  featurePlugged: {
    en: 'Charging cable plugged in',
    fr: 'Câble de charge branché',
    de: 'Ladekabel angeschlossen',
    es: 'Cable de carga enchufado',
  },
  featureChargingStatus: {
    en: 'Charging status',
    fr: 'État de la charge',
    de: 'Ladestatus',
    es: 'Estado de la carga',
  },
  featureChargeTime: {
    en: 'Time to full charge',
    fr: 'Temps avant charge complète',
    de: 'Zeit bis voll geladen',
    es: 'Tiempo hasta carga completa',
  },
  featureIndoorTemperature: {
    en: 'Inside temperature',
    fr: 'Température intérieure',
    de: 'Innentemperatur',
    es: 'Temperatura interior',
  },
  featureLock: { en: 'Lock', fr: 'Verrouillage', de: 'Verriegelung', es: 'Cierre' },
  featureDoors: {
    en: 'Doors and trunk',
    fr: 'Portes et coffre',
    de: 'Türen und Kofferraum',
    es: 'Puertas y maletero',
  },
  featureWindows: { en: 'Windows', fr: 'Vitres', de: 'Fenster', es: 'Ventanillas' },
  featureClimate: { en: 'Climate', fr: 'Climatisation', de: 'Klimatisierung', es: 'Climatización' },
  featureTyre_front_left: {
    en: 'Tyre front left',
    fr: 'Pneu avant gauche',
    de: 'Reifen vorne links',
    es: 'Neumático delantero izquierdo',
  },
  featureTyre_front_right: {
    en: 'Tyre front right',
    fr: 'Pneu avant droit',
    de: 'Reifen vorne rechts',
    es: 'Neumático delantero derecho',
  },
  featureTyre_rear_left: {
    en: 'Tyre rear left',
    fr: 'Pneu arrière gauche',
    de: 'Reifen hinten links',
    es: 'Neumático trasero izquierdo',
  },
  featureTyre_rear_right: {
    en: 'Tyre rear right',
    fr: 'Pneu arrière droit',
    de: 'Reifen hinten rechts',
    es: 'Neumático trasero derecho',
  },
  featureWarnings: { en: 'Warnings', fr: 'Alertes', de: 'Warnungen', es: 'Alertas' },
  featureDistanceHome: {
    en: 'Distance from home',
    fr: 'Distance du domicile',
    de: 'Entfernung von zu Hause',
    es: 'Distancia de casa',
  },

  // --- Charge --------------------------------------------------------------
  charge_charging: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  charge_plugged: {
    en: 'Plugged in, not charging',
    fr: 'Branchée, pas en charge',
    de: 'Angeschlossen, lädt nicht',
    es: 'Enchufado, sin cargar',
  },
  charge_unplugged: {
    en: 'Not plugged in',
    fr: 'Non branchée',
    de: 'Nicht angeschlossen',
    es: 'No enchufado',
  },

  // --- Warnings ------------------------------------------------------------
  noWarning: { en: 'None', fr: 'Aucune', de: 'Keine', es: 'Ninguna' },
  warning_tyre_pressure: {
    en: 'Tyre pressure',
    fr: 'Pression des pneus',
    de: 'Reifendruck',
    es: 'Presión de neumáticos',
  },
  warning_tyre_leak: { en: 'Tyre leak', fr: 'Fuite de pneu', de: 'Reifenleck', es: 'Pinchazo' },
  warning_power_system: {
    en: 'Power system',
    fr: 'Système de propulsion',
    de: 'Antriebssystem',
    es: 'Sistema de propulsión',
  },
  warning_braking: { en: 'Brakes', fr: 'Freinage', de: 'Bremsen', es: 'Frenos' },
  warning_charging_system: {
    en: 'Charging system',
    fr: 'Système de charge',
    de: 'Ladesystem',
    es: 'Sistema de carga',
  },
  warning_steering: { en: 'Steering', fr: 'Direction', de: 'Lenkung', es: 'Dirección' },
  warning_abs: { en: 'ABS', fr: 'ABS', de: 'ABS', es: 'ABS' },
  warning_esp: { en: 'ESP', fr: 'ESP', de: 'ESP', es: 'ESP' },
  warning_eps: {
    en: 'Power steering',
    fr: 'Direction assistée',
    de: 'Servolenkung',
    es: 'Dirección asistida',
  },
  warning_airbag: { en: 'Airbag', fr: 'Airbag', de: 'Airbag', es: 'Airbag' },
  warning_service: {
    en: 'Service due',
    fr: 'Entretien à prévoir',
    de: 'Wartung fällig',
    es: 'Mantenimiento',
  },
  warning_coolant: {
    en: 'Coolant',
    fr: 'Liquide de refroidissement',
    de: 'Kühlmittel',
    es: 'Refrigerante',
  },
  warning_other: {
    en: 'Other warning',
    fr: 'Autre alerte',
    de: 'Andere Warnung',
    es: 'Otra alerta',
  },

  // --- Openings ------------------------------------------------------------
  opening_front_left: {
    en: 'front left door',
    fr: 'porte avant gauche',
    de: 'Tür vorne links',
    es: 'puerta delantera izquierda',
  },
  opening_front_right: {
    en: 'front right door',
    fr: 'porte avant droite',
    de: 'Tür vorne rechts',
    es: 'puerta delantera derecha',
  },
  opening_rear_left: {
    en: 'rear left door',
    fr: 'porte arrière gauche',
    de: 'Tür hinten links',
    es: 'puerta trasera izquierda',
  },
  opening_rear_right: {
    en: 'rear right door',
    fr: 'porte arrière droite',
    de: 'Tür hinten rechts',
    es: 'puerta trasera derecha',
  },
  opening_sliding: {
    en: 'sliding door',
    fr: 'porte coulissante',
    de: 'Schiebetür',
    es: 'puerta corredera',
  },
  opening_trunk: { en: 'trunk', fr: 'coffre', de: 'Kofferraum', es: 'maletero' },
  opening_frunk: {
    en: 'front trunk',
    fr: 'coffre avant',
    de: 'Frontkofferraum',
    es: 'maletero delantero',
  },
  opening_window_front_left: {
    en: 'front left window',
    fr: 'vitre avant gauche',
    de: 'Fenster vorne links',
    es: 'ventanilla delantera izquierda',
  },
  opening_window_front_right: {
    en: 'front right window',
    fr: 'vitre avant droite',
    de: 'Fenster vorne rechts',
    es: 'ventanilla delantera derecha',
  },
  opening_window_rear_left: {
    en: 'rear left window',
    fr: 'vitre arrière gauche',
    de: 'Fenster hinten links',
    es: 'ventanilla trasera izquierda',
  },
  opening_window_rear_right: {
    en: 'rear right window',
    fr: 'vitre arrière droite',
    de: 'Fenster hinten rechts',
    es: 'ventanilla trasera derecha',
  },
  opening_sunroof: { en: 'sunroof', fr: 'toit ouvrant', de: 'Schiebedach', es: 'techo solar' },

  // --- Scene summaries -------------------------------------------------------
  summaryLocked: {
    en: '{car} is locked.',
    fr: '{car} est verrouillée.',
    de: '{car} ist verriegelt.',
    es: '{car} está cerrado.',
  },
  summaryUnlocked: {
    en: '{car} is unlocked.',
    fr: '{car} est déverrouillée.',
    de: '{car} ist entriegelt.',
    es: '{car} está abierto.',
  },
  summaryLeftOpen: {
    en: '{car} is locked but still open: {list}.',
    fr: '{car} est verrouillée mais reste ouverte : {list}.',
    de: '{car} ist verriegelt, aber noch offen: {list}.',
    es: '{car} está cerrado pero sigue abierto: {list}.',
  },
  summaryChargeStarted: {
    en: '{car} started charging ({level} %).',
    fr: '{car} a commencé à charger ({level} %).',
    de: '{car} hat mit dem Laden begonnen ({level} %).',
    es: '{car} ha empezado a cargar ({level} %).',
  },
  summaryChargeStopped: {
    en: '{car} stopped charging ({level} %).',
    fr: '{car} a arrêté de charger ({level} %).',
    de: '{car} hat das Laden beendet ({level} %).',
    es: '{car} ha dejado de cargar ({level} %).',
  },
  summaryPlugged: {
    en: '{car} is plugged in ({level} %).',
    fr: '{car} est branchée ({level} %).',
    de: '{car} ist angeschlossen ({level} %).',
    es: '{car} está enchufado ({level} %).',
  },
  summaryUnplugged: {
    en: '{car} is unplugged ({level} %).',
    fr: '{car} est débranchée ({level} %).',
    de: '{car} ist abgesteckt ({level} %).',
    es: '{car} está desenchufado ({level} %).',
  },
  summaryArrived: {
    en: '{car} is home ({level} %).',
    fr: '{car} est arrivée à la maison ({level} %).',
    de: '{car} ist zu Hause angekommen ({level} %).',
    es: '{car} ha llegado a casa ({level} %).',
  },
  summaryLeft: {
    en: '{car} left home ({level} %).',
    fr: '{car} a quitté la maison ({level} %).',
    de: '{car} hat das Zuhause verlassen ({level} %).',
    es: '{car} ha salido de casa ({level} %).',
  },
  summaryWarning: {
    en: '{car}: warning “{warning}”.',
    fr: '{car} : alerte « {warning} ».',
    de: '{car}: Warnung „{warning}“.',
    es: '{car}: alerta «{warning}».',
  },
  summary_login_refused: {
    en: 'The BYD cloud refuses the sign-in of the integration: check the e-mail address, the password and the country.',
    fr: 'Le cloud BYD refuse la connexion de l’intégration : vérifiez l’adresse e-mail, le mot de passe et le pays.',
    de: 'Die BYD-Cloud lehnt die Anmeldung der Integration ab: Prüfen Sie E-Mail-Adresse, Passwort und Land.',
    es: 'La nube de BYD rechaza el inicio de sesión de la integración: compruebe el correo, la contraseña y el país.',
  },
  summary_pin_refused: {
    en: 'The BYD cloud refused the remote control PIN: commands are stopped until the PIN is changed in the settings.',
    fr: 'Le cloud BYD a refusé le code PIN de commande : les commandes sont suspendues jusqu’à la modification du PIN dans les réglages.',
    de: 'Die BYD-Cloud hat die Fernsteuerungs-PIN abgelehnt: Befehle sind gestoppt, bis die PIN in den Einstellungen geändert wird.',
    es: 'La nube de BYD rechazó el PIN de control remoto: los comandos quedan detenidos hasta cambiar el PIN en los ajustes.',
  },
  summaryBattery: {
    en: 'Battery {level} %, {range} km of range.',
    fr: 'Batterie {level} %, {range} km d’autonomie.',
    de: 'Batterie {level} %, {range} km Reichweite.',
    es: 'Batería {level} %, {range} km de autonomía.',
  },
  summaryStatus: {
    en: '{car}: {lock}, {openings}. {energy}',
    fr: '{car} : {lock}, {openings}. {energy}',
    de: '{car}: {lock}, {openings}. {energy}',
    es: '{car}: {lock}, {openings}. {energy}',
  },

  // --- Widget ----------------------------------------------------------------
  battery: { en: 'Battery', fr: 'Batterie', de: 'Batterie', es: 'Batería' },
  range: { en: 'Range', fr: 'Autonomie', de: 'Reichweite', es: 'Autonomía' },
  lockState: { en: 'Lock', fr: 'Verrouillage', de: 'Verriegelung', es: 'Cierre' },
  locked: { en: 'Locked', fr: 'Verrouillée', de: 'Verriegelt', es: 'Cerrado' },
  unlocked: { en: 'Unlocked', fr: 'Déverrouillée', de: 'Entriegelt', es: 'Abierto' },
  openings: { en: 'Openings', fr: 'Ouvrants', de: 'Öffnungen', es: 'Aperturas' },
  allClosed: {
    en: 'All closed',
    fr: 'Tout est fermé',
    de: 'Alles geschlossen',
    es: 'Todo cerrado',
  },
  open: { en: 'Open: {list}', fr: 'Ouvert : {list}', de: 'Offen: {list}', es: 'Abierto: {list}' },
  charging: { en: 'Charge', fr: 'Charge', de: 'Laden', es: 'Carga' },
  fullIn: {
    en: 'full in {time}',
    fr: 'pleine dans {time}',
    de: 'voll in {time}',
    es: 'llena en {time}',
  },
  inside: { en: 'Inside', fr: 'Intérieur', de: 'Innen', es: 'Interior' },
  climate: { en: 'Climate', fr: 'Climatisation', de: 'Klimatisierung', es: 'Climatización' },
  on: { en: 'On', fr: 'En marche', de: 'An', es: 'Encendida' },
  off: { en: 'Off', fr: 'Arrêtée', de: 'Aus', es: 'Apagada' },
  position: { en: 'Position', fr: 'Position', de: 'Position', es: 'Posición' },
  atHome: { en: 'At home', fr: 'À la maison', de: 'Zu Hause', es: 'En casa' },
  awayFrom: {
    en: '{km} km from home',
    fr: 'À {km} km de la maison',
    de: '{km} km von zu Hause',
    es: 'A {km} km de casa',
  },
  warnings: { en: 'Warnings', fr: 'Alertes', de: 'Warnungen', es: 'Alertas' },
  connection: { en: 'Connection', fr: 'Connexion', de: 'Verbindung', es: 'Conexión' },
  carOffline: {
    en: 'Car offline, old values',
    fr: 'Voiture hors ligne',
    de: 'Fahrzeug offline',
    es: 'Coche sin conexión',
  },
  updated: { en: 'Updated', fr: 'Mis à jour', de: 'Aktualisiert', es: 'Actualizado' },
  ago_now: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  ago_minutes: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  ago_days: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },
  buttonLock: { en: 'Lock', fr: 'Verrouiller', de: 'Verriegeln', es: 'Cerrar' },
  buttonUnlock: { en: 'Unlock', fr: 'Déverrouiller', de: 'Entriegeln', es: 'Abrir' },
  buttonClimateStart: {
    en: 'Start climate',
    fr: 'Lancer la clim',
    de: 'Klima starten',
    es: 'Encender clima',
  },
  buttonClimateStop: {
    en: 'Stop climate',
    fr: 'Arrêter la clim',
    de: 'Klima stoppen',
    es: 'Apagar clima',
  },
  buttonFlash: {
    en: 'Flash lights',
    fr: 'Faire clignoter',
    de: 'Lichthupe',
    es: 'Destellar luces',
  },
  buttonMap: { en: 'Map', fr: 'Carte', de: 'Karte', es: 'Mapa' },
  loading: {
    en: 'Reading the car…',
    fr: 'Lecture de la voiture…',
    de: 'Fahrzeug wird gelesen…',
    es: 'Leyendo el coche…',
  },
  notReady: {
    en: 'Set up the BYD account in the integration settings.',
    fr: 'Renseignez le compte BYD dans les réglages de l’intégration.',
    de: 'Richten Sie das BYD-Konto in den Einstellungen der Integration ein.',
    es: 'Configure la cuenta BYD en los ajustes de la integración.',
  },

  // --- Commands ------------------------------------------------------------
  command_lock: { en: 'lock', fr: 'verrouillage', de: 'Verriegeln', es: 'cierre' },
  command_unlock: { en: 'unlock', fr: 'déverrouillage', de: 'Entriegeln', es: 'apertura' },
  command_climate_start: {
    en: 'climate start',
    fr: 'démarrage de la clim',
    de: 'Klimastart',
    es: 'encendido del clima',
  },
  command_climate_stop: {
    en: 'climate stop',
    fr: 'arrêt de la clim',
    de: 'Klimastopp',
    es: 'apagado del clima',
  },
  command_flash_lights: {
    en: 'flash the lights',
    fr: 'clignotement des feux',
    de: 'Lichtsignal',
    es: 'destello de luces',
  },
  command_find_car: {
    en: 'find my car',
    fr: 'localisation sonore',
    de: 'Fahrzeug finden',
    es: 'localizar coche',
  },
  commandSent: {
    en: 'Command sent ({command}): the car answers within a minute.',
    fr: 'Commande envoyée ({command}) : la voiture répond en moins d’une minute.',
    de: 'Befehl gesendet ({command}): Das Fahrzeug antwortet innerhalb einer Minute.',
    es: 'Comando enviado ({command}): el coche responde en menos de un minuto.',
  },
  commandDone: {
    en: 'Done: {command}.',
    fr: 'Fait : {command}.',
    de: 'Erledigt: {command}.',
    es: 'Hecho: {command}.',
  },
  commandFailed: {
    en: 'Not carried out: {command} (car asleep, offline or refusing).',
    fr: 'Non exécuté : {command} (voiture endormie, hors ligne ou refus).',
    de: 'Nicht ausgeführt: {command} (Fahrzeug schläft, offline oder lehnt ab).',
    es: 'No ejecutado: {command} (coche dormido, sin conexión o rechazo).',
  },
  noPin: {
    en: 'Commands need the remote control PIN of the BYD app (settings of the integration).',
    fr: 'Les commandes demandent le code PIN de commande de l’app BYD (réglages de l’intégration).',
    de: 'Befehle benötigen die Fernsteuerungs-PIN der BYD-App (Einstellungen der Integration).',
    es: 'Los comandos necesitan el PIN de control remoto de la app BYD (ajustes de la integración).',
  },
  pinInvalid: {
    en: 'The remote control PIN must be made of digits only (6 in the BYD app).',
    fr: 'Le code PIN de commande ne doit contenir que des chiffres (6 dans l’app BYD).',
    de: 'Die Fernsteuerungs-PIN darf nur aus Ziffern bestehen (6 in der BYD-App).',
    es: 'El PIN de control remoto solo debe contener cifras (6 en la app BYD).',
  },
  pinRefused: {
    en: 'The BYD cloud refused the PIN: commands are stopped until it is changed in the settings (retrying would lock remote control).',
    fr: 'Le cloud BYD a refusé le code PIN : commandes suspendues jusqu’à sa modification dans les réglages (réessayer bloquerait la commande à distance).',
    de: 'Die BYD-Cloud hat die PIN abgelehnt: Befehle gestoppt, bis sie in den Einstellungen geändert wird (erneute Versuche würden die Fernsteuerung sperren).',
    es: 'La nube de BYD rechazó el PIN: comandos detenidos hasta cambiarlo en los ajustes (reintentar bloquearía el control remoto).',
  },

  // --- Connection status and actions -------------------------------------------
  statusNotConfigured: {
    en: 'Enter the e-mail address and the password of the BYD app account.',
    fr: 'Saisissez l’adresse e-mail et le mot de passe du compte de l’app BYD.',
    de: 'Geben Sie E-Mail-Adresse und Passwort des Kontos der BYD-App ein.',
    es: 'Introduzca el correo electrónico y la contraseña de la cuenta de la app BYD.',
  },
  statusBadCountry: {
    en: 'No BYD server is known for the country “{country}”: enter its two-letter code (FR, DE, ES…).',
    fr: 'Aucun serveur BYD connu pour le pays « {country} » : saisissez son code à deux lettres (FR, BE, CH…).',
    de: 'Für das Land „{country}“ ist kein BYD-Server bekannt: Geben Sie seinen Zweibuchstabencode ein (DE, AT, CH…).',
    es: 'No se conoce ningún servidor BYD para el país «{country}»: introduzca su código de dos letras (ES, MX, AR…).',
  },
  statusLoginRefused: {
    en: 'Sign-in refused by BYD: check the account and the country. Next attempt at {time}.',
    fr: 'Connexion refusée par BYD : vérifiez le compte et le pays. Prochain essai à {time}.',
    de: 'Anmeldung von BYD abgelehnt: Prüfen Sie Konto und Land. Nächster Versuch um {time}.',
    es: 'Inicio de sesión rechazado por BYD: compruebe la cuenta y el país. Próximo intento a las {time}.',
  },
  statusBusy: {
    en: 'The BYD cloud is busy: next attempt at the next reading.',
    fr: 'Le cloud BYD est saturé : nouvel essai à la prochaine lecture.',
    de: 'Die BYD-Cloud ist ausgelastet: neuer Versuch beim nächsten Lesen.',
    es: 'La nube de BYD está saturada: nuevo intento en la próxima lectura.',
  },
  statusUnreachable: {
    en: 'The BYD cloud cannot be reached: next attempt in a few minutes.',
    fr: 'Le cloud BYD est injoignable : nouvel essai dans quelques minutes.',
    de: 'Die BYD-Cloud ist nicht erreichbar: neuer Versuch in einigen Minuten.',
    es: 'No se puede acceder a la nube de BYD: nuevo intento en unos minutos.',
  },
  statusConnected: {
    en: 'Connected to the BYD cloud: {count} car(s).',
    fr: 'Connecté au cloud BYD : {count} voiture(s).',
    de: 'Mit der BYD-Cloud verbunden: {count} Fahrzeug(e).',
    es: 'Conectado a la nube de BYD: {count} coche(s).',
  },
  statusConnectedReadOnly: {
    en: 'Connected to the BYD cloud: {count} car(s), read only (no remote control PIN).',
    fr: 'Connecté au cloud BYD : {count} voiture(s), en lecture seule (pas de code PIN de commande).',
    de: 'Mit der BYD-Cloud verbunden: {count} Fahrzeug(e), nur Lesen (keine Fernsteuerungs-PIN).',
    es: 'Conectado a la nube de BYD: {count} coche(s), solo lectura (sin PIN de control remoto).',
  },
  statusPinRefused: {
    en: 'Connected: {count} car(s), but the PIN was refused, commands stopped. Change it in the settings.',
    fr: 'Connecté : {count} voiture(s), mais le PIN a été refusé, commandes suspendues. Modifiez-le dans les réglages.',
    de: 'Verbunden: {count} Fahrzeug(e), aber die PIN wurde abgelehnt, Befehle gestoppt. Ändern Sie sie in den Einstellungen.',
    es: 'Conectado: {count} coche(s), pero el PIN fue rechazado, comandos detenidos. Cámbielo en los ajustes.',
  },
  noVehicle: {
    en: 'No car on this BYD account.',
    fr: 'Aucune voiture sur ce compte BYD.',
    de: 'Kein Fahrzeug in diesem BYD-Konto.',
    es: 'Ningún coche en esta cuenta BYD.',
  },
  testConnected: {
    en: 'Connected. Cars: {list}.',
    fr: 'Connecté. Voitures : {list}.',
    de: 'Verbunden. Fahrzeuge: {list}.',
    es: 'Conectado. Coches: {list}.',
  },
  refreshed: {
    en: '{count} car(s) read.',
    fr: '{count} voiture(s) lue(s).',
    de: '{count} Fahrzeug(e) gelesen.',
    es: '{count} coche(s) leído(s).',
  },
  diagnosticDone: {
    en: 'Diagnostic of {count} car(s) written to the Logs tab ({list}). Copy the lines starting with “BYD diagnostic” into your report: VIN, plate, nickname and position are left out.',
    fr: 'Diagnostic de {count} voiture(s) écrit dans l’onglet Journaux ({list}). Copiez les lignes commençant par « BYD diagnostic » dans votre retour : VIN, plaque, surnom et position en sont retirés.',
    de: 'Diagnose von {count} Fahrzeug(en) in den Tab Protokolle geschrieben ({list}). Kopieren Sie die Zeilen mit „BYD diagnostic“ in Ihre Meldung: VIN, Kennzeichen, Spitzname und Position sind entfernt.',
    es: 'Diagnóstico de {count} coche(s) escrito en la pestaña Registros ({list}). Copie las líneas que empiezan por «BYD diagnostic» en su informe: VIN, matrícula, apodo y posición se omiten.',
  },
  transportOffline: {
    en: 'The car is offline for the BYD cloud: values may be old, commands may not reach it.',
    fr: 'La voiture est hors ligne pour le cloud BYD : valeurs peut-être anciennes, commandes peut-être pas transmises.',
    de: 'Das Fahrzeug ist für die BYD-Cloud offline: Werte können veraltet sein, Befehle es nicht erreichen.',
    es: 'El coche está sin conexión para la nube de BYD: los valores pueden ser antiguos y los comandos no llegar.',
  },
};

/**
 * @description The text of a key in a language, values substituted.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language (English fallback).
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('summaryLocked', 'fr', { car: 'BYD ATTO 3' }); // -> 'BYD ATTO 3 est verrouillée.'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description A multi-language message built language by language.
 * @param {Function} build - `(language) => string`.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function each(build) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));
}

/**
 * @description The text in every language.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function all(key, values = {}) {
  return each((language) => t(key, language, values));
}

/**
 * @description The label of a warning key.
 * @param {string} warning - The key (vehicle.js WARNINGS).
 * @param {string} language - The language.
 * @returns {string} The label.
 */
function warningLabel(warning, language) {
  const key = `warning_${warning}`;
  return TEXTS[key] ? t(key, language) : t('warning_other', language);
}

/**
 * @description A list of openings, "front left door, trunk".
 * @param {string[]} openings - The opening names.
 * @param {string} language - The language.
 * @returns {string} The list.
 */
function openingsLabel(openings, language) {
  return openings.map((name) => t(`opening_${name}`, language)).join(', ');
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

export { LANGUAGES, TEXTS, t, all, each, warningLabel, openingsLabel, ago };
