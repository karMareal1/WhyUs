// WhyUs Extension - Background Service Worker
// Handles background tasks and extension lifecycle

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('WhyUs extension installed');
    
    // Set default settings
    chrome.storage.local.set({
      backendUrl: 'http://localhost:3000',
      savedResumes: []
    });
  } else if (details.reason === 'update') {
    console.log('WhyUs extension updated');
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Future: Add background processing if needed
  return true;
});
