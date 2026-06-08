/**
 * =============================================================================
 * auth.js — Livello autenticazione: registrazione, login, logout, sessione
 * =============================================================================
 *
 * Questo modulo gestisce tutto ciò che riguarda l'identità dell'utente.
 * Viene caricato DOPO storage.js (da cui usa getUsers, saveUsers, getCookbooks,
 * saveCookbooks) e PRIMA dei controller di pagina.
 *
 * DIPENDENZE (devono essere caricate prima di questo script):
 *   - storage.js  (getUsers, saveUsers, getCookbooks, saveCookbooks)
 *
 * ESPONE GLOBALMENTE:
 *   - La costante LOGGED_IN_USER_KEY (usata anche da login.js per il check iniziale)
 *   - L'oggetto `auth` con i metodi: register, login, logout, getCurrentUser, checkAuth
 *
 * =============================================================================
 * COME FUNZIONA LA SESSIONE (sessionStorage):
 * =============================================================================
 *
 * Al login, viene salvato l'ID dell'utente in sessionStorage sotto la chiave
 * "pgrc_loggedInUser". sessionStorage (a differenza di localStorage) viene
 * automaticamente svuotato quando il browser o la scheda vengono chiusi.
 * Questo simula il comportamento di una sessione web tradizionale.
 *
 * DEVTOOLS — Sessione attiva:
 *   Application → Archiviazione di sessione → [sito corrente]
 *   Chiave: pgrc_loggedInUser
 *   Valore: "user_1712345678900" (esempio di ID generato al momento della registrazione)
 *
 * DEVTOOLS — Dopo il logout:
 *   La chiave pgrc_loggedInUser scomparirà da sessionStorage.
 *   localStorage rimarrà intatto (utente, ricettario, recensioni non vengono cancellati).
 *
 * FLUSSO COMPLETO DI AUTENTICAZIONE:
 *
 *   REGISTRAZIONE:
 *     1. login.js legge i campi del form (username, email, password, favoriteDishes)
 *     2. Chiama auth.register(username, email, password, favoriteDishes)
 *     3. auth.register valida unicità username/email → salva utente → crea ricettario vuoto
 *     4. login.js chiama auth.login() automaticamente → redirect a home.html
 *
 *   LOGIN:
 *     1. login.js legge username e password dal form
 *     2. Chiama auth.login(username, password)
 *     3. auth.login trova l'utente, salva l'ID in sessionStorage → redirect a home.html
 *
 *   PROTEZIONE PAGINE:
 *     1. Ogni pagina protetta (home, recipe, profile) chiama auth.checkAuth() subito
 *     2. checkAuth legge sessionStorage → se vuoto → redirect immediato a index.html
 *     3. L'utente non autenticato non vede MAI il contenuto delle pagine protette
 *
 *   LOGOUT:
 *     1. L'utente clicca il link "Logout" nella navbar
 *     2. Il listener aggiunto da auth.js intercetta il click
 *     3. Chiama auth.logout() → svuota sessionStorage → redirect a index.html
 *
 * =============================================================================
 */

// Chiave usata in sessionStorage per memorizzare l'ID dell'utente loggato.
// È una costante globale perché viene referenziata anche da login.js
// per verificare se esiste già una sessione attiva all'apertura della pagina.
const LOGGED_IN_USER_KEY = 'pgrc_loggedInUser';

/**
 * Oggetto `auth` — esposto globalmente.
 * Contiene tutti i metodi relativi all'autenticazione e alla gestione della sessione.
 */
const auth = {

    /**
     * Registra un nuovo utente nell'applicazione.
     *
     * FLUSSO DETTAGLIATO:
     *   1. Carica l'array di tutti gli utenti esistenti da localStorage (getUsers)
     *   2. Verifica che non esista già un utente con lo stesso username
     *      (confronto case-insensitive: "Mario" e "mario" sono considerati uguali)
     *   3. Verifica che non esista già un utente con la stessa email
     *      (confronto case-insensitive)
     *   4. Crea l'oggetto nuovo utente con un ID univoco basato sul timestamp corrente
     *   5. Aggiunge il nuovo utente all'array e salva in localStorage
     *   6. Crea un ricettario vuoto per il nuovo utente in pgrc_cookbooks
     *      (l'utente inizia con un ricettario vuoto come richiesto dalla specifica)
     *   7. Restituisce { success: true, user: {...} }
     *
     * @param {string} username      - Username scelto dall'utente
     * @param {string} email         - Indirizzo email
     * @param {string} password      - Password in chiaro (limitazione architettura client-only)
     * @param {string} favoriteDishes - Piatti preferiti separati da virgola (facoltativo)
     * @returns {{success: boolean, message?: string, user?: Object}}
     *
     * DEVTOOLS — Dopo la registrazione:
     *   localStorage → pgrc_users: array con il nuovo oggetto utente
     *   localStorage → pgrc_cookbooks: { "user_XXX": [] } (ricettario vuoto)
     *
     * STRUTTURA OGGETTO UTENTE SALVATO:
     *   {
     *     "id": "user_1712345678900",   ← timestamp ms al momento della registrazione
     *     "username": "mario_rossi",
     *     "email": "mario@example.com",
     *     "password": "miapassword",    ← in chiaro (limitazione architettura)
     *     "favoriteDishes": "Pizza, Risotto"
     *   }
     */
    register: (username, email, password, favoriteDishes = '') => {
        const users = getUsers();

        // Controllo unicità username (case-insensitive)
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            return { success: false, message: 'Username già esistente.' };
        }

        // Controllo unicità email (case-insensitive)
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            return { success: false, message: 'Email già in uso.' };
        }

        // Creazione ID univoco: prefisso "user_" + millisecondi dal 1970
        // Date.now() restituisce un numero intero (es. 1712345678900)
        // La probabilità di collisione in un'app client-only è trascurabile
        const newUser = {
            id: `user_${Date.now()}`,
            username,
            email,
            password, // In un'app reale andrebbe hashata lato server (es. bcrypt)
            favoriteDishes
        };

        users.push(newUser);
        saveUsers(users); // Persiste in localStorage

        // Crea la entry del ricettario: chiave = userId, valore = array vuoto
        const cookbooks = getCookbooks();
        cookbooks[newUser.id] = [];
        saveCookbooks(cookbooks); // Persiste in localStorage

        return { success: true, user: newUser };
    },

    /**
     * Autentica un utente esistente e avvia la sessione.
     *
     * FLUSSO DETTAGLIATO:
     *   1. Carica tutti gli utenti da localStorage
     *   2. Cerca un utente con username E password corrispondenti
     *      (username case-insensitive, password case-SENSITIVE)
     *   3. Se trovato: salva l'ID utente in sessionStorage e restituisce successo
     *   4. Se non trovato: restituisce errore senza modificare lo stato
     *
     * @param {string} username - Username inserito nel form
     * @param {string} password - Password inserita nel form
     * @returns {{success: boolean, message?: string, user?: Object}}
     *
     * DEVTOOLS — Dopo il login:
     *   sessionStorage → pgrc_loggedInUser: "user_1712345678900"
     *   (il valore corrisponde all'id dell'utente trovato)
     */
    login: (username, password) => {
        const users = getUsers();

        // Array.find restituisce il primo elemento che soddisfa la condizione, o undefined
        const user = users.find(
            u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
        );

        if (user) {
            // Salva solo l'ID (non l'intero oggetto utente) per sicurezza e leggerezza
            sessionStorage.setItem(LOGGED_IN_USER_KEY, user.id);
            return { success: true, user };
        }
        return { success: false, message: 'Username o password non corretti.' };
    },

    /**
     * Termina la sessione dell'utente corrente e reindirizza al login.
     *
     * FLUSSO:
     *   1. Rimuove la chiave pgrc_loggedInUser da sessionStorage
     *      (localStorage rimane intatto: dati utente, ricettario, recensioni non toccati)
     *   2. Reindirizza immediatamente a index.html (pagina di login)
     *
     * DEVTOOLS — Dopo il logout:
     *   sessionStorage → vuoto (la chiave pgrc_loggedInUser non esiste più)
     *   localStorage → invariato (pgrc_users, pgrc_cookbooks, ecc. restano)
     */
    logout: () => {
        sessionStorage.removeItem(LOGGED_IN_USER_KEY);
        window.location.href = 'index.html';
    },

    /**
     * Restituisce l'oggetto utente completo dell'utente attualmente loggato.
     *
     * FLUSSO:
     *   1. Legge l'ID utente da sessionStorage
     *   2. Se non esiste (sessione scaduta/non avviata) → restituisce null
     *   3. Cerca l'utente nell'array localStorage tramite l'ID
     *   4. Restituisce l'oggetto utente aggiornato (importante: legge SEMPRE da
     *      localStorage, non da una variabile in memoria, così riflette eventuali
     *      modifiche fatte da profile.js senza ricaricare la pagina)
     *
     * @returns {Object|null} L'oggetto utente completo, o null se non loggato
     *
     * USO TIPICO NEI CONTROLLER:
     *   const currentUser = auth.getCurrentUser();
     *   if (!currentUser) return; // Sicurezza aggiuntiva oltre checkAuth
     */
    getCurrentUser: () => {
        const userId = sessionStorage.getItem(LOGGED_IN_USER_KEY);
        if (!userId) return null;
        // Legge sempre da localStorage per avere dati aggiornati
        return getUsers().find(u => u.id === userId) || null;
    },

    /**
     * Verifica che ci sia una sessione attiva; altrimenti reindirizza al login.
     * Chiamata come PRIMA istruzione in ogni pagina protetta (home, recipe, profile).
     *
     * FLUSSO:
     *   1. Chiama getCurrentUser()
     *   2. Se restituisce null (nessuna sessione) → redirect immediato a index.html
     *   3. Se restituisce un utente → non fa nulla, il controller prosegue
     *
     * COMPORTAMENTO ATTESO:
     *   Se si apre direttamente recipe.html o profile.html senza essere loggati,
     *   si viene reindirizzati istantaneamente a index.html.
     *   L'URL nella barra del browser cambierà prima che la pagina sia visibile.
     */
    checkAuth: () => {
        if (!auth.getCurrentUser()) window.location.href = 'index.html';
    }
};

/**
 * LISTENER GLOBALE PER IL PULSANTE LOGOUT
 *
 * Questo blocco viene eseguito quando il DOM è pronto, su TUTTE le pagine
 * che caricano auth.js (home, recipe, profile). Cerca il pulsante #logout-btn
 * nella navbar e gli aggiunge un listener per il click.
 *
 * PERCHÉ CENTRALIZZATO QUI?
 *   Tutte le pagine protette hanno la stessa navbar con #logout-btn.
 *   Anziché duplicare il listener in ogni controller (home.js, recipe.js,
 *   profile.js), lo si gestisce una volta sola qui in auth.js.
 *
 * Il pulsante logout è un <a href="#">, quindi:
 *   - e.preventDefault() impedisce al browser di seguire l'href "#"
 *     (che causerebbe un reload della pagina o aggiunta di "#" all'URL)
 *   - auth.logout() svuota sessionStorage e reindirizza
 */
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Blocca il comportamento default del link
            auth.logout();      // Termina sessione e va a index.html
        });
    }
    // NOTA: se logoutBtn è null (siamo su index.html che non ha navbar),
    // il blocco if semplicemente non esegue nulla — nessun errore.
});
