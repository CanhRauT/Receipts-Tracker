// =================================================================
// FINAL SCRIPT (with Get, Delete, and Bulk Delete)
// =================================================================

// --- State Management ---
// Keeps track of the application's current state in one place.
const state = {
    capturedFile: null,
    selectedReceiptIds: new Set(), // A Set is efficient for tracking unique selected IDs.
};

// --- DOM Elements ---
// Caching DOM elements for performance and convenience.
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
};

// --- UI Module ---
// Handles all direct manipulation of the UI (showing/hiding/rendering).
const ui = {
    // Shows one of the main content screens (upload, preview, loading)
    showUploadScreen(screenName) {
        const screens = {
            upload: dom.uploadSection,
            preview: dom.previewSection,
            loading: dom.loadingSection
        };
        // Hide all screens within the initial wrapper
        Object.values(screens).forEach(s => s && s.classList.add('hidden'));
        // Show the requested screen
        if (screens[screenName]) {
            screens[screenName].classList.remove('hidden');
        }
    },
    // Displays a message to the user (error or success)
    showMessage(message, type = 'error') {
        dom.messageSection.textContent = message;
        dom.messageSection.className = `p-4 my-4 text-sm rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
        dom.messageSection.classList.remove('hidden');
    },
    hideMessage() {
        dom.messageSection.classList.add('hidden');
    },
    // Shows the image preview screen
    showPreview(imageUrl) {
        dom.previewImage.src = imageUrl;
        this.showUploadScreen('preview');
    },
    // Resets the UI back to the initial upload state
    clearAll() {
        this.showUploadScreen('upload');
        dom.previewImage.src = '';
        state.capturedFile = null;
        dom.imageInput.value = '';
        this.hideMessage();
    },
    // Dynamically builds and displays the table of receipts
    renderReceiptList(receipts) {
        dom.receiptsTableBody.innerHTML = ''; // Clear previous list
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
                <td class="p-4"><input type="checkbox" class="receipt-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" data-id="${receipt.id}" ${isChecked ? 'checked' : ''} aria-label=aria-label="Select receipt from ${receipt.merchantName || 'unknown merchant'} on ${receipt.transactionDate || 'unknown date'}"></td>
                <td class="px-6 py-4"><div class="text-sm font-medium text-gray-900">${receipt.merchantName || 'N/A'}</div></td>
                <td class="px-6 py-4"><div class="text-sm text-gray-500">${receipt.transactionDate || 'N/A'}</div></td>
                <td class="px-6 py-4"><div class="text-sm font-bold text-green-700">$${(receipt.total || 0).toFixed(2)}</div></td>
                <td class="px-6 py-4 text-right"><button data-action="delete-single" data-id="${receipt.id}" class="text-red-600 hover:text-red-900 font-medium">Delete</button></td>
            `;
            dom.receiptsTableBody.appendChild(row);
        });
    },
    // Shows or hides the "Delete Selected" button based on selections
    toggleDeleteSelectedButton() {
        if (state.selectedReceiptIds.size > 0) {
            dom.deleteSelectedButton.classList.remove('hidden');
            dom.deleteSelectedButton.textContent = `Delete Selected (${state.selectedReceiptIds.size})`;
        } else {
            dom.deleteSelectedButton.classList.add('hidden');
        }
    }
};

// --- API Module ---
// Handles all communication with the backend Azure Functions.
const api = {
    // Helper to construct authenticated URLs from the config.js file
    buildUrl(endpoint, key, pathParam = '') {
        // Ensure pathParam is properly encoded in case it contains special characters
        const encodedPathParam = encodeURIComponent(pathParam);
        const path = pathParam ? `/${encodedPathParam}` : '';
        return `${config.API_BASE_URL}/api/${endpoint}${path}?code=${key}`;
    },

    async submitReceipt() {
        if (!state.capturedFile) { ui.showMessage('Please choose an image first.'); return; }
        ui.hideMessage();
        ui.showUploadScreen('loading');
        try {
            const formData = new FormData();
            formData.append('image', state.capturedFile);
            const url = this.buildUrl('ProcessReceipt', config.PROCESS_RECEIPT_KEY);
            const response = await fetch(url, { method: 'POST', body: formData });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            ui.showMessage('Receipt processed successfully!', 'success');
        } catch (error) {
            console.error('Error submitting receipt:', error);
            ui.showMessage(`Failed to process receipt: ${error.message}`);
        } finally {
            ui.clearAll(); // Go back to the main upload screen
        }
    },
    
    async getReceipts() {
        try {
            const url = this.buildUrl('GetReceipts', config.GET_RECEIPTS_KEY);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Server error (${response.status})`);
            const receipts = await response.json();
            ui.renderReceiptList(receipts);
        } catch (error) {
            console.error('Failed to fetch receipts:', error);
            ui.showMessage(`Could not load receipts: ${error.message}`);
        }
    },

    async deleteReceipts(ids) {
        const isBulk = ids.length > 1;
        if (!confirm(`Are you sure you want to delete ${isBulk ? ids.length + ' receipts' : 'this receipt'}?`)) return;

        ui.showMessage('Deleting...', 'info');

        try {
            const url = isBulk 
                ? this.buildUrl('DeleteMultipleReceipts', config.DELETE_MULTIPLE_KEY) 
                : this.buildUrl('DeleteReceipt', config.DELETE_SINGLE_KEY, ids[0]);
            
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
            ui.showMessage(`Deletion failed: ${error.message}`);
        } finally {
            // Uncheck all boxes and refresh the list regardless of outcome
            state.selectedReceiptIds.clear();
            dom.selectAllCheckbox.checked = false;
            ui.toggleDeleteSelectedButton();
            await this.getReceipts();
        }
    }
};

// --- Main Event Listener ---
// Initializes the application and handles all user interactions.
function initialize() {
    dom.appContainer.addEventListener('click', async (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;

        switch (action) {
            case 'submit-receipt':
                await api.submitReceipt();
                await api.getReceipts(); // Refresh list after submitting
                break;
            case 'clear-preview': ui.clearAll(); break;
            case 'delete-single':
                const idToDelete = e.target.dataset.id;
                if (idToDelete) await api.deleteReceipts([idToDelete]);
                break;
            case 'delete-selected':
                await api.deleteReceipts(Array.from(state.selectedReceiptIds));
                break;
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

    // Initial load of receipts when the page starts
    api.getReceipts();
    console.log("Receipt Tracker Initialized (with full CRUD features).");
}

document.addEventListener('DOMContentLoaded', initialize);