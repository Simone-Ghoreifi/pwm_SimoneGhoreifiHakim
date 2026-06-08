/**
 * =============================================================================
 * recipe.js — Controller della pagina recipe.html (Dettaglio Ricetta + Recensioni)
 * =============================================================================
 *
 * Gestisce due sezioni distinte della stessa pagina:
 *   A) DETTAGLIO RICETTA: carica e renderizza i dati completi di una ricetta
 *      (immagine, titolo, categoria, area, ingredienti, procedimento)
 *      e gestisce il toggle aggiunta/rimozione dal ricettario personale.
 *   B) RECENSIONI: mostra le recensioni esistenti e gestisce il form
 *      per inserire/modificare/eliminare la propria recensione.
 *
 * COME VIENE IDENTIFICATA LA RICETTA:
 *   L'ID è passato come parametro nella query string dell'URL.
 *   Esempio: recipe.html?id=52772
 *   Si legge con: new URLSearchParams(window.location.search).get('id')
 *
 * DIPENDENZE (caricate prima in recipe.html):
 *   - api.js      (api.lookupById per i dettagli della ricetta)
 *   - storage.js  (getCookbooks, saveCookbooks, getReviews, saveReviews)
 *   - auth.js     (auth.checkAuth, auth.getCurrentUser)
 *
 * DEVTOOLS — Cosa mostrare in questa pagina:
 *
 *   PRIMA di aggiungere al ricettario:
 *     localStorage → pgrc_cookbooks → il tuo userId → array vuoto []
 *
 *   DOPO aver aggiunto la ricetta:
 *     localStorage → pgrc_cookbooks → il tuo userId → [{"mealId":"52772","notes":""}]
 *
 *   DOPO aver inviato una recensione:
 *     localStorage → pgrc_reviews → {"52772": [{"userId":"user_XXX","username":"...","preparationDate":"2025-03-15","date":"2025-...","difficulty":3,"taste":5}]}
 *
 *   DOPO aver rimosso la ricetta dal ricettario:
 *     localStorage → pgrc_cookbooks → il tuo userId → array vuoto []
 *
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    // async perché si fa subito await loadRecipeDetails() in fondo

    // ─── GUARDIA AUTENTICAZIONE ───────────────────────────────────────────────
    auth.checkAuth();

    // ─── Utente corrente (usato ovunque: ricettario, recensioni) ─────────────
    // getCurrentUser() legge l'ID da sessionStorage, poi trova l'utente in localStorage
    const currentUser = auth.getCurrentUser();

    // ─── Riferimenti DOM ─────────────────────────────────────────────────────
    // Il card-body dentro #recipe-detail-container è il target dove iniettare l'HTML della ricetta
    const recipeCardBody = document.querySelector('#recipe-detail-container .card-body');
    const reviewsList = document.getElementById('reviews-list');    // Lista recensioni esistenti
    const reviewForm = document.getElementById('review-form');      // Form di inserimento
    const deleteReviewBtn = document.getElementById('delete-review-btn'); // Pulsante rimozione

    // ─── Lettura dell'ID dalla query string ───────────────────────────────────
    // URLSearchParams è un'API nativa del browser per leggere i parametri URL.
    // window.location.search è la parte "?id=52772" dell'URL corrente.
    const params = new URLSearchParams(window.location.search);
    const mealId = params.get('id'); // Restituisce "52772" oppure null

    // Caso limite: se l'URL non contiene ?id=, mostra errore e interrompe
    if (!mealId) {
        recipeCardBody.innerHTML = '<p class="text-danger">ID ricetta non trovato.</p>';
        return;
    }

    // =========================================================================
    // FUNZIONE HELPER: renderStars
    // =========================================================================
    /**
     * Genera HTML con stelle piene/vuote usando Bootstrap Icons.
     *
     * @param {number} count - Numero di stelle piene (da 1 a 5)
     * @returns {string} Stringa HTML con 5 icone <i> (alcune piene, alcune vuote)
     *
     * ESEMPI:
     *   renderStars(3) → "⭐⭐⭐☆☆" (ma con icone Bootstrap)
     *   renderStars(5) → "⭐⭐⭐⭐⭐"
     *   renderStars(1) → "⭐☆☆☆☆"
     *
     * Le classi usate:
     *   bi-star-fill → stella piena (gialla con text-warning)
     *   bi-star      → stella vuota
     *   text-warning → colore giallo Bootstrap
     */
    function renderStars(count) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            // Se i è ≤ count, stella piena; altrimenti stella vuota
            html += `<i class="bi bi-star${i <= count ? '-fill' : ''} text-warning"></i>`;
        }
        return html;
    }

    // =========================================================================
    // FUNZIONE: loadRecipeDetails
    // =========================================================================
    /**
     * Scarica i dettagli completi della ricetta dall'API e renderizza l'HTML.
     *
     * FLUSSO DETTAGLIATO:
     *   1. Chiama api.lookupById(mealId) → aspetta la risposta
     *   2. Se la risposta è nulla o vuota → mostra errore
     *   3. Estrae l'oggetto pasto (sempre meals[0], è sempre un singolo risultato)
     *   4. Costruisce l'array degli ingredienti iterando su strIngredient1...20
     *   5. Verifica se la ricetta è già nel ricettario dell'utente
     *   6. Genera e inietta l'HTML completo nel card-body
     *   7. Aggiunge il listener al pulsante ricettario
     *
     * ESTRAZIONE INGREDIENTI — il loop da 1 a 20:
     *   TheMealDB usa campi separati: strIngredient1, strIngredient2, ..., strIngredient20
     *   e strMeasure1, strMeasure2, ..., strMeasure20.
     *   I campi non usati sono "" (stringa vuota). Il controllo `ingredient.trim()`
     *   filtra via gli slot vuoti.
     *   Esempio per una ricetta con 8 ingredienti: solo i primi 8 slot sono valorizzati.
     *
     * HTML GENERATO (struttura Bootstrap):
     *   <div class="row g-4 mb-4">         ← riga superiore: immagine + info
     *     <div class="col-md-4">immagine</div>
     *     <div class="col-md-8">titolo + badge + pulsante ricettario</div>
     *   </div>
     *   <div class="row g-4">              ← riga inferiore: ingredienti + procedimento
     *     <div class="col-md-4">lista ingredienti</div>
     *     <div class="col-md-8">istruzioni</div>
     *   </div>
     */
    async function loadRecipeDetails() {
        const data = await api.lookupById(mealId);

        if (!data || !data.meals) {
            recipeCardBody.innerHTML = '<p class="text-danger">Ricetta non trovata.</p>';
            return;
        }

        const meal = data.meals[0]; // L'API restituisce sempre un array di 1 elemento

        // Costruzione array ingredienti
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ingredient = meal[`strIngredient${i}`]; // Accesso dinamico con template string
            const measure = meal[`strMeasure${i}`];
            // Filtra slot vuoti: ingredient deve esistere e non essere solo spazi
            if (ingredient && ingredient.trim()) {
                // Combina misura e ingrediente: "2 cups Flour"
                ingredients.push(`${measure ? measure.trim() + ' ' : ''}${ingredient.trim()}`);
            }
        }

        const inCookbook = checkCookbookStatus(); // true se già nel ricettario

        // Template string HTML — si usa backtick per stringhe multi-riga
        recipeCardBody.innerHTML = `
            <div class="row g-4 mb-4">
                <div class="col-md-4">
                    <img src="${meal.strMealThumb}" class="img-fluid rounded shadow-sm w-100"
                         alt="${meal.strMeal}">
                </div>
                <div class="col-md-8">
                    <h2 class="mb-3">${meal.strMeal}</h2>
                    <div class="mb-3">
                        <span class="badge bg-primary me-2">${meal.strCategory}</span>
                        <span class="badge bg-secondary">${meal.strArea}</span>
                    </div>
                    <button type="button" id="cookbook-btn"
                            class="btn ${inCookbook ? 'btn-danger' : 'btn-primary'}">
                        <i class="bi ${inCookbook ? 'bi-bookmark-x' : 'bi-bookmark-plus'} me-1"></i>
                        ${inCookbook ? 'Rimuovi dal Ricettario' : 'Aggiungi al Ricettario'}
                    </button>
                </div>
            </div>
            <div class="row g-4">
                <div class="col-md-4">
                    <h4 class="mb-3"><i class="bi bi-list-ul me-2"></i>Ingredienti</h4>
                    <ul class="list-group list-group-flush">
                        ${ingredients.map(ing => `<li class="list-group-item px-0">${ing}</li>`).join('')}
                    </ul>
                </div>
                <div class="col-md-8">
                    <h4 class="mb-3"><i class="bi bi-journal-text me-2"></i>Procedimento</h4>
                    <p class="lh-lg">${meal.strInstructions.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        `;
        // NOTA: .replace(/\n/g, '<br>') converte le newline del testo in tag HTML <br>
        // perché dentro un <p> le newline non vengono visualizzate

        // Aggiunge il listener al pulsante DOPO averlo creato con innerHTML
        // (prima di innerHTML il bottone non esisteva nel DOM)
        document.getElementById('cookbook-btn').addEventListener('click', toggleCookbook);
    }

    // =========================================================================
    // FUNZIONE: checkCookbookStatus
    // =========================================================================
    /**
     * Controlla se la ricetta corrente è già nel ricettario dell'utente.
     *
     * FLUSSO:
     *   1. Legge l'intero oggetto cookbooks da localStorage
     *   2. Prende l'array del ricettario dell'utente corrente (o [] se assente)
     *   3. Verifica se esiste un elemento con mealId uguale al mealId corrente
     *
     * @returns {boolean} true se la ricetta è nel ricettario, false altrimenti
     *
     * DEVTOOLS — Console per verificare manualmente:
     *   JSON.parse(localStorage.getItem('pgrc_cookbooks'))[sessionStorage.getItem('pgrc_loggedInUser')]
     */
    function checkCookbookStatus() {
        const userCookbook = getCookbooks()[currentUser.id] || [];
        return userCookbook.some(r => r.mealId === mealId);
        // Array.some restituisce true se ALMENO un elemento soddisfa la condizione
    }

    // =========================================================================
    // FUNZIONE: toggleCookbook
    // =========================================================================
    /**
     * Aggiunge o rimuove la ricetta corrente dal ricettario dell'utente.
     * Chiamata dal click sul pulsante #cookbook-btn.
     *
     * FLUSSO:
     *   1. Legge il ricettario attuale da localStorage
     *   2. Cerca l'indice della ricetta corrente nell'array (findIndex)
     *   3. Se trovata (idx > -1): la rimuove con splice (modifica l'array in-place)
     *   4. Se non trovata (idx = -1): la aggiunge con push (oggetto {mealId, notes:""})
     *   5. Salva il ricettario aggiornato in localStorage
     *   6. Aggiorna l'aspetto del pulsante SENZA ricaricare la pagina
     *
     * LOGICA DEL PULSANTE POST-TOGGLE:
     *   `nowInCookbook = (idx === -1)` perché:
     *   - Se idx era -1 (non c'era) → abbiamo appena AGGIUNTO → ora è nel ricettario
     *   - Se idx era ≥ 0 (c'era) → abbiamo appena RIMOSSO → ora non è nel ricettario
     *
     * NOTA: la nota (notes) viene inizializzata a "" quando si aggiunge la ricetta.
     *   L'utente può poi scrivere la nota dalla pagina profile.html.
     */
    function toggleCookbook() {
        const cookbooks = getCookbooks();
        let userCookbook = cookbooks[currentUser.id] || [];
        const idx = userCookbook.findIndex(r => r.mealId === mealId);

        if (idx > -1) {
            // Ricetta trovata → rimuovila
            // splice(idx, 1): rimuove 1 elemento a partire dall'indice idx
            userCookbook.splice(idx, 1);
        } else {
            // Ricetta non trovata → aggiungila
            userCookbook.push({ mealId, notes: '' });
        }

        cookbooks[currentUser.id] = userCookbook;
        saveCookbooks(cookbooks); // Persiste in localStorage

        // Aggiorna il pulsante dinamicamente
        const nowInCookbook = idx === -1; // true se abbiamo appena aggiunto
        const btn = document.getElementById('cookbook-btn');
        btn.className = `btn ${nowInCookbook ? 'btn-danger' : 'btn-primary'}`;
        btn.innerHTML = `
            <i class="bi ${nowInCookbook ? 'bi-bookmark-x' : 'bi-bookmark-plus'} me-1"></i>
            ${nowInCookbook ? 'Rimuovi dal Ricettario' : 'Aggiungi al Ricettario'}
        `;
    }

    // =========================================================================
    // FUNZIONE: loadReviews
    // =========================================================================
    /**
     * Carica e renderizza le recensioni della ricetta corrente.
     * Chiamata all'avvio E dopo ogni modifica (submit, delete) per aggiornare la UI.
     *
     * FLUSSO:
     *   1. Legge tutte le recensioni da localStorage (oggetto {mealId: [...]})
     *   2. Estrae l'array delle recensioni per il mealId corrente (o [] se nessuna)
     *   3. Se l'array è vuoto → mostra messaggio "Nessuna recensione"
     *   4. Altrimenti → per ogni recensione genera una Bootstrap Card con stelle
     *   5. Cerca se l'utente CORRENTE ha già una recensione
     *   6. Se sì: precompila il form con i suoi valori + mostra pulsante "Rimuovi"
     *   7. Se no: nasconde il pulsante "Rimuovi"
     *
     * STRUTTURA HTML CARD RECENSIONE:
     *   <div class="card mb-2">
     *     <div class="card-body">
     *       <div class="d-flex justify-content-between">  ← username + date (dx)
     *       <div class="d-flex gap-4">                    ← stelle difficoltà + gusto
     *     </div>
     *   </div>
     *
     * DATE MOSTRATE:
     *   - "Preparato il": la data che l'utente ha inserito nel form (campo review-date)
     *   - "Recensito il": il timestamp ISO della submission del form
     *   Entrambe formattate con toLocaleDateString('it-IT') → "15/03/2025"
     */
    function loadReviews() {
        const allReviews = getReviews();              // Tutto l'oggetto recensioni
        const mealReviews = allReviews[mealId] || []; // Solo quelle per questa ricetta
        reviewsList.innerHTML = '';                    // Svuota la lista

        if (mealReviews.length === 0) {
            reviewsList.innerHTML = '<p class="text-muted">Nessuna recensione per questa ricetta.</p>';
        } else {
            mealReviews.forEach(review => {
                const el = document.createElement('div');
                el.className = 'card mb-2';
                el.innerHTML = `
                    <div class="card-body py-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <strong>${review.username}</strong>
                            <small class="text-muted text-end">
                                Preparato il: ${new Date(review.preparationDate).toLocaleDateString('it-IT')}<br>
                                Recensito il: ${new Date(review.date).toLocaleDateString('it-IT')}
                            </small>
                        </div>
                        <div class="d-flex gap-4">
                            <span><strong>Difficolt&agrave;:</strong> ${renderStars(review.difficulty)}</span>
                            <span><strong>Gusto:</strong> ${renderStars(review.taste)}</span>
                        </div>
                    </div>
                `;
                reviewsList.appendChild(el);
            });
        }

        // Controlla se l'utente corrente ha già recensito questa ricetta
        const userReview = mealReviews.find(r => r.userId === currentUser.id);
        if (userReview) {
            // Precompila il form con i valori esistenti
            document.getElementById('review-date').value = userReview.preparationDate;
            document.getElementById('review-difficulty').value = userReview.difficulty;
            document.getElementById('review-taste').value = userReview.taste;
            // Mostra il pulsante "Rimuovi Recensione"
            deleteReviewBtn.classList.remove('hidden');
        } else {
            // L'utente non ha ancora recensito: pulsante rimozione nascosto
            deleteReviewBtn.classList.add('hidden');
        }
    }

    // =========================================================================
    // EVENT LISTENERS: Form Recensione
    // =========================================================================

    /**
     * LISTENER: submit del form di recensione
     *
     * FLUSSO:
     *   1. e.preventDefault() blocca il comportamento default del form
     *   2. Legge le reviews esistenti per questa ricetta da localStorage
     *   3. Filtra via l'eventuale recensione precedente dell'utente corrente
     *      (implementa la regola "una sola recensione per utente per ricetta")
     *   4. Crea il nuovo oggetto recensione con tutti i campi
     *   5. Aggiunge la nuova recensione all'array filtrato
     *   6. Salva in localStorage
     *   7. Resetta il form (svuota i campi)
     *   8. Richiama loadReviews() per aggiornare la UI
     *
     * STRUTTURA OGGETTO RECENSIONE SALVATA:
     *   {
     *     userId: "user_1712345678900",  ← per identificare chi ha recensito
     *     username: "mario_rossi",       ← per mostrarlo nella UI senza join
     *     preparationDate: "2025-03-15", ← data inserita dall'utente (campo date HTML)
     *     date: "2025-03-16T14:32:00.000Z", ← timestamp ISO della submission
     *     difficulty: 3,                 ← parseInt dal campo input
     *     taste: 5                       ← parseInt dal campo input
     *   }
     *
     * NOTA: parseInt() converte la stringa del campo <input type="number"> in intero.
     * I valori del DOM sono sempre stringhe; senza parseInt sarebbero "3" e "5".
     */
    reviewForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const allReviews = getReviews();
        // Filtra via la recensione esistente dell'utente (se presente)
        // Così si garantisce: max 1 recensione per utente per ricetta
        let mealReviews = (allReviews[mealId] || []).filter(r => r.userId !== currentUser.id);

        // Aggiunge la nuova recensione (o la sostituzione di quella precedente)
        mealReviews.push({
            userId: currentUser.id,
            username: currentUser.username,
            preparationDate: document.getElementById('review-date').value,
            date: new Date().toISOString(), // Timestamp ISO del momento di invio
            difficulty: parseInt(document.getElementById('review-difficulty').value),
            taste: parseInt(document.getElementById('review-taste').value)
        });

        allReviews[mealId] = mealReviews;
        saveReviews(allReviews); // Persiste in localStorage

        reviewForm.reset();  // Svuota tutti i campi del form
        loadReviews();       // Ricarica la lista recensioni (ora include la nuova)
    });

    /**
     * LISTENER: click su "Rimuovi Recensione"
     *
     * FLUSSO:
     *   1. Legge tutte le recensioni
     *   2. Filtra via la recensione dell'utente corrente per questa ricetta
     *   3. Salva le recensioni aggiornate
     *   4. Resetta il form e ricarica la lista
     *
     * NOTA: non si chiede conferma perché la recensione può essere reinserita
     * immediatamente dopo la rimozione.
     */
    deleteReviewBtn.addEventListener('click', () => {
        const allReviews = getReviews();
        // Rimuove solo la recensione dell'utente corrente per QUESTA ricetta
        allReviews[mealId] = (allReviews[mealId] || []).filter(r => r.userId !== currentUser.id);
        saveReviews(allReviews);
        reviewForm.reset();
        loadReviews(); // Aggiorna la UI (il form sarà vuoto, pulsante rimuovi sparirà)
    });

    // ─── AVVIO: carica dettagli ricetta e poi recensioni ─────────────────────
    // await loadRecipeDetails() aspetta che l'HTML della ricetta sia iniettato
    // (comprensivo del pulsante #cookbook-btn che serve il listener)
    // Solo DOPO si chiama loadReviews() che non dipende dalla ricetta stessa.
    await loadRecipeDetails();
    loadReviews();
});
