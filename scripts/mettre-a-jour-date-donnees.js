#!/usr/bin/env node
'use strict';

/*
 * Met à jour automatiquement la date publique de data.json lors d'une livraison de données.
 * Le fuseau de Montréal est utilisé pour éviter qu'une exécution GitHub tard le soir affiche
 * déjà la date du lendemain en raison de l'heure UTC du serveur.
 */

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const FICHIER = path.join(RACINE, 'data.json');

function dateMontreal() {
  const morceaux = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const valeurs = Object.fromEntries(morceaux.map(p => [p.type, p.value]));
  return `${valeurs.year}-${valeurs.month}-${valeurs.day}`;
}

const donnees = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
const nouvelleDate = dateMontreal();

if (donnees.miseAJour === nouvelleDate) {
  console.log(`Date des données déjà à jour : ${nouvelleDate}`);
  process.exit(0);
}

donnees.miseAJour = nouvelleDate;
fs.writeFileSync(FICHIER, JSON.stringify(donnees, null, 2) + '\n', 'utf8');
console.log(`Date des données mise à jour automatiquement : ${nouvelleDate}`);
