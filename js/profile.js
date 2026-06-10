/**
 * profile.js — Controller area personale.
 *
 * La pagina mostra subito tutti i campi utente in modalità disabled. Il pulsante
 * "Modifica Dati" sblocca username, email e preferiti; la password richiede una
 * verifica separata tramite modale prima di diventare editabile.
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

    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(element => {
        bootstrap.Tooltip.getOrCreateInstance(element);
    });

    function fillForm() {
        usernameInput.value = currentUser.username;
        emailInput.value = currentUser.email;
        favoritesInput.value = currentUser.favoriteDishes || '';
        passwordInput.value = '';
        passwordInput.placeholder = '••••••••';
    }

    function setEditMode(enabled) {
        editableFields.forEach(field => { field.disabled = !enabled; });
        passwordInput.disabled = true;
        passwordInput.value = '';
        saveProfileBtn.disabled = !enabled;
        cancelEditBtn.classList.toggle('hidden', !enabled);
        editProfileBtn.disabled = enabled;
    }

    function refreshCurrentUser() {
        currentUser = auth.getCurrentUser();
        fillForm();
    }

    function validateUsername(users, username) {
        const normalized = username.trim().toLowerCase();
        return !users.some(user => (
            user.id !== currentUser.id && user.username.toLowerCase() === normalized
        ));
    }

    function validateEmail(users, email) {
        const normalized = email.trim().toLowerCase();
        return !users.some(user => (
            user.id !== currentUser.id && user.email.toLowerCase() === normalized
        ));
    }

    editProfileBtn.addEventListener('click', () => {
        setEditMode(true);
        usernameInput.focus();
    });

    cancelEditBtn.addEventListener('click', () => {
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

        const allReviews = getReviews();
        for (const mealId in allReviews) {
            allReviews[mealId].forEach(review => {
                if (review.userId === currentUser.id) review.username = newUsername;
            });
        }

        if (!passwordInput.disabled && newPassword) {
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

        saveUsers(getUsers().filter(user => user.id !== currentUser.id));

        const cookbooks = getCookbooks();
        delete cookbooks[currentUser.id];
        saveCookbooks(cookbooks);

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
