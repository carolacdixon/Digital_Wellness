// js/options.js

// Load saved settings
chrome.storage.sync.get(['contentThresholds', 'advancedFeatures'], function(result) {
    if (result.contentThresholds) {
        document.getElementById('postsRange').value = result.contentThresholds.postsViewed || 10;
        document.getElementById('storiesRange').value = result.contentThresholds.storiesViewed || 5;
        document.getElementById('reelsRange').value = result.contentThresholds.reelsViewed || 5;
        document.getElementById('timeRange').value = (result.contentThresholds.timeSpent || 300) / 60;
        
        updateRangeValues();
    }
    
    if (result.advancedFeatures) {
        document.getElementById('textAnalysis').checked = result.advancedFeatures.textAnalysis !== false;
        document.getElementById('weightedScoring').checked = result.advancedFeatures.weightedScoring !== false;
        document.getElementById('weightedRange').value = result.advancedFeatures.weightedThreshold || 25;
        updateWeightedVisibility();
    }
});

// Update range display values
function updateRangeValues() {
    document.getElementById('postsValue').textContent = document.getElementById('postsRange').value;
    document.getElementById('storiesValue').textContent = document.getElementById('storiesRange').value;
    document.getElementById('reelsValue').textContent = document.getElementById('reelsRange').value;
    document.getElementById('timeValue').textContent = document.getElementById('timeRange').value;
    document.getElementById('weightedValue').textContent = document.getElementById('weightedRange').value;
}

// Add event listeners for range inputs
document.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', updateRangeValues);
});

// Show/hide weighted threshold based on toggle
function updateWeightedVisibility() {
    const isEnabled = document.getElementById('weightedScoring').checked;
    document.getElementById('weightedThresholdGroup').style.display = isEnabled ? 'block' : 'none';
}

document.getElementById('weightedScoring').addEventListener('change', updateWeightedVisibility);

// Save settings
document.getElementById('saveButton').addEventListener('click', function() {
    const settings = {
        contentThresholds: {
            postsViewed: parseInt(document.getElementById('postsRange').value),
            storiesViewed: parseInt(document.getElementById('storiesRange').value),
            reelsViewed: parseInt(document.getElementById('reelsRange').value),
            timeSpent: parseInt(document.getElementById('timeRange').value) * 60, // Convert to seconds
            scrollDepth: 3000 // Keep default
        },
        advancedFeatures: {
            textAnalysis: document.getElementById('textAnalysis').checked,
            weightedScoring: document.getElementById('weightedScoring').checked,
            weightedThreshold: parseInt(document.getElementById('weightedRange').value)
        }
    };
    
    chrome.storage.sync.set(settings, function() {
        // Show success message
        const status = document.getElementById('status');
        status.classList.add('show');
        setTimeout(() => {
            status.classList.remove('show');
        }, 2000);
    });
});

// Initialize
updateRangeValues();
updateWeightedVisibility();