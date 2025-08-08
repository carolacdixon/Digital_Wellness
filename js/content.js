// js/content.js - Simplified content tracker with floating display
console.log('🔄 content.js loading...');

let visionAnalyzer = null;
let viewedContentIds = new Set();
let floatingDisplay = null;

// Initialize vision analyzer
async function initializeAnalyzer() {
    console.log('Initializing analyzer...');
    if (window.ContentVisionAnalyzer) {
        visionAnalyzer = new window.ContentVisionAnalyzer();
        console.log('✅ Vision Analyzer initialized');
    } else {
        console.log('❌ ContentVisionAnalyzer not found on window');
    }
    
    // Create floating display
    createFloatingDisplay();
}

// Extract unique ID from Instagram post
function extractContentId(element) {
    const article = element.closest('article');
    if (article) {
        const postLink = article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        if (postLink) {
            const match = postLink.href.match(/\/(p|reel)\/([^\/]+)/);
            if (match) return match[2];
        }
    }
    
    const rect = element.getBoundingClientRect();
    return `${rect.top}-${rect.left}-${element.innerHTML.substring(0, 50)}`;
}

// Analyze visible content on the page
async function analyzeVisibleContent() {
    console.log('Checking for visible content...');
    const articles = document.querySelectorAll('article');
    console.log(`Found ${articles.length} articles on page`);
    
    for (const article of articles) {
        const rect = article.getBoundingClientRect();
        const isVisible = (
            rect.top >= -100 &&
            rect.bottom <= window.innerHeight + 100 &&
            rect.height > 100
        );
        
        if (isVisible) {
            const contentId = extractContentId(article);
            
            if (!viewedContentIds.has(contentId)) {
                viewedContentIds.add(contentId);
                console.log(`New content detected: ${contentId}`);
                
                // Analyze with vision analyzer
                if (visionAnalyzer) {
                    await visionAnalyzer.analyzeContent(article, contentId);
                } else {
                    console.log('Vision analyzer not initialized');
                }
            }
        }
    }
}

// Create floating display for category counts
function createFloatingDisplay() {
    if (floatingDisplay) return;
    
    floatingDisplay = document.createElement('div');
    floatingDisplay.id = 'content-tracker-display';
    floatingDisplay.innerHTML = `
        <div class="tracker-header">
            <span class="tracker-title">Content Viewed</span>
            <button class="tracker-minimize">−</button>
        </div>
        <div class="tracker-content">
            <div class="category-grid"></div>
            <button class="tracker-reset">Reset</button>
        </div>
    `;
    
    document.body.appendChild(floatingDisplay);
    
    // Add minimize functionality
    const minimizeBtn = floatingDisplay.querySelector('.tracker-minimize');
    minimizeBtn.addEventListener('click', () => {
        floatingDisplay.classList.toggle('minimized');
        minimizeBtn.textContent = floatingDisplay.classList.contains('minimized') ? '+' : '−';
    });
    
    // Add reset functionality
    const resetBtn = floatingDisplay.querySelector('.tracker-reset');
    resetBtn.addEventListener('click', () => {
        if (visionAnalyzer) {
            visionAnalyzer.reset();
            viewedContentIds.clear();
        }
    });
    
    // Add styles
    addFloatingDisplayStyles();
}

// Update the floating display with new counts
function updateFloatingDisplay(categories) {
    if (!floatingDisplay) return;
    
    const grid = floatingDisplay.querySelector('.category-grid');
    grid.innerHTML = '';
    
    for (const [category, data] of Object.entries(categories)) {
        if (data.count > 0) {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <span class="category-emoji">${data.emoji}</span>
                <span class="category-name">${category}</span>
                <span class="category-count">${data.count}</span>
            `;
            grid.appendChild(item);
        }
    }
}

// Add CSS styles for floating display
function addFloatingDisplayStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #content-tracker-display {
            position: fixed !important;
            top: 70px !important;
            right: 20px !important;
            width: 200px !important;
            background: rgba(28, 28, 30, 0.95) !important;
            border-radius: 12px !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            backdrop-filter: blur(20px) !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
            z-index: 999999 !important;
            font-family: -apple-system, sans-serif !important;
            transition: all 0.3s ease !important;
        }
        
        #content-tracker-display.minimized {
            width: 120px !important;
        }
        
        #content-tracker-display.minimized .tracker-content {
            display: none !important;
        }
        
        .tracker-header {
            padding: 12px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        
        .tracker-title {
            color: #fff !important;
            font-size: 13px !important;
            font-weight: 500 !important;
        }
        
        .tracker-minimize {
            background: transparent !important;
            border: none !important;
            color: #999 !important;
            font-size: 18px !important;
            cursor: pointer !important;
            padding: 0 !important;
            width: 20px !important;
            height: 20px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        
        .tracker-minimize:hover {
            color: #fff !important;
        }
        
        .tracker-content {
            padding: 12px !important;
        }
        
        .category-grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
        }
        
        .category-item {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            color: #ccc !important;
            font-size: 12px !important;
        }
        
        .category-emoji {
            font-size: 16px !important;
        }
        
        .category-name {
            flex: 1 !important;
            text-transform: capitalize !important;
        }
        
        .category-count {
            background: rgba(255, 255, 255, 0.1) !important;
            padding: 2px 6px !important;
            border-radius: 10px !important;
            font-size: 11px !important;
        }
        
        .tracker-reset {
            width: 100% !important;
            padding: 6px !important;
            background: rgba(255, 255, 255, 0.1) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            color: #fff !important;
            font-size: 11px !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
        }
        
        .tracker-reset:hover {
            background: rgba(255, 255, 255, 0.15) !important;
        }
    `;
    document.head.appendChild(style);
}

// Set up scroll listener
function setupScrollListener() {
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            analyzeVisibleContent();
        }, 200);
    });
}

// Set up mutation observer for dynamic content
function setupContentObserver() {
    const observer = new MutationObserver(() => {
        setTimeout(analyzeVisibleContent, 500);
    });
    
    const targetNode = document.querySelector('main') || document.body;
    observer.observe(targetNode, {
        childList: true,
        subtree: true
    });
}

// Listen for updates from vision analyzer
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateCounts') {
        updateFloatingDisplay(message.categories);
    }
});

// Initialize when page is ready
if (document.readyState === 'complete') {
    initializeAnalyzer();
    setupScrollListener();
    setupContentObserver();
    setTimeout(analyzeVisibleContent, 1000);
} else {
    window.addEventListener('load', () => {
        initializeAnalyzer();
        setupScrollListener();
        setupContentObserver();
        setTimeout(analyzeVisibleContent, 1000);
    });
}
