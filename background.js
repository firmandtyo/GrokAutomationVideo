// Background Service Worker — Grok Automation

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// Keep side panel available for all grok.com tabs
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'complete' && tab.url?.includes('grok.com')) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'side-panel.html',
      enabled: true,
    });
  }
});

// Allow side panel on all tabs (so you can open it from any tab)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
