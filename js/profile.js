/**
 * =============================================================================
 * profile.js — Controller area personale
 * =============================================================================
 *
 * La pagina mostra subito tutti i dati dell'utente corrente, ma in modalità
 * disabled. L'utente può:
 *   1. premere "Modifica Dati" per sbloccare username, email e preferiti;
 *   2. sbloccare la password solo dopo conferma della password attuale;
 *   3. salvare le modifiche in pgrc_users;
 *   4. cancellare il profilo, ripulendo anche ricettario e recensioni.
 *
 * PUNTI DA SAPER SPIEGARE:
 *   - Lo username è duplicato dentro ogni recensione per semplificare il render.
 *     Per questo, se cambia username, aggiorniamo anche pgrc_reviews.
 *   - La cancellazione profilo deve toccare tre aree dati: utenti, ricettario e
 *     recensioni. Alla fine viene chiamato auth.logout() per pulire la sessione.
 *   - Il campo password non viene mai precompilato: il placeholder mascherato è
 *     solo UI, non contiene la password reale.
 * =============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    auth.checkAuth();

    let currentUser = auth.getCurrentUser();
    if (!currentUser) return;

    const profileForm = document.getElementById('profile-form');
    const usernameInput = document.getElementById('profile-username');
    const emailInput = document.getElementById('profile-email');
    const favoritesInput = document.getElementById('profile-favorites');
    const passwordInput = document.getElementById('profile-password');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const unlockPasswordBtn = document.getElementById('unlock-password-btn');
    const deleteProfileBtn = document.getElementById('delete-profile-btn');
    const editableFields = [usernameInput, emailInput, favoritesInput];

    // Bootstrap non inizializza i tooltip da solo: serve istanziare i trigger.
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(element => {
        bootstrap.Tooltip.getOrCreateInstance(element);
    });

    function fillForm() {
        // Sincronizza il form con currentUser; utile sia all'avvio sia dopo annulla/salva.
        usernameInput.value = currentUser.username;
        emailInput.value = currentUser.email;
        favoritesInput.value = currentUser.favoriteDishes || '';
        passwordInput.value = '';
        passwordInput.placeholder = '••••••••';
    }

    function setEditMode(enabled) {
        // La password resta bloccata anche in edit mode: ha un flusso di verifica separato.
        editableFields.forEach(field => { field.disabled = !enabled; });
        passwordInput.disabled = true;
        passwordInput.value = '';
        saveProfileBtn.disabled = !enabled;
        cancelEditBtn.classList.toggle('hidden', !enabled);
        editProfileBtn.disabled = enabled;
    }

    function refreshCurrentUser() {
        // Rilegge l'utente dal Web Storage, così il form mostra sempre lo stato persistito.
        currentUser = auth.getCurrentUser();
        fillForm();
    }

    function validateUsername(users, username) {
        // Case-insensitive: "Mario" e "mario" vengono considerati lo stesso username.
        const normalized = username.trim().toLowerCase();
        return !users.some(user => (
            user.id !== currentUser.id && user.username.toLowerCase() === normalized
        ));
    }

    function validateEmail(users, email) {
        // Anche l'email viene confrontata in modo case-insensitive.
        const normalized = email.trim().toLowerCase();
        return !users.some(user => (
            user.id !== currentUser.id && user.email.toLowerCase() === normalized
        ));
    }

    editProfileBtn.addEventListener('click', () => {
        // Entra in modalità modifica senza cambiare ancora il localStorage.
        setEditMode(true);
        usernameInput.focus();
    });

    cancelEditBtn.addEventListener('click', () => {
        // Ripristina i valori persistiti, scartando quello che l'utente aveva scritto.
        refreshCurrentUser();
        setEditMode(false);
        ui.notify({
            type: 'info',
            title: 'Modifiche annullate',
            message: 'I campi sono tornati ai dati salvati.'
        });
    });

    unlockPasswordBtn.addEventListener('click', async () => {
        if (saveProfileBtn.disabled) {
            ui.notify({
                type: 'info',
                title: 'Attiva modifica dati',
                message: 'Prima premi "Modifica Dati", poi sblocca la password.'
            });
            return;
        }

        const password = await ui.promptPassword({
            title: 'Cambia password',
            message: 'Inserisci la password attuale per abilitare il campo nuova password.',
            confirmText: 'Sblocca'
        });

        if (password === null) return;

        // La verifica usa l'utente salvato, non i campi form eventualmente modificati.
        const users = getUsers();
        const user = users.find(candidate => candidate.id === currentUser.id);
        const isValid = await auth.verifyPassword(user, password);

        if (!isValid) {
            ui.notify({
                type: 'danger',
                title: 'Password errata',
                message: 'La password attuale non corrisponde.'
            });
            return;
        }

        passwordInput.disabled = false;
        passwordInput.placeholder = 'Nuova password';
        passwordInput.focus();
        ui.notify({
            type: 'success',
            title: 'Password sbloccata',
            message: 'Ora puoi inserire una nuova password prima di salvare.'
        });
    });

    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const users = getUsers();
        const userIndex = users.findIndex(user => user.id === currentUser.id);
        if (userIndex === -1) return;

        const newUsername = usernameInput.value.trim();
        const newEmail = emailInput.value.trim();
        const newFavorites = favoritesInput.value.trim();
        const newPassword = passwordInput.value;

        if (!newUsername || !newEmail) {
            ui.notify({
                type: 'danger',
                title: 'Dati mancanti',
                message: 'Username ed email sono obbligatori.'
            });
            return;
        }

        if (!validateUsername(users, newUsername)) {
            ui.notify({
                type: 'danger',
                title: 'Username non disponibile',
                message: 'Esiste già un account con questo username.'
            });
            return;
        }

        if (!validateEmail(users, newEmail)) {
            ui.notify({
                type: 'danger',
                title: 'Email non disponibile',
                message: 'Esiste già un account con questa email.'
            });
            return;
        }

        users[userIndex].username = newUsername;
        users[userIndex].email = newEmail;
        users[userIndex].favoriteDishes = newFavorites;

        // Denormalizzazione controllata: le review salvano anche username per non
        // fare join con pgrc_users durante il render della pagina ricetta.
        const allReviews = getReviews();
        for (const mealId in allReviews) {
            allReviews[mealId].forEach(review => {
                if (review.userId === currentUser.id) review.username = newUsername;
            });
        }

        if (!passwordInput.disabled && newPassword) {
            // Se il campo password è stato sbloccato ma lasciato vuoto, non cambiamo password.
            const credential = await auth.createPasswordCredential(newPassword);
            Object.assign(users[userIndex], credential);
            delete users[userIndex].password;
        }

        saveUsers(users);
        saveReviews(allReviews);
        refreshCurrentUser();
        setEditMode(false);
        ui.notify({
            type: 'success',
            title: 'Profilo aggiornato',
            message: 'Le modifiche sono state salvate nel localStorage.'
        });
    });

    deleteProfileBtn.addEventListener('click', async () => {
        const confirmed = await ui.confirm({
            title: 'Rimuovi profilo',
            message: 'L’operazione elimina account, ricettario personale e recensioni associate.',
            confirmText: 'Rimuovi',
            confirmVariant: 'btn-danger',
            iconClass: 'bi bi-trash'
        });

        if (!confirmed) return;

        // 1) rimuove l'account da pgrc_users.
        saveUsers(getUsers().filter(user => user.id !== currentUser.id));

        // 2) rimuove l'intero ricettario personale dell'utente.
        const cookbooks = getCookbooks();
        delete cookbooks[currentUser.id];
        saveCookbooks(cookbooks);

        // 3) rimuove solo le recensioni scritte dall'utente eliminato.
        const allReviews = getReviews();
        for (const mealId in allReviews) {
            allReviews[mealId] = allReviews[mealId].filter(review => review.userId !== currentUser.id);
        }
        saveReviews(allReviews);

        auth.logout();
    });

    fillForm();
    setEditMode(false);
});
