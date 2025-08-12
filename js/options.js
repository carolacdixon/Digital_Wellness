// ============================================================================
// FILE: js/options.js
// Purpose: Settings page functionality
// ============================================================================

/**
 * Options Page Script
 * Manages the settings interface where users can:
 * - Add their Hugging Face API token
 * - See the current API status
 * - Remove their token
 */

/**
 * Check and display the current API token status
 * @returns {Promise<void>}
 */
async function checkApiStatus() {
  const result = await chrome.storage.sync.get(['huggingFaceToken']);
  const statusDiv = document.getElementById('apiStatus');
  const tokenInput = document.getElementById('huggingFaceToken');
  
  if (result.huggingFaceToken) {
    // Token exists - show connected status
    statusDiv.className = 'api-status connected';
    statusDiv.innerHTML = '✅ API token configured - AI image analysis enabled';
    // Show masked token for security
    tokenInput.value = result.huggingFaceToken;
  } else {
    // No token - show disconnected status
    statusDiv.className = 'api-status disconnected';
    statusDiv.innerHTML = '⚠️ No API token - Using text-only analysis';
  }
}

/**
 * Save the API token to Chrome storage
 */
document.getElementById('saveButton').addEventListener('click', function() {
  const token = document.getElementById('huggingFaceToken').value.trim();
  
  if (token) {
    // Save token
    chrome.storage.sync.set({ huggingFaceToken: token }, function() {
      checkApiStatus();
      showSaveStatus('Settings saved!');
    });
  } else {
    // Remove token if empty
    chrome.storage.sync.remove('huggingFaceToken', function() {
      checkApiStatus();
      showSaveStatus('Token removed');
    });
  }
});

/**
 * Show a temporary status message
 * @param {string} message - Message to display
 */
function showSaveStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.classList.add('show');
  
  // Hide after 2 seconds
  setTimeout(() => {
    status.classList.remove('show');
  }, 2000);
}

// Check status when page loads
checkApiStatus();