# PGRC — Piattaforma Gestione Ricette di Cucina

Progetto universitario per il corso di **Programmazione Web e Mobile** — A.A. 2024/2025  
Autore: **Alberto Stanzani**

---

## Descrizione

PGRC è una web application client-side che permette agli utenti registrati di cercare ricette culinarie (via API TheMealDB), gestire un ricettario personale e lasciare recensioni. Tutta la persistenza avviene tramite `localStorage` / `sessionStorage` del browser, senza back-end.

---

## Struttura del progetto

```
/
├── index.html          # Login e registrazione
├── first-login.html    # Convalida UI dopo registrazione
├── home.html           # Ricerca ricette
├── recipe.html         # Dettaglio ricetta + recensioni
├── profile.html        # Area personale + ricettario
│
├── css/
│   ├── style.css       # Variabili colore + override Bootstrap (tema DarkCyan)
│   ├── home.css        # Hover card ricette
│   ├── recipe.css      # Immagine ricetta responsive
│   └── profile.css     # Textarea note ricettario
│
├── js/
│   ├── storage.js      # CRUD localStorage (utenti, ricettari, recensioni, cache API)
│   ├── api.js          # Wrapper chiamate TheMealDB REST API
│   ├── auth.js         # Registrazione, login, logout, checkAuth
│   ├── ui.js           # Componenti UI riutilizzabili (modale conferma)
│   ├── login.js        # Controller pagina index.html
│   ├── first-login.js  # Controller pagina first-login.html
│   ├── home.js         # Controller pagina home.html
│   ├── recipe.js       # Controller pagina recipe.html
│   └── profile.js      # Controller pagina profile.html
│
├── screenshot/         # Prove di funzionamento
└── Relazione Progetto programmazione web e mobile Alberto Stanzani.pdf
```

---

## Tecnologie

| Tecnologia | Uso |
|---|---|
| HTML5 | Struttura semantica delle pagine |
| CSS3 | Presentazione (separata dall'HTML) |
| JavaScript ES6+ | Logica applicativa vanilla (no framework) |
| Bootstrap 5.3 | Layout responsive, componenti UI |
| Bootstrap Icons 1.11 | Icone vettoriali |
| TheMealDB API v1 | Sorgente dati ricette (REST/JSON) |
| localStorage | Persistenza utenti, ricettari, recensioni, cache API |
| sessionStorage | Sessione utente corrente |

---

## Pagine e funzionalità

### `index.html` — Login / Registrazione
- Toggle tra form di login e form di registrazione (stessa pagina)
- Registrazione raccoglie: username, email, password, piatti preferiti
- Alla registrazione viene creato automaticamente un ricettario vuoto
- Dopo la registrazione redirect a `first-login.html`, senza auto-login
- Redirect automatico a `home.html` se sessione già attiva

### `home.html` — Ricerca Ricette
- Ricerca testuale con selettore **Per Nome** / **Per Ingrediente**
- Filtri a tendina per **Categoria**, **Area geografica** e **Lettera iniziale**
- Startup della home con cache localStorage di catalogo A–Z, categorie e aree (TTL 1h)
- Ricerche e filtri serviti prima dal catalogo in localStorage, poi dalle API come fallback
- Griglia responsive Bootstrap di card cliccabili

### `recipe.html` — Dettaglio Ricetta
- Immagine, badge categoria/area, lista ingredienti, procedimento completo
- Dettaglio ricetta letto da `pgrc_meal_details_cache` o `pgrc_meals_cache`, con API solo come fallback
- Pulsante **Aggiungi / Rimuovi dal Ricettario** (toggle)
- Sezione recensioni con stelle Bootstrap Icons (⭐)
- Form recensione con: data di preparazione, voto difficoltà (1–5), voto gusto (1–5)
- Un utente può avere una sola recensione per ricetta (sovrascrive)

### `profile.html` — Area Personale
- Visualizzazione dati utente (username, email, piatti preferiti)
- Form di modifica email, password e piatti preferiti
- Cambio password consentito solo inserendo prima la password attuale
- Eliminazione account (con pulizia ricettario e recensioni)
- Ricettario personale con note private per ricetta (salvate in localStorage)
- Card ricettario popolate da cache dettagli/catalogo, con API solo come fallback

---

## Architettura JS

La logica è separata in moduli caricati in sequenza tramite tag `<script>`:

1. **`storage.js`** — livello dati: tutte le funzioni che leggono/scrivono localStorage. Espone `getUsers`, `getCookbooks`, `getReviews`, `getMealsCache`, ecc.
2. **`api.js`** — livello API: incapsula tutti gli endpoint TheMealDB in un oggetto `api`. Gestisce errori HTTP con try/catch.
3. **`auth.js`** — livello autenticazione: oggetto `auth` con `register`, `login`, `logout`, `getCurrentUser`, `checkAuth`. Salva password come salt+hash.
4. **`ui.js`** — componenti UI condivisi, inclusa la modale di conferma riusabile per logout e rimozione profilo.
5. **`*.js` controller** — ogni pagina ha il proprio controller che legge il DOM e usa i livelli sottostanti.

### Flusso dati

```
TheMealDB API
     │  fetch (se cache scaduta/assente)
     ▼
localStorage  ◄──── storage.js ────► Controller JS
     │                                     │
     │                                     ▼
sessionStorage                          DOM HTML
(sessione utente)
```

---

## Cache API

Per startup applicativo si intende l'ingresso nella prima pagina autenticata (`home.html`): prima del login non sono necessari dati TheMealDB. `home.js` scarica tutte le ricette (26 chiamate per lettera A–Z) in parallelo con `Promise.all` alla prima visita, poi salva il risultato in `localStorage` con timestamp. Anche categorie e aree dei filtri sono salvate in cache. Le visite successive entro 1 ora usano il Web Storage senza fare chiamate di rete per catalogo e filtri.

Chiave localStorage: `pgrc_meals_cache` — struttura: `{ timestamp: number, meals: Meal[] }`

Chiavi filtri: `pgrc_categories_cache` e `pgrc_areas_cache` — struttura: `{ timestamp, categories[] }` / `{ timestamp, areas[] }`

Chiave dettagli: `pgrc_meal_details_cache` — struttura: `{ [mealId]: { timestamp, meal } }`

---

## Come aprire il progetto

Il progetto è puramente client-side: basta aprire `index.html` in un browser moderno.  
Per evitare CORS sulle chiamate API è consigliato servire i file tramite un server locale, ad esempio:

```bash
# Python 3
python3 -m http.server 8080

# oppure con VS Code Live Server
```

---

## Chiavi localStorage utilizzate

| Chiave | Contenuto |
|---|---|
| `pgrc_users` | Array di oggetti utente con `passwordSalt`, `passwordHash`, `passwordAlgorithm` |
| `pgrc_cookbooks` | Oggetto `{ userId: [{ mealId, notes }] }` |
| `pgrc_reviews` | Oggetto `{ mealId: [{ userId, username, preparationDate, date, difficulty, taste }] }` |
| `pgrc_meals_cache` | Oggetto `{ timestamp, meals[] }` — TTL 1h |
| `pgrc_categories_cache` | Oggetto `{ timestamp, categories[] }` — TTL 1h |
| `pgrc_areas_cache` | Oggetto `{ timestamp, areas[] }` — TTL 1h |
| `pgrc_meal_details_cache` | Oggetto `{ mealId: { timestamp, meal } }` — TTL 1h |
| `pgrc_loggedInUser` *(sessionStorage)* | ID utente della sessione corrente |
