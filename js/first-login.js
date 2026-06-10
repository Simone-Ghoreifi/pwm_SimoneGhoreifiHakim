/**
 * first-login.js — Controller della pagina post-registrazione.
 *
 * La pagina non autentica l'utente: serve a rendere esplicito il primo login
 * dopo la creazione dell'account, come passaggio di convalida lato UI.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem(LOGGED_IN_USER_KEY)) {
        window.location.href = 'home.html';
        return;
    }

    const username = sessionStorage.getItem('pgrc_pendingFirstLoginUser');
    const message = document.getElementById('first-login-message');
    const goLoginBtn = document.getElementById('go-login-btn');

    if (username) {
        message.textContent = `Account "${username}" creato. Effettua il primo login per convalidare l'accesso.`;
    }

    goLoginBtn.addEventListener('click', () => {
        sessionStorage.removeItem('pgrc_pendingFirstLoginUser');
        window.location.href = 'index.html';
    });
});
