// js/options.js - Simplified options for API token only

// Check API token status on load
async function checkApiStatus() {
    const result = await chrome.storage.sync.get(['huggingFaceToken']);
    const statusDiv = document.getElementById('apiStatus');
    const tokenInput = document.getElementById('huggingFaceToken');
    
    if (result.huggingFaceToken) {
        statusDiv.className = 'api-status connected';
        statusDiv.innerHTML = '✅ API token configured - Image analysis enabled';
        tokenInput.value = result.huggingFaceToken;
    } else {
        statusDiv.className = 'api-status disconnected';
        statusDiv.innerHTML = '⚠️ No API token - Image analysis disabled';
    }
}

// Save settings
document.getElementById('saveButton').addEventListener('click', function() {
    const token = document.getElementById('huggingFaceToken').value.trim();
    
    if (token) {
        chrome.storage.sync.set({ huggingFaceToken: token }, function() {
            checkApiStatus();
            showSaveStatus();
        });
    } else {
        chrome.storage.sync.remove('huggingFaceToken', function() {
            checkApiStatus();
            showSaveStatus();
        });
    }
});

function showSaveStatus() {
    const status = document.getElementById('status');
    status.classList.add('show');
    setTimeout(() => {
        status.classList.remove('show');
    }, 2000);
}

// Initialize
checkApiStatus();