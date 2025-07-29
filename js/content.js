// js/content.js - Integrated version with text analysis
const DELAY_TIME = 30;

// Default configuration
const DEFAULT_THRESHOLDS = {
    postsViewed: 10,
    storiesViewed: 5,
    reelsViewed: 5,
    timeSpent: 300,
    scrollDepth: 3000
};

const DEFAULT_FEATURES = {
    textAnalysis: true,
    weightedScoring: true,
    weightedThreshold: 25
};

// Content tracking state
let contentMetrics = {
    postsViewed: new Set(),
    storiesViewed: new Set(),
    reelsViewed: new Set(),
    timeSpent: 0,
    scrollDepth: 0,
    sessionStart: Date.now(),
    lastInteraction: Date.now()
};

let viewedContentIds = new Set();
let reminderShown = false;
let contentObserver = null;
let enhancedTracker = null;
let userSettings = {
    thresholds: DEFAULT_THRESHOLDS,
    features: DEFAULT_FEATURES
};

// Load user settings
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['contentThresholds', 'advancedFeatures']);
        if (result.contentThresholds) {
            userSettings.thresholds = { ...DEFAULT_THRESHOLDS, ...result.contentThresholds };
        }
        if (result.advancedFeatures) {
            userSettings.features = { ...DEFAULT_FEATURES, ...result.advancedFeatures };
        }
        
        // Initialize enhanced tracker if text analysis is enabled
        if (userSettings.features.textAnalysis && window.EnhancedContentTracker) {
            enhancedTracker = new window.EnhancedContentTracker();
            enhancedTracker.weightedThreshold = userSettings.features.weightedThreshold;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function shouldShowReminder() {
    try {
        const domain = window.location.hostname.replace('www.', '');
        const result = await chrome.storage.sync.get('sites');
        
        if (!result.sites || result.sites.length === 0) {
            return true;
        }

        const sites = result.sites;
        const matchingSite = sites.find(site => 
            domain.includes(site.domain) || site.domain.includes(domain)
        );
        
        return matchingSite ? matchingSite.enabled : false;
    } catch (error) {
        return false;
    }
}

// Check if content threshold has been reached
function hasReachedThreshold() {
    const timeSpent = (Date.now() - contentMetrics.sessionStart) / 1000;
    
    // Check weighted threshold if enabled
    if (userSettings.features.weightedScoring && enhancedTracker) {
        return enhancedTracker.hasReachedWeightedThreshold(contentMetrics);
    }
    
    // Otherwise use simple thresholds
    return (
        contentMetrics.postsViewed.size >= userSettings.thresholds.postsViewed ||
        contentMetrics.storiesViewed.size >= userSettings.thresholds.storiesViewed ||
        contentMetrics.reelsViewed.size >= userSettings.thresholds.reelsViewed ||
        timeSpent >= userSettings.thresholds.timeSpent ||
        contentMetrics.scrollDepth >= userSettings.thresholds.scrollDepth
    );
}

// Extract unique ID from Instagram post/story/reel
function extractContentId(element) {
    const article = element.closest('article');
    if (article) {
        const postLink = article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        if (postLink) {
            const match = postLink.href.match(/\/(p|reel)\/([^\/]+)/);
            if (match) return match[2];
        }
    }
    
    const storyContainer = element.closest('[role="button"][aria-label*="story"]');
    if (storyContainer) {
        return `story-${storyContainer.getAttribute('aria-label')}`;
    }
    
    const rect = element.getBoundingClientRect();
    return `${rect.top}-${rect.left}-${element.innerHTML.substring(0, 50)}`;
}

// Determine content type
function getContentType(element) {
    if (element.querySelector('video') && window.location.pathname.includes('/reels')) {
        return 'reel';
    }
    
    if (element.closest('[aria-label*="story"]') || window.location.pathname.includes('/stories')) {
        return 'story';
    }
    
    return 'post';
}

// Analyze visible content on the page
function analyzeVisibleContent() {
    if (reminderShown) return;
    
    const contentSelectors = [
        'article',
        '[role="button"][aria-label*="story"]',
        'video',
        '[aria-label="Timeline: "]'
    ];
    
    contentSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const isVisible = (
                rect.top >= 0 &&
                rect.bottom <= window.innerHeight &&
                rect.height > 100
            );
            
            if (isVisible) {
                const contentId = extractContentId(element);
                
                if (!viewedContentIds.has(contentId)) {
                    viewedContentIds.add(contentId);
                    const contentType = getContentType(element);
                    
                    // Track content with enhanced analysis if enabled
                    if (enhancedTracker && userSettings.features.textAnalysis) {
                        enhancedTracker.analyzeAndTrackContent(element, contentId, contentType);
                    }
                    
                    switch(contentType) {
                        case 'post':
                            contentMetrics.postsViewed.add(contentId);
                            console.log(`Post viewed: ${contentMetrics.postsViewed.size}/${userSettings.thresholds.postsViewed}`);
                            break;
                        case 'story':
                            contentMetrics.storiesViewed.add(contentId);
                            console.log(`Story viewed: ${contentMetrics.storiesViewed.size}/${userSettings.thresholds.storiesViewed}`);
                            break;
                        case 'reel':
                            contentMetrics.reelsViewed.add(contentId);
                            console.log(`Reel viewed: ${contentMetrics.reelsViewed.size}/${userSettings.thresholds.reelsViewed}`);
                            break;
                    }
                    
                    if (hasReachedThreshold()) {
                        showMindfulReminder();
                    }
                }
            }
        });
    });
}

// Track scroll depth
function trackScrolling() {
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY) {
            contentMetrics.scrollDepth += (currentScrollY - lastScrollY);
        }
        lastScrollY = currentScrollY;
        
        analyzeVisibleContent();
    });
}

// Set up mutation observer for dynamic content
function setupContentObserver() {
    if (contentObserver) {
        contentObserver.disconnect();
    }
    
    contentObserver = new MutationObserver((mutations) => {
        clearTimeout(contentMetrics.analysisTimeout);
        contentMetrics.analysisTimeout = setTimeout(() => {
            analyzeVisibleContent();
        }, 500);
    });
    
    const targetNode = document.querySelector('main') || document.body;
    contentObserver.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: false
    });
}

// Show the mindful reminder when threshold is reached
async function showMindfulReminder() {
    if (reminderShown || !(await shouldShowReminder())) {
        return;
    }
    
    reminderShown = true;
    
    console.log('Content consumption metrics:', {
        posts: contentMetrics.postsViewed.size,
        stories: contentMetrics.storiesViewed.size,
        reels: contentMetrics.reelsViewed.size,
        timeSpent: (Date.now() - contentMetrics.sessionStart) / 1000,
        scrollDepth: contentMetrics.scrollDepth
    });
    
    createReminderDialog();
}

async function createReminderDialog() {
    if (!document.body || document.documentElement.tagName.toLowerCase() === 'svg') {
        return;
    }

    if (document.querySelector('.focus-reminder')) {
        return;
    }

    const dialog = document.createElement('div');
    dialog.className = 'focus-reminder';
    
    // Get consumption summary
    let summaryHtml = '';
    if (enhancedTracker && userSettings.features.textAnalysis) {
        const summary = enhancedTracker.getConsumptionSummary(contentMetrics);
        summaryHtml = `
            <p>You've viewed ${summary.postsViewed} posts and spent ${summary.timeSpent} minutes here.</p>
            ${summary.dominantContent !== 'general' ? 
                `<p>You've been looking at a lot of ${summary.dominantContent} content.</p>` : ''}
            ${summary.negativeContent > 2 ? 
                `<p>Some of the content you've viewed contained negative themes.</p>` : ''}
        `;
    } else {
        const postsCount = contentMetrics.postsViewed.size;
        const timeSpent = Math.floor((Date.now() - contentMetrics.sessionStart) / 60000);
        summaryHtml = `<p>You've viewed ${postsCount} posts and spent ${timeSpent} minutes here.</p>`;
    }
    
    dialog.innerHTML = `
        <div class="focus-reminder-content">
            <h2>Mindful Moment</h2>
            ${summaryHtml}
            <p>Are you spending your time intentionally?</p>
            
            <div id="timer-selection" class="section">
                <p class="section-title">If necessary...</p>
                <p class="section-subtitle">Look outside the window<br>and come back in a minute</p>
                <div class="timer-options">
                    <button class="schedule" data-minutes="1">Take a Break</button>
                </div>
            </div>

            <div id="timer-display" class="section" style="display: none;">
                <p class="timer">Time remaining until you can continue</p>
                <p class="countdown"><span id="countdown">00:${DELAY_TIME}</span></p>
            </div>

            <div class="focus-reminder-buttons">
                <button class="leave">Leave Now</button>
                <p class="button-hint">and focus on what matters</p>
            </div>
        </div>
    `;

    let countdownInterval;
    const timerDisplay = dialog.querySelector('#timer-display');
    const countdownElement = dialog.querySelector('#countdown');
    const timerSelection = dialog.querySelector('#timer-selection');

    dialog.querySelector('.schedule').addEventListener('click', () => {
        if (countdownInterval) clearInterval(countdownInterval);

        let timeLeft = DELAY_TIME;
        timerSelection.style.display = 'none';
        timerDisplay.style.display = 'block';
        
        countdownInterval = setInterval(() => {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            countdownElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                dialog.style.opacity = '0';
                dialog.style.transform = 'translate(-50%, -50%) scale(0.95)';
                setTimeout(() => {
                    dialog.remove();
                    resetMetrics();
                }, 200);
            }
        }, 1000);
    });

    dialog.querySelector('.leave').addEventListener('click', () => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        dialog.style.opacity = '0';
        dialog.style.transform = 'translate(-50%, -50%) scale(0.95)';
        setTimeout(() => {
            chrome.runtime.sendMessage({ action: 'closeTab' });
        }, 200);
    });

    dialog.style.opacity = '0';
    dialog.style.transition = 'all 0.2s ease';
    document.body.appendChild(dialog);
    
    setTimeout(() => {
        dialog.style.opacity = '1';
    }, 50);
}

// Reset metrics for a new session
function resetMetrics() {
    contentMetrics = {
        postsViewed: new Set(),
        storiesViewed: new Set(),
        reelsViewed: new Set(),
        timeSpent: 0,
        scrollDepth: 0,
        sessionStart: Date.now(),
        lastInteraction: Date.now()
    };
    viewedContentIds.clear();
    reminderShown = false;
    
    if (enhancedTracker) {
        enhancedTracker.textAnalysisResults.clear();
    }
}

// Initialize content tracking
async function initializeContentTracking() {
    if (!document.body || document.documentElement.tagName.toLowerCase() === 'svg') {
        return;
    }
    
    // Load settings first
    await loadSettings();
    
    // Set up observers and listeners
    setupContentObserver();
    trackScrolling();
    
    // Initial content analysis
    setTimeout(() => {
        analyzeVisibleContent();
    }, 2000);
    
    // Periodic analysis for time-based threshold
    setInterval(() => {
        if (hasReachedThreshold() && !reminderShown) {
            showMindfulReminder();
        }
    }, 30000);
}

// Handle messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkReminder') {
        if (hasReachedThreshold()) {
            showMindfulReminder();
        }
    } else if (message.action === 'getMetrics') {
        sendResponse({
            ...contentMetrics,
            postsViewed: contentMetrics.postsViewed.size,
            storiesViewed: contentMetrics.storiesViewed.size,
            reelsViewed: contentMetrics.reelsViewed.size,
            timeSpent: (Date.now() - contentMetrics.sessionStart) / 1000
        });
    }
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.contentThresholds || changes.advancedFeatures)) {
        loadSettings();
    }
});

// Initialize when page is ready
if (document.readyState === 'complete') {
    initializeContentTracking();
} else {
    window.addEventListener('load', initializeContentTracking);
}