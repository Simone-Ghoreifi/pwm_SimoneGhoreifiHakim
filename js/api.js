/**
 * =============================================================================
 * api.js — Livello API: wrapper per tutte le chiamate a TheMealDB
 * =============================================================================
 *
 * Questo modulo centralizza TUTTE le comunicazioni con il servizio esterno
 * TheMealDB (https://www.themealdb.com/api/json/v1/1/).
 * Espone un oggetto globale `api` con metodi che corrispondono agli endpoint
 * REST disponibili.
 *
 * PERCHÉ UN MODULO SEPARATO?
 *   Se in futuro si volesse cambiare sorgente dati (es. sorgente dati v2 o
 *   un back-end proprietario), basta modificare solo questo file.
 *   Tutti i controller (home.js, recipe.js, profile.js) rimangono invariati.
 *
 * STRUTTURA TIPICA DELLA RISPOSTA THEMEALDB:
 *   La maggior parte degli endpoint restituisce: { meals: [ {...}, {...}, ... ] }
 *   Se non ci sono risultati: { meals: null }
 *   In caso di errore HTTP: la funzione fetchFromApi restituisce null
 *
 * NOTA SUGLI INGREDIENTI:
 *   TheMealDB non usa un array per gli ingredienti. Ogni ricetta ha 20 coppie
 *   di campi come strIngredient1/strMeasure1, ..., strIngredient20/strMeasure20.
 *   I campi non usati sono stringa vuota "" o null. Questa peculiarità è gestita
 *   in recipe.js con un ciclo da 1 a 20.
 *
 * COME VERIFICARE LE CHIAMATE API IN DEVTOOLS:
 *   1. Aprire DevTools → scheda "Rete" (o "Network")
 *   2. Fare clic su "Fetch/XHR" nel filtro in alto per vedere solo le chiamate API
 *   3. Ricaricare la pagina o eseguire una ricerca
 *   4. Ogni chiamata apparirà come riga: fare clic per vedere URL, risposta JSON, timing
 *   5. Nella scheda "Anteprima" (Preview) si vede il JSON formattato della risposta
 *
 * CACHE E RETE:
 *   Se pgrc_meals_cache è valida (< 1h), la scheda Rete NON mostrerà le 26 chiamate
 *   A-Z perché vengono servite dalla cache. Questo dimostra al prof il funzionamento
 *   del caching: prima visita = 26 chiamate visibili; visite successive = 0 chiamate.
 *
 * =============================================================================
 */

// URL base dell'API TheMealDB (versione gratuita, chiave "1")
const API_BASE_URL = 'https://www.themealdb.com/api/json/v1/1/';

/**
 * Funzione privata (non esportata) che esegue la chiamata HTTP GET all'API.
 * Tutti i metodi pubblici dell'oggetto `api` la usano internamente.
 *
 * FLUSSO:
 *   1. Costruisce l'URL completo: API_BASE_URL + endpoint
 *   2. Chiama fetch() (API nativa del browser, restituisce una Promise)
 *   3. Verifica che la risposta HTTP sia OK (status 200-299)
 *   4. Deserializza il corpo della risposta come JSON
 *   5. In caso di qualsiasi errore (rete, HTTP, JSON malformato) → restituisce null
 *
 * @param {string} endpoint - Parte dell'URL dopo il base (es. "search.php?s=pasta")
 * @returns {Promise<Object|null>} - L'oggetto JSON della risposta, o null se errore
 *
 * DEVTOOLS — Scheda Network: ogni chiamata a fetchFromApi produce una riga nella
 * lista delle richieste Fetch/XHR. Si può vedere l'URL completo, lo status code
 * (200 = OK) e il corpo della risposta JSON.
 */
async function fetchFromApi(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);

        // response.ok è true per status 200-299, false per 4xx/5xx
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        // response.json() è async: deserializza il body come JSON
        return await response.json();
    } catch (error) {
        // Cattura sia errori di rete (offline) sia errori HTTP (4xx, 5xx)
        console.error("API call failed:", error);
        return null; // I controller gestiscono il null controllando la risposta
    }
}

/**
 * Oggetto `api` — esposto globalmente, usato da home.js, recipe.js, profile.js.
 *
 * Ogni metodo è una arrow function che chiama fetchFromApi con l'endpoint corretto
 * e restituisce direttamente la Promise. I controller usano await per aspettare
 * il risultato (es. `const data = await api.searchByName('pasta')`).
 */
const api = {

    /**
     * Cerca tutte le ricette il cui nome inizia con una determinata lettera.
     * Usato da home.js per caricare il catalogo completo (chiama per A, B, C, ... Z).
     *
     * Endpoint: search.php?f={letter}
     * Risposta: { meals: [...ricette complete con tutti i campi...] }
     *
     * @param {string} letter - Lettera singola (es. 'a', 'b', ..., 'z')
     * @returns {Promise<{meals: Array}|null>}
     */
    filterByStartLetter: (letter) => fetchFromApi(`search.php?f=${letter}`),

    /**
     * Cerca ricette per nome (ricerca testuale).
     * Usato da home.js quando l'utente digita nel campo di ricerca con tipo "Per Nome".
     *
     * Endpoint: search.php?s={name}
     * Risposta: { meals: [...ricette che contengono `name` nel titolo...] }
     * Se nessun risultato: { meals: null }
     *
     * @param {string} name - Testo da cercare nel nome del piatto (es. "pasta")
     * @returns {Promise<{meals: Array|null}|null>}
     */
    searchByName: (name) => fetchFromApi(`search.php?s=${name}`),

    /**
     * Filtra ricette per ingrediente principale.
     * Usato da home.js quando l'utente seleziona "Per Ingrediente" e digita.
     *
     * Endpoint: filter.php?i={ingredient}
     * Risposta: { meals: [...ricette con anteprima (NO ingredienti completi, NO istruzioni)...] }
     * NOTA: questo endpoint restituisce solo idMeal, strMeal, strMealThumb (dati ridotti).
     *
     * @param {string} ingredient - Nome dell'ingrediente in inglese (es. "chicken", "tomato")
     * @returns {Promise<{meals: Array|null}|null>}
     */
    searchByIngredient: (ingredient) => fetchFromApi(`filter.php?i=${ingredient}`),

    /**
     * Recupera i dettagli completi di una ricetta tramite il suo ID numerico.
     * Usato da recipe.js per costruire la scheda dettagliata, e da profile.js
     * per caricare le ricette del ricettario (servono nome e immagine).
     *
     * Endpoint: lookup.php?i={id}
     * Risposta: { meals: [{ idMeal, strMeal, strCategory, strArea, strInstructions,
     *             strMealThumb, strIngredient1...20, strMeasure1...20, ... }] }
     * L'array meals contiene SEMPRE un solo elemento (o null se id non valido).
     *
     * @param {string} id - ID numerico TheMealDB della ricetta (es. "52772")
     * @returns {Promise<{meals: Array}|null>}
     */
    lookupById: (id) => fetchFromApi(`lookup.php?i=${id}`),

    /**
     * Recupera l'elenco di tutte le categorie disponibili con immagine e descrizione.
     * Usato da home.js per popolare il menù a tendina "Categoria" al caricamento.
     *
     * Endpoint: categories.php
     * Risposta: { categories: [{idCategory, strCategory, strCategoryThumb, strCategoryDescription}] }
     *
     * @returns {Promise<{categories: Array}|null>}
     */
    listAllCategories: () => fetchFromApi(`categories.php`),

    /**
     * Recupera l'elenco di tutte le aree geografiche (cucine del mondo).
     * Usato da home.js per popolare il menù a tendina "Area Geografica" al caricamento.
     *
     * Endpoint: list.php?a=list
     * Risposta: { meals: [{strArea: "Italian"}, {strArea: "Chinese"}, ...] }
     * NOTA: il campo si chiama "meals" anche se contiene aree, per uniformità API.
     *
     * @returns {Promise<{meals: Array}|null>}
     */
    listAllAreas: () => fetchFromApi(`list.php?a=list`),

    /**
     * Filtra le ricette per categoria.
     * Usato da home.js quando l'utente seleziona una categoria dal menù a tendina.
     *
     * Endpoint: filter.php?c={category}
     * Risposta: { meals: [...anteprima ricette (solo idMeal, strMeal, strMealThumb)...] }
     * NOTA: come filterByIngredient, NON restituisce i dettagli completi.
     *
     * @param {string} category - Nome categoria esatto (es. "Seafood", "Dessert")
     * @returns {Promise<{meals: Array|null}|null>}
     */
    filterByCategory: (category) => fetchFromApi(`filter.php?c=${category}`),

    /**
     * Filtra le ricette per area geografica.
     * Usato da home.js quando l'utente seleziona un'area dal menù a tendina.
     *
     * Endpoint: filter.php?a={area}
     * Risposta: { meals: [...anteprima ricette (solo idMeal, strMeal, strMealThumb)...] }
     *
     * @param {string} area - Nome area esatto (es. "Italian", "Japanese", "Mexican")
     * @returns {Promise<{meals: Array|null}|null>}
     */
    filterByArea: (area) => fetchFromApi(`filter.php?a=${area}`),
};
