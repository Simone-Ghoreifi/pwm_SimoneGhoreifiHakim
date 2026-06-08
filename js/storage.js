/**
 * =============================================================================
 * storage.js — Livello dati: tutte le operazioni su Web Storage
 * =============================================================================
 *
 * Questo modulo è il PRIMO ad essere caricato in ogni pagina (tranne index).
 * Astrae completamente le interazioni con localStorage, esponendo funzioni
 * con nomi semantici invece di chiamare direttamente localStorage.getItem/setItem.
 * Tutti gli altri moduli (api.js, auth.js, controller) usano SOLO queste funzioni.
 *
 * STRUTTURA DATI IN LOCALSTORAGE:
 * ─────────────────────────────────────────────────────────────────
 *  pgrc_users        → Array<Utente>
 *  pgrc_cookbooks    → { [userId]: Array<{mealId, notes}> }
 *  pgrc_reviews      → { [mealId]: Array<Recensione> }
 *  pgrc_meals_cache  → { timestamp: number, meals: Array<Pasto> }
 *
 * STRUTTURA DATI IN SESSIONSTORAGE:
 * ─────────────────────────────────────────────────────────────────
 *  pgrc_loggedInUser → string (id dell'utente loggato, es. "user_1712345678900")
 *  (definito e gestito in auth.js, non qui)
 *
 * =============================================================================
 * ★ GUIDA STRUMENTI SVILUPPATORE DEL BROWSER (per la presentazione al prof)
 * =============================================================================
 *
 * COME APRIRE DEVTOOLS:
 *   Mac  → Cmd + Option + I   oppure   F12
 *   Win  → F12                oppure   Ctrl + Shift + I
 *   Alt  → tasto destro sulla pagina → "Ispeziona"
 *
 * DOVE TROVARE LOCALSTORAGE:
 *   1. Aprire DevTools → fare clic sulla scheda "Applicazione"
 *      (in inglese: "Application"; se non si vede, fare clic su ">>" nella barra tab)
 *   2. Nel pannello sinistro, espandere la sezione "Archiviazione" (o "Storage")
 *   3. Fare clic su "Archiviazione locale" (localStorage) → selezionare il sito
 *      (es. http://127.0.0.1:8080 oppure file:///...)
 *   4. Nella tabella a destra appaiono tutte le coppie chiave/valore
 *   5. Fare clic su una riga per vedere il valore espanso nel pannello inferiore
 *
 * DOVE TROVARE SESSIONSTORAGE:
 *   Stessa procedura, ma fare clic su "Archiviazione di sessione" invece di locale.
 *   Qui si vedrà la chiave "pgrc_loggedInUser" con il valore dell'ID utente
 *   SOLO quando qualcuno è loggato. Dopo il logout scompare.
 *
 * COME LEGGERE JSON FORMATTATO NELLA CONSOLE:
 *   Aprire la scheda "Console" e digitare uno di questi comandi:
 *
 *     JSON.parse(localStorage.getItem('pgrc_users'))
 *     → restituisce l'array di tutti gli utenti registrati
 *
 *     JSON.parse(localStorage.getItem('pgrc_cookbooks'))
 *     → restituisce l'oggetto con tutti i ricettari ({userId: [...]})
 *
 *     JSON.parse(localStorage.getItem('pgrc_reviews'))
 *     → restituisce l'oggetto con tutte le recensioni ({mealId: [...]})
 *
 *     JSON.parse(localStorage.getItem('pgrc_meals_cache'))
 *     → restituisce la cache delle ricette con il suo timestamp
 *
 *     sessionStorage.getItem('pgrc_loggedInUser')
 *     → restituisce l'ID dell'utente attualmente loggato (o null)
 *
 * SEQUENZA DA MOSTRARE AL PROF (per dimostrare il funzionamento):
 *
 *   PASSO 1 — Prima di qualsiasi azione:
 *     localStorage è vuoto (o ha solo pgrc_meals_cache se si è caricata la home)
 *     sessionStorage è vuoto
 *
 *   PASSO 2 — Dopo la registrazione:
 *     localStorage → pgrc_users: array con il nuovo utente
 *     localStorage → pgrc_cookbooks: oggetto con entry vuota per il nuovo userId
 *
 *   PASSO 3 — Dopo il login:
 *     sessionStorage → pgrc_loggedInUser: l'ID dell'utente (es. "user_1712345678900")
 *
 *   PASSO 4 — Dopo aver visitato la home (prima volta):
 *     localStorage → pgrc_meals_cache: oggetto enorme con timestamp + array di tutte le ricette
 *     (questo dimostra il caching: la prossima visita non fa chiamate API)
 *
 *   PASSO 5 — Dopo aver aggiunto una ricetta al ricettario:
 *     localStorage → pgrc_cookbooks: l'array del proprio userId ora contiene un elemento
 *     con {mealId: "XXXXX", notes: ""}
 *
 *   PASSO 6 — Dopo aver salvato una nota privata:
 *     localStorage → pgrc_cookbooks: il campo "notes" dell'elemento corrispondente
 *     è ora valorizzato con il testo inserito
 *
 *   PASSO 7 — Dopo aver inviato una recensione:
 *     localStorage → pgrc_reviews: oggetto con chiave = mealId, valore = array
 *     contenente l'oggetto recensione con preparationDate, difficulty, taste, ecc.
 *
 *   PASSO 8 — Dopo il logout:
 *     sessionStorage → pgrc_loggedInUser: sparisce (la chiave non esiste più)
 *     localStorage rimane intatto (i dati persistono tra sessioni)
 *
 * =============================================================================
 */

// ─── Chiavi di accesso a localStorage ────────────────────────────────────────
// Costanti centralizzate per evitare typo nelle stringhe usate come chiavi.
// Se si dovesse rinominare una chiave, basta cambiarla qui una volta sola.
const USERS_KEY = 'pgrc_users';        // Array degli utenti registrati
const COOKBOOKS_KEY = 'pgrc_cookbooks'; // Ricettari personali per userId
const REVIEWS_KEY = 'pgrc_reviews';    // Recensioni per mealId
const MEALS_CACHE_KEY = 'pgrc_meals_cache'; // Cache del catalogo TheMealDB

// TTL della cache ricette in millisecondi: 1 ora = 60 min × 60 sec × 1000 ms
const CACHE_TTL = 3600000;

// ─── Funzioni generiche (usate internamente) ──────────────────────────────────

/**
 * Legge e deserializza (JSON.parse) il valore associato a una chiave in localStorage.
 *
 * @param {string} key - La chiave da leggere
 * @returns {any|null} Il valore deserializzato, oppure null se la chiave non esiste
 *                     o se il JSON non è valido
 *
 * USO IN DEVTOOLS: questo è ciò che succede ogni volta che si chiama getUsers(),
 * getCookbooks(), ecc. — si può replicare manualmente in Console con:
 *   JSON.parse(localStorage.getItem('pgrc_users'))
 */
function getData(key) {
    try {
        const data = localStorage.getItem(key); // Legge la stringa grezza
        return data ? JSON.parse(data) : null;   // Deserializza se la stringa esiste
    } catch (error) {
        // JSON.parse può lanciare SyntaxError se il valore è corrotto.
        // In quel caso si restituisce null anziché far crashare l'app.
        console.error(`Error reading from localStorage key "${key}":`, error);
        return null;
    }
}

/**
 * Serializza (JSON.stringify) e salva un valore in localStorage.
 *
 * @param {string} key  - La chiave sotto cui salvare il valore
 * @param {any}    data - Il valore da serializzare e salvare
 *
 * NOTA: localStorage può essere pieno (quota ~5MB per origine).
 * In quel caso setItem lancia QuotaExceededError, catturato dal try/catch.
 *
 * USO IN DEVTOOLS: ogni chiamata a saveUsers(), saveCookbooks(), ecc.
 * esegue questa funzione. Dopo ogni salvataggio si può aggiornare la
 * vista localStorage in DevTools (premere F5 nella sezione Application)
 * per vedere il valore aggiornato.
 */
function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error writing to localStorage key "${key}":`, error);
    }
}

// ─── Funzioni per gli Utenti ──────────────────────────────────────────────────

/**
 * Restituisce l'array di tutti gli utenti registrati.
 * Se la chiave non esiste ancora (prima registrazione), restituisce array vuoto.
 *
 * @returns {Array<{id, username, email, password, favoriteDishes}>}
 *
 * DEVTOOLS — Console: JSON.parse(localStorage.getItem('pgrc_users'))
 */
function getUsers() { return getData(USERS_KEY) || []; }

/**
 * Sovrascrive l'intero array degli utenti in localStorage.
 * Usato da auth.register (aggiunge utente) e da profile.js (modifica/elimina utente).
 *
 * @param {Array} users - Array aggiornato di tutti gli utenti
 */
function saveUsers(users) { saveData(USERS_KEY, users); }

// ─── Funzioni per i Ricettari ─────────────────────────────────────────────────

/**
 * Restituisce l'oggetto che mappa ogni userId al suo array di ricette salvate.
 * Struttura: { "user_XXX": [{mealId:"52772", notes:"mia nota"}, ...], ... }
 *
 * @returns {Object}
 *
 * DEVTOOLS — Console: JSON.parse(localStorage.getItem('pgrc_cookbooks'))
 * → Per vedere solo il tuo ricettario:
 *   JSON.parse(localStorage.getItem('pgrc_cookbooks'))[sessionStorage.getItem('pgrc_loggedInUser')]
 */
function getCookbooks() { return getData(COOKBOOKS_KEY) || {}; }

/**
 * Sovrascrive l'intero oggetto dei ricettari in localStorage.
 * Usato da recipe.js (aggiungi/rimuovi ricetta) e da profile.js (salva nota, elimina profilo).
 *
 * @param {Object} cookbooks - Oggetto aggiornato {userId: [{mealId, notes}]}
 */
function saveCookbooks(cookbooks) { saveData(COOKBOOKS_KEY, cookbooks); }

// ─── Funzioni per le Recensioni ───────────────────────────────────────────────

/**
 * Restituisce l'oggetto che mappa ogni mealId all'array delle sue recensioni.
 * Struttura: { "52772": [{userId, username, preparationDate, date, difficulty, taste}], ... }
 *
 * @returns {Object}
 *
 * DEVTOOLS — Console: JSON.parse(localStorage.getItem('pgrc_reviews'))
 * → Per vedere le recensioni di una ricetta specifica (es. id 52772):
 *   JSON.parse(localStorage.getItem('pgrc_reviews'))['52772']
 */
function getReviews() { return getData(REVIEWS_KEY) || {}; }

/**
 * Sovrascrive l'intero oggetto delle recensioni in localStorage.
 * Usato da recipe.js (invia/elimina recensione) e da profile.js (elimina profilo).
 *
 * @param {Object} reviews - Oggetto aggiornato {mealId: [{...}]}
 */
function saveReviews(reviews) { saveData(REVIEWS_KEY, reviews); }

// ─── Funzioni per la Cache del Catalogo Ricette ───────────────────────────────

/**
 * Legge la cache del catalogo ricette e ne verifica la validità temporale.
 *
 * La cache contiene l'array di TUTTE le ricette TheMealDB (scaricate alla prima
 * visita della home iterando su tutte le 26 lettere dell'alfabeto).
 *
 * LOGICA DI VALIDAZIONE TTL:
 *   1. Legge il valore sotto la chiave pgrc_meals_cache
 *   2. Se non esiste → restituisce null (prima visita, bisogna scaricare)
 *   3. Se esiste ma il timestamp è vecchio di più di 1h → elimina la cache
 *      e restituisce null (la cache è scaduta, bisogna riscaricare)
 *   4. Se esiste ed è fresca → restituisce l'array di pasti (meals)
 *
 * @returns {Array<Pasto>|null}
 *
 * DEVTOOLS — Application → localStorage → pgrc_meals_cache
 * Il valore sarà un oggetto tipo: { "timestamp": 1712345678900, "meals": [...] }
 * Per calcolare da quante ore è vecchia:
 *   const c = JSON.parse(localStorage.getItem('pgrc_meals_cache'));
 *   console.log('Età cache (minuti):', (Date.now() - c.timestamp) / 60000);
 */
function getMealsCache() {
    const cached = getData(MEALS_CACHE_KEY);
    if (!cached) return null; // Cache assente

    if (Date.now() - cached.timestamp > CACHE_TTL) {
        // Cache scaduta: la rimuovo così home.js farà un nuovo fetch
        localStorage.removeItem(MEALS_CACHE_KEY);
        return null;
    }
    return cached.meals; // Cache valida: restituisco i dati
}

/**
 * Salva l'array di tutti i pasti in localStorage con il timestamp corrente.
 * Chiamata da home.js dopo aver scaricato tutte le ricette A-Z dalla prima volta.
 *
 * @param {Array} meals - Array di tutti gli oggetti pasto restituiti da TheMealDB
 *
 * DEVTOOLS: dopo la prima visita alla home, in localStorage apparirà la chiave
 * pgrc_meals_cache con un valore JSON molto lungo (centinaia di ricette).
 * Si può verificare con: JSON.parse(localStorage.getItem('pgrc_meals_cache')).meals.length
 */
function saveMealsCache(meals) {
    saveData(MEALS_CACHE_KEY, { timestamp: Date.now(), meals });
}
