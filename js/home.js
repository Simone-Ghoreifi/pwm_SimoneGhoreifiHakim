/**
 * =============================================================================
 * home.js — Controller della pagina home.html (Ricerca Ricette)
 * =============================================================================
 *
 * Gestisce tutta la logica interattiva della pagina di ricerca:
 *   - Popolamento dinamico dei filtri (categorie e aree) con cache localStorage
 *   - Ricerca per nome, ingrediente, categoria, area e iniziale
 *   - Caricamento dell'intero catalogo in localStorage allo startup della home
 *   - Rendering dei risultati come Bootstrap Cards
 *
 * DIPENDENZE (caricate prima in home.html):
 *   - api.js      (oggetto `api` con tutti gli endpoint TheMealDB)
 *   - storage.js  (cache catalogo, categorie e aree)
 *   - auth.js     (auth.checkAuth per proteggere la pagina)
 *
 * ELEMENTI DOM GESTITI:
 *   #search-type      → <select> "Per Nome" / "Per Ingrediente"
 *   #search-input     → <input text> campo di testo libero
 *   #category-filter  → <select> filtro categoria (popolato dinamicamente)
 *   #area-filter      → <select> filtro area geografica (popolato dinamicamente)
 *   #letter-filter    → <select> filtro lettera iniziale A-Z
 *   #results-container→ <div> griglia Bootstrap dove vengono iniettate le card
 *   #search-message   → <p> per messaggi di stato ("Caricamento...", "Nessun risultato")
 *
 * =============================================================================
 * LOGICA DI RICERCA — Le modalità mutuamente esclusive:
 * =============================================================================
 *
 *   1. CATEGORIA selezionata → api.filterByCategory()
 *      (svuota testo e area)
 *
 *   2. AREA selezionata → api.filterByArea()
 *      (svuota testo e categoria)
 *
 *   3. LETTERA selezionata → api.filterByStartLetter()
 *      (svuota testo, categoria e area)
 *
 *   4. TESTO + tipo "nome" → api.searchByName()
 *      (con debounce 500ms)
 *
 *   5. TESTO + tipo "ingrediente" → api.searchByIngredient()
 *      (con debounce 500ms)
 *
 *   6. NESSUN FILTRO → loadAllMeals() → catalogo completo con cache localStorage
 *
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─── GUARDIA AUTENTICAZIONE ───────────────────────────────────────────────
    // Prima di qualsiasi altra cosa: se non c'è sessione attiva, redirect a login.
    // auth.checkAuth() legge sessionStorage e reindirizza a index.html se null.
    auth.checkAuth();

    // ─── Riferimenti DOM ─────────────────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchType = document.getElementById('search-type');       // select "Per Nome/Ingrediente"
    const categoryFilter = document.getElementById('category-filter');
    const areaFilter = document.getElementById('area-filter');
    const letterFilter = document.getElementById('letter-filter');
    const resultsContainer = document.getElementById('results-container'); // la griglia Bootstrap row
    const searchMessage = document.getElementById('search-message');

    // ─── Variabile per il debounce ────────────────────────────────────────────
    // Tiene l'ID del timeout corrente per poterlo cancellare se l'utente
    // continua a digitare prima che il precedente sia scaduto.
    let debounceTimer;

    function setSearchControlsDisabled(disabled) {
        [searchInput, searchType, categoryFilter, areaFilter, letterFilter].forEach(control => {
            control.disabled = disabled;
        });
    }

    function resetSelectOptions(selectElement) {
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }
    }

    function appendOptions(selectElement, items, getValue) {
        resetSelectOptions(selectElement);
        items.forEach(item => {
            const value = getValue(item);
            if (!value) return;

            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = value;
            selectElement.appendChild(opt);
        });
    }

    function getCachedMealsByPredicate(predicate) {
        const cachedMeals = getMealsCache();
        return cachedMeals ? cachedMeals.filter(predicate) : null;
    }

    function mealHasIngredient(meal, searchTerm) {
        const normalizedTerm = searchTerm.toLowerCase();

        for (let i = 1; i <= 20; i++) {
            const ingredient = meal[`strIngredient${i}`];
            if (ingredient && ingredient.toLowerCase().includes(normalizedTerm)) {
                return true;
            }
        }

        return false;
    }

    // =========================================================================
    // FUNZIONE: populateFilters
    // =========================================================================
    /**
     * Popola i due menù a tendina (categoria e area) con dati salvati nel Web Storage.
     * Viene chiamata UNA SOLA VOLTA al caricamento della pagina.
     *
     * FLUSSO:
     *   1. Prova a leggere pgrc_categories_cache
     *   2. Se manca/scade, chiama api.listAllCategories() e salva la cache
     *   3. Per ogni categoria crea un <option> e lo appende al <select> categorie
     *   4. Prova a leggere pgrc_areas_cache
     *   5. Se manca/scade, chiama api.listAllAreas() e salva la cache
     *   6. Per ogni area crea un <option> e lo appende al <select> aree
     *
     * NOTA: i <select> in HTML hanno già un'opzione di default ("Tutte le Categorie"
     * e "Tutte le Aree") con valore "" — questa non viene toccata qui.
     *
     * DEVTOOLS:
     *   Alla prima visita appaiono pgrc_categories_cache e pgrc_areas_cache.
     *   Alle visite successive i filtri sono popolati senza chiamate API finché
     *   la cache non scade.
     */
    async function populateFilters() {
        let categories = getCategoriesCache();
        if (!categories) {
            const categoriesData = await api.listAllCategories();
            categories = categoriesData && categoriesData.categories ? categoriesData.categories : [];
            if (categories.length > 0) saveCategoriesCache(categories);
        }
        appendOptions(categoryFilter, categories, category => category.strCategory);

        let areas = getAreasCache();
        if (!areas) {
            const areasData = await api.listAllAreas();
            // NOTA: l'API restituisce le aree dentro "meals" (non "areas")
            areas = areasData && areasData.meals ? areasData.meals : [];
            if (areas.length > 0) saveAreasCache(areas);
        }
        appendOptions(areaFilter, areas, area => area.strArea);
    }

    // =========================================================================
    // FUNZIONE: displayResults
    // =========================================================================
    /**
     * Svuota il container e renderizza le ricette come Bootstrap Cards.
     *
     * @param {Array|null} meals - Array di oggetti pasto, o null se nessun risultato
     *
     * STRUTTURA HTML GENERATA PER OGNI RICETTA:
     *   <div class="col">                       ← colonna del sistema Bootstrap row-cols
     *     <a href="recipe.html?id=52772">        ← link che passa l'ID nella query string
     *       <div class="card recipe-card">
     *         <img class="card-img-top" ...>    ← immagine 190px (impostata in home.css)
     *         <div class="card-body">
     *           <h5 class="card-title">...</h5>
     *         </div>
     *       </div>
     *     </a>
     *   </div>
     *
     * COME FUNZIONA LA NAVIGAZIONE ALLE RICETTE:
     *   Il link href="recipe.html?id=52772" passa l'ID come query string parameter.
     *   recipe.js al caricamento usa URLSearchParams per leggere quell'ID:
     *     const params = new URLSearchParams(window.location.search);
     *     const mealId = params.get('id'); // → "52772"
     */
    function displayResults(meals) {
        resultsContainer.innerHTML = ''; // Svuota i risultati precedenti

        if (!meals || meals.length === 0) {
            searchMessage.textContent = 'Nessuna ricetta trovata. Prova con un altro termine.';
            return; // Esci dalla funzione — non c'è nulla da renderizzare
        }

        searchMessage.textContent = ''; // Nascondi messaggi di stato

        meals.forEach(meal => {
            const col = document.createElement('div');
            col.className = 'col'; // Colonna Bootstrap (larghezza gestita dal row-cols sul padre)

            // innerHTML genera tutto l'HTML della card in una stringa template
            col.innerHTML = `
                <a href="recipe.html?id=${meal.idMeal}" class="text-decoration-none">
                    <div class="card h-100 recipe-card shadow-sm">
                        <img src="${meal.strMealThumb}" class="card-img-top" alt="${meal.strMeal}">
                        <div class="card-body">
                            <h5 class="card-title text-dark mb-0">${meal.strMeal}</h5>
                        </div>
                    </div>
                </a>
            `;
            resultsContainer.appendChild(col); // Aggiunge la colonna alla griglia
        });
    }

    // =========================================================================
    // FUNZIONE: loadAllMeals (con caching localStorage)
    // =========================================================================
    /**
     * Scarica TUTTE le ricette del catalogo TheMealDB, usando la cache se disponibile.
     *
     * STRATEGIA DI CACHING (perché necessaria):
     *   TheMealDB non ha un endpoint "dammi tutte le ricette".
     *   L'unico modo è chiamare filterByStartLetter per ogni lettera A-Z (26 chiamate).
     *   Fare 26 fetch ad ogni caricamento della home sarebbe lento e rischioso
     *   per i rate limits dell'API. Soluzione: si fa una volta e si salva in localStorage.
     *
     * FLUSSO DETTAGLIATO:
     *   1. getMealsCache() → controlla se la cache esiste ed è fresca (< 1h)
     *      - Se SÌ: restituisce subito l'array cached → FINE (0 chiamate API)
     *      - Se NO: procede al passo 2
     *   2. Mostra il messaggio "Caricamento ricette in corso…"
     *   3. Crea un array di 26 Promise (una per lettera) chiamando api.filterByStartLetter
     *   4. Promise.all esegue TUTTE le 26 chiamate IN PARALLELO (non in sequenza!)
     *      Tempo totale ≈ tempo della chiamata più lenta, non la somma di tutte.
     *   5. Concatena tutti gli array di risultati in un unico array piatto
     *   6. Salva in localStorage con saveMealsCache(meals) → timestamp + array
     *   7. Restituisce l'array completo
     *
     * @returns {Promise<Array>} Array di tutti i pasti del catalogo
     *
     * DEVTOOLS — PRIMA VISITA:
     *   Scheda Network: vedrai le chiamate A-Z, categorie e aree se cache assenti
     *   Application → localStorage → pgrc_meals_cache, pgrc_categories_cache, pgrc_areas_cache
     *
     * DEVTOOLS — VISITE SUCCESSIVE (cache valida):
     *   La home legge catalogo e filtri dal Web Storage, senza chiamate API.
     *
     * Per verificare l'età della cache in Console:
     *   const c = JSON.parse(localStorage.getItem('pgrc_meals_cache'));
     *   console.log('Ricette in cache:', c.meals.length);
     *   console.log('Età (minuti):', Math.round((Date.now() - c.timestamp) / 60000));
     */
    async function loadAllMeals() {
        const cached = getMealsCache(); // Tenta di leggere dalla cache
        if (cached) return cached;      // Cache hit: restituisce subito senza API

        searchMessage.textContent = 'Caricamento ricette in corso…';

        // Crea array delle 26 lettere: ['a', 'b', 'c', ..., 'z']
        const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

        // Promise.all prende un array di Promise e ne aspetta il completamento
        // di TUTTE in parallelo. Se una fallisce, Promise.all fallisce (ma
        // fetchFromApi non lancia mai, restituisce null in caso di errore).
        const results = await Promise.all(alphabet.map(l => api.filterByStartLetter(l)));

        // Concatena i risultati: results è un array di 26 risposte API
        // Ogni risposta può essere { meals: [...] } o null
        let meals = [];
        results.forEach(r => {
            if (r && r.meals) meals = meals.concat(r.meals); // Aggiunge al flat array
        });

        saveMealsCache(meals); // Salva in localStorage per le visite future
        return meals;
    }

    // =========================================================================
    // FUNZIONE: performSearch (asincrona, cuore della logica di ricerca)
    // =========================================================================
    /**
     * Determina la modalità di ricerca corretta e aggiorna i risultati.
     * Chiamata da tutti gli event listener (input, change dei select).
     *
     * LOGICA CONDIZIONALE (ordine importante — le condizioni sono mutuamente esclusive):
     *
     *   if (categoria selezionata)       → filtra pgrc_meals_cache o fallback API
     *   else if (area selezionata)       → filtra pgrc_meals_cache o fallback API
     *   else if (lettera selezionata)    → filtra pgrc_meals_cache o fallback API
     *   else if (testo inserito)
     *     if (tipo = ingrediente)        → filtra ingredienti cache o fallback API
     *     else (tipo = nome, default)    → filtra nomi cache o fallback API
     *   else (nessun filtro)             → loadAllMeals (con cache)
     *
     * I filtri a tendina e il testo vengono svuotati l'uno quando si usa l'altro
     * (vedi i listener), quindi di fatto solo una condizione può essere vera.
     */
    async function performSearch() {
        const searchTerm = searchInput.value.trim(); // .trim() rimuove spazi iniziali/finali
        const category = categoryFilter.value;       // "" se "Tutte le Categorie"
        const area = areaFilter.value;               // "" se "Tutte le Aree"
        const startLetter = letterFilter.value;       // "" se "Tutte"
        const type = searchType.value;               // "name" o "ingredient"

        // Reset UI
        resultsContainer.innerHTML = '';
        searchMessage.textContent = 'Caricamento…';

        let meals = null;

        if (category) {
            // Prima usa il catalogo in localStorage; API solo se la cache non c'è.
            meals = getCachedMealsByPredicate(meal => meal.strCategory === category);
            if (!meals) {
                const data = await api.filterByCategory(category);
                meals = data ? data.meals : null;
            }

        } else if (area) {
            meals = getCachedMealsByPredicate(meal => meal.strArea === area);
            if (!meals) {
                const data = await api.filterByArea(area);
                meals = data ? data.meals : null;
            }

        } else if (startLetter) {
            meals = getCachedMealsByPredicate(meal => (
                meal.strMeal && meal.strMeal.toLowerCase().startsWith(startLetter)
            ));
            if (!meals) {
                const data = await api.filterByStartLetter(startLetter);
                meals = data ? data.meals : null;
            }

        } else if (searchTerm) {
            // Testo inserito: comportamento dipende dal tipo selezionato
            if (type === 'ingredient') {
                meals = getCachedMealsByPredicate(meal => mealHasIngredient(meal, searchTerm));
                if (!meals) {
                    const data = await api.searchByIngredient(searchTerm);
                    meals = data ? data.meals : null;
                }
            } else {
                const normalizedTerm = searchTerm.toLowerCase();
                meals = getCachedMealsByPredicate(meal => (
                    meal.strMeal && meal.strMeal.toLowerCase().includes(normalizedTerm)
                ));
                if (!meals) {
                    const data = await api.searchByName(searchTerm);
                    meals = data ? data.meals : null;
                }
            }
        } else {
            // Nessun filtro attivo: carica tutto il catalogo (con cache)
            meals = await loadAllMeals();
        }

        displayResults(meals); // Renderizza qualsiasi risultato (o messaggio "nessun risultato")
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================

    /**
     * LISTENER: cambio del tipo di ricerca (Per Nome / Per Ingrediente)
     *
     * Aggiorna il placeholder dell'input per guidare l'utente, e rilancia
     * la ricerca se c'è già del testo inserito nel campo.
     */
    searchType.addEventListener('change', () => {
        searchInput.placeholder = searchType.value === 'ingredient'
            ? 'es. chicken, tomato, cheese…'
            : 'es. Pasta, Curry…';
        if (searchInput.value.trim()) performSearch(); // Rilancia se c'è testo
    });

    /**
     * LISTENER: digitazione nel campo di ricerca
     *
     * DEBOUNCE: tecnica per evitare di chiamare l'API a ogni keystroke.
     *   - clearTimeout(debounceTimer): cancella il timer precedente (se esiste)
     *   - setTimeout(..., 500): pianifica performSearch tra 500ms
     *   - Se l'utente digita di nuovo prima dei 500ms → il timer precedente viene
     *     cancellato e riparte da 0
     *   - La chiamata API viene fatta solo DOPO 500ms di inattività
     *
     * RESET FILTRI: quando si usa il testo, si svuotano categoria e area
     * per garantire la mutua esclusività delle modalità di ricerca.
     */
    searchInput.addEventListener('input', () => {
        categoryFilter.value = '';  // Deseleziona categoria
        areaFilter.value = '';      // Deseleziona area
        letterFilter.value = '';    // Deseleziona lettera iniziale
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(performSearch, 500); // 500ms di debounce
    });

    /**
     * LISTENER: cambio del filtro categoria
     *
     * Svuota il testo e l'area, poi esegue la ricerca immediatamente
     * (non serve debounce perché il cambio di una select non è continuo).
     */
    categoryFilter.addEventListener('change', () => {
        searchInput.value = ''; // Svuota il campo testo
        areaFilter.value = '';  // Deseleziona area
        letterFilter.value = ''; // Deseleziona lettera iniziale
        performSearch();        // Ricerca immediata
    });

    /**
     * LISTENER: cambio del filtro area
     * Simmetrico al listener della categoria.
     */
    areaFilter.addEventListener('change', () => {
        searchInput.value = '';    // Svuota il campo testo
        categoryFilter.value = ''; // Deseleziona categoria
        letterFilter.value = '';   // Deseleziona lettera iniziale
        performSearch();           // Ricerca immediata
    });

    /**
     * LISTENER: cambio del filtro per lettera iniziale.
     * Svuota gli altri criteri e interroga l'endpoint search.php?f={letter}.
     */
    letterFilter.addEventListener('change', () => {
        searchInput.value = '';
        categoryFilter.value = '';
        areaFilter.value = '';
        performSearch();
    });

    async function initializeRecipeData() {
        setSearchControlsDisabled(true);
        try {
            await Promise.all([
                populateFilters(),
                performSearch()
            ]);
        } finally {
            setSearchControlsDisabled(false);
        }
    }

    // ─── AVVIO: startup della prima pagina applicativa autenticata ───────────
    // Qui vengono preparati catalogo, categorie e aree nel Web Storage.
    initializeRecipeData();
});
