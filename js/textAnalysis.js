// js/textAnalysis.js - Text analysis module for content classification

class ContentAnalyzer {
    constructor() {
        // Keywords for different content categories
        this.categories = {
            comparison: {
                keywords: ['better', 'worse', 'perfect', 'flawless', 'goals', 'wish', 'jealous', 'amazing life'],
                weight: 2.0 // Higher weight for potentially harmful content
            },
            commercial: {
                keywords: ['buy', 'sale', 'discount', 'shop', 'link in bio', 'promo', 'sponsored', 'ad'],
                weight: 1.5
            },
            engagement: {
                keywords: ['like', 'follow', 'share', 'comment', 'tag', 'dm', 'giveaway'],
                weight: 1.2
            },
            lifestyle: {
                keywords: ['travel', 'food', 'fashion', 'beauty', 'fitness', 'luxury', 'vacation'],
                weight: 1.3
            },
            negative: {
                keywords: ['hate', 'ugly', 'stupid', 'fail', 'worst', 'terrible', 'disgusting'],
                weight: 2.5 // Highest weight for negative content
            }
        };
        
        // Sentiment indicators
        this.sentimentIndicators = {
            positive: ['love', 'happy', 'excited', 'grateful', 'blessed', 'amazing', 'wonderful'],
            negative: ['sad', 'angry', 'disappointed', 'frustrated', 'hate', 'terrible', 'awful'],
            neutral: ['okay', 'fine', 'normal', 'regular', 'typical', 'standard']
        };
    }
    
    // Extract text from Instagram post
    extractPostText(element) {
        const textContent = [];
        
        // Caption text
        const caption = element.querySelector('[data-testid="post-caption"], span[dir="auto"]');
        if (caption) {
            textContent.push(caption.textContent);
        }
        
        // Comments (first few visible)
        const comments = element.querySelectorAll('[role="button"] span[dir="auto"]');
        comments.forEach((comment, index) => {
            if (index < 3) { // Limit to first 3 comments
                textContent.push(comment.textContent);
            }
        });
        
        // Hashtags
        const hashtags = element.querySelectorAll('a[href*="/explore/tags/"]');
        hashtags.forEach(tag => {
            textContent.push(tag.textContent);
        });
        
        return textContent.join(' ').toLowerCase();
    }
    
    // Analyze text content and return a score
    analyzeContent(text) {
        if (!text || text.length < 10) {
            return { score: 1, categories: [], sentiment: 'neutral' };
        }
        
        let totalScore = 1;
        const detectedCategories = [];
        
        // Check each category
        for (const [category, data] of Object.entries(this.categories)) {
            let categoryScore = 0;
            
            for (const keyword of data.keywords) {
                if (text.includes(keyword)) {
                    categoryScore += data.weight;
                    detectedCategories.push(category);
                }
            }
            
            totalScore += categoryScore;
        }
        
        // Analyze sentiment
        const sentiment = this.analyzeSentiment(text);
        
        // Adjust score based on sentiment
        if (sentiment === 'negative') {
            totalScore *= 1.5;
        } else if (sentiment === 'positive' && detectedCategories.includes('comparison')) {
            totalScore *= 1.3; // Positive comparison posts can be harmful too
        }
        
        return {
            score: Math.min(totalScore, 5), // Cap at 5
            categories: [...new Set(detectedCategories)],
            sentiment: sentiment
        };
    }
    
    // Simple sentiment analysis
    analyzeSentiment(text) {
        let positiveCount = 0;
        let negativeCount = 0;
        
        this.sentimentIndicators.positive.forEach(word => {
            if (text.includes(word)) positiveCount++;
        });
        
        this.sentimentIndicators.negative.forEach(word => {
            if (text.includes(word)) negativeCount++;
        });
        
        if (negativeCount > positiveCount) return 'negative';
        if (positiveCount > negativeCount) return 'positive';
        return 'neutral';
    }
    
    // Calculate weighted consumption score
    calculateWeightedScore(contentMetrics, textAnalysisResults) {
        let weightedScore = 0;
        
        // Base scores for different content types
        const baseScores = {
            post: 1,
            story: 0.8,
            reel: 1.2 // Reels are typically more engaging/addictive
        };
        
        // Calculate weighted score based on content analysis
        contentMetrics.postsViewed.forEach(postId => {
            const analysis = textAnalysisResults.get(postId);
            if (analysis) {
                weightedScore += baseScores.post * analysis.score;
            } else {
                weightedScore += baseScores.post;
            }
        });
        
        // Add story and reel scores
        weightedScore += contentMetrics.storiesViewed.size * baseScores.story;
        weightedScore += contentMetrics.reelsViewed.size * baseScores.reel;
        
        return weightedScore;
    }
}

// Enhanced content metrics with text analysis
class EnhancedContentTracker {
    constructor() {
        this.analyzer = new ContentAnalyzer();
        this.textAnalysisResults = new Map();
        this.weightedThreshold = 25; // Adjusted threshold based on content quality
    }
    
    // Analyze and track content with text analysis
    analyzeAndTrackContent(element, contentId, contentType) {
        if (contentType === 'post') {
            const text = this.analyzer.extractPostText(element);
            const analysis = this.analyzer.analyzeContent(text);
            this.textAnalysisResults.set(contentId, analysis);
            
            // Log analysis for debugging
            console.log(`Content analysis for ${contentId}:`, {
                text: text.substring(0, 100) + '...',
                score: analysis.score,
                categories: analysis.categories,
                sentiment: analysis.sentiment
            });
        }
    }
    
    // Check if weighted threshold is reached
    hasReachedWeightedThreshold(contentMetrics) {
        const weightedScore = this.analyzer.calculateWeightedScore(
            contentMetrics,
            this.textAnalysisResults
        );
        
        console.log(`Weighted consumption score: ${weightedScore}/${this.weightedThreshold}`);
        
        return weightedScore >= this.weightedThreshold;
    }
    
    // Get consumption summary for the reminder
    getConsumptionSummary(contentMetrics) {
        const categoryCount = {};
        let negativeContentCount = 0;
        
        this.textAnalysisResults.forEach(analysis => {
            analysis.categories.forEach(cat => {
                categoryCount[cat] = (categoryCount[cat] || 0) + 1;
            });
            
            if (analysis.sentiment === 'negative') {
                negativeContentCount++;
            }
        });
        
        const dominantCategory = Object.entries(categoryCount)
            .sort((a, b) => b[1] - a[1])[0];
        
        return {
            postsViewed: contentMetrics.postsViewed.size,
            dominantContent: dominantCategory ? dominantCategory[0] : 'general',
            negativeContent: negativeContentCount,
            timeSpent: Math.floor((Date.now() - contentMetrics.sessionStart) / 60000)
        };
    }
}

// Export for use in content.js
window.EnhancedContentTracker = EnhancedContentTracker;