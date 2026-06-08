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
│   ├── login.js        # Controller pagina index.html
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
- Redirect automatico a `home.html` se sessione già attiva

### `home.html` — Ricerca Ricette
- Ricerca testuale con selettore **Per Nome** / **Per Ingrediente**
- Filtri a tendina per **Categoria** e **Area geografica**
- Caricamento iniziale di tutte le ricette (A–Z) con **cache localStorage** (TTL 1h)
- Griglia responsive Bootstrap di card cliccabili

### `recipe.html` — Dettaglio Ricetta
- Immagine, badge categoria/area, lista ingredienti, procedimento completo
- Pulsante **Aggiungi / Rimuovi dal Ricettario** (toggle)
- Sezione recensioni con stelle Bootstrap Icons (⭐)
- Form recensione con: data di preparazione, voto difficoltà (1–5), voto gusto (1–5)
- Un utente può avere una sola recensione per ricetta (sovrascrive)

### `profile.html` — Area Personale
- Visualizzazione dati utente (username, email, piatti preferiti)
- Form di modifica email, password e piatti preferiti
- Eliminazione account (con pulizia ricettario e recensioni)
- Ricettario personale con note private per ricetta (salvate in localStorage)

---

## Architettura JS

La logica è separata in moduli caricati in sequenza tramite tag `<script>`:

1. **`storage.js`** — livello dati: tutte le funzioni che leggono/scrivono localStorage. Espone `getUsers`, `getCookbooks`, `getReviews`, `getMealsCache`, ecc.
2. **`api.js`** — livello API: incapsula tutti gli endpoint TheMealDB in un oggetto `api`. Gestisce errori HTTP con try/catch.
3. **`auth.js`** — livello autenticazione: oggetto `auth` con `register`, `login`, `logout`, `getCurrentUser`, `checkAuth`. Inizializza anche il listener del bottone logout.
4. **`*.js` controller** — ogni pagina ha il proprio controller che legge il DOM e usa i livelli sottostanti.

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

`home.js` scarica tutte le ricette (26 chiamate per lettera A–Z) in parallelo con `Promise.all` alla prima visita, poi salva il risultato in `localStorage` con timestamp. Le visite successive entro 1 ora usano la cache senza fare chiamate di rete.

Chiave localStorage: `pgrc_meals_cache` — struttura: `{ timestamp: number, meals: Meal[] }`

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
| `pgrc_users` | Array di oggetti utente |
| `pgrc_cookbooks` | Oggetto `{ userId: [{ mealId, notes }] }` |
| `pgrc_reviews` | Oggetto `{ mealId: [{ userId, username, preparationDate, date, difficulty, taste }] }` |
| `pgrc_meals_cache` | Oggetto `{ timestamp, meals[] }` — TTL 1h |
| `pgrc_loggedInUser` *(sessionStorage)* | ID utente della sessione corrente |
