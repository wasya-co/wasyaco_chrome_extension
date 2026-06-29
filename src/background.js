var CHAT_WS_URL = "ws://127.0.0.1:3001";

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (!request || request.type !== "CHAT_SEND" || typeof request.text !== "string") {
		return;
	}
	var text = request.text;
	var ws = new WebSocket(CHAT_WS_URL);
	var finished = false;
	function done(payload) {
		if (finished) return;
		finished = true;
		sendResponse(payload);
		try {
			ws.close();
		} catch (e) {}
	}
	ws.onopen = function () {
		try {
			ws.send(text);
			done({ ok: true });
		} catch (e) {
			done({ ok: false, error: String(e && e.message ? e.message : e) });
		}
	};
	ws.onerror = function () {
		done({ ok: false, error: "WebSocket connection failed" });
	};
	return true;
});

function sendToggleToTab(tab) {
	if (!tab || !tab.id) return;
	chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" }, function () {
		if (chrome.runtime.lastError) {
			/* Page may have no content script yet (or is disallowed like chrome://). */
			injectScriptsAndRetry(tab.id);
		}
	});
}

function injectScriptsAndRetry(tabId) {
	chrome.tabs.executeScript(tabId, { file: "libs/jquery.js" }, function () {
		if (chrome.runtime.lastError) return;
		chrome.tabs.executeScript(tabId, { file: "src/sidebar.js" }, function () {
			if (chrome.runtime.lastError) return;
			chrome.tabs.insertCSS(tabId, { file: "src/grid.css" }, function () {
				if (chrome.runtime.lastError) return;
				chrome.tabs.sendMessage(tabId, { action: "toggleSidebar" }, function () {
					/* Ignore lastError; tab may still be restricted. */
				});
			});
		});
	});
}

function toggleSidebarOnActiveTab(fallbackTab) {
	if (fallbackTab && fallbackTab.id) {
		sendToggleToTab(fallbackTab);
		return;
	}
	chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
		if (chrome.runtime.lastError || !tabs || !tabs.length) return;
		sendToggleToTab(tabs[0]);
	});
}

var actionApi = chrome.action || chrome.browserAction;
if (actionApi && actionApi.onClicked && actionApi.onClicked.addListener) {
	actionApi.onClicked.addListener(function (tab) {
		toggleSidebarOnActiveTab(tab);
	});
}
