/**
 * cookbook.js — Controller pagina ricettario personale.
 *
 * Mostra le ricette salvate dall'utente, permette di salvare note private e
 * rimanda alla scheda dettaglio già esistente con recipe.html?id={mealId}.
 */
document.addEventListener('DOMContentLoaded', async () => {
    auth.checkAuth();

    const currentUser = auth.getCurrentUser();
    if (!currentUser) return;

    const cookbookContainer = document.getElementById('cookbook-container');
    const cookbookMessage = document.getElementById('cookbook-message');

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

        cookbookContainer.innerHTML = '';

        if (userCookbook.length === 0) {
            cookbookMessage.textContent = 'Il tuo ricettario è vuoto. Aggiungi ricette dalla pagina di ricerca.';
            return;
        }

        cookbookMessage.textContent = '';

        for (const recipeInfo of userCookbook) {
            const meal = await getCookbookMeal(recipeInfo.mealId);
            if (!meal) continue;

            const col = document.createElement('div');
            col.className = 'col';
            col.innerHTML = `
                <article class="card h-100 shadow-sm cookbook-card">
                    <a href="recipe.html?id=${meal.idMeal}" class="cookbook-card-link">
                        <img src="${meal.strMealThumb}" class="cookbook-thumb" alt="${meal.strMeal}">
                        <div class="card-body pb-2">
                            <h5 class="cookbook-title card-title mb-1">${meal.strMeal}</h5>
                            <div class="d-flex gap-2 small text-muted">
                                <span>${meal.strCategory || 'Categoria n.d.'}</span>
                                <span>&bull;</span>
                                <span>${meal.strArea || 'Area n.d.'}</span>
                            </div>
                        </div>
                    </a>
                    <div class="card-body pt-0 d-flex flex-column">
                        <label for="note-${meal.idMeal}" class="form-label small">Nota privata</label>
                        <textarea id="note-${meal.idMeal}"
                                  class="form-control cookbook-note flex-grow-1"
                                  data-meal-id="${meal.idMeal}"
                                  placeholder="Aggiungi una nota privata...">${recipeInfo.notes || ''}</textarea>
                        <div class="mt-3 d-flex justify-content-end">
                            <button type="button" class="btn btn-sm btn-primary save-note-btn"
                                    data-meal-id="${meal.idMeal}">
                                <i class="bi bi-floppy me-1"></i>Salva Nota
                            </button>
                        </div>
                    </div>
                </article>
            `;
            cookbookContainer.appendChild(col);
        }
    }

    cookbookContainer.addEventListener('click', (event) => {
        const btn = event.target.closest('.save-note-btn');
        if (!btn) return;

        const mealId = btn.dataset.mealId;
        const textarea = cookbookContainer.querySelector(`textarea[data-meal-id="${mealId}"]`);
        const cookbooks = getCookbooks();
        const userCookbook = cookbooks[currentUser.id] || [];
        const recipeIndex = userCookbook.findIndex(recipe => recipe.mealId === mealId);

        if (recipeIndex === -1) {
            ui.notify({
                type: 'danger',
                title: 'Nota non salvata',
                message: 'La ricetta non è più presente nel tuo ricettario.'
            });
            return;
        }

        userCookbook[recipeIndex].notes = textarea.value;
        cookbooks[currentUser.id] = userCookbook;
        saveCookbooks(cookbooks);

        ui.notify({
            type: 'success',
            title: 'Nota salvata',
            message: 'La nota privata è stata aggiornata nel ricettario.'
        });
    });

    await loadCookbook();
});
