// js/visionAnalysis.js - Simplified category-only vision analyzer
console.log('🔄 visionAnalysis.js loading...');

class ContentVisionAnalyzer {
    constructor() {
        console.log('📊 ContentVisionAnalyzer constructor called');
        this.processedContent = new Set();
        this.apiToken = null;
        this.cache = new Map();
        
        // Simple content categories
        this.contentCategories = {
            'beauty': { count: 0, emoji: '💄' },
            'fashion': { count: 0, emoji: '👗' },
            'food': { count: 0, emoji: '🍔' },
            'fitness': { count: 0, emoji: '💪' },
            'travel': { count: 0, emoji: '✈️' },
            'pets': { count: 0, emoji: '🐾' },
            'lifestyle': { count: 0, emoji: '🏠' },
            'other': { count: 0, emoji: '📷' }
        };
        
        console.log('📊 Content Analyzer initialized');
        this.checkApiToken();
    }
    
    async checkApiToken() {
        const settings = await chrome.storage.sync.get(['huggingFaceToken']);
        if (settings.huggingFaceToken) {
            this.apiToken = settings.huggingFaceToken;
            console.log('✅ API token found - Image analysis enabled');
            console.log('Token starts with:', this.apiToken.substring(0, 7) + '...');
        } else {
            console.log('⚠️ No API token. Add token in extension settings.');
        }
    }
    
    // Main analysis function
    async analyzeContent(element, contentId) {
        if (!this.apiToken || this.processedContent.has(contentId)) {
            return null;
        }
        
        // Check cache
        if (this.cache.has(contentId)) {
            const cached = this.cache.get(contentId);
            this.contentCategories[cached.category].count++;
            this.updateDisplay();
            return cached;
        }
        
        try {
            // Extract image and caption
            const postData = await this.extractPostData(element);
            if (!postData.image) return null;
            
            // Send to Hugging Face for categorization
            const category = await this.categorizeWithAPI(postData);
            
            // Update counts
            this.contentCategories[category].count++;
            this.processedContent.add(contentId);
            this.cache.set(contentId, { category });
            
            // Update display
            this.updateDisplay();
            
            console.log(`Post ${contentId}: ${category}`);
            
            return { category };
            
        } catch (error) {
            console.error('Analysis error:', error);
            return null;
        }
    }
    
    // Extract image and caption from post
    async extractPostData(element) {
        const data = {
            image: null,
            caption: ''
        };
        
        // Get image
        const img = element.querySelector('img[srcset], img[src]');
        if (img && img.width > 150) {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 224;
                canvas.height = 224;
                ctx.drawImage(img, 0, 0, 224, 224);
                data.image = canvas.toDataURL('image/jpeg', 0.8);
            } catch (error) {
                console.log('Image extraction failed');
            }
        }
        
        // Get caption
        const captionEl = element.querySelector('[data-testid="post-caption"], span[dir="auto"]');
        if (captionEl) {
            data.caption = captionEl.textContent || '';
        }
        
        return data;
    }
    
    // Send to Hugging Face API for categorization
    async categorizeWithAPI(postData) {
        try {
            // Convert image to blob
            const response = await fetch(postData.image);
            const blob = await response.blob();
            
            // Call image captioning API
            const apiResponse = await fetch(
                'https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning',
                {
                    method: 'POST',
                    body: blob,
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'image/jpeg'
                    }
                }
            );
            
            if (!apiResponse.ok) {
                console.log('API error:', apiResponse.status);
                return 'other';
            }
            
            const result = await apiResponse.json();
            const generatedText = result[0]?.generated_text || '';
            
            // Combine generated caption with post caption
            const fullText = `${generatedText} ${postData.caption}`.toLowerCase();
            
            // Simple keyword-based categorization
            if (fullText.includes('makeup') || fullText.includes('beauty') || fullText.includes('skincare')) {
                return 'beauty';
            } else if (fullText.includes('outfit') || fullText.includes('dress') || fullText.includes('fashion')) {
                return 'fashion';
            } else if (fullText.includes('food') || fullText.includes('eating') || fullText.includes('meal')) {
                return 'food';
            } else if (fullText.includes('workout') || fullText.includes('gym') || fullText.includes('fitness')) {
                return 'fitness';
            } else if (fullText.includes('travel') || fullText.includes('beach') || fullText.includes('vacation')) {
                return 'travel';
            } else if (fullText.includes('dog') || fullText.includes('cat') || fullText.includes('pet')) {
                return 'pets';
            } else if (fullText.includes('home') || fullText.includes('room') || fullText.includes('decor')) {
                return 'lifestyle';
            }
            
            return 'other';
            
        } catch (error) {
            console.error('API call failed:', error);
            return 'other';
        }
    }
    
    // Update the floating display
    updateDisplay() {
        // Send message to update the floating counter
        chrome.runtime.sendMessage({
            action: 'updateCounts',
            categories: this.getCategories()
        });
    }
    
    // Get category counts
    getCategories() {
        const result = {};
        for (const [category, data] of Object.entries(this.contentCategories)) {
            result[category] = {
                count: data.count,
                emoji: data.emoji
            };
        }
        return result;
    }
    
    // Reset counts
    reset() {
        for (const category in this.contentCategories) {
            this.contentCategories[category].count = 0;
        }
        this.processedContent.clear();
        this.cache.clear();
        this.updateDisplay();
    }
}

// Export for use
window.ContentVisionAnalyzer = ContentVisionAnalyzer;