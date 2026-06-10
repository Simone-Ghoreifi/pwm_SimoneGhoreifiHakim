/**
 * auth.js — Registrazione, login, logout e sessione.
 *
 * Le password non vengono mai salvate in chiaro: ogni utente contiene
 * `passwordSalt`, `passwordHash` e `passwordAlgorithm`. In un'app reale l'hash
 * andrebbe calcolato lato server, ma per questo progetto client-side è comunque
 * preferibile mostrare nel localStorage un digest non reversibile.
 */

// Chiave sessionStorage usata dai controller per capire se l'utente è loggato.
const LOGGED_IN_USER_KEY = 'pgrc_loggedInUser';

const PASSWORD_ALGORITHM = 'SHA-256';
const FALLBACK_PASSWORD_ALGORITHM = 'FNV-1A-FALLBACK';

function normalizeUsername(username) {
    return username.trim().toLowerCase();
}

function findUserByUsername(users, username) {
    const normalized = normalizeUsername(username);
    return users.find(user => user.username.toLowerCase() === normalized);
}

function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function supportsSubtleCrypto() {
    return Boolean(window.crypto && window.crypto.subtle && window.TextEncoder);
}

function createPasswordSalt() {
    const bytes = new Uint8Array(16);

    if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
        return bytesToHex(bytes);
    }

    // Fallback raro per contesti browser molto limitati: non è crittograficamente
    // forte, ma evita comunque di salvare password in chiaro.
    return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function fallbackHash(value) {
    let hashA = 0x811c9dc5;
    let hashB = 0x9e3779b9;

    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        hashA ^= code;
        hashA = Math.imul(hashA, 0x01000193);
        hashB ^= code + i;
        hashB = Math.imul(hashB, 0x85ebca6b);
    }

    const partA = (hashA >>> 0).toString(16).padStart(8, '0');
    const partB = (hashB >>> 0).toString(16).padStart(8, '0');
    return `fallback-${partA}${partB}`;
}

async function hashPassword(password, salt, algorithm = PASSWORD_ALGORITHM) {
    const valueToHash = `${salt}:${password}`;

    if (algorithm === FALLBACK_PASSWORD_ALGORITHM || !supportsSubtleCrypto()) {
        return {
            hash: fallbackHash(valueToHash),
            algorithm: FALLBACK_PASSWORD_ALGORITHM
        };
    }

    const encoder = new TextEncoder();
    const digest = await window.crypto.subtle.digest(PASSWORD_ALGORITHM, encoder.encode(valueToHash));

    return {
        hash: bytesToHex(new Uint8Array(digest)),
        algorithm: PASSWORD_ALGORITHM
    };
}

async function createPasswordCredential(password) {
    const passwordSalt = createPasswordSalt();
    const digest = await hashPassword(password, passwordSalt);

    return {
        passwordSalt,
        passwordHash: digest.hash,
        passwordAlgorithm: digest.algorithm
    };
}

async function verifyPassword(user, password) {
    if (!user) return false;

    // Compatibilità con eventuali utenti creati prima del refactor: il login
    // funziona una volta e poi migrateLegacyPassword rimuove il campo `password`.
    if (!user.passwordHash && typeof user.password === 'string') {
        return user.password === password;
    }

    if (!user.passwordHash || !user.passwordSalt) return false;

    const digest = await hashPassword(
        password,
        user.passwordSalt,
        user.passwordAlgorithm || PASSWORD_ALGORITHM
    );

    return digest.hash === user.passwordHash;
}

async function migrateLegacyPassword(users, user, password) {
    if (!user || !Object.prototype.hasOwnProperty.call(user, 'password')) return user;

    const userIndex = users.findIndex(candidate => candidate.id === user.id);
    if (userIndex === -1) return user;

    const credential = await createPasswordCredential(password);
    const migratedUser = {
        ...users[userIndex],
        ...credential
    };
    delete migratedUser.password;

    users[userIndex] = migratedUser;
    saveUsers(users);
    return migratedUser;
}

const auth = {
    /**
     * Registra l'utente e crea il ricettario vuoto. Non avvia la sessione:
     * login.js reindirizza alla pagina first-login.html per la convalida.
     */
    register: async (username, email, password, favoriteDishes = '') => {
        const users = getUsers();
        const cleanUsername = username.trim();
        const cleanEmail = email.trim();

        if (findUserByUsername(users, cleanUsername)) {
            return { success: false, message: 'Username già esistente.' };
        }

        if (users.some(user => user.email.toLowerCase() === cleanEmail.toLowerCase())) {
            return { success: false, message: 'Email già in uso.' };
        }

        const credential = await createPasswordCredential(password);
        const newUser = {
            id: `user_${Date.now()}`,
            username: cleanUsername,
            email: cleanEmail,
            ...credential,
            favoriteDishes: favoriteDishes.trim()
        };

        users.push(newUser);
        saveUsers(users);

        const cookbooks = getCookbooks();
        cookbooks[newUser.id] = [];
        saveCookbooks(cookbooks);

        return { success: true, user: newUser };
    },

    /**
     * Login in due passaggi: prima verifica che lo username esista, poi controlla
     * la password. Così il messaggio "username non registrato" è preciso.
     */
    login: async (username, password) => {
        const users = getUsers();
        const user = findUserByUsername(users, username);

        if (!user) {
            return { success: false, message: 'Username non registrato presso il nostro db.' };
        }

        const passwordMatches = await verifyPassword(user, password);
        if (!passwordMatches) {
            return { success: false, message: 'Password non corretta.' };
        }

        const migratedUser = await migrateLegacyPassword(users, user, password);
        sessionStorage.setItem(LOGGED_IN_USER_KEY, migratedUser.id);
        return { success: true, user: migratedUser };
    },

    logout: () => {
        sessionStorage.removeItem(LOGGED_IN_USER_KEY);
        window.location.href = 'index.html';
    },

    getCurrentUser: () => {
        const userId = sessionStorage.getItem(LOGGED_IN_USER_KEY);
        if (!userId) return null;
        return getUsers().find(user => user.id === userId) || null;
    },

    checkAuth: () => {
        if (!auth.getCurrentUser()) window.location.href = 'index.html';
    },

    createPasswordCredential,
    verifyPassword,

    /**
     * Se nel browser esistono utenti storici con `password` in chiaro, li converte
     * appena possibile. Utile quando si mostra Application/localStorage al docente.
     */
    migrateLegacyPasswords: async () => {
        const users = getUsers();
        let changed = false;

        for (const user of users) {
            if (!Object.prototype.hasOwnProperty.call(user, 'password')) continue;

            const credential = await createPasswordCredential(user.password);
            Object.assign(user, credential);
            delete user.password;
            changed = true;
        }

        if (changed) saveUsers(users);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    auth.migrateLegacyPasswords().catch(error => {
        console.error('Migrazione password legacy fallita:', error);
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async (event) => {
        event.preventDefault();

        const confirmed = await ui.confirm({
            title: 'Conferma logout',
            message: 'Vuoi terminare la sessione corrente?',
            confirmText: 'Logout',
            confirmVariant: 'btn-primary',
            iconClass: 'bi bi-box-arrow-right'
        });

        if (confirmed) auth.logout();
    });
});
