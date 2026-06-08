# Relazione del Progetto — Programmazione Web e Mobile
## Piattaforma per la Gestione di Ricette di Cucina (PGRC)

**Studente:** Alberto Stanzani  
**Anno Accademico:** 2024/2025  
**Corso:** Programmazione Web e Mobile  
**Docente:** Prof. Valerio Bellandi

---

## Indice

1. [Introduzione e obiettivi](#1-introduzione-e-obiettivi)
2. [Analisi dei requisiti](#2-analisi-dei-requisiti)
3. [Architettura generale](#3-architettura-generale)
4. [Struttura e organizzazione dei file](#4-struttura-e-organizzazione-dei-file)
5. [Progettazione delle pagine web](#5-progettazione-delle-pagine-web)
6. [Sorgente dati: TheMealDB API](#6-sorgente-dati-themealdb-api)
7. [Gestione del Web Storage](#7-gestione-del-web-storage)
8. [Implementazione delle funzionalità](#8-implementazione-delle-funzionalit%C3%A0)
9. [Presentazione e stile (CSS + Bootstrap)](#9-presentazione-e-stile-css--bootstrap)
10. [Scelte implementative e motivazioni](#10-scelte-implementative-e-motivazioni)
11. [Limitazioni note](#11-limitazioni-note)
12. [Conclusioni](#12-conclusioni)

---

## 1. Introduzione e obiettivi

Il presente documento descrive la progettazione e l'implementazione dell'applicazione web denominata **PGRC — Piattaforma per la Gestione di Ricette di Cucina**, sviluppata come progetto d'esame per il corso di Programmazione Web e Mobile dell'anno accademico 2024/2025.

L'obiettivo del progetto è realizzare una web application interattiva, completamente client-side, che consenta a utenti registrati di:

- cercare ricette culinarie attingendo da una sorgente dati esterna (TheMealDB);
- gestire un ricettario personale con note private associate a ogni ricetta;
- recensire le ricette esprimendo una valutazione su difficoltà e gusto, accompagnata dalla data in cui il piatto è stato preparato;
- gestire il proprio profilo utente (registrazione, modifica dati, cancellazione account).

L'intera applicazione è stata sviluppata rispettando il paradigma di **separazione tra struttura e presentazione**: il contenuto semantico è definito in HTML5, lo stile visivo in CSS3 (con il framework Bootstrap 5), e la logica interattiva in JavaScript puro (ES6+), senza l'utilizzo di framework aggiuntivi come React, Angular o Vue.

---

## 2. Analisi dei requisiti

La specifica del progetto individua quattro macro-scenari principali, qui analizzati in dettaglio con la corrispondente copertura implementativa.

### 2.1 Gestione del profilo utente

Il primo macro-scenario richiede la gestione classica di un profilo utente. In particolare:

- **Registrazione**: l'utente inserisce username, indirizzo email, password e piatti preferiti. Alla registrazione viene creato automaticamente un ricettario personale vuoto associato all'account.
- **Login**: l'utente accede inserendo username e password. La sessione è mantenuta tramite `sessionStorage`.
- **Modifica dati**: l'utente autenticato può aggiornare email, password e piatti preferiti dalla propria area personale.
- **Rimozione profilo**: l'utente può eliminare il proprio account. L'operazione è irreversibile e comporta la pulizia di ricettario, recensioni associate e dati di sessione.

### 2.2 Ricerca di ricette culinarie

Il secondo macro-scenario richiede la possibilità di cercare ricette tramite diversi criteri:

- **Ricerca per nome**: ricerca full-text sul nome del piatto tramite l'API TheMealDB.
- **Ricerca per ingrediente**: ricerca filtrando per ingrediente principale, tramite endpoint dedicato dell'API.
- **Filtro per categoria**: selezione da menù a tendina popolato dinamicamente dalle categorie disponibili in TheMealDB.
- **Filtro per area geografica**: selezione da menù a tendina popolato dinamicamente con le aree geografiche disponibili.
- **Visualizzazione di tutte le ricette**: in assenza di criteri attivi, l'applicazione mostra l'intero catalogo, scaricato in parallelo iterando sull'alfabeto e memorizzato in cache.

Per ogni ricetta nella scheda dettagliata vengono mostrati: immagine, categoria, area di origine, lista degli ingredienti con relative misure, procedimento di preparazione, e recensioni degli utenti.

### 2.3 Gestione del ricettario personale

Il terzo macro-scenario richiede la creazione e gestione di un ricettario personale:

- L'utente può aggiungere o rimuovere una ricetta dal proprio ricettario direttamente dalla scheda dettagliata, tramite un pulsante toggle.
- Per ogni ricetta nel ricettario è possibile inserire una **nota testuale privata**, non visibile agli altri utenti, salvata in `localStorage`.
- Il ricettario è visualizzabile nell'area personale, dove ogni card mostra il nome della ricetta (con link alla scheda), la textarea della nota e il pulsante di salvataggio.

### 2.4 Recensioni delle ricette

Il quarto macro-scenario prevede la possibilità di recensire le ricette:

- Ogni utente autenticato può lasciare **una sola recensione per ricetta**, specificando:
  - la **data di preparazione** del piatto (campo obbligatorio `<input type="date">`);
  - un **voto da 1 a 5 per la difficoltà**;
  - un **voto da 1 a 5 per il gusto**.
- L'utente può **modificare** la propria recensione (il form viene precompilato con i valori esistenti) oppure **eliminarla**.
- Le recensioni di tutti gli utenti sono visibili nella scheda di ogni ricetta, con nome utente, data di preparazione, data di recensione e valutazioni a stelle.

---

## 3. Architettura generale

L'applicazione adotta un'architettura **MPA (Multi-Page Application)** con quattro pagine HTML distinte. Non viene usato alcun router client-side: la navigazione avviene tramite normali link HTML e redirect JavaScript (`window.location.href`).

La logica JavaScript è suddivisa in livelli sovrapposti e caricati in sequenza:

```
┌─────────────────────────────────────────────┐
│  Controller di pagina (home.js, recipe.js…) │  ← manipola il DOM
├─────────────────────────────────────────────┤
│  auth.js                                    │  ← gestisce sessione e autenticazione
├─────────────────────────────────────────────┤
│  api.js                                     │  ← comunica con TheMealDB
├─────────────────────────────────────────────┤
│  storage.js                                 │  ← astrae localStorage/sessionStorage
└─────────────────────────────────────────────┘
```

Ogni pagina HTML carica i livelli necessari nell'ordine corretto tramite tag `<script>` in coda al `<body>`. Questa scelta garantisce che il DOM sia già disponibile e che i moduli di livello inferiore siano definiti prima di quelli che li usano, senza dover ricorrere a sistemi di importazione ES Modules o bundler.

---

## 4. Struttura e organizzazione dei file

```
/
├── index.html          # Pagina di login e registrazione
├── home.html           # Pagina di ricerca ricette
├── recipe.html         # Pagina di dettaglio ricetta e recensioni
├── profile.html        # Area personale e ricettario
│
├── css/
│   ├── style.css       # Reset, variabili, override Bootstrap (colore primario DarkCyan)
│   ├── home.css        # Stili specifici per le card ricette nella home
│   ├── recipe.css      # Stili specifici per l'immagine nella scheda ricetta
│   └── profile.css     # Stile per la textarea delle note nel ricettario
│
├── js/
│   ├── storage.js      # Livello dati: tutte le operazioni su localStorage
│   ├── api.js          # Livello API: wrapper degli endpoint TheMealDB
│   ├── auth.js         # Livello autenticazione: registro, login, logout, checkAuth
│   ├── login.js        # Controller: gestisce index.html
│   ├── home.js         # Controller: gestisce home.html
│   ├── recipe.js       # Controller: gestisce recipe.html
│   └── profile.js      # Controller: gestisce profile.html
│
├── screenshot/         # Schermate dimostrative del funzionamento
│
├── README.md
├── relazione.md        # Questo documento
└── PWM_ProgettoAnnoAccademico20242025.pdf
```

La separazione tra `css/` e `js/` mantiene chiara la distinzione tra presentazione e comportamento. Ogni pagina HTML ha un file CSS dedicato per gli stili specifici, oltre a `style.css` globale che contiene le variabili di colore e gli override del framework Bootstrap.

---

## 5. Progettazione delle pagine web

### 5.1 `index.html` — Login e Registrazione

La pagina di accesso presenta una singola card centrata nella viewport. Al suo interno coesistono due form, `#login-view` e `#register-view`, uno dei quali è nascosto in ogni momento tramite la classe CSS `.hidden`. Il toggle tra le due viste è gestito da due link ("Registrati" / "Accedi") che manipolano le classi senza ricaricare la pagina.

Il form di registrazione raccoglie: username, email, password (minimo 6 caratteri) e piatti preferiti (campo facoltativo). La validazione di base è delegata agli attributi HTML5 (`required`, `type="email"`, `minlength`).

Se l'utente è già autenticato (sessionStorage non vuoto), viene reindirizzato immediatamente a `home.html` prima che il DOM sia reso visibile, evitando un flash di contenuto non pertinente.

### 5.2 `home.html` — Ricerca Ricette

La pagina di ricerca è strutturata in due aree verticali:

1. **Barra di ricerca e filtri**: un input-group Bootstrap composto dal selettore del tipo di ricerca ("Per Nome" / "Per Ingrediente") e dall'input testuale, affiancati da due select per categoria e area geografica. I filtri vengono popolati dinamicamente all'avvio tramite chiamate API.

2. **Griglia risultati**: un container `<div>` con classi Bootstrap `row row-cols-*` che viene riempito dinamicamente da JavaScript. Ogni elemento è una Bootstrap Card con immagine, titolo e link alla scheda dettagliata.

La ricerca è **mutualmente esclusiva**: attivare un filtro per categoria o area svuota l'input testuale, e viceversa. La ricerca testuale è dotata di **debounce** a 500ms per limitare le chiamate API durante la digitazione.

### 5.3 `recipe.html` — Dettaglio Ricetta

La pagina riceve l'ID della ricetta come parametro query string (`?id=XXXXX`) e costruisce l'intera sezione dettaglio dinamicamente via JavaScript al caricamento.

La struttura della pagina comprende due card principali (entrambe contenute nel `<main>`):

1. **Card dettaglio ricetta** (`#recipe-detail-container`): header con immagine e informazioni principali (titolo, badge categoria e area, pulsante ricettario), seguita da una riga a due colonne con ingredienti a sinistra e procedimento a destra.

2. **Card recensioni** (`#reviews-section`): lista delle recensioni esistenti (con stelle visuali, date e username), seguita dal form di inserimento recensione con i campi data di preparazione, difficoltà e gusto.

Il pulsante ricettario è implementato come toggle: il testo, il colore e l'icona cambiano dinamicamente in base allo stato corrente (nella/non nella raccolta personale).

### 5.4 `profile.html` — Area Personale

La pagina è divisa in due sezioni verticali:

1. **Card dati utente** (`#profile-details`): visualizza username, email e piatti preferiti. Contiene un form di modifica nascosto, attivabile tramite il pulsante "Modifica Dati". Il pulsante "Rimuovi Profilo" apre una finestra di conferma nativa del browser prima di procedere.

2. **Card ricettario** (`#my-cookbook`): griglia Bootstrap che mostra una card per ogni ricetta nel ricettario. Ogni card include il nome della ricetta linkato alla scheda, una textarea per le note private, e un pulsante "Salva Nota" con feedback visivo inline ("Salvato!" che scompare dopo 2 secondi).

---

## 6. Sorgente dati: TheMealDB API

Tutte le informazioni sulle ricette sono acquisite tramite le API REST pubbliche di **TheMealDB** (`https://www.themealdb.com/api/json/v1/1/`). Il modulo `api.js` centralizza tutte le chiamate HTTP in un oggetto `api` con i seguenti metodi:

| Metodo | Endpoint | Uso |
|---|---|---|
| `filterByStartLetter(letter)` | `search.php?f={letter}` | Caricamento completo catalogo (A–Z) |
| `searchByName(name)` | `search.php?s={name}` | Ricerca per nome piatto |
| `searchByIngredient(ingredient)` | `filter.php?i={ingredient}` | Ricerca per ingrediente |
| `lookupById(id)` | `lookup.php?i={id}` | Recupero dettagli singola ricetta |
| `listAllCategories()` | `categories.php` | Popolamento filtro categorie |
| `listAllAreas()` | `list.php?a=list` | Popolamento filtro aree geografiche |
| `filterByCategory(category)` | `filter.php?c={category}` | Filtro per categoria |
| `filterByArea(area)` | `filter.php?a={area}` | Filtro per area geografica |

Ogni metodo è implementato tramite la funzione privata `fetchFromApi(endpoint)`, che gestisce uniformemente gli errori HTTP con un blocco `try/catch`, restituendo `null` in caso di fallimento senza propagare eccezioni al controller.

### Gestione degli ingredienti

L'API TheMealDB restituisce gli ingredienti in un formato non convenzionale: ogni ricetta ha 20 coppie di campi `strIngredient1`/`strMeasure1`, ..., `strIngredient20`/`strMeasure20`. Il controller `recipe.js` itera su tutti e 20 i possibili indici, filtrando le voci con ingrediente non vuoto, e costruisce la lista in formato leggibile (`"misura ingrediente"`).

---

## 7. Gestione del Web Storage

La persistenza dei dati è interamente affidata al Web Storage del browser. Il modulo `storage.js` astrae tutte le operazioni di lettura e scrittura, esponendo funzioni specifiche per ogni entità.

### 7.1 Struttura dati in localStorage

**Chiave `pgrc_users`** — Array di oggetti utente:
```json
[
  {
    "id": "user_1712345678900",
    "username": "mario_rossi",
    "email": "mario@example.com",
    "password": "mypassword",
    "favoriteDishes": "Pizza, Risotto, Tiramisù"
  }
]
```

**Chiave `pgrc_cookbooks`** — Oggetto indicizzato per ID utente:
```json
{
  "user_1712345678900": [
    { "mealId": "52772", "notes": "Ottima con pasta integrale." },
    { "mealId": "52834", "notes": "" }
  ]
}
```

**Chiave `pgrc_reviews`** — Oggetto indicizzato per ID pasto:
```json
{
  "52772": [
    {
      "userId": "user_1712345678900",
      "username": "mario_rossi",
      "preparationDate": "2025-03-15",
      "date": "2025-03-16T14:32:00.000Z",
      "difficulty": 3,
      "taste": 5
    }
  ]
}
```

**Chiave `pgrc_meals_cache`** — Cache del catalogo ricette:
```json
{
  "timestamp": 1712345678900,
  "meals": [ { "idMeal": "52772", "strMeal": "Teriyaki Chicken Casserole", ... } ]
}
```

**Chiave `pgrc_loggedInUser`** (sessionStorage) — ID utente corrente:
```
"user_1712345678900"
```

### 7.2 Cache delle ricette

Caricare l'intero catalogo TheMealDB richiede 26 chiamate HTTP in parallelo (una per lettera dell'alfabeto). Per evitare di ripetere questa operazione a ogni visita, il risultato viene serializzato in JSON e salvato in `localStorage` con un timestamp. Ad ogni caricamento della home, la funzione `getMealsCache()` verifica se la cache esiste e se il timestamp è più recente di 1 ora (3.600.000 ms). In caso affermativo, i dati vengono serviti dalla cache; altrimenti si effettua un nuovo fetch e la cache viene aggiornata.

Questo meccanismo rispetta il requisito del documento di specifica che richiede esplicitamente che i dati siano "scaricati dalle API di TheMealDB, memorizzati nel web storage, e visualizzati nell'applicazione web".

### 7.3 Sessione utente

La sessione è gestita tramite `sessionStorage` (non `localStorage`) in modo che venga automaticamente invalidata alla chiusura del browser. Al login, viene salvato l'ID dell'utente sotto la chiave `pgrc_loggedInUser`. La funzione `auth.checkAuth()`, chiamata all'inizio di ogni pagina protetta, verifica la presenza di questa chiave e reindirizza a `index.html` in caso di assenza, implementando una protezione di accesso senza back-end.

---

## 8. Implementazione delle funzionalità

### 8.1 Registrazione e Login

Il processo di registrazione esegue due validazioni lato client prima di persistere i dati:
1. Controllo unicità dello username (confronto case-insensitive su tutti gli utenti esistenti).
2. Controllo unicità dell'email (confronto case-insensitive).

In caso di successo, il nuovo utente viene aggiunto all'array `pgrc_users` e viene creata una entry vuota in `pgrc_cookbooks`. Immediatamente dopo la registrazione viene eseguito automaticamente il login, evitando all'utente di dover inserire nuovamente le credenziali.

Il login esegue una ricerca nell'array degli utenti confrontando username (case-insensitive) e password. In caso di match, l'ID utente viene salvato in `sessionStorage`.

**Nota sulla sicurezza:** Le password sono salvate in chiaro nel `localStorage`. In un'applicazione reale ciò sarebbe inaccettabile; tuttavia, trattandosi di un'applicazione puramente client-side senza back-end, non è possibile implementare un hashing sicuro (come bcrypt) lato server. Questa limitazione è intrinseca all'architettura scelta e viene accettata nel contesto del progetto universitario.

### 8.2 Ricerca e filtri nella Home

La ricerca è implementata con quattro modalità mutuamente esclusive, gestite dalla funzione asincrona `performSearch()`:

1. **Filtro categoria attivo**: chiamata `api.filterByCategory()`.
2. **Filtro area attivo**: chiamata `api.filterByArea()`.
3. **Testo inserito, tipo "nome"**: chiamata `api.searchByName()`.
4. **Testo inserito, tipo "ingrediente"**: chiamata `api.searchByIngredient()`.
5. **Nessun filtro attivo**: caricamento completo del catalogo tramite `loadAllMeals()` (con cache).

Quando l'utente attiva un filtro a tendina, l'input testuale viene svuotato e viceversa, per garantire la mutua esclusività. La ricerca testuale utilizza un meccanismo di **debounce** (ritardo di 500ms) implementato con `setTimeout`/`clearTimeout`, per evitare di inviare una chiamata API a ogni singola lettera digitata.

### 8.3 Scheda Ricetta e Ricettario

Al caricamento di `recipe.html`, l'ID viene letto dai parametri URL tramite `URLSearchParams`. Viene poi chiamato `api.lookupById()` e il contenuto della card viene generato dinamicamente via `innerHTML`.

Il pulsante di aggiunta/rimozione dal ricettario accede all'oggetto `pgrc_cookbooks` in localStorage, trova il ricettario dell'utente corrente tramite il suo ID, e aggiunge o rimuove la ricetta (identificata da `mealId`). L'aggiornamento del pulsante è immediato: classe CSS, icona Bootstrap Icons e testo cambiano senza ricaricare la pagina.

### 8.4 Recensioni

Ogni recensione è un oggetto con cinque campi: `userId`, `username`, `preparationDate`, `date` (timestamp ISO 8601 dell'invio), `difficulty` e `taste`. Le recensioni di una ricetta sono memorizzate come array sotto la chiave `mealId` nell'oggetto `pgrc_reviews`.

La regola "un utente una recensione per ricetta" è implementata filtrando le recensioni esistenti per `userId` prima di aggiungere quella nuova, sia in fase di inserimento che di modifica. Quando l'utente ha già recensito una ricetta, il form viene precompilato con i valori salvati e viene reso visibile il pulsante "Rimuovi Recensione".

Le stelle nelle recensioni mostrate sono generate tramite Bootstrap Icons (`bi-star-fill` per le stelle piene, `bi-star` per le vuote) con la classe `text-warning` per il colore giallo, sostituendo la soluzione precedente basata su caratteri Unicode.

### 8.5 Gestione profilo e piatti preferiti

Il campo `favoriteDishes` è una stringa a testo libero separata da virgole, raccolta alla registrazione e modificabile nell'area personale. La scelta del formato stringa libera (anziché un array strutturato o una multi-select) è motivata dalla semplicità: non è necessaria nessuna elaborazione sui dati, e la leggibilità per l'utente è immediata.

L'eliminazione del profilo esegue in sequenza:
1. Rimozione dell'utente dall'array `pgrc_users`.
2. Eliminazione della chiave corrispondente in `pgrc_cookbooks`.
3. Rimozione di tutte le recensioni con `userId` corrispondente da `pgrc_reviews`.
4. Chiamata a `auth.logout()` che svuota la sessionStorage e reindirizza alla home.

---

## 9. Presentazione e stile (CSS + Bootstrap)

### 9.1 Framework Bootstrap 5.3

L'applicazione utilizza Bootstrap 5.3 caricato via CDN per tutte le pagine. Bootstrap fornisce:

- **Sistema di griglia responsivo** (`container`, `row`, `col-*`, `row-cols-*`) per adattare il layout a schermi di diverse dimensioni.
- **Navbar responsiva** con menu collassabile (hamburger) su schermi piccoli, identica in tutte le pagine protette.
- **Card** per contenitori visivi di ricette, recensioni, dettaglio ricetta, sezioni profilo.
- **Componenti form** (`form-control`, `form-select`, `form-label`, `input-group`) per uniformità visiva di tutti i form.
- **Bottoni** (`btn`, `btn-primary`, `btn-danger`, `btn-sm`) con stati hover e active.
- **Badge** per categoria e area geografica nella scheda ricetta.
- **Utility classes** per spaziatura (`mb-*`, `mt-*`, `gap-*`), testo (`text-muted`, `text-danger`, `fw-semibold`) e layout (`d-flex`, `justify-content-between`, `align-items-center`).

### 9.2 Personalizzazione del tema colore

Il colore primario di Bootstrap è stato sostituito con **DarkCyan (#008B8B)** tramite override delle variabili CSS che Bootstrap 5 espone a livello di componente. In `style.css`, le classi `.btn-primary`, `.bg-primary`, `.badge.bg-primary` e `.text-primary` vengono ridefinite usando le custom properties di Bootstrap (`--bs-btn-bg`, `--bs-btn-hover-bg`, ecc.), senza necessità di ricompilare il sorgente SASS del framework.

### 9.3 CSS specifici per pagina

Oltre a `style.css`, ogni pagina ha un file CSS dedicato per gli aspetti non coperti da Bootstrap:

- **`home.css`**: definisce l'effetto hover delle card ricette (traslazione verso l'alto e ombra amplificata) e l'altezza fissa delle immagini.
- **`recipe.css`**: imposta una media query per mantenere un aspect ratio coerente dell'immagine della ricetta su schermi desktop.
- **`profile.css`**: definisce l'altezza minima e la modalità di ridimensionamento della textarea delle note nel ricettario.

### 9.4 Bootstrap Icons 1.11

Le icone vettoriali sono fornite da Bootstrap Icons, caricate via CDN. Vengono usate per:
- icone nella navbar (casa, persona, porta di uscita, libro);
- icone nei pulsanti (freccia di accesso, persona+, segnalibro, cestino, matita, floppy disk, invio);
- **stelle di valutazione** nelle recensioni (`bi-star-fill` / `bi-star` con `text-warning`), che sostituiscono i precedenti caratteri Unicode ★/☆.

---

## 10. Scelte implementative e motivazioni

### Architettura MPA vs SPA

È stata preferita una architettura Multi-Page Application (MPA) con quattro file HTML distinti rispetto a una Single-Page Application (SPA). Questa scelta è motivata da:

- **Semplicità**: non richiede un router client-side, gestione di stati complessi o build tools.
- **Aderenza alla specifica**: il documento di progetto parla di "pagine web" al plurale e non richiede esplicitamente un'architettura SPA.
- **Separazione netta delle responsabilità**: ogni pagina ha il proprio controller JS e i propri stili specifici.

### JavaScript vanilla senza framework

La scelta di usare JavaScript puro (ES6+) senza React, Vue o altri framework è in linea con i requisiti del corso ("HTML5, CSS3 e JavaScript") e con l'indicazione esplicita di non usare React. Il codice risulta più verboso nei punti in cui si manipola il DOM, ma il comportamento è completamente trasparente e non dipende da astrazioni esterne.

### Gestione stato con localStorage

In assenza di un back-end, localStorage è l'unica opzione per la persistenza cross-sessione. La sua struttura piatta (chiave/valore stringa) è stata compensata dall'uso di JSON serializzato/deserializzato, con funzioni dedicate nel modulo `storage.js` che isolano il codice di I/O dal resto dell'applicazione.

### Cache con TTL sul catalogo ricette

Il catalogo completo TheMealDB richiede 26 chiamate API in parallelo. Effettuarle a ogni caricamento della pagina home sarebbe inefficiente e potrebbe portare a limitazioni di rate da parte del server. La cache con TTL di 1 ora bilancia freschezza dei dati e numero di richieste di rete.

### Delegazione degli eventi nel ricettario

Le card del ricettario sono generate dinamicamente da JavaScript (una per ogni ricetta salvata). Anziché aggiungere un event listener a ogni bottone "Salva Nota" durante la creazione, viene usata la **event delegation**: un singolo listener sul container padre (`#cookbook-container`) intercetta tutti i click e identifica il target tramite `e.target.closest('.save-note-btn')`. Questo approccio è più efficiente in memoria e funziona correttamente anche con elementi aggiunti dinamicamente.

### Debounce sulla ricerca testuale

La ricerca testuale è collegata all'evento `input` dell'`<input>` di ricerca, che si attiva a ogni keystroke. Per evitare di inviare una chiamata API per ogni lettera digitata, è stato implementato un debounce con `setTimeout`/`clearTimeout` a 500ms: la chiamata API viene effettuata solo se l'utente smette di digitare per almeno mezzo secondo.

---

## 11. Limitazioni note

- **Password in chiaro**: come discusso nella sezione 8.1, le password sono salvate non cifrate in localStorage. Questa limitazione è strutturale all'architettura client-only.
- **Nessun back-end**: le operazioni di autenticazione e persistenza sono simulate client-side; chiunque abbia accesso al browser può ispezionare o modificare i dati in localStorage tramite gli strumenti di sviluppo.
- **Recensioni visibili solo localmente**: le recensioni sono salvate nel localStorage del singolo browser. Non essendoci un server condiviso, le recensioni di un utente non sono visibili ad altri utenti su macchine diverse.
- **Ricettario locale**: per la stessa ragione, il ricettario e le note personali sono accessibili solo dal browser in cui sono stati creati.
- **Catalogo API dipendente da TheMealDB**: se il servizio TheMealDB non è raggiungibile, l'applicazione funziona solo parzialmente (con i dati in cache, se disponibili, o non funziona per le nuove ricerche).

---

## 12. Conclusioni

Il progetto PGRC implementa tutte le funzionalità richieste dalla specifica: gestione del profilo utente (inclusi piatti preferiti), ricerca di ricette per nome, ingrediente, categoria e area geografica, gestione del ricettario personale con note private, e sistema di recensioni con data di preparazione e valutazioni a stelle.

L'architettura è volutamente semplice e aderente ai vincoli del corso: HTML5, CSS3 e JavaScript puro, senza back-end e senza framework aggiuntivi. L'utilizzo di Bootstrap 5 ha permesso di ottenere un'interfaccia visivamente moderna e responsive senza rinunciare alla separazione struttura/presentazione richiesta dalla specifica. Il caching delle ricette in localStorage migliora le prestazioni percepite e rispetta il requisito di memorizzare i dati API nel web storage del browser.

---

*Documento generato per la discussione del progetto — A.A. 2024/2025*
