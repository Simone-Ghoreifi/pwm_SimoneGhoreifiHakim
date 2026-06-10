/**
 * ui.js — Componenti UI riutilizzabili.
 *
 * Espone:
 *   - ui.confirm(...): modale conferma/annulla Promise-based
 *   - ui.promptPassword(...): modale con campo password
 *   - ui.notify(...): alert globali animati sopra il viewport
 */
const ui = (() => {
    const CONFIRM_MODAL_ID = 'pgrc-confirm-modal';
    const PASSWORD_MODAL_ID = 'pgrc-password-modal';
    const ALERT_CONTAINER_ID = 'pgrc-alert-container';

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

    function ensurePasswordModal() {
        let modal = document.getElementById(PASSWORD_MODAL_ID);
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = PASSWORD_MODAL_ID;
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content pgrc-modal">
                    <div class="modal-header">
                        <h5 class="modal-title" id="pgrc-password-title"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"
                                aria-label="Chiudi"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3" id="pgrc-password-message"></p>
                        <label for="pgrc-password-input" class="form-label">Password attuale</label>
                        <input type="password" class="form-control" id="pgrc-password-input"
                               autocomplete="current-password">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary"
                                data-bs-dismiss="modal" id="pgrc-password-cancel">
                            Annulla
                        </button>
                        <button type="button" class="btn btn-primary" id="pgrc-password-ok">
                            Conferma
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    function promptPassword(options = {}) {
        const modalEl = ensurePasswordModal();
        const titleEl = modalEl.querySelector('#pgrc-password-title');
        const messageEl = modalEl.querySelector('#pgrc-password-message');
        const inputEl = modalEl.querySelector('#pgrc-password-input');
        const okBtn = modalEl.querySelector('#pgrc-password-ok');

        titleEl.textContent = options.title || 'Verifica password';
        messageEl.textContent = options.message || 'Inserisci la password attuale per procedere.';
        okBtn.textContent = options.confirmText || 'Conferma';
        inputEl.value = '';

        return new Promise(resolve => {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            let submitted = false;

            const submit = () => {
                submitted = true;
                modal.hide();
            };
            const onKeydown = (event) => {
                if (event.key === 'Enter') submit();
            };
            const onShown = () => inputEl.focus();
            const onHidden = () => {
                okBtn.removeEventListener('click', submit);
                inputEl.removeEventListener('keydown', onKeydown);
                modalEl.removeEventListener('shown.bs.modal', onShown);
                modalEl.removeEventListener('hidden.bs.modal', onHidden);
                resolve(submitted ? inputEl.value : null);
            };

            okBtn.addEventListener('click', submit);
            inputEl.addEventListener('keydown', onKeydown);
            modalEl.addEventListener('shown.bs.modal', onShown);
            modalEl.addEventListener('hidden.bs.modal', onHidden);
            modal.show();
        });
    }

    function ensureAlertContainer() {
        let container = document.getElementById(ALERT_CONTAINER_ID);
        if (container) return container;

        container = document.createElement('div');
        container.id = ALERT_CONTAINER_ID;
        container.className = 'pgrc-alert-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
        return container;
    }

    function notify(options = {}) {
        const container = ensureAlertContainer();
        const type = options.type || 'info';
        const icons = {
            success: 'bi-check-circle',
            danger: 'bi-exclamation-triangle',
            warning: 'bi-exclamation-circle',
            info: 'bi-info-circle'
        };

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} pgrc-alert shadow`;
        alert.role = 'alert';
        alert.innerHTML = `
            <i class="bi ${icons[type] || icons.info}" aria-hidden="true"></i>
            <div class="pgrc-alert-copy">
                ${options.title ? `<strong>${options.title}</strong>` : ''}
                <span>${options.message || ''}</span>
            </div>
            <button type="button" class="btn-close" aria-label="Chiudi"></button>
        `;

        const close = () => {
            alert.classList.add('is-leaving');
            setTimeout(() => alert.remove(), 220);
        };

        alert.querySelector('.btn-close').addEventListener('click', close);
        container.appendChild(alert);
        requestAnimationFrame(() => alert.classList.add('is-visible'));
        setTimeout(close, options.duration || 3500);
    }

    return { confirm, promptPassword, notify };
})();
