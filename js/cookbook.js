/**
 * cookbook.js — Controller pagina ricettario personale.
 *
 * Mostra le ricette salvate dall'utente, gestisce la rimozione dal ricettario
 * e permette di inserire o modificare la propria recensione.
 */
document.addEventListener('DOMContentLoaded', async () => {
    auth.checkAuth();

    const currentUser = auth.getCurrentUser();
    if (!currentUser) return;

    const cookbookContainer = document.getElementById('cookbook-container');
    const cookbookMessage = document.getElementById('cookbook-message');
    let activeReviewMealId = null;

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

    function getUserReview(mealId) {
        const mealReviews = getReviews()[mealId] || [];
        return mealReviews.find(review => review.userId === currentUser.id) || null;
    }

    function ensureReviewModal() {
        let modal = document.getElementById('cookbook-review-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'cookbook-review-modal';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content pgrc-modal">
                    <form id="cookbook-review-form">
                        <div class="modal-header">
                            <h5 class="modal-title" id="cookbook-review-title">Recensione</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"
                                    aria-label="Chiudi"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted mb-3" id="cookbook-review-meal"></p>
                            <div class="row g-3">
                                <div class="col-12">
                                    <label for="cookbook-review-date" class="form-label">
                                        Data di Preparazione
                                    </label>
                                    <input type="date" class="form-control"
                                           id="cookbook-review-date" required>
                                </div>
                                <div class="col-sm-6">
                                    <label for="cookbook-review-difficulty" class="form-label">
                                        Difficolt&agrave; <span class="text-muted">(1&ndash;5)</span>
                                    </label>
                                    <input type="number" class="form-control"
                                           id="cookbook-review-difficulty"
                                           min="1" max="5" required>
                                </div>
                                <div class="col-sm-6">
                                    <label for="cookbook-review-taste" class="form-label">
                                        Gusto <span class="text-muted">(1&ndash;5)</span>
                                    </label>
                                    <input type="number" class="form-control"
                                           id="cookbook-review-taste"
                                           min="1" max="5" required>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary"
                                    data-bs-dismiss="modal">
                                Annulla
                            </button>
                            <button type="submit" class="btn btn-primary"
                                    id="cookbook-review-submit">
                                Salva recensione
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#cookbook-review-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!activeReviewMealId) return;

            const allReviews = getReviews();
            const mealReviews = (allReviews[activeReviewMealId] || [])
                .filter(review => review.userId !== currentUser.id);

            mealReviews.push({
                userId: currentUser.id,
                username: currentUser.username,
                preparationDate: document.getElementById('cookbook-review-date').value,
                date: new Date().toISOString(),
                difficulty: parseInt(document.getElementById('cookbook-review-difficulty').value),
                taste: parseInt(document.getElementById('cookbook-review-taste').value)
            });

            allReviews[activeReviewMealId] = mealReviews;
            saveReviews(allReviews);
            bootstrap.Modal.getOrCreateInstance(modal).hide();
            ui.notify({
                type: 'success',
                title: 'Recensione salvata',
                message: 'La tua valutazione è stata aggiornata.'
            });
            await loadCookbook();
        });

        return modal;
    }

    async function openReviewModal(mealId) {
        activeReviewMealId = mealId;

        const modal = ensureReviewModal();
        const meal = await getCookbookMeal(mealId);
        const userReview = getUserReview(mealId);

        modal.querySelector('#cookbook-review-title').textContent = userReview
            ? 'Modifica recensione'
            : 'Scrivi recensione';
        modal.querySelector('#cookbook-review-meal').textContent = meal
            ? meal.strMeal
            : 'Ricetta selezionata';
        modal.querySelector('#cookbook-review-submit').textContent = userReview
            ? 'Aggiorna recensione'
            : 'Salva recensione';

        const form = modal.querySelector('#cookbook-review-form');
        form.reset();

        if (userReview) {
            modal.querySelector('#cookbook-review-date').value = userReview.preparationDate;
            modal.querySelector('#cookbook-review-difficulty').value = userReview.difficulty;
            modal.querySelector('#cookbook-review-taste').value = userReview.taste;
        }

        bootstrap.Modal.getOrCreateInstance(modal).show();
    }

    async function removeRecipeFromCookbook(mealId) {
        const confirmed = await ui.confirm({
            title: 'Rimuovi dal ricettario',
            message: 'Vuoi rimuovere questa ricetta dal tuo ricettario personale?',
            confirmText: 'Rimuovi',
            confirmVariant: 'btn-danger',
            iconClass: 'bi bi-bookmark-x'
        });

        if (!confirmed) return;

        const cookbooks = getCookbooks();
        const userCookbook = cookbooks[currentUser.id] || [];
        const nextCookbook = userCookbook.filter(recipe => recipe.mealId !== mealId);

        cookbooks[currentUser.id] = nextCookbook;
        saveCookbooks(cookbooks);
        ui.notify({
            type: 'success',
            title: 'Ricetta rimossa',
            message: 'La ricetta è stata rimossa dal tuo ricettario.'
        });
        await loadCookbook();
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

            const mealId = String(meal.idMeal || recipeInfo.mealId);
            const hasUserReview = Boolean(getUserReview(mealId));
            const reviewIcon = hasUserReview ? 'bi-pencil-square' : 'bi-chat-left-text';
            const reviewLabel = hasUserReview ? 'Modifica' : 'Recensisci';

            const col = document.createElement('div');
            col.className = 'col';
            col.innerHTML = `
                <article class="card h-100 shadow-sm cookbook-card">
                    <a href="recipe.html?id=${mealId}" class="cookbook-card-link">
                        <img src="${meal.strMealThumb}" class="cookbook-thumb" alt="${meal.strMeal}">
                        <div class="card-body">
                            <h5 class="cookbook-title card-title mb-1">${meal.strMeal}</h5>
                            <div class="d-flex gap-2 small text-muted">
                                <span>${meal.strCategory || 'Categoria n.d.'}</span>
                                <span>&bull;</span>
                                <span>${meal.strArea || 'Area n.d.'}</span>
                            </div>
                        </div>
                    </a>
                    <div class="card-body pt-0">
                        <div class="cookbook-actions">
                            <button type="button"
                                    class="btn btn-sm btn-danger remove-recipe-btn"
                                    data-meal-id="${mealId}">
                                <i class="bi bi-trash me-1"></i>Rimuovi
                            </button>
                            <button type="button"
                                    class="btn btn-sm btn-primary review-recipe-btn"
                                    data-meal-id="${mealId}">
                                <i class="bi ${reviewIcon} me-1"></i>${reviewLabel}
                            </button>
                        </div>
                    </div>
                </article>
            `;
            cookbookContainer.appendChild(col);
        }
    }

    cookbookContainer.addEventListener('click', async (event) => {
        const removeBtn = event.target.closest('.remove-recipe-btn');
        if (removeBtn) {
            await removeRecipeFromCookbook(removeBtn.dataset.mealId);
            return;
        }

        const reviewBtn = event.target.closest('.review-recipe-btn');
        if (reviewBtn) {
            await openReviewModal(reviewBtn.dataset.mealId);
        }
    });

    await loadCookbook();
});
