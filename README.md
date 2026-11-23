# Pridjevi Arena Online v2

## Pokretanje lokalno
1. Instaliraj Node.js 18 ili noviji.
2. U mapi projekta pokreni `npm start`.
3. Otvori `http://localhost:3000` za učenike i `http://localhost:3000/host` za voditelja.

## Objavljivanje na Renderu
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable (preporučeno): `ADMIN_PASSWORD` = odabrana lozinka voditelja.
- Ako ne postaviš `ADMIN_PASSWORD`, početna lozinka je `pridjevi2026`.

Voditelj ulazi na `/host`, upisuje lozinku i pokreće rundu. Učenici otvaraju glavnu poveznicu, upisuju PIN i naziv tima. Ne dijelite administratorsku lozinku učenicima.

Napomena: PIN i rezultati čuvaju se u memoriji servera i resetiraju se nakon ponovnog pokretanja servisa.
