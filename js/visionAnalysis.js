// js/visionAnalysis.js - TensorFlow.js Computer Vision module for content recognition

class ContentVisionAnalyzer {
    constructor() {
        this.models = {
            mobilenet: null,
            cocoSsd: null,
            blazeface: null
        };
        this.modelsReady = false;
        this.modelLoadingPromise = null;
        this.analysisQueue = [];
        this.isProcessing = false;
        this.analysisCache = new Map(); // Cache results
        
        // Performance settings
        this.settings = {
            maxConcurrentAnalysis: 1, // Process one image at a time
            analysisDelay: 1000, // Wait 1 second between analyses
            cacheSize: 50, // Cache last 50 results
            enableLazyLoading: true, // Load models only when needed
            modelsToLoad: ['mobilenet', 'cocoSsd'] // Skip blazeface initially for faster load
        };
        
        // Content categories with advanced detection rules
        this.contentCategories = {
            'beauty': { 
                count: 0, 
                objects: ['lipstick', 'cosmetics', 'mirror'],
                keywords: ['makeup', 'cosmetic', 'beauty', 'hair', 'salon', 'skincare', 'face', 'lipstick'],
                faceThreshold: 0.7 // High face prominence suggests beauty content
            },
            'fashion': { 
                count: 0,
                objects: ['dress', 'shirt', 'shoe', 'handbag', 'tie'],
                keywords: ['clothing', 'dress', 'outfit', 'fashion', 'style', 'wear', 'shoe', 'accessory']
            },
            'food': { 
                count: 0,
                objects: ['food', 'pizza', 'cake', 'sandwich', 'dining table', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl'],
                keywords: ['food', 'pizza', 'restaurant', 'meal', 'dish', 'cuisine', 'breakfast', 'lunch', 'dinner']
            },
            'fitness': { 
                count: 0,
                objects: ['sports ball', 'tennis racket', 'skateboard', 'surfboard', 'skis'],
                keywords: ['gym', 'exercise', 'workout', 'fitness', 'sport', 'athletic', 'muscle', 'training']
            },
            'consumerism': { 
                count: 0,
                objects: ['shopping bag', 'credit card', 'price tag'],
                keywords: ['buy', 'sale', 'discount', 'shop', 'price', 'deal', 'offer', 'purchase'],
                textPatterns: ['$', '€', '£', '%', 'off', 'sale', 'buy now', 'limited offer']
            },
            'travel': { 
                count: 0,
                objects: ['airplane', 'boat', 'car', 'train', 'suitcase', 'backpack'],
                keywords: ['beach', 'mountain', 'city', 'landscape', 'vacation', 'hotel', 'airport', 'tourist']
            },
            'technology': { 
                count: 0,
                objects: ['laptop', 'cell phone', 'tv', 'keyboard', 'mouse', 'monitor'],
                keywords: ['computer', 'phone', 'laptop', 'tech', 'gadget', 'device', 'screen', 'electronic']
            },
            'pets': { 
                count: 0,
                objects: ['dog', 'cat', 'bird', 'horse', 'sheep', 'cow'],
                keywords: ['dog', 'cat', 'pet', 'animal', 'puppy', 'kitten', 'bird', 'fish']
            },
            'lifestyle': {
                count: 0,
                objects: ['couch', 'bed', 'chair', 'potted plant', 'vase'],
                keywords: ['home', 'decor', 'interior', 'design', 'lifestyle', 'living']
            },
            'other': { count: 0, objects: [], keywords: [] }
        };
        
        // Track detailed analytics
        this.analytics = {
            totalFacesDetected: 0,
            totalObjectsDetected: 0,
            totalTextDetected: 0,
            averageConfidence: 0,
            detectionHistory: []
        };
        
        this.initializeModels();
    }
    
    async initializeModels() {
        // Prevent multiple initialization attempts
        if (this.modelLoadingPromise) {
            return this.modelLoadingPromise;
        }
        
        this.modelLoadingPromise = this._loadModels();
        return this.modelLoadingPromise;
    }
    
    async _loadModels() {
        try {
            // Show loading indicator
            console.log('🤖 AI models loading... This may take a moment on first use.');
            
            // Check if TensorFlow.js is already loaded
            if (typeof tf === 'undefined') {
                await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js');
            }
            
            // Configure TensorFlow.js for better performance
            if (typeof tf !== 'undefined') {
                await tf.ready();
                // Use WebGL backend for better performance
                await tf.setBackend('webgl');
                
                // Set flags for performance
                tf.env().set('WEBGL_PACK', true);
                tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
            }
            
            // Load only essential models initially
            const loadPromises = [];
            
            if (this.settings.modelsToLoad.includes('mobilenet') && typeof mobilenet === 'undefined') {
                loadPromises.push(this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@latest/dist/mobilenet.min.js'));
            }
            if (this.settings.modelsToLoad.includes('cocoSsd') && typeof cocoSsd === 'undefined') {
                loadPromises.push(this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@latest/dist/coco-ssd.min.js'));
            }
            
            await Promise.all(loadPromises);
            
            // Initialize only essential models
            console.log('Loading computer vision models...');
            
            if (this.settings.modelsToLoad.includes('mobilenet') && typeof mobilenet !== 'undefined') {
                this.models.mobilenet = await mobilenet.load({
                    version: 2,
                    alpha: 0.5 // Use smaller, faster model
                });
                console.log('✓ MobileNet loaded');
            }
            
            if (this.settings.modelsToLoad.includes('cocoSsd') && typeof cocoSsd !== 'undefined') {
                this.models.cocoSsd = await cocoSsd.load({
                    base: 'lite_mobilenet_v2' // Use lighter model
                });
                console.log('✓ COCO-SSD loaded');
            }
            
            this.modelsReady = true;
            console.log('✅ AI models ready for content analysis');
            
            // Load face detection lazily when needed
            this.loadFaceDetectionLater();
            
        } catch (error) {
            console.error('Error loading AI models:', error);
            console.log('📌 Continuing without computer vision features');
            // Don't throw - let the extension work without vision
        }
    }
    
    async loadFaceDetectionLater() {
        // Load blazeface in background after 10 seconds
        setTimeout(async () => {
            try {
                if (typeof blazeface === 'undefined') {
                    await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@latest/dist/blazeface.min.js');
                }
                if (typeof blazeface !== 'undefined' && !this.models.blazeface) {
                    this.models.blazeface = await blazeface.load();
                    console.log('✓ BlazeFace loaded (background)');
                }
            } catch (error) {
                console.log('Face detection not available');
            }
        }, 10000);
    }
    
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    // Extract images from Instagram post
    extractImages(element) {
        const images = [];
        
        // Find main post images
        const postImages = element.querySelectorAll('img[srcset], img[src]');
        postImages.forEach(img => {
            // Filter out profile pictures and small icons
            if (img.width > 150 && img.height > 150 && !img.src.includes('profile')) {
                images.push(img);
            }
        });
        
        // Find video thumbnails
        const videos = element.querySelectorAll('video');
        videos.forEach(video => {
            if (video.poster) {
                const img = new Image();
                img.src = video.poster;
                images.push(img);
            }
        });
        
        return images;
    }
    
    // Extract text content from post
    extractText(element) {
        const textContent = [];
        
        // Caption text
        const captions = element.querySelectorAll('[data-testid="post-caption"], span[dir="auto"]');
        captions.forEach(caption => {
            textContent.push(caption.textContent);
        });
        
        // Look for price patterns and commercial text
        const allText = element.textContent.toLowerCase();
        return allText;
    }
    
    // Detect faces in image
    async detectFaces(img) {
        try {
            const predictions = await this.models.blazeface.estimateFaces(img, false);
            this.analytics.totalFacesDetected += predictions.length;
            
            // Calculate face prominence (face area / image area)
            let maxFaceProminence = 0;
            if (predictions.length > 0) {
                const imgArea = img.width * img.height;
                predictions.forEach(face => {
                    const faceWidth = face.bottomRight[0] - face.topLeft[0];
                    const faceHeight = face.bottomRight[1] - face.topLeft[1];
                    const faceArea = faceWidth * faceHeight;
                    const prominence = faceArea / imgArea;
                    maxFaceProminence = Math.max(maxFaceProminence, prominence);
                });
            }
            
            return {
                count: predictions.length,
                prominence: maxFaceProminence,
                predictions: predictions
            };
        } catch (error) {
            console.error('Face detection error:', error);
            return { count: 0, prominence: 0, predictions: [] };
        }
    }
    
    // Detect objects in image
    async detectObjects(img) {
        try {
            const predictions = await this.models.cocoSsd.detect(img);
            this.analytics.totalObjectsDetected += predictions.length;
            
            // Group objects by class
            const objectGroups = {};
            predictions.forEach(pred => {
                if (!objectGroups[pred.class]) {
                    objectGroups[pred.class] = [];
                }
                objectGroups[pred.class].push(pred);
            });
            
            return {
                objects: objectGroups,
                predictions: predictions,
                count: predictions.length
            };
        } catch (error) {
            console.error('Object detection error:', error);
            return { objects: {}, predictions: [], count: 0 };
        }
    }
    
    // Classify image content
    async classifyImage(img) {
        try {
            const predictions = await this.models.mobilenet.classify(img);
            return predictions;
        } catch (error) {
            console.error('Image classification error:', error);
            return [];
        }
    }
    
    // Detect commercial/consumerism content
    detectCommercialContent(text, objects) {
        const commercialIndicators = [
            /\$\d+/g,              // Price patterns
            /€\d+/g,
            /£\d+/g,
            /\d+%\s*off/gi,        // Discount patterns
            /sale/gi,
            /buy\s*now/gi,
            /limited\s*offer/gi,
            /promo/gi,
            /discount/gi,
            /shop\s*now/gi,
            /link\s*in\s*bio/gi
        ];
        
        let commercialScore = 0;
        commercialIndicators.forEach(pattern => {
            if (pattern.test(text)) {
                commercialScore += 1;
            }
        });
        
        // Check for shopping-related objects
        const shoppingObjects = ['handbag', 'tie', 'backpack', 'suitcase'];
        Object.keys(objects).forEach(objClass => {
            if (shoppingObjects.includes(objClass)) {
                commercialScore += 0.5;
            }
        });
        
        return commercialScore > 0;
    }
    
    // Categorize content based on all analyses
    async categorizeContent(faces, objects, classifications, text) {
        const scores = {};
        
        // Initialize scores
        Object.keys(this.contentCategories).forEach(category => {
            scores[category] = 0;
        });
        
        // 1. Object-based categorization
        Object.keys(objects.objects).forEach(objClass => {
            Object.entries(this.contentCategories).forEach(([category, data]) => {
                if (data.objects && data.objects.includes(objClass)) {
                    scores[category] += 2; // High weight for direct object match
                }
            });
        });
        
        // 2. Classification-based categorization
        classifications.forEach(prediction => {
            const className = prediction.className.toLowerCase();
            Object.entries(this.contentCategories).forEach(([category, data]) => {
                if (data.keywords) {
                    data.keywords.forEach(keyword => {
                        if (className.includes(keyword)) {
                            scores[category] += prediction.probability;
                        }
                    });
                }
            });
        });
        
        // 3. Face-based categorization
        if (faces.count > 0) {
            // High face prominence might indicate beauty/portrait content
            if (faces.prominence > 0.3) {
                scores['beauty'] += faces.prominence * 2;
            }
            // Multiple faces might indicate social/lifestyle content
            if (faces.count > 2) {
                scores['lifestyle'] += 1;
            }
        }
        
        // 4. Text-based categorization
        const lowerText = text.toLowerCase();
        Object.entries(this.contentCategories).forEach(([category, data]) => {
            if (data.keywords) {
                data.keywords.forEach(keyword => {
                    if (lowerText.includes(keyword)) {
                        scores[category] += 0.5;
                    }
                });
            }
        });
        
        // 5. Special detection for consumerism
        if (this.detectCommercialContent(text, objects.objects)) {
            scores['consumerism'] += 3;
        }
        
        // Find category with highest score
        let primaryCategory = 'other';
        let highestScore = 0;
        
        Object.entries(scores).forEach(([category, score]) => {
            if (score > highestScore && category !== 'other') {
                highestScore = score;
                primaryCategory = category;
            }
        });
        
        // If no strong category match, default to 'other'
        if (highestScore < 0.5) {
            primaryCategory = 'other';
        }
        
        return {
            category: primaryCategory,
            confidence: highestScore,
            scores: scores,
            details: {
                faces: faces.count,
                objects: objects.count,
                hasCommercialContent: scores['consumerism'] > 0
            }
        };
    }
    
    // Main analysis function with performance optimizations
    async analyzeVisualContent(element, contentId) {
        // Check cache first
        if (this.analysisCache.has(contentId)) {
            const cached = this.analysisCache.get(contentId);
            this.contentCategories[cached.category].count++;
            return cached;
        }
        
        // Initialize models if needed (lazy loading)
        if (!this.modelsReady && this.settings.enableLazyLoading) {
            this.initializeModels(); // Don't await - let it load in background
            return null;
        }
        
        if (!this.modelsReady) {
            return null;
        }
        
        // Add to queue instead of processing immediately
        return new Promise((resolve) => {
            this.analysisQueue.push({ element, contentId, resolve });
            this.processQueue();
        });
    }
    
    async processQueue() {
        if (this.isProcessing || this.analysisQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.analysisQueue.length > 0) {
            const { element, contentId, resolve } = this.analysisQueue.shift();
            
            try {
                const result = await this.performAnalysis(element, contentId);
                resolve(result);
                
                // Add to cache
                if (result && this.analysisCache.size >= this.settings.cacheSize) {
                    // Remove oldest entry
                    const firstKey = this.analysisCache.keys().next().value;
                    this.analysisCache.delete(firstKey);
                }
                if (result) {
                    this.analysisCache.set(contentId, result);
                }
                
                // Delay between analyses to prevent performance issues
                await new Promise(resolve => setTimeout(resolve, this.settings.analysisDelay));
            } catch (error) {
                console.error('Error in vision analysis:', error);
                resolve(null);
            }
        }
        
        this.isProcessing = false;
    }
    
    async performAnalysis(element, contentId) {
        const images = this.extractImages(element);
        if (images.length === 0) {
            return null;
        }
        
        try {
            const img = images[0];
            
            // Resize image for faster processing
            const resizedImg = await this.resizeImage(img, 224, 224);
            const text = this.extractText(element);
            
            // Run only available analyses
            const analyses = await Promise.all([
                this.models.blazeface ? this.detectFaces(resizedImg) : Promise.resolve({ count: 0, prominence: 0, predictions: [] }),
                this.models.cocoSsd ? this.detectObjects(resizedImg) : Promise.resolve({ objects: {}, predictions: [], count: 0 }),
                this.models.mobilenet ? this.classifyImage(resizedImg) : Promise.resolve([])
            ]);
            
            const [faces, objects, classifications] = analyses;
            
            // Categorize based on available analyses
            const categorization = await this.categorizeContent(faces, objects, classifications, text);
            
            // Update category counter
            this.contentCategories[categorization.category].count++;
            
            // Store detailed analytics
            this.analytics.detectionHistory.push({
                contentId: contentId,
                timestamp: Date.now(),
                category: categorization.category,
                confidence: categorization.confidence,
                details: categorization.details
            });
            
            // Update average confidence
            const totalDetections = this.analytics.detectionHistory.length;
            this.analytics.averageConfidence = 
                (this.analytics.averageConfidence * (totalDetections - 1) + categorization.confidence) / totalDetections;
            
            return categorization;
        } catch (error) {
            console.error('Error analyzing visual content:', error);
            return null;
        }
    }
    
    // Resize image for faster processing
    async resizeImage(img, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        return canvas;
    }
    
    // Get content breakdown for display
    getContentBreakdown() {
        const breakdown = [];
        let totalAnalyzed = 0;
        
        for (const [category, data] of Object.entries(this.contentCategories)) {
            if (data.count > 0) {
                breakdown.push({
                    category: category,
                    count: data.count,
                    emoji: this.getCategoryEmoji(category),
                    percentage: 0 // Will be calculated below
                });
                totalAnalyzed += data.count;
            }
        }
        
        // Calculate percentages
        breakdown.forEach(item => {
            item.percentage = Math.round((item.count / totalAnalyzed) * 100);
        });
        
        // Sort by count descending
        breakdown.sort((a, b) => b.count - a.count);
        
        // Get insights
        const insights = this.generateInsights(breakdown);
        
        return {
            breakdown: breakdown,
            total: totalAnalyzed,
            insights: insights,
            analytics: {
                facesDetected: this.analytics.totalFacesDetected,
                objectsDetected: this.analytics.totalObjectsDetected,
                averageConfidence: this.analytics.averageConfidence.toFixed(2)
            }
        };
    }
    
    // Generate insights based on content consumption
    generateInsights(breakdown) {
        const insights = [];
        
        // Check for high commercial content
        const commercial = breakdown.find(item => item.category === 'consumerism');
        if (commercial && commercial.percentage > 30) {
            insights.push('High exposure to commercial content');
        }
        
        // Check for beauty/comparison content
        const beauty = breakdown.find(item => item.category === 'beauty');
        if (beauty && beauty.percentage > 25) {
            insights.push('Significant beauty/appearance-focused content');
        }
        
        // Check content diversity
        if (breakdown.length === 1) {
            insights.push(`Your feed is dominated by ${breakdown[0].category} content`);
        } else if (breakdown.length > 5) {
            insights.push('Diverse content consumption');
        }
        
        return insights;
    }
    
    // Get emoji for category
    getCategoryEmoji(category) {
        const emojis = {
            'beauty': '💄',
            'fashion': '👗',
            'food': '🍔',
            'fitness': '💪',
            'consumerism': '🛍️',
            'travel': '✈️',
            'technology': '💻',
            'pets': '🐾',
            'lifestyle': '🏠',
            'other': '📷'
        };
        return emojis[category] || '📷';
    }
    
    // Reset counters
    reset() {
        for (const category in this.contentCategories) {
            this.contentCategories[category].count = 0;
        }
        this.analytics = {
            totalFacesDetected: 0,
            totalObjectsDetected: 0,
            totalTextDetected: 0,
            averageConfidence: 0,
            detectionHistory: []
        };
        this.analysisCache.clear();
        this.analysisQueue = [];
    }
}

// Export for use in content.js
window.ContentVisionAnalyzer = ContentVisionAnalyzer;