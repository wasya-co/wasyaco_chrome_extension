/**
 * Runs as a declared content script (manifest) so chrome.runtime is always available.
 * Injected sidebar code (executeScript) dispatches DOM events; we forward to the background.
 */
document.addEventListener(
	"forh-bs-send-chat",
	function (ev) {
		var text = ev.detail && ev.detail.text;
		if (typeof text !== "string" || !text) return;

		chrome.runtime.sendMessage({ type: "CHAT_SEND", text: text }, function (response) {
			var err = chrome.runtime.lastError;
			document.dispatchEvent(
				new CustomEvent("forh-bs-chat-result", {
					detail: {
						response: response,
						lastError: err ? err.message : null,
					},
				})
			);
		});
	},
	true
);
