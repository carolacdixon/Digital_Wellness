// js/background.js - Enhanced message passing
console.log('Background script loaded');

// Keep track of active tabs
const activeTabs = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    // Forward category updates to content script
    if (message.action === 'updateCounts' && sender.tab) {
        // Store the latest counts
        activeTabs.set(sender.tab.id, message.categories);
        
        // Forward to the tab's content script
        chrome.tabs.sendMessage(sender.tab.id, message).catch(err => {
            console.log('Could not send message to tab:', err);
        });
    }
    
    // Handle requests for current counts
    if (message.action === 'getCounts' && sender.tab) {
        const counts = activeTabs.get(sender.tab.id) || {};
        sendResponse(counts);
    }
    
    return true; // Keep message channel open for async response
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    activeTabs.delete(tabId);
});

// Log when extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed/updated:', details.reason);
    
    // Open options page on first install
    if (details.reason === 'install') {
        chrome.runtime.openOptionsPage();
    }
});