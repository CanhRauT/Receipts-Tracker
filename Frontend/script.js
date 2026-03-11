// =================================================================
// FINAL SCRIPT (Updated for Authentication)
// =================================================================

// --- State Management ---
const state = {
    capturedFile: null,
    selectedReceiptIds: new Set(),
};

// --- DOM Elements ---
const dom = {
    appContainer: document.getElementById('app-container'),
    uploadWrapper: document.getElementById('initial-upload-wrapper'),
    uploadSection: document.getElementById('uploadSection'),
    imageInput: document.getElementById('imageInput'),
    previewSection: document.getElementById('previewSection'),
    previewImage: document.getElementById('previewImage'),
    loadingSection: document.getElementById('loadingSection'),
    messageSection: document.getElementById('messageSection'),
    receiptListSection: document.getElementById('receiptListSection'),
    receiptsTableBody: document.getElementById('receiptsTableBody'),
    noReceiptsMessage: document.getElementById('noReceiptsMessage'),
    deleteSelectedButton: document.querySelector('[data-action="delete-selected"]'),
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),
    resultsSection: document.getElementById('resultsSection'),
    resultsContent: document.getElementById('resultsContent'),
    userInfo: document.getElementById('user-info'),
};

// --- UI Module ---
const ui = {
    showUploadScreen(screenName) {
        const screens = { upload: dom.uploadSection, preview: dom.previewSection, loading: dom.loadingSection };
        Object.values(screens).forEach(s => s && s.classList.add('hidden'));
        if (screens[screenName]) screens[screenName].classList.remove('hidden');
    },
    showMessage(message, type = 'info') {
        if (!dom.messageSection) return;
        dom.messageSection.textContent = message;
        dom.messageSection.className = `p-4 my-4 text-sm rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
        dom.messageSection.classList.remove('hidden');
    },
    hideMessage() { if (dom.messageSection) dom.messageSection.classList.add('hidden'); },
    showPreview(imageUrl) {
        dom.previewImage.src = imageUrl;
        this.showUploadScreen('preview');
    },
    clearAll() {
        this.showUploadScreen('upload');
        dom.previewImage.src = '';
        state.capturedFile = null;
        dom.imageInput.value = '';
        this.hideMessage();
    },
    renderReceiptList(receipts) {
        dom.receiptsTableBody.innerHTML = '';
        if (receipts.length === 0) {
            dom.noReceiptsMessage.classList.remove('hidden');
            dom.receiptListSection.classList.add('hidden');
            return;
        }
        dom.noReceiptsMessage.classList.add('hidden');
        dom.receiptListSection.classList.remove('hidden');
        receipts.forEach(receipt => {
            const isChecked = state.selectedReceiptIds.has(receipt.id);
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="p-4"><input type="checkbox" class="receipt-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" data-id="${receipt.id}" ${isChecked ? 'checked' : ''} aria-label="Select receipt"></td>
                <td class="px-6 py-4"><div class="text-sm font-medium text-gray-900">${receipt.merchantName || 'N/A'}</div></td>
                <td class="px-6 py-4"><div class="text-sm text-gray-500">${receipt.transactionDate || 'N/A'}</div></td>
                <td class="px-6 py-4"><div class="text-sm font-bold text-green-700">$${(receipt.total || 0).toFixed(2)}</div></td>
                <td class="px-6 py-4 text-right"><button data-action="delete-single" data-id="${receipt.id}" class="text-red-600 hover:text-red-900 font-medium">Delete</button></td>
            `;
            dom.receiptsTableBody.appendChild(row);
        });
    },
    toggleDeleteSelectedButton() {
        if (state.selectedReceiptIds.size > 0) {
            dom.deleteSelectedButton.classList.remove('hidden');
            dom.deleteSelectedButton.textContent = `Delete Selected (${state.selectedReceiptIds.size})`;
        } else { dom.deleteSelectedButton.classList.add('hidden'); }
    },
    showResults(data) {
        dom.resultsContent.innerHTML = `
            <div class="grid md:grid-cols-2 gap-6 border-t pt-4">
                <div><h4 class="font-semibold text-gray-700 mb-2">Merchant</h4><p class="text-lg">${data.merchantName || 'N/A'}</p></div>
                <div><h4 class="font-semibold text-gray-700 mb-2">Date</h4><p class="text-lg">${data.transactionDate || 'N/A'}</p></div>
                <div><h4 class="font-semibold text-gray-700 mb-2">Total</h4><p class="text-lg font-bold text-green-700">$${(data.total || 0).toFixed(2)}</p></div>
                <div><h4 class="font-semibold text-gray-700 mb-2">Receipt ID</h4><p class="text-sm text-gray-600 break-all">${data.id || 'N/A'}</p></div>
            </div>
            ${data.originalImageUrl ? `<div class="mt-6"><h4 class="font-semibold text-gray-700 mb-2">Original Image</h4><a href="${data.originalImageUrl}" target="_blank" rel="noopener noreferrer"><img src="${data.originalImageUrl}" alt="Uploaded receipt image" class="max-w-full h-auto rounded-lg border"></a></div>` : ''}
        `;
        dom.uploadWrapper.classList.add('hidden');
        dom.receiptListSection.classList.add('hidden');
        dom.resultsSection.classList.remove('hidden');
        dom.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
};

// --- API Module ---
const api = {
    buildUrl(endpoint, pathParam = '') {
        const path = pathParam ? `/${encodeURIComponent(pathParam)}` : '';
        return `/api/${endpoint}${path}`;
    },
    async submitReceipt() {
        if (!state.capturedFile) { ui.showMessage('Please choose an image first.', 'error'); return; }
        ui.hideMessage();
        ui.showUploadScreen('loading');
        try {
            const formData = new FormData();
            formData.append('image', state.capturedFile);
            const url = this.buildUrl('ProcessReceipt');
            const response = await fetch(url, { method: 'POST', body: formData });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            const resultData = await response.json();
            ui.showResults(resultData);
        } catch (error) {
            console.error('Error submitting receipt:', error);
            ui.showMessage(`Failed to process receipt: ${error.message}`, 'error');
        } finally {
            ui.clearAll();
        }
    },
    async getReceipts() {
        try {
            const url = this.buildUrl('GetReceipts');
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Server error (${response.status})`);
            const receipts = await response.json();
            ui.renderReceiptList(receipts);
        } catch (error) {
            console.error('Failed to fetch receipts:', error);
            ui.showMessage(`Could not load receipts: ${error.message}`, 'error');
        }
    },
    async deleteReceipts(ids) {
        const isBulk = ids.length > 1;
        if (!confirm(`Are you sure you want to delete ${isBulk ? ids.length + ' receipts' : 'this receipt'}?`)) return;
        ui.showMessage('Deleting...', 'info');
        try {
            const url = isBulk ? this.buildUrl('DeleteMultipleReceipts') : this.buildUrl('DeleteReceipt', ids[0]);
            const method = isBulk ? 'POST' : 'DELETE';
            const body = isBulk ? JSON.stringify({ ids }) : null;
            const headers = isBulk ? { 'Content-Type': 'application/json' } : {};
            const response = await fetch(url, { method, body, headers });
            if (!response.ok && response.status !== 204) {
                const errorText = await response.text();
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            ui.showMessage('Successfully deleted.', 'success');
        } catch (error) {
            console.error('Failed to delete receipts:', error);
            ui.showMessage(`Deletion failed: ${error.message}`, 'error');
        } finally {
            state.selectedReceiptIds.clear();
            dom.selectAllCheckbox.checked = false;
            ui.toggleDeleteSelectedButton();
            await this.getReceipts();
        }
    }
};

// --- Main Initialization and Event Listeners ---
async function initialize() {
    try {
        const response = await fetch('/.auth/me');
        const { clientPrincipal } = await response.json();
        if (!clientPrincipal) {
            dom.userInfo.innerText = 'Access denied. Please log in.';
            return;
        }
        dom.userInfo.innerText = `Welcome, ${clientPrincipal.userDetails}!`;
        setupEventListeners();
        await api.getReceipts();
        console.log("Receipt Tracker Initialized for authenticated user.");
    } catch (error) {
        console.error('Initialization failed:', error);
        dom.userInfo.innerText = 'Error loading application.';
        ui.showMessage('Could not initialize the application. Please try refreshing.', 'error');
    }
}
function setupEventListeners() {
    dom.appContainer.addEventListener('click', async (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        switch (action) {
            case 'submit-receipt': await api.submitReceipt(); break;
            case 'clear-preview': ui.clearAll(); break;
            case 'back-to-list':
                dom.resultsSection.classList.add('hidden');
                dom.receiptListSection.classList.remove('hidden');
                dom.uploadWrapper.classList.remove('hidden');
                ui.clearAll();
                await api.getReceipts();
                break;
            case 'delete-single':
                const idToDelete = e.target.dataset.id;
                if (idToDelete) await api.deleteReceipts([idToDelete]);
                break;
            case 'delete-selected': await api.deleteReceipts(Array.from(state.selectedReceiptIds)); break;
            case 'select-all':
                const isChecked = dom.selectAllCheckbox.checked;
                dom.receiptsTableBody.querySelectorAll('.receipt-checkbox').forEach(cb => {
                    cb.checked = isChecked;
                    const id = cb.dataset.id;
                    if (isChecked) state.selectedReceiptIds.add(id);
                    else state.selectedReceiptIds.delete(id);
                });
                ui.toggleDeleteSelectedButton();
                break;
        }
    });
    dom.imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { ui.showMessage('Invalid file type.'); return; }
        ui.hideMessage();
        state.capturedFile = file;
        ui.showPreview(URL.createObjectURL(file));
    });
    dom.receiptsTableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('receipt-checkbox')) {
            const id = e.target.dataset.id;
            if (e.target.checked) state.selectedReceiptIds.add(id);
            else state.selectedReceiptIds.delete(id);
            ui.toggleDeleteSelectedButton();
        }
    });
}
document.addEventListener('DOMContentLoaded', initialize);