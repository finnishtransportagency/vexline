![Väyläviraston logo](https://vayla.fi/documents/25230764/35412219/vayla_sivussa_fi_sv_rgb.png)
# Viitekehysmuunnin API – Vexline

[FI]:
## Kuvaus

Vexline on [Viitekehysmuunin-rajapinnan](https://vayla.fi/documents/25230764/39766119/Viitekehysmuunnin+rajapintakuvaus.pdf/771c824f-c168-0973-e03c-881c1b04e3a9/) graafinen käyttöliittymä, jonka avulla voi muuntaa taulukkomuodossa olevia paikkatietoaineistoja sijaintiviitekehyksestä (esim. tieosoite tai kooridnaatisto) toiseen. Käyttäjä voi vaikuttaa muunnoksen lopputulokseen säätämällä käyttöliittymän parametreja.

## Ympäristön pystytys

1. [Asenna node.js](https://nodejs.org/)

2. Kloonaa Vexline repository

3. Hae ja asenna projektin tarvitsemat riippuvuudet hakemistoon, johon projekti on kloonattu

  yarn install

## Ajaminen

Ympäristömuuttujat luetaan `.env`-tiedostosta. Esimerkkitiedostosta `.env.template` voi ottaa mallia ja luoda oman `.env`-tiedoston.

Sovellus käyttää oletusarvoisesti porttia 80, jolloin koko URL on http://localhost/vexline/. Käytettävää porttia voi vaihtaa asettamalla arvo ympäristömuuttujaan `ENV_UI_PORT`.

Viitekehysmuunnin-rajapinnan osoitetta voi vaihtaa ympäristömuuttujalla `ENV_VKM_URL`.

Sovelluksen käynnistäminen vaatii juurihakemistosta löytyvän `.env`-tiedoston.

Sovellus käynnistetään komennolla:

  yarn start
  
## Docker-kontin ajaminen

Docker image voidaan rakentaa käyttäen juurikansiossa sijaitsevaa Dockerfile-tiedostoa.

  docker build -f Dockerfile -t vexline:develop --build-arg VKM_URL="https://avoinapi.vaylapilvi.fi" --build-arg APP_PATH="/vexline" --no-cache

  docker run -p 80:80 vexline:develop


[EN]:
## Description

Vexline is a graphical user interface for the [Viitekehysmuunin API](https://vayla.fi/documents/25230764/39766119/Viitekehysmuunnin+rajapintakuvaus.pdf/771c824f-c168-0973-e03c-881c1b04e3a9/), which allows for the conversion of GIS data in tabular form from one spatial reference system (e.g., road address or coordinate system) to another. The user can influence the conversion outcome by adjusting the parameters in the UI.

## Environment setup

1. [Install node.js](https://nodejs.org/)

2. Clone Vexline repository

3. Install project dependencies
  
  yarn install

## Running Vexline

Environment variables are read from the `.env` file. A template file located in the root directory can be used to create this file.

Vexline uses port 80 by default, in which case the local URL is http://localhost/vexline/. The port number and app URL can be changed through the `ENV_UI_PORT` and `ENV_APP_PATH` variables.

Starting the application requires a `.env` file located in the root directory.

To start Vexline:

  yarn start

## Running a Docker container

Docker image can be built using the Dockerfile located in the root directory.

  docker build -f Dockerfile -t vexline:develop --build-arg VKM_URL="https://avoinapi.vaylapilvi.fi" --build-arg APP_PATH="/vexline" --no-cache

  docker run -p 80:80 vexline:develop