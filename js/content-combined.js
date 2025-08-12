// ============================================================================
// FILE: js/content-combined.js
// Purpose: Main content analysis script that runs on Instagram
// ============================================================================

/**
 * Instagram Content Tracker
 * 
 * This script runs on Instagram pages and:
 * 1. Monitors visible posts as you scroll
 * 2. Analyzes images using AI (if API token provided) or text keywords
 * 3. Categorizes content into types (beauty, fashion, food, etc.)
 * 4. Displays real-time statistics in a floating widget
 * 
 * @author MSc Thesis Project
 * @version 1.0.0
 */

'use strict';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** @const {boolean} - Set to true to enable console logging for debugging */
const DEBUG = false;

/** @const {string} - Hugging Face model for generating image captions */
const CAPTION_MODEL = 'Salesforce/blip-image-captioning-base';

/** @const {string} - Hugging Face model for classifying text into categories */
const CLASSIFIER_MODEL = 'facebook/bart-large-mnli';

/** @const {number} - Minimum confidence score (0-1) for AI predictions */
const CONFIDENCE_THRESHOLD = 0.3;

/** @const {number} - Milliseconds to wait between API calls to avoid rate limits */
const API_RATE_LIMIT_DELAY = 1000;

/** @const {number} - How often to scan for new content (milliseconds) */
const SCAN_INTERVAL = 5000;

// ============================================================================
// GLOBAL STATE
// ============================================================================

/** @type {Set<string>} - IDs of posts we've already analyzed */
let processedContent = new Set();

/** @type {Set<string>} - IDs of posts the user has viewed */
let viewedContentIds = new Set();

/** @type {HTMLElement|null} - Reference to the floating statistics display */
let floatingDisplay = null;

/** @type {string|null} - Hugging Face API token for AI features */
let apiToken = null;

/**
 * Content categories with their counts and metadata
 * Each category has:
 * - count: Number of posts in this category
 * - emoji: Visual icon for the category
 * - keywords: Words to look for in captions (fallback when AI unavailable)
 */
let contentCategories = {
  'beauty': { 
    count: 0, 
    emoji: '💄',
    keywords: ['makeup', 'beauty', 'skincare', 'glow', 'skin', 'cosmetic', 'lipstick', 'mascara']
  },
  'fashion': { 
    count: 0, 
    emoji: '👗',
    keywords: ['outfit', 'ootd', 'fashion', 'style', 'dress', 'wear', 'clothing', 'clothes']
  },
  'food': { 
    count: 0, 
    emoji: '🍔',
    keywords: ['food', 'eat', 'meal', 'recipe', 'delicious', 'yummy', 'cook', 'restaurant']
  },
  'fitness': { 
    count: 0, 
    emoji: '💪',
    keywords: ['workout', 'gym', 'fitness', 'exercise', 'training', 'muscle', 'yoga', 'run']
  },
  'travel': { 
    count: 0, 
    emoji: '✈️',
    keywords: ['travel', 'trip', 'vacation', 'explore', 'adventure', 'journey', 'visit', 'tourist']
  },
  'pets': { 
    count: 0, 
    emoji: '🐾',
    keywords: ['dog', 'cat', 'pet', 'puppy', 'kitten', 'animal', 'fur baby', 'paw']
  },
  'lifestyle': { 
    count: 0, 
    emoji: '🏠',
    keywords: ['home', 'decor', 'life', 'daily', 'morning', 'routine', 'cozy', 'living']
  },
  'other': { 
    count: 0, 
    emoji: '📷',
    keywords: [] // Catch-all category
  }
};

// ============================================================================
// API TOKEN MANAGEMENT
// ============================================================================

/**
 * Load the Hugging Face API token from Chrome storage
 * This token enables AI-powered image analysis
 * @returns {Promise<void>}
 */
async function loadApiToken() {
  try {
    const settings = await chrome.storage.sync.get(['huggingFaceToken']);
    if (settings.huggingFaceToken) {
      apiToken = settings.huggingFaceToken;
      if (DEBUG) console.log('✅ API token loaded - AI analysis enabled');
    } else {
      if (DEBUG) console.log('⚠️ No API token - using text-only analysis');
    }
  } catch (error) {
    console.error('Failed to load API token:', error);
  }
}

// ============================================================================
// IMAGE ANALYSIS
// ============================================================================

/**
 * Convert an image URL to base64 format for API submission
 * @param {string} url - The image URL to convert
 * @returns {Promise<string|null>} Base64 encoded image or null if failed
 */
async function imageUrlToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Extract just the base64 data (remove the data:image/jpeg;base64, prefix)
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    if (DEBUG) console.error('Failed to convert image:', error);
    return null;
  }
}

/**
 * Analyze an image using Hugging Face AI models
 * Process:
 * 1. Convert image to base64
 * 2. Send to BLIP model to generate a caption describing the image
 * 3. Send caption to BART model to classify into our categories
 * 
 * @param {string} imageUrl - URL of the image to analyze
 * @param {string} caption - Original post caption (used to enhance classification)
 * @returns {Promise<string|null>} Category name or null if analysis failed
 */
async function analyzeImageWithAI(imageUrl, caption = '') {
  // Skip if no API token available
  if (!apiToken) {
    return null;
  }

  try {
    // Step 1: Convert image to base64
    const base64Image = await imageUrlToBase64(imageUrl);
    if (!base64Image) {
      return null;
    }

    if (DEBUG) console.log('🔍 Starting AI image analysis...');

    // Step 2: Generate image caption using BLIP model
    const captionResponse = await fetch(
      `https://api-inference.huggingface.co/models/${CAPTION_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: base64Image,
          options: { wait_for_model: true }
        })
      }
    );

    if (!captionResponse.ok) {
      if (DEBUG) console.error('Caption API error:', captionResponse.status);
      return null;
    }

    const captionResults = await captionResponse.json();
    const generatedCaption = captionResults[0]?.generated_text || '';
    
    if (DEBUG) console.log('Generated caption:', generatedCaption);

    // Step 3: Combine AI caption with original caption for better context
    const fullText = `${generatedCaption} ${caption}`.trim();

    // Step 4: Classify the text into our categories
    const categories = Object.keys(contentCategories).filter(c => c !== 'other');
    
    const classificationResponse = await fetch(
      `https://api-inference.huggingface.co/models/${CLASSIFIER_MODEL}`,
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
          options: { wait_for_model: true }
        })
      }
    );

    if (!classificationResponse.ok) {
      if (DEBUG) console.error('Classification API error:', classificationResponse.status);
      return null;
    }

    const classificationResults = await classificationResponse.json();
    
    // Step 5: Return the highest confidence category if above threshold
    if (classificationResults?.labels?.length > 0) {
      const topCategory = classificationResults.labels[0];
      const topScore = classificationResults.scores[0];
      
      if (topScore > CONFIDENCE_THRESHOLD) {
        if (DEBUG) {
          console.log(`✅ AI classified as: ${topCategory} (${(topScore * 100).toFixed(1)}% confidence)`);
        }
        return topCategory;
      }
    }

    return null;
  } catch (error) {
    if (DEBUG) console.error('AI analysis failed:', error);
    return null;
  }
}

/**
 * Fallback categorization using keyword matching in captions
 * Used when AI is unavailable or fails
 * 
 * @param {string} caption - Text to analyze
 * @returns {string} Category name
 */
function categorizeByKeywords(caption) {
  const text = (caption || '').toLowerCase();
  
  // Check each category's keywords
  for (const [category, data] of Object.entries(contentCategories)) {
    if (category === 'other') continue;
    
    // If any keyword matches, return this category
    if (data.keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }
  
  return 'other';
}

// ============================================================================
// CONTENT EXTRACTION
// ============================================================================

/**
 * Extract a unique ID from an Instagram post element
 * Try multiple methods to ensure we don't count the same post twice
 * 
 * @param {HTMLElement} element - The post element
 * @returns {string} Unique identifier for the post
 */
function extractPostId(element) {
  try {
    const article = element.closest('article') || element;
    
    // Method 1: Look for Instagram's post/reel URLs
    const links = article.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    for (const link of links) {
      const match = link.href.match(/\/(p|reel)\/([^\/\?]+)/);
      if (match) return match[2];
    }
    
    // Method 2: Use image source as ID
    const img = article.querySelector('img[src]');
    if (img && img.src) {
      return img.src.split('/').pop().split('?')[0];
    }
    
    // Method 3: Generate ID from content hash
    const text = article.textContent || '';
    const hash = text.substring(0, 50).replace(/\s+/g, '');
    return `post-${Date.now()}-${hash}`;
  } catch (error) {
    // Fallback: Random ID
    return `post-${Date.now()}-${Math.random()}`;
  }
}

/**
 * Extract image URL from a post element
 * Instagram uses various image formats, so we try multiple selectors
 * 
 * @param {HTMLElement} element - The post element
 * @returns {string|null} Image URL or null if not found
 */
function extractImageUrl(element) {
  const selectors = [
    'img[srcset]',  // High-res images
    'img[src]',      // Regular images
    'video[poster]'  // Video thumbnails
  ];
  
  for (const selector of selectors) {
    const img = element.querySelector(selector);
    if (img) {
      if (img.srcset) {
        // Get highest quality from srcset
        const srcsetParts = img.srcset.split(',');
        const lastPart = srcsetParts[srcsetParts.length - 1].trim();
        return lastPart.split(' ')[0];
      } else if (img.src && !img.src.includes('data:')) {
        return img.src;
      } else if (img.poster) {
        return img.poster;
      }
    }
  }
  
  return null;
}

/**
 * Extract caption text from a post element
 * Instagram's DOM structure varies, so we try multiple selectors
 * 
 * @param {HTMLElement} element - The post element
 * @returns {string} Caption text or empty string
 */
function extractCaption(element) {
  const selectors = [
    'h1',                              // Sometimes captions are in h1
    'span[dir="auto"]',                // Common caption container
    '[data-testid="post-caption"]',   // Test ID (may change)
    'div[style*="line-height"] span'   // Style-based selector
  ];
  
  let caption = '';
  
  for (const selector of selectors) {
    try {
      const elements = element.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent || '';
        // Use the longest text we find (likely the actual caption)
        if (text.length > caption.length && text.length > 10) {
          caption = text;
        }
      }
    } catch (error) {
      // Continue with next selector
    }
  }
  
  return caption;
}

// ============================================================================
// MAIN ANALYSIS PIPELINE
// ============================================================================

/**
 * Analyze a single Instagram post
 * This is the main processing function that:
 * 1. Extracts content from the post
 * 2. Attempts AI analysis if available
 * 3. Falls back to keyword analysis
 * 4. Updates category counts
 * 
 * @param {HTMLElement} element - The post element to analyze
 * @param {string} postId - Unique identifier for the post
 * @returns {Promise<void>}
 */
async function analyzePost(element, postId) {
  // Skip if already processed
  if (processedContent.has(postId)) {
    return;
  }
  
  processedContent.add(postId);
  
  // Extract content from the post
  const imageUrl = extractImageUrl(element);
  const caption = extractCaption(element);
  
  if (DEBUG) {
    console.log(`📸 Analyzing post: ${postId}`);
    if (imageUrl) console.log(`   Image: ${imageUrl.substring(0, 50)}...`);
    if (caption) console.log(`   Caption: ${caption.substring(0, 50)}...`);
  }
  
  let category = 'other';
  
  // Try AI analysis first if we have an image and API token
  if (imageUrl && apiToken) {
    const aiCategory = await analyzeImageWithAI(imageUrl, caption);
    if (aiCategory) {
      category = aiCategory;
      if (DEBUG) console.log(`   ✨ AI category: ${category}`);
    } else {
      // AI failed, fall back to keywords
      category = categorizeByKeywords(caption);
      if (DEBUG) console.log(`   📝 Keyword category: ${category}`);
    }
  } else {
    // No AI available, use keywords only
    category = categorizeByKeywords(caption);
    if (DEBUG) console.log(`   📝 Keyword category: ${category}`);
  }
  
  // Update the count for this category
  contentCategories[category].count++;
  
  // Refresh the display
  updateFloatingDisplay();
}

/**
 * Scan the page for visible Instagram posts and analyze them
 * This function:
 * 1. Finds all posts on the page
 * 2. Checks which ones are visible in the viewport
 * 3. Analyzes new posts that haven't been processed yet
 * 
 * @returns {Promise<void>}
 */
async function scanVisibleContent() {
  if (DEBUG) console.log('Scanning for visible content...');
  
  // Find all posts on the page (Instagram uses various selectors)
  const postSelectors = [
    'article',                  // Main post container
    'div[role="article"]',     // Alternative selector
    '[data-testid="post"]'     // Test ID (may change)
  ];
  
  let posts = [];
  for (const selector of postSelectors) {
    posts = document.querySelectorAll(selector);
    if (posts.length > 0) break;
  }
  
  if (DEBUG) console.log(`Found ${posts.length} posts on page`);
  
  let newPostCount = 0;
  
  for (const post of posts) {
    try {
      // Check if post is visible in viewport
      const rect = post.getBoundingClientRect();
      const isVisible = (
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.height > 100  // Minimum height to avoid fragments
      );
      
      if (isVisible) {
        const postId = extractPostId(post);
        
        if (!viewedContentIds.has(postId)) {
          viewedContentIds.add(postId);
          newPostCount++;
          await analyzePost(post, postId);
          
          // Rate limiting: pause between API calls
          if (apiToken && newPostCount % 3 === 0) {
            await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT_DELAY));
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing post:', error);
    }
  }
  
  if (DEBUG && newPostCount > 0) {
    console.log(`✅ Analyzed ${newPostCount} new posts`);
  }
}

// ============================================================================
// USER INTERFACE
// ============================================================================

/**
 * Create the floating display widget that shows category statistics
 * This creates a draggable, minimizable overlay on the Instagram page
 * 
 * @returns {void}
 */
function createFloatingDisplay() {
  if (floatingDisplay) return;
  
  if (DEBUG) console.log('Creating floating display...');
  
  // Create main container
  floatingDisplay = document.createElement('div');
  floatingDisplay.id = 'content-tracker-display';
  
  // Apply inline styles (to work on any page without external CSS)
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
  
  // Create header with title and minimize button
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
  
  // Title shows whether AI or keyword analysis is active
  const title = document.createElement('span');
  Object.assign(title.style, {
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    letterSpacing: '0.3px'
  });
  title.textContent = apiToken ? '🤖 AI Vision Analysis' : '📝 Text Analysis';
  
  // Minimize/maximize button
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
    justifyContent: 'center',
    transition: 'all 0.2s'
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
  
  // Category list container
  const categoryList = document.createElement('div');
  categoryList.className = 'category-list';
  Object.assign(categoryList.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '12px',
    maxHeight: '300px',
    overflowY: 'auto'
  });
  
  // Total count display
  const statsContainer = document.createElement('div');
  Object.assign(statsContainer.style, {
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
  statsContainer.appendChild(totalCount);
  
  // Reset button
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
    letterSpacing: '0.5px',
    transition: 'all 0.2s'
  });
  resetBtn.textContent = 'Reset Counts';
  
  // Assemble the widget
  content.appendChild(categoryList);
  content.appendChild(statsContainer);
  content.appendChild(resetBtn);
  
  floatingDisplay.appendChild(header);
  floatingDisplay.appendChild(content);
  
  // Add to page
  document.body.appendChild(floatingDisplay);
  
  // EVENT HANDLERS
  
  // Minimize/maximize functionality
  minimizeBtn.addEventListener('click', () => {
    const isMinimized = floatingDisplay.getAttribute('data-minimized') === 'true';
    
    if (isMinimized) {
      // Expand
      floatingDisplay.setAttribute('data-minimized', 'false');
      content.style.display = 'block';
      floatingDisplay.style.width = '220px';
      minimizeBtn.textContent = '−';
    } else {
      // Minimize
      floatingDisplay.setAttribute('data-minimized', 'true');
      content.style.display = 'none';
      floatingDisplay.style.width = '140px';
      minimizeBtn.textContent = '+';
    }
  });
  
  // Reset button handler
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all content counts?')) {
      resetCounts();
    }
  });
  
  // Add hover effects for better UX
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
  
  if (DEBUG) console.log('✅ Floating display created');
}

/**
 * Update the floating display with current category counts
 * Refreshes the UI to show the latest statistics
 * 
 * @returns {void}
 */
function updateFloatingDisplay() {
  if (!floatingDisplay) {
    createFloatingDisplay();
    return;
  }
  
  const categoryList = floatingDisplay.querySelector('.category-list');
  const totalCountEl = floatingDisplay.querySelector('.total-count');
  const title = floatingDisplay.querySelector('span');
  
  // Update title based on API status
  if (title) {
    title.textContent = apiToken ? '🤖 AI Vision Analysis' : '📝 Text Analysis';
  }
  
  if (!categoryList || !totalCountEl) return;
  
  // Clear and rebuild category list
  categoryList.innerHTML = '';
  let total = 0;
  
  // Add each category with count > 0
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
      
      // Category emoji
      const emoji = document.createElement('span');
      Object.assign(emoji.style, {
        fontSize: '18px',
        width: '24px',
        textAlign: 'center'
      });
      emoji.textContent = data.emoji;
      
      // Category name
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
      
      // Count badge
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
      
      // Hover effect
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255, 255, 255, 0.08)';
        item.style.transform = 'translateX(2px)';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.background = 'rgba(255, 255, 255, 0.05)';
        item.style.transform = 'translateX(0)';
      });
      
      categoryList.appendChild(item);
    }
  }
  
  // Update total
  totalCountEl.textContent = `Total: ${total}`;
}

/**
 * Reset all counts and clear processed content
 * @returns {void}
 */
function resetCounts() {
  // Reset all category counts to 0
  for (const category in contentCategories) {
    contentCategories[category].count = 0;
  }
  
  // Clear tracking sets
  processedContent.clear();
  viewedContentIds.clear();
  
  // Update display
  updateFloatingDisplay();
  
  if (DEBUG) console.log('✅ All counts reset');
}

// ============================================================================
// EVENT LISTENERS & OBSERVERS
// ============================================================================

/**
 * Set up scroll listener to detect when user scrolls
 * Uses debouncing to avoid excessive processing
 * @returns {void}
 */
function setupScrollListener() {
  let scrollTimeout;
  
  const handleScroll = () => {
    clearTimeout(scrollTimeout);
    // Debounce: wait 300ms after scrolling stops before scanning
    scrollTimeout = setTimeout(() => {
      scanVisibleContent();
    }, 300);
  };
  
  // Listen for both scroll and wheel events
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('wheel', handleScroll, { passive: true });
  
  if (DEBUG) console.log('✅ Scroll listeners attached');
}

/**
 * Set up mutation observer to detect when new content is added to the page
 * Instagram loads content dynamically, so we need to watch for DOM changes
 * @returns {void}
 */
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    // Check if any new posts were added
    const hasNewContent = mutations.some(mutation => {
      if (mutation.addedNodes.length > 0) {
        return Array.from(mutation.addedNodes).some(node => {
          return node.nodeType === 1 && // Element node
                 (node.tagName === 'ARTICLE' || 
                  (node.querySelector && node.querySelector('article')));
        });
      }
      return false;
    });
    
    if (hasNewContent) {
      // Wait a bit for content to fully load, then scan
      setTimeout(scanVisibleContent, 500);
    }
  });
  
  // Watch the main content area (or body as fallback)
  const targetNode = document.querySelector('main') || 
                    document.querySelector('[role="main"]') || 
                    document.body;
  
  observer.observe(targetNode, {
    childList: true,  // Watch for added/removed children
    subtree: true     // Watch all descendants
  });
  
  if (DEBUG) console.log('✅ Mutation observer attached');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the content tracker
 * Sets up all necessary components and starts monitoring
 * @returns {Promise<void>}
 */
async function initialize() {
  console.log('🚀 Initializing Instagram Content Tracker...');
  
  try {
    // Load API token from storage
    await loadApiToken();
    
    // Create the UI immediately
    createFloatingDisplay();
    
    // Set up event listeners
    setupScrollListener();
    setupMutationObserver();
    
    // Do initial scan after a short delay
    setTimeout(() => {
      scanVisibleContent();
    }, 1000);
    
    // Periodic backup scan (in case events are missed)
    setInterval(() => {
      scanVisibleContent();
    }, SCAN_INTERVAL);
    
    console.log('✅ Instagram Content Tracker initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize tracker:', error);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOM already loaded, initialize immediately
  initialize();
}
