/**
 * =============================================================================
 * profile.js — Controller della pagina profile.html (Area Personale)
 * =============================================================================
 *
 * Gestisce due sezioni distinte della pagina profilo:
 *   A) DATI UTENTE: visualizza username, email, piatti preferiti;
 *      gestisce il form di modifica (email, password, piatti preferiti);
 *      gestisce la cancellazione dell'account.
 *   B) RICETTARIO PERSONALE: carica e visualizza le ricette salvate dall'utente,
 *      con textarea per note private e pulsante "Salva Nota" con feedback inline.
 *
 * DIPENDENZE (caricate prima in profile.html):
 *   - api.js      (api.lookupById per ottenere nome e immagine di ogni ricetta salvata)
 *   - storage.js  (getUsers, saveUsers, getCookbooks, saveCookbooks, getReviews, saveReviews)
 *   - auth.js     (auth.checkAuth, auth.getCurrentUser, auth.logout)
 *
 * NOTA IMPORTANTE SUL RICETTARIO:
 *   In localStorage il ricettario contiene solo mealId e notes. Per mostrare nome
 *   e immagine, il controller cerca prima pgrc_meal_details_cache e pgrc_meals_cache;
 *   chiama api.lookupById solo come fallback e salva il dettaglio recuperato.
 *
 * DEVTOOLS — Cosa mostrare in questa pagina:
 *
 *   MODIFICA DATI:
 *     Prima: localStorage → pgrc_users → cerca il tuo utente → vedi email/hash password
 *     Dopo modifiche salvate: email, preferiti ed eventuale hash password sono aggiornati
 *
 *   SALVATAGGIO NOTA:
 *     Prima: localStorage → pgrc_cookbooks → [userId] → [{mealId:"...", notes:""}]
 *     Dopo: [..., {mealId:"...", notes:"Il mio commento"}]
 *
 *   ELIMINAZIONE ACCOUNT:
 *     Dopo: pgrc_users non contiene più il tuo utente
 *           pgrc_cookbooks non ha più la chiave del tuo userId
 *           pgrc_reviews non contiene più le tue recensioni
 *           sessionStorage è vuoto (logout automatico)
 *
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

    // ─── GUARDIA AUTENTICAZIONE ───────────────────────────────────────────────
    auth.checkAuth();

    // ─── Utente corrente ──────────────────────────────────────────────────────
    // getCurrentUser() cerca in sessionStorage l'ID, poi in localStorage i dati completi.
    const currentUser = auth.getCurrentUser();
    if (!currentUser) return; // Doppia sicurezza (auth.checkAuth fa già il redirect)

    // ─── Riferimenti DOM — Sezione Profilo ───────────────────────────────────
    const usernameSpan = document.getElementById('profile-username');   // <span> nome utente
    const emailSpan = document.getElementById('profile-email');          // <span> email
    const favoritesSpan = document.getElementById('profile-favorites');  // <span> piatti preferiti
    const editProfileForm = document.getElementById('edit-profile-form'); // Div form modifica (hidden)
    const editProfileBtn = document.getElementById('edit-profile-btn');   // Pulsante "Modifica Dati"
    const deleteProfileBtn = document.getElementById('delete-profile-btn'); // Pulsante "Rimuovi Profilo"
    const updateForm = document.getElementById('update-form');            // <form> di modifica
    const updateMessage = document.getElementById('update-message');      // Messaggi form profilo
    // ─── Riferimenti DOM — Sezione Ricettario ────────────────────────────────
    const cookbookContainer = document.getElementById('cookbook-container'); // griglia Bootstrap row
    const cookbookMessage = document.getElementById('cookbook-message');     // messaggio se vuoto

    // =========================================================================
    // FUNZIONE: displayUserData
    // =========================================================================
    /**
     * Popola i tag <span> con i dati dell'utente corrente letti da localStorage.
     * Chiamata una sola volta all'avvio.
     *
     * NOTA: se favoriteDishes è "" (stringa vuota, campo non compilato in fase
     * di registrazione), mostra il carattere "—" per indicare assenza di valore.
     */
    function displayUserData() {
        usernameSpan.textContent = currentUser.username;
        emailSpan.textContent = currentUser.email;
        favoritesSpan.textContent = currentUser.favoriteDishes || '—';
        // "—" se favoriteDishes è stringa vuota, null, o undefined
    }

    // =========================================================================
    // FUNZIONE: loadCookbook (asincrona)
    // =========================================================================
    /**
     * Carica il ricettario dell'utente e renderizza le card con note.
     *
     * FLUSSO DETTAGLIATO:
     *   1. Legge l'oggetto cookbooks da localStorage
     *   2. Estrae l'array del ricettario dell'utente corrente (o [] se vuoto)
     *   3. Se vuoto → mostra messaggio → exit
     *   4. Per ogni elemento del ricettario:
     *      a. Recupera il dettaglio da cache Web Storage o fallback API
     *      b. Se la risposta è valida → crea e appende una Bootstrap Card col
     *      c. La card contiene: nome linkato, textarea per la nota, pulsante salva
     *
     * PERCHÉ for...of (sequenziale) invece di Promise.all (parallelo)?
     *   - Promise.all aggiungerebbe tutte le card in ordine non prevedibile
     *   - for...of garantisce che le card appaiano nell'ordine del ricettario
     *   - Per ricettari piccoli (<20 ricette) la differenza di performance è trascurabile
     *
     * STRUTTURA HTML CARD GENERATA:
     *   <div class="col">              ← colonna del row Bootstrap
     *     <div class="card h-100">
     *       <div class="card-body d-flex flex-column">
     *         <h5><a href="recipe.html?id=XXX">Nome Ricetta</a></h5>
     *         <textarea data-meal-id="XXX">nota eventuale</textarea>
     *         <div class="d-flex justify-content-end">
     *           <span class="save-note-feedback" style="display:none">Salvato!</span>
     *           <button class="save-note-btn" data-meal-id="XXX">Salva Nota</button>
     *         </div>
     *       </div>
     *     </div>
     *   </div>
     *
     * ATTRIBUTO data-meal-id:
     *   Sia la textarea che il pulsante hanno data-meal-id="XXX".
     *   Questo permette al listener (vedi sotto) di sapere quale ricetta
     *   corrisponde a quale nota, senza dover eseguire un'altra chiamata API.
     */
    async function getCookbookMeal(mealId) {
        const cachedDetail = getMealDetailCache(mealId);
        if (cachedDetail) return cachedDetail;

        const catalogMeal = findMealInCatalogCache(mealId);
        if (catalogMeal) {
            saveMealDetailCache(catalogMeal);
            return catalogMeal;
        }

        const data = await api.lookupById(mealId);
        if (!data || !data.meals) return null;

        const meal = data.meals[0];
        saveMealDetailCache(meal);
        return meal;
    }

    async function loadCookbook() {
        const cookbooks = getCookbooks();
        const userCookbook = cookbooks[currentUser.id] || [];

        cookbookContainer.innerHTML = ''; // Svuota il container

        if (userCookbook.length === 0) {
            cookbookMessage.textContent = 'Il tuo ricettario è vuoto. Aggiungi ricette dalla pagina di ricerca!';
            return; // Nessuna ricetta da caricare
        }
        cookbookMessage.textContent = ''; // Nascondi il messaggio

        // Ciclo sequenziale: mantiene l'ordine del ricettario anche con fallback API
        for (const recipeInfo of userCookbook) {
            const meal = await getCookbookMeal(recipeInfo.mealId);
            if (meal) {
                const col = document.createElement('div');
                col.className = 'col';
                col.innerHTML = `
                    <div class="card h-100 shadow-sm">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">
                                <a href="recipe.html?id=${meal.idMeal}"
                                   class="text-decoration-none">${meal.strMeal}</a>
                            </h5>
                            <textarea class="form-control cookbook-note flex-grow-1 mt-2"
                                      data-meal-id="${meal.idMeal}"
                                      placeholder="Aggiungi una nota privata…">${recipeInfo.notes || ''}</textarea>
                            <div class="mt-2 d-flex justify-content-end align-items-center gap-2">
                                <span class="save-note-feedback text-success fw-semibold small"
                                      data-meal-id="${meal.idMeal}"
                                      style="display:none;">
                                    <i class="bi bi-check-circle me-1"></i>Salvato!
                                </span>
                                <button type="button" class="btn btn-sm btn-primary save-note-btn"
                                        data-meal-id="${meal.idMeal}">
                                    <i class="bi bi-floppy me-1"></i>Salva Nota
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                cookbookContainer.appendChild(col);
            }
        }
    }

    // =========================================================================
    // EVENT LISTENER: click sul container ricettario (EVENT DELEGATION)
    // =========================================================================
    /**
     * Salva la nota privata associata a una ricetta nel ricettario.
     *
     * PERCHÉ EVENT DELEGATION invece di un listener per ogni pulsante?
     *   I pulsanti "Salva Nota" sono generati DINAMICAMENTE da loadCookbook().
     *   Se si aggiungesse il listener prima che i pulsanti esistano, non funzionerebbe.
     *   Con la delegation, si attacca un UNICO listener al container padre
     *   (#cookbook-container), che è già presente nel DOM al caricamento.
     *   Quando si clicca un bottone figlio, l'evento "risale" al container (bubbling).
     *
     * PATTERN e.target.closest('.save-note-btn'):
     *   e.target è l'elemento cliccato. Se si clicca sull'icona <i> dentro il pulsante,
     *   e.target sarebbe il <i>, non il <button>. .closest() risale il DOM verso il
     *   genitore più vicino che matcha il selettore CSS, gestendo correttamente il caso.
     *
     * FLUSSO:
     *   1. Verifica che il click sia su (o dentro) un .save-note-btn
     *   2. Legge il data-meal-id del pulsante per sapere quale ricetta aggiornare
     *   3. Legge il contenuto della textarea con lo stesso data-meal-id
     *   4. Aggiorna il campo notes nel ricettario in localStorage
     *   5. Mostra il feedback "Salvato!" (con display:inline) e lo nasconde dopo 2s
     *
     * DEVTOOLS — Dopo aver salvato una nota:
     *   Application → localStorage → pgrc_cookbooks → clicca sulla chiave
     *   → nel valore JSON vedrai notes: "il tuo testo"
     */
    cookbookContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.save-note-btn');
        if (!btn) return; // Click su altro elemento nel container → ignora

        const mealId = btn.dataset.mealId; // Legge data-meal-id="XXX"
        const noteText = document.querySelector(`textarea[data-meal-id="${mealId}"]`).value;

        const cookbooks = getCookbooks();
        const userCookbook = cookbooks[currentUser.id];
        const recipeIndex = userCookbook.findIndex(r => r.mealId === mealId);

        if (recipeIndex > -1) {
            userCookbook[recipeIndex].notes = noteText; // Aggiorna la nota
            cookbooks[currentUser.id] = userCookbook;
            saveCookbooks(cookbooks); // Persiste in localStorage

            // Feedback inline: mostra "Salvato!" e nasconde dopo 2 secondi
            const feedback = document.querySelector(`.save-note-feedback[data-meal-id="${mealId}"]`);
            feedback.style.display = 'inline'; // Mostra
            setTimeout(() => { feedback.style.display = 'none'; }, 2000); // Nascondi dopo 2s
        }
    });

    // =========================================================================
    // EVENT LISTENER: click su "Modifica Dati"
    // =========================================================================
    /**
     * Toggle della visibilità del form di modifica.
     *
     * classList.toggle('hidden'):
     *   - Se il form ha la classe .hidden → la rimuove (mostra il form)
     *   - Se il form non ha la classe .hidden → la aggiunge (nasconde il form)
     *
     * Quando si apre il form, i campi vengono precompilati con i valori attuali
     * (email e piatti preferiti) così l'utente può vedere cosa sta per modificare
     * e non deve reinserire tutto da capo.
     */
    editProfileBtn.addEventListener('click', () => {
        editProfileForm.classList.toggle('hidden');
        // Precompila i campi con i valori attuali dell'utente
        document.getElementById('update-email').value = currentUser.email;
        document.getElementById('update-favorites').value = currentUser.favoriteDishes || '';
        // La password NON viene precompilata per sicurezza: si cambia solo se
        // l'utente inserisce un nuovo valore nel campo
        document.getElementById('update-current-password').value = '';
        document.getElementById('update-password').value = '';
    });

    function showUpdateMessage(message, type = 'success') {
        updateMessage.textContent = message;
        updateMessage.classList.remove('text-success', 'text-danger');
        updateMessage.classList.add(type === 'success' ? 'text-success' : 'text-danger');
    }

    // =========================================================================
    // EVENT LISTENER: submit del form di modifica profilo
    // =========================================================================
    /**
     * Salva le modifiche ai dati utente in localStorage.
     *
     * FLUSSO:
     *   1. e.preventDefault() blocca il reload della pagina
     *   2. Legge email, password attuale, nuova password e piatti preferiti
     *   3. Trova l'utente nell'array tramite il suo ID
     *   4. Se c'è una nuova password, verifica prima la password attuale
     *   5. Salva solo passwordSalt/passwordHash/passwordAlgorithm, mai il testo in chiaro
     *   6. Aggiorna email se compilata e sempre i piatti preferiti
     *   7. Salva l'array aggiornato in localStorage
     *   8. Mostra messaggio di successo verde
     *   9. Dopo 2 secondi: ricarica la pagina con location.reload()
     *      (così i <span> mostrano i dati aggiornati senza logica aggiuntiva)
     *
     * PERCHÉ location.reload() invece di aggiornare i <span> direttamente?
     *   Semplifica il codice: al reload, displayUserData() viene rieseguita
     *   e legge i dati aggiornati da localStorage.
     *
     * DEVTOOLS — Dopo aver salvato modifiche:
     *   localStorage → pgrc_users → cerca il tuo ID → email e/o passwordHash aggiornati
     */
    updateForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newEmail = document.getElementById('update-email').value;
        const currentPassword = document.getElementById('update-current-password').value;
        const newPassword = document.getElementById('update-password').value;
        const newFavorites = document.getElementById('update-favorites').value;

        const users = getUsers();
        const userIndex = users.findIndex(u => u.id === currentUser.id);

        if (userIndex > -1) {
            if (newPassword) {
                if (!currentPassword) {
                    showUpdateMessage('Inserisci la password attuale per impostarne una nuova.', 'danger');
                    return;
                }

                const currentPasswordIsValid = await auth.verifyPassword(users[userIndex], currentPassword);
                if (!currentPasswordIsValid) {
                    showUpdateMessage('Password attuale non corretta.', 'danger');
                    return;
                }

                const credential = await auth.createPasswordCredential(newPassword);
                Object.assign(users[userIndex], credential);
                delete users[userIndex].password; // rimuove eventuale campo legacy in chiaro
            }

            // Aggiorna solo se il campo non è vuoto (campo vuoto = nessuna modifica)
            if (newEmail) users[userIndex].email = newEmail;
            // I piatti preferiti vengono SEMPRE aggiornati (anche se svuotati)
            users[userIndex].favoriteDishes = newFavorites;

            saveUsers(users); // Persiste in localStorage

            showUpdateMessage('Dati aggiornati con successo!');
            setTimeout(() => {
                updateMessage.textContent = ''; // Resetta il messaggio
                location.reload(); // Ricarica la pagina per mostrare i dati aggiornati
            }, 2000);
        }
    });

    // =========================================================================
    // EVENT LISTENER: click su "Rimuovi Profilo"
    // =========================================================================
    /**
     * Elimina l'account dell'utente corrente e tutti i dati associati.
     *
     * FLUSSO (dopo conferma):
     *   1. Rimuove l'utente dall'array pgrc_users
     *   2. Elimina la chiave del ricettario da pgrc_cookbooks
     *   3. Rimuove tutte le recensioni dell'utente da pgrc_reviews
     *      (itera su ogni mealId e filtra via le recensioni con userId corrispondente)
     *   4. Chiama auth.logout() → svuota sessionStorage → redirect a index.html
     *
     * CONFERMA con ui.confirm():
     *   Mostra la modale Bootstrap condivisa definita in ui.js.
     *   Se l'utente annulla, confirmed è false e non viene modificato nulla.
     *   Questa è l'unica azione distruttiva irreversibile dell'app, quindi la
     *   conferma è giustificata.
     *
     * DEVTOOLS — Dopo l'eliminazione:
     *   pgrc_users → l'utente non esiste più nell'array
     *   pgrc_cookbooks → la chiave userId è scomparsa
     *   pgrc_reviews → tutte le recensioni dell'utente sono state filtrate via
     *   sessionStorage → vuoto (il logout l'ha svuotato)
     */
    deleteProfileBtn.addEventListener('click', async () => {
        const confirmed = typeof ui !== 'undefined'
            ? await ui.confirm({
                title: 'Rimuovi profilo',
                message: 'Sei sicuro di voler eliminare il profilo? L’operazione rimuove anche ricettario e recensioni.',
                confirmText: 'Rimuovi',
                confirmVariant: 'btn-danger',
                iconClass: 'bi bi-trash'
            })
            : confirm('Sei sicuro di voler eliminare il tuo profilo? Questa azione è irreversibile.');

        if (!confirmed) return;

        // 1. Rimuove utente dall'array (filter crea un nuovo array senza l'utente)
        saveUsers(getUsers().filter(u => u.id !== currentUser.id));

        // 2. Rimuove il ricettario dell'utente (delete rimuove la proprietà dall'oggetto)
        const cookbooks = getCookbooks();
        delete cookbooks[currentUser.id];
        saveCookbooks(cookbooks);

        // 3. Rimuove le recensioni dell'utente da TUTTE le ricette
        const allReviews = getReviews();
        for (const mealId in allReviews) {
            // Per ogni mealId, tieni solo le recensioni di ALTRI utenti
            allReviews[mealId] = allReviews[mealId].filter(r => r.userId !== currentUser.id);
        }
        saveReviews(allReviews);

        // 4. Logout → svuota sessionStorage → redirect a index.html
        auth.logout();
    });

    // ─── AVVIO: mostra dati utente e carica il ricettario ────────────────────
    displayUserData();      // Sincrona: popola subito i <span> con username/email/piatti
    await loadCookbook();   // Asincrona: carica le ricette del ricettario via API
});
