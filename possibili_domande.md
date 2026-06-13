# Possibili domande d'esame e guida pratica PGRC

Questo file serve come traccia operativa per la discussione del progetto. L'obiettivo non è imparare risposte a memoria, ma sapere dove guardare nel codice e cosa mostrare in browser quando il docente chiede una funzionalità.

---

## 1. Audit finale rispetto alla specifica PDF

### Requisiti coperti

| Requisito PDF | Dove si vede nell'app | File principali |
|---|---|---|
| Registrazione utente | `index.html`, form Registrazione | `js/login.js`, `js/auth.js`, `js/storage.js` |
| Login utente | `index.html`, form Accedi | `js/login.js`, `js/auth.js` |
| Modifica dati personali | `profile.html`, pulsante Modifica Dati | `js/profile.js`, `js/auth.js` |
| Rimozione profilo | `profile.html`, pulsante Rimuovi | `js/profile.js` |
| Ricerca ricette | `home.html` | `js/home.js`, `js/api.js` |
| Ricerca per nome | Dropdown "Per Nome" + input | `js/home.js`, `api.searchByName()` |
| Ricerca per ingrediente | Dropdown "Per Ingrediente" + input | `js/home.js`, `api.searchByIngredient()` |
| Ricerca per iniziale | Dropdown "Per Iniziale" + input lettera | `js/home.js`, `api.filterByStartLetter()` |
| Filtri categoria/area | Select Categoria e Area Geografica | `js/home.js`, `api.filterByCategory()`, `api.filterByArea()` |
| Scheda ricetta | Click su card in home | `recipe.html`, `js/recipe.js` |
| Ingredienti e procedimento | Sezione dettaglio ricetta | `js/recipe.js` |
| Immagini ricette | Card home/ricettario e dettaglio | `js/home.js`, `js/cookbook.js`, `js/recipe.js` |
| Ricettario personale | Aggiungi/Rimuovi dal dettaglio, pagina Ricettario | `js/recipe.js`, `js/cookbook.js` |
| Recensioni | Form recensione in dettaglio e modale da ricettario | `js/recipe.js`, `js/cookbook.js` |
| Rimozione recensioni | Bottone Rimuovi Recensione in dettaglio | `js/recipe.js` |
| Web Storage JSON | DevTools, tab Application | `js/storage.js` |
| Startup con dati TheMealDB in cache | Primo ingresso in `home.html` | `js/home.js`, `js/storage.js` |
| HTML5/CSS3/JS separati | Struttura repo `*.html`, `css/`, `js/` | tutti i file |

### Punto da spiegare con attenzione

La specifica cita la possibilità di avere una nota testuale privata per ricetta nel ricettario. In questa versione è stata rimossa per scelta progettuale, perché duplicava il ruolo delle recensioni e appesantiva le card del ricettario.

Risposta consigliata se il docente lo chiede:

> La funzionalità base richiesta in discussione è creazione/popolamento del ricettario e gestione recensioni. La nota privata era una funzionalità accessoria che duplicava il sistema di recensioni. Ho quindi mantenuto il ricettario come raccolta pulita di `mealId` e ho spostato l'interazione testuale/valutativa nel sistema recensioni, che è strutturato, modificabile e già previsto dalla specifica.

Se il docente insiste:

> La scelta è documentata come trade-off progettuale. Reintrodurla sarebbe semplice: basterebbe estendere gli elementi di `pgrc_cookbooks` da `{ mealId }` a `{ mealId, note }` e aggiungere textarea/salvataggio nella card. L'ho evitato perché avrebbe creato due fonti testuali concorrenti per lo stesso piatto.

---

## 2. Mappa mentale del progetto

### Pagine

- `index.html`: login e registrazione. Controller: `js/login.js`.
- `first-login.html`: conferma dopo registrazione. Controller: `js/first-login.js`.
- `home.html`: ricerca ricette, filtri e caricamento cache. Controller: `js/home.js`.
- `recipe.html`: dettaglio ricetta, ricettario e recensioni. Controller: `js/recipe.js`.
- `cookbook.html`: ricettario personale con azioni rimuovi/recensisci. Controller: `js/cookbook.js`.
- `profile.html`: area personale, modifica dati, cambio password, cancellazione account. Controller: `js/profile.js`.

### Moduli JS trasversali

- `js/storage.js`: unico livello che parla direttamente con `localStorage`.
- `js/api.js`: wrapper degli endpoint REST TheMealDB.
- `js/auth.js`: registrazione, login, sessione, logout, hashing password.
- `js/ui.js`: modali conferma/password e notifiche globali.

### CSS

- `css/style.css`: tema globale dark, variabili colore, override Bootstrap.
- `css/home.css`: hover e immagini card home.
- `css/cookbook.css`: card ricettario e riga bottoni 50/50.
- `css/recipe.css`: responsive immagine dettaglio.
- `css/profile.css`: card profilo e bottone sblocco password.

---

## 3. Guida rapida per aprire il progetto

### Avvio consigliato

Dal terminale nella cartella del progetto:

```bash
python3 -m http.server 8080
```

Poi aprire:

```text
http://127.0.0.1:8080/index.html
```

Perché usare un server locale:

- evita problemi CORS o percorsi strani con `file://`;
- rende DevTools più chiaro perché lo storage è associato a `http://127.0.0.1:8080`;
- simula meglio una vera applicazione web.

### Reset completo prima della demo

In DevTools, tab Application:

1. Apri `Local Storage`.
2. Seleziona `http://127.0.0.1:8080`.
3. Cancella tutte le chiavi PGRC.
4. Apri `Session Storage`.
5. Cancella eventuali chiavi.
6. Ricarica `index.html`.

Metodo alternativo in Console:

```js
localStorage.clear();
sessionStorage.clear();
location.href = 'index.html';
```

---

## 4. DevTools Application: guida passo passo

### Come aprire DevTools

- Chrome/Edge su Mac: `Cmd + Option + I`.
- Chrome/Edge su Windows/Linux: `Ctrl + Shift + I`.
- Alternativa: tasto destro sulla pagina, `Ispeziona`.

### Dove trovare Web Storage

1. Apri DevTools.
2. Vai nella tab `Application`.
3. Nel menu a sinistra cerca `Storage`.
4. Apri `Local Storage`.
5. Seleziona `http://127.0.0.1:8080`.
6. Apri anche `Session Storage` per vedere la sessione utente.

### Chiavi localStorage attese

| Chiave | Quando appare | Cosa contiene |
|---|---|---|
| `pgrc_users` | Dopo registrazione | Array utenti |
| `pgrc_cookbooks` | Dopo registrazione | Oggetto `{ userId: [{ mealId }] }` |
| `pgrc_reviews` | Dopo prima recensione | Oggetto `{ mealId: [review] }` |
| `pgrc_meals_cache` | Dopo prima home | Catalogo ricette + timestamp |
| `pgrc_categories_cache` | Dopo prima home | Categorie + timestamp |
| `pgrc_areas_cache` | Dopo prima home | Aree + timestamp |
| `pgrc_meal_details_cache` | Dopo apertura ricetta | Dettagli ricetta + timestamp |

### Chiavi sessionStorage attese

| Chiave | Quando appare | Cosa contiene |
|---|---|---|
| `pgrc_pendingFirstLoginUser` | Subito dopo registrazione | Username temporaneo per `first-login.html` |
| `pgrc_loggedInUser` | Dopo login | ID utente corrente |

---

## 5. Demo completa con stato prima/dopo

### Scenario A: prima registrazione

Prima:

- `localStorage` vuoto o senza chiavi PGRC.
- `sessionStorage` vuoto.

Azioni:

1. Vai su `index.html`.
2. Clicca `Registrati`.
3. Inserisci username, email, password, piatti preferiti.
4. Premi `Registrati`.

Dopo:

- `pgrc_users` contiene un array con il nuovo utente.
- Il campo password NON è in chiaro: ci sono `passwordSalt`, `passwordHash`, `passwordAlgorithm`.
- `pgrc_cookbooks` contiene una entry vuota per l'ID utente.
- `sessionStorage.pgrc_pendingFirstLoginUser` contiene lo username.
- Non esiste ancora `pgrc_loggedInUser`.

Snippet Console:

```js
JSON.parse(localStorage.getItem('pgrc_users'));
JSON.parse(localStorage.getItem('pgrc_cookbooks'));
sessionStorage.getItem('pgrc_pendingFirstLoginUser');
sessionStorage.getItem('pgrc_loggedInUser');
```

Risposta pronta:

> La registrazione crea l'account e il ricettario vuoto, ma non crea sessione. La sessione nasce solo dopo login, così il primo accesso è esplicito.

### Scenario B: primo login

Prima:

- Esiste `pgrc_users`.
- Esiste `pgrc_cookbooks`.
- Non esiste `pgrc_loggedInUser`.

Azioni:

1. Da `first-login.html`, clicca `Vai al Login`.
2. Inserisci username e password.
3. Premi `Accedi`.

Dopo:

- `sessionStorage.pgrc_loggedInUser` contiene `user_...`.
- Sei su `home.html`.

Snippet:

```js
sessionStorage.getItem('pgrc_loggedInUser');
JSON.parse(localStorage.getItem('pgrc_users'))
  .find(u => u.id === sessionStorage.getItem('pgrc_loggedInUser'));
```

### Scenario C: loading cache ricette

Prima:

- Cancella `pgrc_meals_cache`, `pgrc_categories_cache`, `pgrc_areas_cache`.

Azioni:

1. Vai su `home.html`.
2. Apri tab `Network`, filtro `Fetch/XHR`.
3. Ricarica.

Dopo:

- `pgrc_meals_cache` contiene molte ricette e un `timestamp`.
- `pgrc_categories_cache` contiene le categorie.
- `pgrc_areas_cache` contiene le aree.
- In Network si vedono chiamate a TheMealDB, soprattutto `search.php?f=a`, `search.php?f=b`, ecc.

Snippet:

```js
const mealsCache = JSON.parse(localStorage.getItem('pgrc_meals_cache'));
mealsCache.meals.length;
new Date(mealsCache.timestamp).toLocaleString('it-IT');

JSON.parse(localStorage.getItem('pgrc_categories_cache')).categories.length;
JSON.parse(localStorage.getItem('pgrc_areas_cache')).areas.length;
```

Risposta pronta:

> TheMealDB non offre un endpoint unico per tutte le ricette. Il progetto carica il catalogo iterando sulle 26 lettere, salva il risultato in `localStorage` e lo riusa per un'ora.

### Scenario D: visita successiva con cache valida

Prima:

- Le cache sono già presenti e hanno meno di 1 ora.

Azioni:

1. Ricarica `home.html`.
2. Guarda Network.

Dopo:

- Non partono le 26 chiamate A-Z.
- I risultati appaiono leggendo da `localStorage`.

Snippet:

```js
const c = JSON.parse(localStorage.getItem('pgrc_meals_cache'));
Math.round((Date.now() - c.timestamp) / 60000);
```

### Scenario E: forzare scadenza cache

In Console:

```js
const c = JSON.parse(localStorage.getItem('pgrc_meals_cache'));
c.timestamp = Date.now() - (2 * 60 * 60 * 1000);
localStorage.setItem('pgrc_meals_cache', JSON.stringify(c));
location.reload();
```

Risultato:

- `storage.js` considera la cache scaduta.
- La home scarica nuovamente i dati.

### Scenario F: ricerca ricette

Per nome:

1. Dropdown `Per Nome`.
2. Scrivi `pasta`.
3. Attendi debounce.

Per ingrediente:

1. Dropdown `Per Ingrediente`.
2. Scrivi `chicken`.

Per iniziale:

1. Dropdown `Per Iniziale`.
2. Scrivi `a`.

Categoria/area:

1. Seleziona una categoria o un'area.
2. L'input testuale si svuota.

Risposta pronta:

> La ricerca è mutuamente esclusiva per evitare combinazioni ambigue. Ogni criterio usa prima la cache locale e chiama l'API solo se la cache non è disponibile.

### Scenario G: scheda ricetta

Azioni:

1. Clicca una card in home.
2. La URL diventa `recipe.html?id=XXXXX`.

Da mostrare:

- Immagine.
- Badge categoria/area.
- Ingredienti ricavati da `strIngredient1...20`.
- Procedimento.
- Sezione recensioni.

Snippet:

```js
JSON.parse(localStorage.getItem('pgrc_meal_details_cache'));
```

Risposta pronta:

> L'ID arriva dalla query string. `recipe.js` prova prima la cache dettaglio, poi il catalogo completo, infine `api.lookupById()`.

### Scenario H: aggiungere al ricettario

Azioni:

1. In `recipe.html`, premi `Aggiungi al Ricettario`.
2. Conferma la modale.
3. Vai su `cookbook.html`.

Dopo:

- `pgrc_cookbooks[userId]` contiene `{ mealId: "..." }`.
- La pagina ricettario mostra la card.

Snippet:

```js
const userId = sessionStorage.getItem('pgrc_loggedInUser');
JSON.parse(localStorage.getItem('pgrc_cookbooks'))[userId];
```

### Scenario I: rimuovere dal ricettario

Azioni:

1. In `cookbook.html`, premi `Rimuovi`.
2. Annulla: non cambia niente.
3. Premi di nuovo e conferma.

Dopo:

- L'elemento sparisce dall'array del ricettario.
- Se era l'ultimo, appare messaggio di ricettario vuoto.

### Scenario J: recensione da dettaglio

Azioni:

1. In `recipe.html`, compila data, difficoltà, gusto.
2. Premi `Invia Recensione`.

Dopo:

- `pgrc_reviews[mealId]` contiene la recensione.
- Il form viene precompilato se ricarichi la pagina.
- Il pulsante `Rimuovi Recensione` diventa visibile.

Snippet:

```js
JSON.parse(localStorage.getItem('pgrc_reviews'));
```

Risposta pronta:

> Prima di salvare una recensione, il controller filtra eventuali recensioni precedenti dello stesso utente per quella ricetta. Così resta valida la regola una recensione per utente per ricetta.

### Scenario K: recensione da ricettario

Azioni:

1. Vai su `cookbook.html`.
2. Premi `Recensisci` su una card.
3. Compila la modale.
4. Salva.
5. Il bottone diventa `Modifica`.

Dopo:

- La recensione è la stessa che vedi in `recipe.html`.
- Non ci sono due sistemi dati separati.

### Scenario L: rimozione recensione

Azioni:

1. Vai su `recipe.html` della ricetta recensita.
2. Premi `Rimuovi Recensione`.

Dopo:

- In `pgrc_reviews[mealId]` non c'è più la recensione dell'utente corrente.

### Scenario M: modifica profilo

Azioni:

1. Vai su `profile.html`.
2. Premi `Modifica Dati`.
3. Cambia username/email/preferiti.
4. Salva.

Dopo:

- `pgrc_users` cambia.
- Se cambia username, anche le recensioni già scritte mostrano il nuovo username.

Snippet:

```js
JSON.parse(localStorage.getItem('pgrc_users'));
JSON.parse(localStorage.getItem('pgrc_reviews'));
```

### Scenario N: cambio password

Azioni:

1. Premi `Modifica Dati`.
2. Premi il bottone accanto al campo password.
3. Inserisci password attuale.
4. Scrivi nuova password.
5. Salva.

Dopo:

- Cambiano `passwordSalt` e `passwordHash`.
- Non viene mai salvata la password in chiaro.

### Scenario O: cancellazione profilo

Prima:

- Utente registrato.
- Magari con ricettario e recensioni.

Azioni:

1. Vai su `profile.html`.
2. Premi `Rimuovi`.
3. Conferma.

Dopo:

- L'utente sparisce da `pgrc_users`.
- La sua entry sparisce da `pgrc_cookbooks`.
- Le sue recensioni spariscono da `pgrc_reviews`.
- `sessionStorage.pgrc_loggedInUser` viene rimosso.
- Si torna al login.

Snippet per verificare:

```js
JSON.parse(localStorage.getItem('pgrc_users'));
JSON.parse(localStorage.getItem('pgrc_cookbooks'));
JSON.parse(localStorage.getItem('pgrc_reviews'));
sessionStorage.getItem('pgrc_loggedInUser');
```

---

## 6. Domande probabili e risposte pronte

### Perché avete usato localStorage?

> La specifica richiede esplicitamente Web Storage e dati in JSON/XML. Ho usato `localStorage` per dati persistenti tra sessioni: utenti, ricettari, recensioni e cache API.

### Perché sessionStorage per il login?

> La sessione deve essere temporanea. `sessionStorage` sparisce alla chiusura della tab/browser, mentre `localStorage` conserva i dati applicativi.

### Perché non c'è back-end?

> Il progetto è client-side per vincolo didattico: HTML5, CSS3 e JavaScript. Tutta la persistenza è simulata con Web Storage.

### Dove sono salvati gli utenti?

> In `localStorage.pgrc_users`, array JSON. Ogni utente ha `id`, `username`, `email`, `favoriteDishes`, `passwordSalt`, `passwordHash`, `passwordAlgorithm`.

### Le password sono sicure?

> Non è sicurezza reale da produzione, perché tutto gira lato client. Però non vengono salvate in chiaro: uso salt e hash tramite Web Crypto (`SHA-256`) con fallback didattico se Web Crypto non è disponibile.

### Perché serve un salt?

> Il salt fa sì che due utenti con la stessa password abbiano hash diversi. È una buona pratica anche se qui resta una simulazione client-side.

### Come funziona la registrazione?

> `login.js` intercetta il submit, chiama `auth.register()`, valida username/email unici, crea credenziali hashate, salva l'utente e crea un ricettario vuoto in `pgrc_cookbooks`.

### Perché dopo registrazione non fate login automatico?

> Per rendere chiaro il passaggio di convalida: registrazione crea dati persistenti, login crea sessione. È anche più facile da mostrare in DevTools.

### Come proteggete le pagine private?

> Ogni controller privato chiama `auth.checkAuth()` al caricamento. Se non c'è utente corrente in `sessionStorage`, reindirizza a `index.html`.

### Come funziona la cache TheMealDB?

> `home.js` chiama `loadAllMeals()`. Se `pgrc_meals_cache` è valida, usa quella. Altrimenti fa 26 chiamate parallele per le lettere A-Z, concatena i risultati e salva `{ timestamp, meals }`.

### Perché 26 chiamate?

> TheMealDB non ha un endpoint gratuito "dammi tutto il catalogo". L'unico modo è usare `search.php?f=a`, `search.php?f=b`, ecc.

### Perché avete TTL di 1 ora?

> È un compromesso tra freschezza dei dati e riduzione delle chiamate. Per una demo universitaria va bene: dati abbastanza aggiornati e caricamento più veloce.

### Perché non usate direttamente sempre l'API?

> Per rispettare la richiesta di memorizzare i dati nel Web Storage e per ridurre tempi di caricamento/chiamate ripetute.

### Come gestite gli errori API?

> `api.js` centralizza le chiamate in `fetchFromApi()`, usa `try/catch`, controlla `response.ok` e restituisce `null` in caso di errore. I controller gestiscono il caso senza crash.

### Come cercate per ingrediente?

> Se il catalogo completo è in cache, filtro localmente i campi `strIngredient1...20`. Se non c'è cache, uso l'endpoint `filter.php?i=`.

### Come cercate per iniziale?

> L'utente sceglie `Per Iniziale` nel dropdown e inserisce una lettera. Il controller filtra localmente per `strMeal.startsWith(letter)` oppure usa `search.php?f=`.

### Perché avete accorpato iniziale nel dropdown?

> Per uniformare la barra di ricerca: nome, ingrediente e iniziale sono tre modalità dello stesso input. Categoria e area restano filtri separati.

### Come costruite ingredienti e misure?

> TheMealDB non restituisce array. `recipe.js` itera da 1 a 20 su `strIngredientN` e `strMeasureN`, scarta gli slot vuoti e genera la lista.

### Come funziona il ricettario?

> `pgrc_cookbooks` è un oggetto per utente: `{ userId: [{ mealId }] }`. Dal dettaglio ricetta si aggiunge/rimuove con modale di conferma; dalla pagina ricettario si vedono le card salvate.

### Perché in ricettario salvate solo mealId?

> Per evitare duplicazione dei dati TheMealDB. Nome, immagine, categoria e area si recuperano da cache dettaglio/catalogo o API fallback.

### Come funziona la recensione?

> È salvata in `pgrc_reviews`, indicizzata per `mealId`. Ogni recensione contiene `userId`, `username`, `preparationDate`, `date`, `difficulty`, `taste`.

### Perché salvate anche username nella recensione?

> È una denormalizzazione leggera: rende più semplice mostrare le recensioni senza fare join con `pgrc_users`. Se lo username cambia, `profile.js` aggiorna le recensioni dell'utente.

### Come garantite una sola recensione per utente?

> Prima di salvare, filtro via eventuali recensioni esistenti dello stesso `userId` per quel `mealId`, poi aggiungo la nuova.

### Perché la recensione si può fare anche dal ricettario?

> È un flusso più naturale: se una ricetta è salvata nel ricettario, l'utente può recensirla senza dover rientrare manualmente nella scheda dettaglio.

### Come funziona la cancellazione account?

> `profile.js` elimina l'utente da `pgrc_users`, elimina la sua entry da `pgrc_cookbooks`, rimuove le sue recensioni da `pgrc_reviews` e poi chiama `auth.logout()`.

### Che cosa succede se ci sono dati corrotti nel localStorage?

> `storage.js` usa `try/catch` in `getData()`. Se il JSON non è valido, restituisce `null` invece di far crashare l'app.

### Perché MPA invece di SPA?

> Le pagine separate sono più semplici, coerenti con la specifica e non richiedono router o build tool. Ogni pagina ha un controller JS dedicato.

### Perché niente framework?

> La specifica chiede HTML5, CSS3 e JavaScript. Usare vanilla JS rende il progetto trasparente e più facile da discutere.

### Perché Bootstrap?

> Bootstrap accelera layout, form, modali, card e responsive design. Il tema è personalizzato in `style.css` con variabili e override.

### Perché le modali sono in `ui.js`?

> Per non duplicare markup e logica. `ui.confirm()` e `ui.promptPassword()` restituiscono Promise, quindi i controller possono usare `await` e mantenere flussi leggibili.

---

## 7. Come navigare nel codice durante l'orale

### Se chiede login/registrazione

Apri:

1. `index.html`: mostra form e ID DOM.
2. `js/login.js`: submit dei form.
3. `js/auth.js`: `register()`, `login()`, hashing.
4. `js/storage.js`: `getUsers()`, `saveUsers()`.

### Se chiede Web Storage

Apri:

1. `js/storage.js`: chiavi e funzioni generiche `getData()`/`saveData()`.
2. DevTools Application.
3. Console con `JSON.parse(localStorage.getItem(...))`.

### Se chiede TheMealDB

Apri:

1. `js/api.js`: endpoint.
2. `js/home.js`: `loadAllMeals()`, `populateFilters()`, `performSearch()`.
3. Network tab per vedere le chiamate.

### Se chiede dettaglio ricetta

Apri:

1. `recipe.html`: container dinamici.
2. `js/recipe.js`: `loadRecipeDetails()`, `renderStars()`, recensioni.

### Se chiede ricettario

Apri:

1. `js/recipe.js`: `toggleCookbook()`.
2. `js/cookbook.js`: `loadCookbook()`, `removeRecipeFromCookbook()`, `openReviewModal()`.
3. `css/cookbook.css`: riga azioni 50/50.

### Se chiede profilo

Apri:

1. `profile.html`: campi disabilitati.
2. `js/profile.js`: edit mode, password modal, cancellazione.
3. `js/auth.js`: `verifyPassword()`, `createPasswordCredential()`.

---

## 8. Edit veloci e sicuri durante la demo

### Cambiare TTL cache

File: `js/storage.js`.

Costante:

```js
const CACHE_TTL = 3600000;
```

Esempio: 5 minuti:

```js
const CACHE_TTL = 5 * 60 * 1000;
```

### Forzare ricettario vuoto

Console:

```js
const userId = sessionStorage.getItem('pgrc_loggedInUser');
const cookbooks = JSON.parse(localStorage.getItem('pgrc_cookbooks'));
cookbooks[userId] = [];
localStorage.setItem('pgrc_cookbooks', JSON.stringify(cookbooks));
location.reload();
```

### Aggiungere una recensione finta da Console

Sostituisci `MEAL_ID` con l'id nella URL.

```js
const userId = sessionStorage.getItem('pgrc_loggedInUser');
const user = JSON.parse(localStorage.getItem('pgrc_users')).find(u => u.id === userId);
const reviews = JSON.parse(localStorage.getItem('pgrc_reviews')) || {};
reviews.MEAL_ID = [
  ...(reviews.MEAL_ID || []).filter(r => r.userId !== userId),
  {
    userId,
    username: user.username,
    preparationDate: '2026-06-12',
    date: new Date().toISOString(),
    difficulty: 3,
    taste: 5
  }
];
localStorage.setItem('pgrc_reviews', JSON.stringify(reviews));
location.reload();
```

### Svuotare solo cache API

```js
localStorage.removeItem('pgrc_meals_cache');
localStorage.removeItem('pgrc_categories_cache');
localStorage.removeItem('pgrc_areas_cache');
localStorage.removeItem('pgrc_meal_details_cache');
location.reload();
```

### Ripristinare demo pulita

```js
localStorage.clear();
sessionStorage.clear();
location.href = 'index.html';
```

---

## 9. Checklist finale prima dell'esame

- Avviare con `python3 -m http.server 8080`.
- Aprire `http://127.0.0.1:8080/index.html`.
- DevTools Application aperta e visibile.
- DevTools Network pronto su filtro Fetch/XHR.
- Fare almeno una registrazione pulita.
- Mostrare che password non è in chiaro.
- Fare login e mostrare `pgrc_loggedInUser`.
- Entrare in home e mostrare cache TheMealDB.
- Cercare per nome, ingrediente, iniziale.
- Aprire scheda ricetta.
- Aggiungere al ricettario.
- Recensire.
- Aprire ricettario e modificare recensione da lì.
- Rimuovere recensione.
- Cancellare profilo e mostrare pulizia dati.

---

## 10. Risposte brevi per domande secche

- Dove sono i dati? Nel Web Storage del browser, serializzati JSON.
- Dove sono le API? In `js/api.js`.
- Dove parte la cache? In `js/home.js`, funzione `initializeRecipeData()`.
- Dove controlli la sessione? In `auth.checkAuth()`.
- Dove salvi la sessione? In `sessionStorage.pgrc_loggedInUser`.
- Dove salvi utenti? In `localStorage.pgrc_users`.
- Dove salvi ricettari? In `localStorage.pgrc_cookbooks`.
- Dove salvi recensioni? In `localStorage.pgrc_reviews`.
- Come identifichi una ricetta? Con `idMeal` di TheMealDB.
- Come identifichi un utente? Con ID interno `user_${Date.now()}`.
- Come identifichi la ricetta nel dettaglio? Query string `?id=...`.
- Come eviti più recensioni dello stesso utente? Filtro per `userId` prima del salvataggio.
- Come eviti chiamate API ripetute? Cache con timestamp e TTL.
- Come gestisci errori API? `try/catch` in `fetchFromApi()`, ritorno `null`.
- Come fai responsive design? Bootstrap grid + CSS dedicato.
- Come separi struttura e stile? HTML in `*.html`, CSS in `css/`, logica in `js/`.
