// Base network setup for all app connections.
nw.App.setProxyConfig("", chrome.extension.getURL("ShinyColors.pac"));

// Select the frame element so it can be used later everywhere.
var iframe = document.getElementById('iframe');

// Every time the outerframe of the iframe loads a page...
document.querySelector('#iframe').onload = function()
{
	// Verify if frame domain is from ShinyColors
	if ( iframe.contentDocument.location.hostname.indexOf("shinycolors.enza.fun") != -1 )
	{
		// Inject the script directly into the frame, as we are not isolated.
		var script = iframe.contentDocument.createElement("script");
		script.src = chrome.extension.getURL("hiori/injects.js");
		iframe.contentDocument.head.appendChild(script);
	}

	// Bind custom notifications API so It can have future uses like
	// Stamina tracking notifications, etc.
	// Yk_notif.bind(iframe.contentWindow); // [!REV] not using rn

	// Bind basic keyboard commands to app
	iframe.contentDocument.onkeydown = function(e) {
		// F11
		if ( e.which == 122 )
		{
			e.preventDefault();
			win.toggleFullscreen();

			var event = new CustomEvent('osd-message', {
				detail: {
					osd_type: "fullscreen", 
					fs_status: win.isFullscreen
				}
			});

			window.dispatchEvent(event);
		}

		// Ctrl + R
		if ( e.ctrlKey == true && e.which == 82 )
		{
			iframe.contentWindow.location.reload();

			var event = new CustomEvent('osd-message', {
				detail: {
					osd_type: "reload"
				}
			});

			window.dispatchEvent(event);
		}
	}

	// We change the focus of the document to the iframe, so that
	// all interaction happens withing the iframe.
	iframe.focus();
}

// [!REV] move to OSD.js
// Listen to OSD messages
window.addEventListener('osd-message', function (e) {
	if ( e.detail.osd_type == "fullscreen" )
	{
		var status = (e.detail.fs_status ? "off" : "on");
		OSD.new("Fullscreen " + status);
	}
	else if ( e.detail.osd_type == "reload" )
	{
		OSD.new("Reloading...");
	}
	else
	{
		console.log("Uncaught type" + e.detail.osd_type);
	}
});

// Window resize event
win.on("resize", function(w, h) {
	// If height doesn't properly fit a 16:9 aspect ratio...
	if ( h != Math.ceil((9/16)*w) )
	{
		// Fix the height only.
		win.height = Math.ceil((9/16)*w);
	}
});

// After the blank window loads properly, and network settings
// are properly set, we then set the source to load SC.
win.on("loaded", function() {
	iframe.src = "https://shinycolors.enza.fun";

	var read_timeout = 5000, anim_ms = 2001;
	var prem = document.getElementById("pre-message");

	var timer = null;
	
	// Hide the preload message screen after read_timeout milisecs
	// please pay attention to the duration of the hide animation on 'estilos.css'
	timer = setTimeout(function() {
		prem.classList.add("hide");
		iframe.focus();

		// Save some memory (?)
		timer = setTimeout(function() { 
			prem.style.display = "none";
		}, anim_ms);
	}, read_timeout);
});
