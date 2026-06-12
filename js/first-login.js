/**
 * =============================================================================
 * first-login.js — Controller della pagina post-registrazione
 * =============================================================================
 *
 * La pagina appare dopo una registrazione riuscita, ma NON autentica l'utente.
 * Serve a rendere esplicito il primo login e a mostrare al docente una distinzione
 * chiara tra:
 *   - registrazione: crea pgrc_users e pgrc_cookbooks;
 *   - login: crea sessionStorage.pgrc_loggedInUser.
 *
 * Usa solo sessionStorage.pgrc_pendingFirstLoginUser per personalizzare il testo.
 * Questa chiave è temporanea e viene rimossa quando si torna alla pagina di login.
 * =============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    // Se l'utente è già loggato, questa pagina non ha più senso.
    if (sessionStorage.getItem(LOGGED_IN_USER_KEY)) {
        window.location.href = 'home.html';
        return;
    }

    const username = sessionStorage.getItem('pgrc_pendingFirstLoginUser');
    const message = document.getElementById('first-login-message');
    const goLoginBtn = document.getElementById('go-login-btn');

    if (username) {
        // Messaggio di cortesia: non è un dato persistente dell'applicazione.
        message.textContent = `Account "${username}" creato. Effettua il primo login per convalidare l'accesso.`;
    }

    goLoginBtn.addEventListener('click', () => {
        // Pulizia della chiave temporanea prima di tornare a index.html.
        sessionStorage.removeItem('pgrc_pendingFirstLoginUser');
        window.location.href = 'index.html';
    });
});
