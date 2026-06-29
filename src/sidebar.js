var STORAGE_KEY = "forh_bs_sidebar_open";

function persistSidebarOpen(open) {
	try {
		chrome.storage.local.set({ [STORAGE_KEY]: !!open });
	} catch (e) {}
}

function ensurePageWrapper() {
	if (document.getElementById("my-extension-wrapper")) return;
	var wrapper = document.createElement("div");
	wrapper.id = "my-extension-wrapper";
	while (document.body.firstChild) {
		wrapper.appendChild(document.body.firstChild);
	}
	document.body.appendChild(wrapper);
}

function removePageWrapper() {
	var wrapper = document.getElementById("my-extension-wrapper");
	if (!wrapper) return;
	while (wrapper.firstChild) {
		document.body.insertBefore(wrapper.firstChild, wrapper);
	}
	wrapper.remove();
}

function showSidebar() {
	if (document.getElementById("forh-bs-sidebar")) return;
	ensurePageWrapper();
	$("body").append(`
		<div id="forh-bs-sidebar" aria-label="Annesque Browser Extension">
			<div class="forh-bs-sidebar-top">
				<div class="forh-bs-sidebar-header">
					<span class="forh-bs-sidebar-title">Bootstrap Grid v7</span>
					<button type="button" class="forh-bs-sidebar-close" title="Close">&times;</button>
				</div>
				<p class="forh-bs-sidebar-hint">Click the extension icon or close to hide.</p>
			</div>
			<div class="forh-bs-chat-panel" aria-label="Chat">
				<div class="forh-bs-chat-history" id="forh-bs-chat-history" role="log" aria-live="polite"></div>
				<div class="forh-bs-chat-compose">
					<input type="text" class="forh-bs-chat-input" id="forh-bs-chat-input" placeholder="Message…" autocomplete="off" />
					<button type="button" class="forh-bs-chat-send" id="forh-bs-chat-send">Send</button>
				</div>
			</div>
		</div>
	`);
	var $root = $("#forh-bs-sidebar");

	function scrollHistoryToBottom() {
		var el = $root.find("#forh-bs-chat-history")[0];
		if (el) el.scrollTop = el.scrollHeight;
	}

	function sendMessage() {
		var $input = $root.find("#forh-bs-chat-input");
		var text = ($input.val() || "").trim();
		if (!text) return;
		$root.find("#forh-bs-chat-history").append(
			$('<div class="forh-bs-chat-msg" />').text(text)
		);
		$input.val("");
		scrollHistoryToBottom();

		function onResult(ev) {
			document.removeEventListener("forh-bs-chat-result", onResult);
			var detail = ev.detail || {};
			if (detail.lastError) {
				$root.find("#forh-bs-chat-history").append(
					$('<div class="forh-bs-chat-msg forh-bs-chat-msg--system" />').text(
						"Could not send: " + detail.lastError
					)
				);
				scrollHistoryToBottom();
				return;
			}
			var response = detail.response;
			if (response && !response.ok && response.error) {
				$root.find("#forh-bs-chat-history").append(
					$('<div class="forh-bs-chat-msg forh-bs-chat-msg--system" />').text(
						"Could not send: " + response.error
					)
				);
				scrollHistoryToBottom();
			}
		}
		document.addEventListener("forh-bs-chat-result", onResult);
		document.dispatchEvent(
			new CustomEvent("forh-bs-send-chat", {
				bubbles: true,
				cancelable: false,
				detail: { text: text },
			})
		);
	}

	$root.find(".forh-bs-sidebar-close").on("click", removeSidebar);
	$root.find("#forh-bs-chat-send").on("click", sendMessage);
	$root.find("#forh-bs-chat-input").on("keydown", function (e) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});

	persistSidebarOpen(true);
}

function removeSidebar() {
	$("#forh-bs-sidebar").remove();
	removePageWrapper();
	persistSidebarOpen(false);
}

function toggleSidebar() {
	if ($("body").find("#forh-bs-sidebar").length === 0) {
		showSidebar();
	} else {
		removeSidebar();
	}
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request && request.action === "toggleSidebar") {
		toggleSidebar();
		sendResponse({ ok: true });
		return true;
	}
});

function restoreSidebarIfNeeded() {
	chrome.storage.local.get([STORAGE_KEY], function (r) {
		if (chrome.runtime.lastError) return;
		if (r[STORAGE_KEY] && !document.getElementById("forh-bs-sidebar")) {
			showSidebar();
		}
	});
}

restoreSidebarIfNeeded();

/* Back/forward cache: DOM may be restored without re-running this script. */
window.addEventListener("pageshow", function (ev) {
	if (ev.persisted) {
		restoreSidebarIfNeeded();
	}
});
