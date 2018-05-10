document.getElementById('title-version').innerText = nw.App.manifest.version;

// Adquire config so it can be applied to every element on init
var config = SCWP.config.get_all();

// If the proxy is active in the config...
if ( config.proxy.active )
{
	// Base network setup for all app connections.
	nw.App.setProxyConfig("", chrome.extension.getURL("ShinyColors.pac"));
}

// [!REV]
// Function to change the proxy in execution time. yet to be implemented.
// Needs some care with the window, as it would leak info from one time to another.
function handleProxyChange() {
	var proxy_config = SCWP.config.get("proxy");

	// Might also want to make a custom pac using blobs in order to set a custom proxy.

	if ( proxy_config.active )
	{
		nw.App.setProxyConfig("", chrome.extension.getURL("ShinyColors.pac"));
	}
	else { nw.App.setProxyConfig(""); }
}

// Select the frame element so it can be used later everywhere.
var iframe = document.getElementById('iframe');
var isAOT = false;

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## CONFIG RELATED INITS
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

// Process the inputs from the config, including setting their initial value
// from those stored in the config.
document.querySelectorAll("#config input").forEach(function(el, i) {
	var section = el.getAttribute("config-area");
	var key     = el.getAttribute("config-property");
	var type    = el.getAttribute("type").toLowerCase();
	var value   = config[section][key], new_value = null;

	if ( type == "checkbox" ) { el.checked = value; }

	el.addEventListener("change", function(e){
		var temp = SCWP.config.get(section);

		if ( type == "checkbox" )
		{
			new_value = e.target.checked;
			temp[key] = new_value;
		}

		SCWP.config.set(section, temp);
	});

	el.addEventListener("click", function(e) {
		fakefocus();
	});
});

// Process all buttons from the config...
document.querySelectorAll("#config button").forEach(function(el, i) {
	el.addEventListener("click", function(e) {
		var action = e.target.getAttribute("config-custom");

		if ( action == "delete-cookies" && e.shiftKey == true ) { 
			delete_all_cookies(); 
			toggle_config();
		}
	});
});

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## GOBAL HELPER FUNCTIONS
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

function delete_all_cookies()
{
	win.cookies.getAll({}, function(cookies) {
		var count = cookies.length;
		cookies.forEach(function(cookie, i) {
			win.cookies.remove({
				url: "https://" + cookie.domain  + cookie.path,
				name: cookie.name
			});

			// If we're on the last cookie
			if ( i == count-1 ) 
			{
				// Return to title screen
				iframe.src = "https://shinycolors.enza.fun";

				// Create reload osd event and dispatch.
				var event = new CustomEvent('osd-message', { 
					detail: { osd_type: "reload"}
				});

				window.dispatchEvent(event);
			}
		});
	});
}

function fakefocus()
{
	var ibent = new iframe.contentWindow.CustomEvent("focus");
	iframe.contentWindow.dispatchEvent(ibent);
}

function reload_iframe()
{
	iframe.contentWindow.location.reload();

	var event = new CustomEvent('osd-message', {
		detail: {
			osd_type: "reload"
		}
	});

	window.dispatchEvent(event);
}

function toggle_config()
{
	var elem_config = document.getElementById("config");
	var display_prop = elem_config.style.display;

	elem_config.style.display = (display_prop == "none" ? "block" : "none");
	elem_config.classList.toggle("hide");
}

function toggle_fs()
{
	if ( isAOT ) { toggle_aot(); }
	win.toggleFullscreen();

	var event = new CustomEvent('osd-message', {
		detail: {
			osd_type: "fullscreen", 
			fs_status: win.isFullscreen
		}
	});

	window.dispatchEvent(event);
}

function toggle_aot()
{
	var fullscreen = win.isFullscreen;

	if ( !fullscreen )
	{
		isAOT = !isAOT;

		win.setAlwaysOnTop(isAOT);

		var event = new CustomEvent('osd-message', {
			detail: {
				osd_type: "aot",
				aot_status: !isAOT
			}
		});

		window.dispatchEvent(event);
	}
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## SC FRAME ONLOAD INJECTS
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

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

		var _inj_timer = null;

		function hook_SM()
		{
			if ( iframe.contentWindow.aoba && iframe.contentWindow.aoba.soundManager )
			{
				iframe.contentWindow.aoba.soundManager.omute = iframe.contentWindow.aoba.soundManager.mute;
				iframe.contentWindow.aoba.soundManager.mute = function()
				{
					var config = SCWP.config.get("sound");

					if ( config.afk_mute ) { iframe.contentWindow.aoba.soundManager.omute(); }
				}
			}
			else
			{
				console.log("try again...");
				_inj_timer = setTimeout(() => {hook_SM()}, 500);
			}
		}

		hook_SM();
	}

	// Bind custom notifications API so It can have future uses like
	// Stamina tracking notifications, etc.
	// Yk_notif.bind(iframe.contentWindow); // [!REV] not using rn

	// Bind basic keyboard commands to app
	iframe.contentDocument.onkeydown = function(e) {
		// Esc
		if ( e.which == 27 )
		{
			var fullscreen = win.isFullscreen;
			if ( fullscreen ) { e.preventDefault(); toggle_fs(); }
		}

		// F11
		if ( e.which == 122 )
		{
			e.preventDefault(); toggle_fs(); 
		}

		// Ctrl + R or F5
		if ( e.ctrlKey == true && e.which == 82 || e.which == 116 )
		{
			e.preventDefault(); reload_iframe();
		}

		// Ctrl + T
		if ( e.ctrlKey == true && e.which == 84 )
		{
			e.preventDefault(); toggle_aot();
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
		var status = (e.detail.fs_status ? "off" : "on (ESC or F11 to exit)");
		OSD.new("Fullscreen " + status);
	}
	else if ( e.detail.osd_type == "reload" )
	{
		OSD.new("Reloading...");
	}
	else if ( e.detail.osd_type == "aot" )
	{
		var status = (e.detail.aot_status ? "off" : "on");
		OSD.new("Always on top " + status);
	}
	else
	{
		console.log("Uncaught type" + e.detail.osd_type);
	}
});

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## NWJS WINDOW EVENTS
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

// Window resize event
win.on("resize", function(w, h) {
	var fullscreen = win.isFullscreen;
	var hasClass = document.body.classList.contains("fullscreen");

	// If height doesn't properly fit a 16:9 aspect ratio...
	if ( !fullscreen && h != Math.ceil((9/16)*w) + 22 )
	{
		// Fix the height only.
		win.height = Math.ceil((9/16)*w) + 22;
	}

	// If the frame is fullscreen, we add the class...
	if ( fullscreen ) { document.body.classList.add("fullscreen"); }

	// If the frame is normal window and has the fullscreen class...
	else if ( !fullscreen && hasClass ) { document.body.classList.remove("fullscreen"); }
});

// After the blank window loads properly, and network settings
// are properly set, we then set the source to load SC.
win.on("loaded", function() {
	iframe.src = "https://shinycolors.enza.fun";

	var read_timeout = 6500, anim_ms = 2001;
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
