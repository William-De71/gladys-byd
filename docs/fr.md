# BYD

## Présentation

Cette intégration amène vos voitures BYD dans Gladys via le cloud de l’app **BYD** internationale (pas l’app pour la Chine) : batterie, autonomie, charge, verrouillage, portes, vitres, climatisation, pression des pneus, alertes et position. Avec le code PIN de commande de l’app, Gladys peut aussi verrouiller et déverrouiller la voiture, lancer ou arrêter la clim, faire clignoter les feux et lancer la localisation sonore.

BYD ne publie aucune API : l’intégration parle le protocole de l’app, d’après la bibliothèque libre pyBYD (utilisée par l’intégration Home Assistant). BYD peut le changer à tout moment.

## Prérequis

- Gladys Assistant 5.1.1 ou plus récent.
- Une voiture BYD reliée à l’app BYD, et l’adresse e-mail et le mot de passe du compte de l’app.
- Conseillé : un second compte BYD avec qui la voiture est partagée (le partage se fait depuis l’app). L’app peut déconnecter votre téléphone quand Gladys se connecte avec le même compte.
- Pour les commandes : le **code PIN de commande** à 6 chiffres défini dans l’app BYD par le compte qu’utilise Gladys (un compte partagé définit le sien).

## Configuration

| Champ                  | Rôle                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Adresse e-mail         | Le compte de l’app BYD.                                                                             |
| Mot de passe           | Son mot de passe, stocké comme secret.                                                              |
| Pays du compte         | Code à deux lettres du pays où le compte a été créé (FR, BE, CH…) : il choisit le serveur.          |
| Code PIN de commande   | Les 6 chiffres de l’app. Vide : lecture seule.                                                      |
| Intervalle de lecture  | 5 à 480 minutes (15 par défaut). Chaque lecture réveille la voiture et consomme un peu de batterie. |
| Température de la clim | 15 à 31 °C, demandée quand la clim est lancée depuis Gladys.                                        |
| Durée de la clim       | 10, 15, 20, 25 ou 30 minutes.                                                                       |
| Rayon du domicile      | Sous cette distance d’une maison de Gladys (avec une position), la voiture est à la maison.         |
| Langue des textes      | Langue des noms, des états et des résumés de scènes.                                                |

Enregistrez, puis cliquez sur **Tester la connexion** : il liste les voitures du compte.

## Utilisation

### Appareils

Dans **Découvrir**, ajoutez vos voitures. Chaque voiture propose les fonctionnalités qu’elle remonte : batterie, autonomie électrique (et carburant pour les hybrides rechargeables), compteur kilométrique, câble de charge, état de la charge, temps avant charge complète, température intérieure, verrouillage, portes et coffre, vitres, climatisation, pression des quatre pneus (en bar), alertes et distance du domicile. Relancez un scan après un premier trajet s’il manque une fonctionnalité.

Le verrouillage et la clim sont des commandes : elles demandent le PIN. Une commande part en arrière-plan ; la voiture répond en moins d’une minute et elle est relue 30 secondes plus tard.

### Widget de tableau de bord

Le widget **Voiture BYD** montre la photo du modèle, la batterie, l’autonomie, le verrouillage, les ouvrants, la charge, la température intérieure, la clim, la position, les alertes et l’âge des données, avec des boutons pour verrouiller ou déverrouiller, lancer ou arrêter la clim, faire clignoter les feux et ouvrir la carte.

![Deux cartes du widget BYD : une voiture en charge à la maison, une garée en ville (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-byd/main/docs/assets/widgets.fr.png)

### Scènes

Déclencheurs : verrouillée ou déverrouillée, verrouillée mais ouverte, charge démarrée ou arrêtée, câble branché ou débranché, arrivée ou départ de la maison, voyant d’alerte allumé, problème de compte. Actions : envoyer une commande (attend la voiture), lire l’état de la voiture.

- Quand la voiture arrive à la maison → envoyer « Branche la voiture : {{triggerEvent.data.battery_level}} % ».
- Quand la voiture est verrouillée mais ouverte → envoyer {{triggerEvent.data.summary}}.
- Chaque matin de semaine à 7 h 40 → envoyer la commande « Lancer la climatisation ».

### Transport

Tout passe par le cloud BYD de votre région (badge **cloud**). Un point orange signifie que BYD voit la voiture hors ligne : les valeurs peuvent être anciennes.

## Dépannage

- **Connexion refusée** : vérifiez l’adresse e-mail, le mot de passe et le pays. Après un refus, l’intégration attend 15 minutes (puis 30, jusqu’à 4 heures) avant de réessayer, pour que BYD ne bloque pas le compte ; enregistrer la configuration relance un essai tout de suite.
- **PIN refusé** : toutes les commandes s’arrêtent jusqu’à ce que vous changiez le PIN dans la configuration. Des PIN erronés répétés bloquent la commande à distance de la voiture pour la journée.
- **Votre téléphone a été déconnecté** : utilisez un second compte avec qui la voiture est partagée.
- **Valeurs anciennes, « voiture hors ligne »** : la voiture n’a pas de réseau mobile (parking souterrain) ou dort profondément ; les commandes peuvent échouer jusqu’à sa reconnexion.
- **Une valeur manque ou semble fausse** : cliquez sur **Diagnostic** dans la configuration, puis copiez les lignes commençant par « BYD diagnostic » de l’onglet Journaux dans une issue GitHub (VIN, plaque et position en sont retirés).
