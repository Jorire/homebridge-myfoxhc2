# Homebridge Myfox HC2 plugin
Homebridge plugin for exposing Myfox HC2 alarm system.

# Installation
````
[sudo] npm install -g --unsafe-perm homebridge-myfoxhc2
````
or using homebridge plugin interface.
See [https://github.com/homebridge/homebridge#installing-plugins@](HomeBridge Documentation).

# Configuration
Go to [https://api.myfox.me/dev/authentication](myfox API Authentication), section *Get a token*.
`Client ID` and `Client Secret` can be found at [https://api.myfox.me/login](myfox API - My Applications).
Obtain a fresh token like this one:
````
{"access_token":"89a8ed445434319af322323033aae855ae53d2","expires_in":3600,"token_type":"Bearer","scope":null,"refresh_token":"b13323423426768686864433546633636332f944"}
````
You will need to extract the `refresh_token`.
On your Homebridge installation, go to Plugins and access `Homebridge Myfox HC2 Plugin` settings.
Client id, Client secret and Refresh token are mandatory !

# Customization
At startup the plugin will list all available devices and scenarios.
To customize them (show/hide, override type, ...), you will need each Site identifier and Device identifier.
Logs: 
````
[21/05/2020 à 08:16:20] Homebridge is running on port 51576.
[21/05/2020 à 08:16:24] [MyfoxHC2]      Site / Alarm existing 78912 Maison ea842614-8a8b-4c3e-961d-80a588f5836a
[21/05/2020 à 08:16:25] [MyfoxHC2]      Electric device hidden 78912 556677 Prise Salle à manger 9a0b97b2-23f7-4336-bb6e-68e121e16984
[21/05/2020 à 08:16:25] [MyfoxHC2]      Electric device existing 78912 555479 Prise Bureau c5c06a79-bf00-4a2a-805f-426055bcef88
[21/05/2020 à 08:16:25] [MyfoxHC2]      Electric device existing 78912 325677 Prise Caméra 1f6a2321-f5fb-4120-a43c-cbd35b6d69b6
[21/05/2020 à 08:16:27] [MyfoxHC2]      Scenario hidden 78912 489945 Déclenchement sirène b899adce-84e0-4001-94ff-395773df1b12
````

`78912` is Site identifier and `556677` is the Device identifier for an outlet named *Prise Salle à manger*.


