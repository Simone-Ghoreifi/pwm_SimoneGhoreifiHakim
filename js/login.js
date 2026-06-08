/**
 * =============================================================================
 * login.js — Controller della pagina index.html (Login e Registrazione)
 * =============================================================================
 *
 * Questo è l'unico controller che NON chiama auth.checkAuth() all'inizio,
 * perché è la pagina pubblica di accesso — logica invertita: se l'utente
 * È già loggato, lo mandiamo via (a home.html).
 *
 * DIPENDENZE (caricate prima di questo script in index.html):
 *   - storage.js  (per LOGGED_IN_USER_KEY, che è definita in auth.js)
 *   - auth.js     (per l'oggetto auth e la costante LOGGED_IN_USER_KEY)
 *
 * STRUTTURA DI index.html GESTITA DA QUESTO CONTROLLER:
 *   #login-view    → form di login     (visibile di default)
 *   #register-view → form di signup    (nascosto di default con classe .hidden)
 *   I due form NON sono su pagine separate: si trovano entrambi nello stesso
 *   <div class="card"> e si alternano togliendo/aggiungendo la classe .hidden.
 *
 * FLUSSO COMPLETO ALLA VISITA DI index.html:
 *   1. DOMContentLoaded si attiva
 *   2. CHECK SESSIONE: se pgrc_loggedInUser esiste in sessionStorage → redirect a home.html
 *      (l'utente è già loggato, non ha senso mostrargli il login)
 *   3. Si raccolgono i riferimenti agli elementi DOM
 *   4. Si registrano 4 event listener: show-register, show-login, login-form, register-form
 *   5. La pagina attende l'input dell'utente
 *
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─── GUARDIA: redirect se sessione già attiva ─────────────────────────────
    // LOGGED_IN_USER_KEY è definita in auth.js (costante globale = 'pgrc_loggedInUser')
    // sessionStorage.getItem restituisce null se la chiave non esiste,
    // o la stringa dell'ID utente se la sessione è attiva.
    // Se la sessione è attiva, non mostriamo affatto la pagina di login.
    if (sessionStorage.getItem(LOGGED_IN_USER_KEY)) {
        window.location.href = 'home.html'; // Redirect immediato
        return; // Interrompe l'esecuzione del resto del listener
    }

    // ─── Riferimenti DOM ─────────────────────────────────────────────────────
    // I due "pannelli" che si alternano nella card
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');

    // I form HTML5 (hanno attributo action non valorizzato, vengono intercettati via JS)
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Paragrafi per messaggi di errore (inizialmente vuoti)
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');

    // ─── LISTENER: link "Registrati" (nella vista login) ─────────────────────
    // Quando l'utente clicca "Registrati":
    //   1. Nasconde il loginView aggiungendo la classe CSS .hidden
    //   2. Mostra il registerView rimuovendo la classe .hidden
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault(); // Impedisce al link <a href="#"> di fare scroll in cima
        loginView.classList.add('hidden');
        registerView.classList.remove('hidden');
    });

    // ─── LISTENER: link "Accedi" (nella vista registrazione) ─────────────────
    // Inverso del precedente: nasconde register, mostra login.
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        registerView.classList.add('hidden');
        loginView.classList.remove('hidden');
    });

    // ─── LISTENER: submit del form di Login ──────────────────────────────────
    //
    // FLUSSO:
    //   1. e.preventDefault() blocca il comportamento default del form HTML
    //      (che altrimenti farebbe una GET/POST alla stessa URL e ricaricherebbe la pagina)
    //   2. Legge username e password dai rispettivi <input>
    //   3. Chiama auth.login() che cerca l'utente in localStorage
    //   4. Se successo: redirect a home.html
    //   5. Se fallimento: mostra il messaggio di errore nel paragrafo #login-error
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); // FONDAMENTALE: senza questo la pagina si ricaricherebbe

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const result = auth.login(username, password);
        // result = { success: true, user: {...} }  oppure
        // result = { success: false, message: "Username o password non corretti." }

        if (result.success) {
            window.location.href = 'home.html'; // Login OK: vai alla home
        } else {
            loginError.textContent = result.message; // Mostra errore sotto il form
        }
    });

    // ─── LISTENER: submit del form di Registrazione ──────────────────────────
    //
    // FLUSSO:
    //   1. e.preventDefault() blocca il comportamento default
    //   2. Legge tutti e 4 i campi del form (username, email, password, favoriteDishes)
    //      NOTA: favoriteDishes non ha required, quindi può essere stringa vuota ""
    //   3. Chiama auth.register() che valida e salva il nuovo utente
    //   4. Se successo: esegue AUTOMATICAMENTE il login (l'utente non deve ri-inserire
    //      le credenziali) e poi redirect a home.html
    //   5. Se fallimento (username o email già in uso): mostra il messaggio di errore
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        // Campo facoltativo: se vuoto, sarà una stringa ""
        const favoriteDishes = document.getElementById('register-favorites').value;

        const result = auth.register(username, email, password, favoriteDishes);

        if (result.success) {
            // Login automatico post-registrazione: non si torna mai al form di login
            const loginResult = auth.login(username, password);
            if (loginResult.success) window.location.href = 'home.html';
            // Se per qualche motivo il login fallisce dopo la registrazione
            // (caso teoricamente impossibile), l'utente rimarrebbe sulla pagina
        } else {
            registerError.textContent = result.message; // Es. "Username già esistente."
        }
    });
});
