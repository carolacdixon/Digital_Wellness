/**
 * Background Service Worker
 * Handles extension installation and basic message routing
 */

console.log('Background service worker loaded');

/**
 * Handle extension installation/update events
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension event:', details.reason);
  
  // Open settings page on first install so user can add API token
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});