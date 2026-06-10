/**
 * ui.js — Componenti UI riutilizzabili.
 *
 * Al momento espone una modale di conferma Promise-based. I controller possono
 * usarla con `await ui.confirm(...)` senza duplicare markup Bootstrap nelle pagine.
 */
const ui = (() => {
    const CONFIRM_MODAL_ID = 'pgrc-confirm-modal';

    function ensureConfirmModal() {
        let modal = document.getElementById(CONFIRM_MODAL_ID);
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = CONFIRM_MODAL_ID;
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content pgrc-modal">
                    <div class="modal-header">
                        <h5 class="modal-title" id="pgrc-confirm-title"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"
                                aria-label="Chiudi"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-flex gap-3 align-items-start">
                            <span class="pgrc-modal-icon" aria-hidden="true">
                                <i id="pgrc-confirm-icon" class="bi bi-question-circle"></i>
                            </span>
                            <p class="mb-0" id="pgrc-confirm-message"></p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary"
                                data-bs-dismiss="modal" id="pgrc-confirm-cancel">
                            Annulla
                        </button>
                        <button type="button" class="btn btn-primary" id="pgrc-confirm-ok">
                            Conferma
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    function confirm(options = {}) {
        const modalEl = ensureConfirmModal();
        const titleEl = modalEl.querySelector('#pgrc-confirm-title');
        const messageEl = modalEl.querySelector('#pgrc-confirm-message');
        const iconEl = modalEl.querySelector('#pgrc-confirm-icon');
        const okBtn = modalEl.querySelector('#pgrc-confirm-ok');
        const cancelBtn = modalEl.querySelector('#pgrc-confirm-cancel');

        titleEl.textContent = options.title || 'Conferma operazione';
        messageEl.textContent = options.message || 'Vuoi procedere?';
        iconEl.className = options.iconClass || 'bi bi-question-circle';
        cancelBtn.textContent = options.cancelText || 'Annulla';
        okBtn.textContent = options.confirmText || 'Conferma';
        okBtn.className = `btn ${options.confirmVariant || 'btn-primary'}`;

        return new Promise(resolve => {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            let confirmed = false;

            const onConfirm = () => {
                confirmed = true;
                modal.hide();
            };
            const onHidden = () => {
                okBtn.removeEventListener('click', onConfirm);
                modalEl.removeEventListener('hidden.bs.modal', onHidden);
                resolve(confirmed);
            };

            okBtn.addEventListener('click', onConfirm);
            modalEl.addEventListener('hidden.bs.modal', onHidden);
            modal.show();
        });
    }

    return { confirm };
})();
