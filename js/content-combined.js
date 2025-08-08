// js/content-combined.js - Enhanced with CLIP image+text analysis
console.log('🚀 Instagram Content Tracker with CLIP Starting...');

// Configuration
const DEBUG = true;
const CLIP_MODEL = 'Salesforce/blip-image-captioning-base'; // Using BLIP for image understanding
const CLASSIFICATION_MODEL = 'facebook/bart-large-mnli'; // For zero-shot classification

// State management
let processedContent = new Set();
let viewedContentIds = new Set();
let floatingDisplay = null;
let apiToken = null;

// Enhanced content categories with descriptions for CLIP
let contentCategories = {
    'beauty': { 
        count: 0, 
        emoji: '💄',
        prompts: ['beauty products', 'makeup', 'skincare', 'cosmetics', 'facial beauty']
    },
    'fashion': { 
        count: 0, 
        emoji: '👗',
        prompts: ['fashion outfit', 'clothing', 'style', 'wearing clothes', 'fashion model']
    },
    'food': { 
        count: 0, 
        emoji: '🍔',
        prompts: ['food', 'meal', 'eating', 'restaurant dish', 'cooking']
    },
    'fitness': { 
        count: 0, 
        emoji: '💪',
        prompts: ['fitness workout', 'gym exercise', 'sports', 'athletic activity', 'yoga pose']
    },
    'travel': { 
        count: 0, 
        emoji: '✈️',
        prompts: ['travel destination', 'vacation', 'tourist location', 'landscape scenery', 'adventure']
    },
    'pets': { 
        count: 0, 
        emoji: '🐾',
        prompts: ['pet animal', 'dog', 'cat', 'cute animal', 'pet companion']
    },
    'lifestyle': { 
        count: 0, 
        emoji: '🏠',
        prompts: ['home interior', 'lifestyle', 'daily life', 'home decor', 'living space']
    },
    'other': { 
        count: 0, 
        emoji: '📷',
        prompts: ['general photo', 'other content', 'miscellaneous']
    }
};

// Check for API token
async function checkApiToken() {
    try {
        const settings = await chrome.storage.sync.get(['huggingFaceToken']);
        if (settings.huggingFaceToken) {
            apiToken = settings.huggingFaceToken;
            if (DEBUG) console.log('✅ API token found - CLIP analysis enabled');
        } else {
            if (DEBUG) console.log('⚠️ No API token - using caption-based categorization only');
        }
    } catch (error) {
        console.error('Error checking API token:', error);
    }
}

// Convert image URL to base64
async function imageUrlToBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Remove the data:image/jpeg;base64, prefix
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error converting image to base64:', error);
        return null;
    }
}

// Analyze image with vision model and classify the description
async function analyzeImageWithCLIP(imageUrl, caption = '') {
    if (!apiToken) {
        return null;
    }

    try {
        // Get base64 image
        const base64Image = await imageUrlToBase64(imageUrl);
        if (!base64Image) {
            console.error('Failed to convert image to base64');
            return null;
        }

        if (DEBUG) console.log('🔍 Analyzing image with vision model...');

        // Step 1: Generate image description using BLIP
        const captionResponse = await fetch(
            `https://api-inference.huggingface.co/models/${CLIP_MODEL}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: base64Image,
                    options: {
                        wait_for_model: true
                    }
                })
            }
        );

        if (!captionResponse.ok) {
            const errorText = await captionResponse.text();
            console.error('Vision API error:', captionResponse.status, errorText);
            return null;
        }

        const captionResults = await captionResponse.json();
        
        if (!captionResults || captionResults.length === 0) {
            console.error('No caption generated');
            return null;
        }

        const generatedCaption = captionResults[0]?.generated_text || '';
        if (DEBUG) console.log('Generated caption:', generatedCaption);

        // Combine generated caption with original caption
        const fullText = `${generatedCaption} ${caption}`.trim();

        // Step 2: Classify the combined text
        const categories = Object.keys(contentCategories).filter(c => c !== 'other');
        
        const classificationResponse = await fetch(
            `https://api-inference.huggingface.co/models/${CLASSIFICATION_MODEL}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: fullText,
                    parameters: {
                        candidate_labels: categories,
                        multi_label: false
                    },
                    options: {
                        wait_for_model: true
                    }
                })
            }
        );

        if (!classificationResponse.ok) {
            const errorText = await classificationResponse.text();
            console.error('Classification API error:', classificationResponse.status, errorText);
            return null;
        }

        const classificationResults = await classificationResponse.json();
        
        if (DEBUG) console.log('Classification results:', classificationResults);

        // Get the top category
        if (classificationResults && classificationResults.labels && classificationResults.labels.length > 0) {
            const topCategory = classificationResults.labels[0];
            const topScore = classificationResults.scores[0];
            
            // Only use if confidence is above threshold
            if (topScore > 0.3) {
                if (DEBUG) console.log(`✅ AI classified as: ${topCategory} (confidence: ${(topScore * 100).toFixed(1)}%)`);
                return topCategory;
            }
        }

        return null;
    } catch (error) {
        console.error('Error in vision analysis:', error);
        return null;
    }
}

// Fallback: Categorize content based on caption only
function categorizeByCaption(caption) {
    const text = (caption || '').toLowerCase();
    
    const categoryKeywords = {
        'beauty': ['makeup', 'beauty', 'skincare', 'glow', 'skin', 'cosmetic', 'lipstick', 'mascara'],
        'fashion': ['outfit', 'ootd', 'fashion', 'style', 'dress', 'wear', 'clothing', 'clothes'],
        'food': ['food', 'eat', 'meal', 'recipe', 'delicious', 'yummy', 'cook', 'restaurant', 'dinner', 'lunch'],
        'fitness': ['workout', 'gym', 'fitness', 'exercise', 'training', 'muscle', 'yoga', 'run'],
        'travel': ['travel', 'trip', 'vacation', 'explore', 'adventure', 'journey', 'visit', 'tourist'],
        'pets': ['dog', 'cat', 'pet', 'puppy', 'kitten', 'animal', 'fur baby', 'paw'],
        'lifestyle': ['home', 'decor', 'life', 'daily', 'morning', 'routine', 'cozy', 'living']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => text.includes(keyword))) {
            return category;
        }
    }
    
    return 'other';
}

// Enhanced content analysis with CLIP
async function analyzeContent(element, contentId) {
    if (processedContent.has(contentId)) {
        return;
    }
    
    processedContent.add(contentId);
    
    // Extract image URL
    let imageUrl = null;
    const imageSelectors = [
        'img[srcset]',
        'img[src]',
        'video[poster]'
    ];
    
    for (const selector of imageSelectors) {
        const img = element.querySelector(selector);
        if (img) {
            if (img.srcset) {
                // Get the highest quality image from srcset
                const srcsetParts = img.srcset.split(',');
                const lastPart = srcsetParts[srcsetParts.length - 1].trim();
                imageUrl = lastPart.split(' ')[0];
            } else if (img.src) {
                imageUrl = img.src;
            } else if (img.poster) {
                imageUrl = img.poster;
            }
            
            if (imageUrl && !imageUrl.includes('data:')) {
                break;
            }
        }
    }
    
    // Extract caption
    let caption = '';
    const captionSelectors = [
        'h1',
        'span[dir="auto"]',
        '[data-testid="post-caption"]',
        'div[style*="line-height"] span'
    ];
    
    for (const selector of captionSelectors) {
        try {
            const elements = element.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent || '';
                if (text.length > caption.length && text.length > 10) {
                    caption = text;
                }
            }
        } catch (error) {
            // Continue with next selector
        }
    }
    
    if (DEBUG) console.log(`📸 Analyzing post: ${contentId}`);
    if (DEBUG && imageUrl) console.log(`   Image: ${imageUrl.substring(0, 50)}...`);
    if (DEBUG && caption) console.log(`   Caption: ${caption.substring(0, 50)}...`);
    
    let category = 'other';
    
    // Try vision analysis first if we have an image and API token
    if (imageUrl && apiToken) {
        const visionCategory = await analyzeImageWithCLIP(imageUrl, caption);
        if (visionCategory) {
            category = visionCategory;
            if (DEBUG) console.log(`   ✨ AI vision category: ${category}`);
        } else {
            // Fallback to caption-based categorization
            category = categorizeByCaption(caption);
            if (DEBUG) console.log(`   📝 Caption-based category: ${category}`);
        }
    } else {
        // No image or API token, use caption-based categorization
        category = categorizeByCaption(caption);
        if (DEBUG) console.log(`   📝 Caption-only category: ${category}`);
    }
    
    // Update count
    contentCategories[category].count++;
    
    // Update display
    updateFloatingDisplay();
}

// Create floating display
function createFloatingDisplay() {
    if (floatingDisplay) {
        if (DEBUG) console.log('Display already exists');
        return;
    }
    
    if (DEBUG) console.log('Creating floating display...');
    
    floatingDisplay = document.createElement('div');
    floatingDisplay.id = 'content-tracker-display';
    
    // Apply styles directly to avoid CSS conflicts
    Object.assign(floatingDisplay.style, {
        position: 'fixed',
        top: '70px',
        right: '20px',
        width: '220px',
        background: 'rgba(28, 28, 30, 0.95)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        zIndex: '999999',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    });
    
    // Create header
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '12px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px 12px 0 0'
    });
    
    const title = document.createElement('span');
    Object.assign(title.style, {
        color: '#fff',
        fontSize: '13px',
        fontWeight: '600',
        letterSpacing: '0.3px'
    });
    title.textContent = apiToken ? '🤖 AI Vision Analysis' : '📝 Text Analysis';
    
    const minimizeBtn = document.createElement('button');
    Object.assign(minimizeBtn.style, {
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#fff',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '0',
        width: '24px',
        height: '24px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    });
    minimizeBtn.textContent = '−';
    
    header.appendChild(title);
    header.appendChild(minimizeBtn);
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'tracker-content';
    Object.assign(content.style, {
        padding: '14px'
    });
    
    // Create category grid
    const grid = document.createElement('div');
    grid.className = 'category-grid';
    Object.assign(grid.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '12px',
        maxHeight: '300px',
        overflowY: 'auto'
    });
    
    // Create stats area
    const stats = document.createElement('div');
    Object.assign(stats.style, {
        padding: '10px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        marginBottom: '12px'
    });
    
    const totalCount = document.createElement('div');
    totalCount.className = 'total-count';
    Object.assign(totalCount.style, {
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        textAlign: 'center'
    });
    totalCount.textContent = 'Total: 0';
    stats.appendChild(totalCount);
    
    // Create reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'tracker-reset';
    Object.assign(resetBtn.style, {
        width: '100%',
        padding: '8px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        color: '#fff',
        fontSize: '12px',
        fontWeight: '600',
        borderRadius: '8px',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    });
    resetBtn.textContent = 'Reset';
    
    // Assemble content area
    content.appendChild(grid);
    content.appendChild(stats);
    content.appendChild(resetBtn);
    
    // Assemble display
    floatingDisplay.appendChild(header);
    floatingDisplay.appendChild(content);
    
    // Add to page
    document.body.appendChild(floatingDisplay);
    
    // Add event listeners
    minimizeBtn.addEventListener('click', () => {
        const isMinimized = floatingDisplay.getAttribute('data-minimized') === 'true';
        
        if (isMinimized) {
            floatingDisplay.setAttribute('data-minimized', 'false');
            content.style.display = 'block';
            floatingDisplay.style.width = '220px';
            minimizeBtn.textContent = '−';
        } else {
            floatingDisplay.setAttribute('data-minimized', 'true');
            content.style.display = 'none';
            floatingDisplay.style.width = '140px';
            minimizeBtn.textContent = '+';
        }
    });
    
    resetBtn.addEventListener('click', () => {
        if (confirm('Reset all content counts?')) {
            resetCounts();
        }
    });
    
    // Add hover effects
    resetBtn.addEventListener('mouseenter', () => {
        resetBtn.style.transform = 'translateY(-1px)';
        resetBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });
    
    resetBtn.addEventListener('mouseleave', () => {
        resetBtn.style.transform = 'translateY(0)';
        resetBtn.style.boxShadow = 'none';
    });
    
    minimizeBtn.addEventListener('mouseenter', () => {
        minimizeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        minimizeBtn.style.transform = 'scale(1.1)';
    });
    
    minimizeBtn.addEventListener('mouseleave', () => {
        minimizeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        minimizeBtn.style.transform = 'scale(1)';
    });
    
    if (DEBUG) console.log('✅ Floating display created and added to page');
}

// Update the floating display
function updateFloatingDisplay() {
    if (!floatingDisplay) {
        if (DEBUG) console.log('No display to update, creating one...');
        createFloatingDisplay();
        return;
    }
    
    if (DEBUG) console.log('Updating display with:', contentCategories);
    
    const grid = floatingDisplay.querySelector('.category-grid');
    const totalCountEl = floatingDisplay.querySelector('.total-count');
    const title = floatingDisplay.querySelector('span');
    
    // Update title based on API status
    if (title) {
        title.textContent = apiToken ? '🤖 AI Vision Analysis' : '📝 Text Analysis';
    }
    
    if (!grid || !totalCountEl) {
        console.error('Display elements not found');
        return;
    }
    
    // Clear grid
    grid.innerHTML = '';
    let total = 0;
    
    // Add categories with counts > 0
    for (const [category, data] of Object.entries(contentCategories)) {
        total += data.count;
        
        if (data.count > 0) {
            const item = document.createElement('div');
            Object.assign(item.style, {
                display: 'flex',
                alignItems: 'center',
                padding: '8px 10px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                transition: 'all 0.2s'
            });
            
            const emoji = document.createElement('span');
            Object.assign(emoji.style, {
                fontSize: '18px',
                width: '24px',
                textAlign: 'center'
            });
            emoji.textContent = data.emoji;
            
            const name = document.createElement('span');
            Object.assign(name.style, {
                flex: '1',
                color: '#e0e0e0',
                fontSize: '13px',
                textTransform: 'capitalize',
                fontWeight: '500',
                marginLeft: '10px'
            });
            name.textContent = category;
            
            const count = document.createElement('span');
            Object.assign(count.style, {
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#fff',
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
            });
            count.textContent = data.count.toString();
            
            item.appendChild(emoji);
            item.appendChild(name);
            item.appendChild(count);
            
            // Add hover effect
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(255, 255, 255, 0.08)';
                item.style.transform = 'translateX(2px)';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.background = 'rgba(255, 255, 255, 0.05)';
                item.style.transform = 'translateX(0)';
            });
            
            grid.appendChild(item);
        }
    }
    
    // Update total
    totalCountEl.textContent = `Total: ${total}`;
    
    // Make sure display is visible
    floatingDisplay.style.display = 'block';
}

// Reset counts
function resetCounts() {
    for (const category in contentCategories) {
        contentCategories[category].count = 0;
    }
    processedContent.clear();
    viewedContentIds.clear();
    updateFloatingDisplay();
    if (DEBUG) console.log('✅ Counts reset');
}

// Extract unique ID from Instagram post
function extractContentId(element) {
    try {
        // Try to find a unique identifier
        const article = element.closest('article') || element;
        
        // Method 1: Look for post/reel links
        const links = article.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
        for (const link of links) {
            const match = link.href.match(/\/(p|reel)\/([^\/\?]+)/);
            if (match) return match[2];
        }
        
        // Method 2: Use image src as ID
        const img = article.querySelector('img[src]');
        if (img && img.src) {
            return img.src.split('/').pop().split('?')[0];
        }
        
        // Method 3: Generate ID from content
        const text = article.textContent || '';
        const hash = text.substring(0, 50).replace(/\s+/g, '');
        return `content-${Date.now()}-${hash}`;
    } catch (error) {
        return `content-${Date.now()}-${Math.random()}`;
    }
}

// Analyze visible content on the page
async function analyzeVisibleContent() {
    if (DEBUG) console.log('Scanning for visible content...');
    
    // Find all posts on the page
    const postSelectors = [
        'article',
        'div[role="article"]',
        '[data-testid="post"]'
    ];
    
    let posts = [];
    for (const selector of postSelectors) {
        try {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
                posts = Array.from(found);
                break;
            }
        } catch (error) {
            // Continue with next selector
        }
    }
    
    if (DEBUG) console.log(`Found ${posts.length} posts on page`);
    
    let newPosts = 0;
    
    for (const post of posts) {
        try {
            const rect = post.getBoundingClientRect();
            
            // Check if post is visible
            const isVisible = (
                rect.top < window.innerHeight &&
                rect.bottom > 0 &&
                rect.height > 100
            );
            
            if (isVisible) {
                const contentId = extractContentId(post);
                
                if (!viewedContentIds.has(contentId)) {
                    viewedContentIds.add(contentId);
                    newPosts++;
                    await analyzeContent(post, contentId);
                    
                    // Add a small delay between API calls to avoid rate limiting
                    if (apiToken && newPosts % 3 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
        } catch (error) {
            console.error('Error analyzing post:', error);
        }
    }
    
    if (DEBUG && newPosts > 0) {
        console.log(`✅ Analyzed ${newPosts} new posts`);
    }
}

// Set up scroll listener
function setupScrollListener() {
    let scrollTimeout;
    
    const handleScroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            analyzeVisibleContent();
        }, 300);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleScroll, { passive: true });
    
    if (DEBUG) console.log('✅ Scroll listeners set up');
}

// Set up mutation observer
function setupContentObserver() {
    const observer = new MutationObserver((mutations) => {
        const hasNewContent = mutations.some(mutation => {
            if (mutation.addedNodes.length > 0) {
                return Array.from(mutation.addedNodes).some(node => {
                    return node.nodeType === 1 && 
                           (node.tagName === 'ARTICLE' || 
                            (node.querySelector && node.querySelector('article')));
                });
            }
            return false;
        });
        
        if (hasNewContent) {
            setTimeout(analyzeVisibleContent, 500);
        }
    });
    
    const targetNode = document.querySelector('main') || 
                      document.querySelector('[role="main"]') || 
                      document.body;
                      
    observer.observe(targetNode, {
        childList: true,
        subtree: true
    });
    
    if (DEBUG) console.log('✅ Mutation observer set up');
}

// Initialize everything
async function initialize() {
    console.log('🚀 Initializing Instagram Content Tracker with CLIP...');
    
    try {
        // Check API token
        await checkApiToken();
        
        // Create display immediately
        createFloatingDisplay();
        
        // Set up listeners
        setupScrollListener();
        setupContentObserver();
        
        // Initial analysis
        setTimeout(() => {
            analyzeVisibleContent();
        }, 1000);
        
        // Periodic analysis as backup
        setInterval(() => {
            analyzeVisibleContent();
        }, 5000);
        
        console.log('✅ Instagram Content Tracker with CLIP initialized successfully!');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Start when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCounts') {
        sendResponse(contentCategories);
    }
    return true;
});