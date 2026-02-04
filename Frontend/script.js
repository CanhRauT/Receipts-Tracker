// APPLICATION LOGIC (Simplified for Image Upload Only)

// --- State Management ---
const state = {
    capturedFile: null,
};

// --- DOM Elements ---
const dom = {
    appContainer: document.getElementById('app-container'),
    uploadSection: document.getElementById('uploadSection'),
    imageInput: document.getElementById('imageInput'),
    previewSection: document.getElementById('previewSection'),
    previewImage: document.getElementById('previewImage'),
    loadingSection: document.getElementById('loadingSection'),
    resultsSection: document.getElementById('resultsSection'),
    resultsContent: document.getElementById('resultsContent'),
    messageSection: document.getElementById('messageSection'),
};

// --- UI Module ---
const ui = {
    showScreen(screen) {
        const screens = {
            upload: dom.uploadSection,
            preview: dom.previewSection,
            loading: dom.loadingSection,
            results: dom.resultsSection
        };
        // Hide all screens first
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        // Show the requested screen
        if (screens[screen]) {
            screens[screen].classList.remove('hidden');
        }
    },
    showMessage(message, type = 'error') {
        dom.messageSection.textContent = message;
        dom.messageSection.className = `p-4 my-4 text-sm rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
        dom.messageSection.classList.remove('hidden');
    },
    hideMessage() {
        dom.messageSection.classList.add('hidden');
    },
    showPreview(imageUrl) {
        dom.previewImage.src = imageUrl;
        this.showScreen('preview');
    },
    clearAll() {
        this.showScreen('upload');
        dom.previewImage.src = '';
        state.capturedFile = null;
        dom.imageInput.value = '';
        this.hideMessage();
    },
    showResults(data) {
        dom.resultsContent.innerHTML = `
            <div class="grid md:grid-cols-2 gap-6">
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">Merchant</h4>
                    <p class="text-lg">${data.merchantName || 'N/A'}</p>
                </div>
                <div><h4 class="font-semibold text-gray-700 mb-2">Date</h4><p class="text-lg">${data.transactionDate || 'N/A'}</p></div>
                <div><h4 class="font-semibold text-gray-700 mb-2">Total</h4><p class="text-lg font-bold text-green-600">$${(data.total || 0).toFixed(2)}</p></div>
                <div><h4 class="font-semibold text-gray-700 mb-2">Receipt ID</h4><p class="text-sm text-gray-600">${data.id || 'N/A'}</p></div>
            </div>
            ${data.originalImageUrl ? `<div class="mt-6">
                <h4 class="font-semibold text-gray-700 mb-2">Original Image</h4>
                <a href="${data.originalImageUrl}" target="_blank" rel="noopener noreferrer">
                <img src="${data.originalImageUrl}" alt="Uploaded receipt image from Azure Storage" 
                class="max-w-full h-auto rounded-lg border receipt-preview-image"></a></div>` : ''}
            <div class="mt-6 text-center"><button data-action="process-another" class="px-6 py-2 rounded-lg font-semibold transition-colors duration-200 bg-blue-600 text-white hover:bg-blue-700"><i class="fas fa-plus mr-2"></i>Process Another Receipt</button></div>
        `;
        this.showScreen('results');
    }
};

// --- File Handling Module ---
const fileHandler = {
    handleImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            ui.showMessage('Invalid file type. Please select an image.', 'error');
            dom.imageInput.value = ''; // Reset the input
            return;
        }

        ui.hideMessage();
        state.capturedFile = file;
        ui.showPreview(URL.createObjectURL(file));
    },
};

// --- API Module ---
const api = {
    async submitReceipt() {
        if (!state.capturedFile) {
            ui.showMessage('Please choose an image first.', 'error');
            return;
        }
        ui.hideMessage();
        ui.showScreen('loading');
        try {
            const formData = new FormData();
            formData.append('image', state.capturedFile);

            const response = await fetch(config.AZURE_FUNCTION_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            const result = await response.json();
            ui.showResults(result);
        } catch (error) {
            console.error('Error submitting receipt:', error);
            ui.showMessage(`Failed to process receipt: ${error.message}`);
            ui.showScreen('upload'); // Go back to the upload screen on error
        }
    }
};

// --- Main Event Listener ---
function initialize() {
    dom.appContainer.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;

        switch (action) {
            case 'submit-receipt': api.submitReceipt(); break;
            case 'clear-preview': ui.clearAll(); break;
            case 'process-another': ui.clearAll(); break;
        }
    });
    
    dom.imageInput.addEventListener('change', fileHandler.handleImage);

    console.log("Receipt Tracker Initialized (Simplified).");
}

document.addEventListener('DOMContentLoaded', initialize);