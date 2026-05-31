// Content Script — runs on grok.com
// This script enables the side panel to communicate with the Grok tab

(function () {
  'use strict';

  // Notify that content script is active
  console.log('[Grok Automation] Content script active on', window.location.href);

  // Listen for messages from the side panel / background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ alive: true, url: window.location.href });
      return true;
    }
  });
})();
