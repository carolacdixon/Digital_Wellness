// js/background.js - Simple message passing

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Forward category updates to content script
    if (message.action === 'updateCounts' && sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, message);
    }
});