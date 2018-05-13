// Node libraries
const fs = require("fs");

document.getElementById('title-version').innerText = nw.App.manifest.version;

// Adquire config so it can be applied to any element on init
var config = SCWP.config.get_all();

var proxy_changed = false;
var valid_ipv4 = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\:[\d]{1,6})?$/g;

var bench_start = Date.now(); // [!DEBUG]

// If the proxy is active in the config...
function proxyConfig( config_obj )
{
	if ( config_obj.active )
	{
		// Base load url using built-in proxy.
		var load_url = chrome.extension.getURL("ShinyColors.pac");

		// If the user has set it's own proxy...
		if ( config_obj.custom )
		{
			// Read the custom template and replace the "[CUSTOM]" with proxy.
			let content = fs.readFileSync("customPAC.pac", "UTF-8");
			content = content.replace("[CUSTOM]", config_obj.custom);

			// Convert to url data using browser native base64 encoder.
			load_url =  'data:text/json;base64,' + btoa(content);
			content = null; // unload content
		}

		// Load the url to the NW.js proxy config entry.
		nw.App.setProxyConfig("", load_url);
	}
}

proxyConfig(config.proxy);

console.log("Proxy config took " + (Date.now() - bench_start) + " ms to load"); // [!DEBUG]

function handleProxyChange() {
	// Always retrieve last version.
	var proxy_config = SCWP.config.get("proxy");

	if ( proxy_config.active ) { proxyConfig(proxy_config); }
	else { nw.App.setProxyConfig(""); }

	var event = new CustomEvent('osd-message', {
		detail: { osd_type: "proxy-reload" }
	});

	window.dispatchEvent(event);

	reload_iframe(true);
	proxy_changed = false;
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
	var save    = true;
	var section = el.getAttribute("config-area");
	var key     = el.getAttribute("config-property");
	var type    = el.getAttribute("type").toLowerCase();
	var value   = config[section][key], new_value = null;

	if ( type == "checkbox" ) { el.checked = value; }
	else if ( type == "text" ) { el.value = value; }

	el.addEventListener("change", function(e){
		var temp = SCWP.config.get(section);
		var old = SCWP.config.get(section);

		if ( type == "checkbox" )
		{
			new_value = e.target.checked;
			temp[key] = new_value;
		}

		else if ( type == "text" )
		{
			new_value = e.target.value;
			temp[key] = new_value;
		}

		// If something changes in the proxy config
		if ( section == "proxy" )
		{
			if ( key == "custom" )
			{
				new_value = new_value.trim();
				temp[key] = new_value;

				if ( new_value == "" || valid_ipv4.test(new_value) )
				{
					proxy_changed = true;
					console.log("VALID IP:PORT");
				}
				else { save = false; }
			}

			else if ( key == "active" )
			{
				proxy_changed = true;
				console.log("Proxy status: ", value);
			}
		}

		if ( save )
		{
			SCWP.config.set(section, temp);
			config[section] = temp;
		}
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

function reload_iframe( suppress_osd = false )
{
	iframe.contentWindow.location.reload();
	if ( suppress_osd ) { return; }

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

	if ( proxy_changed ) { handleProxyChange(); }
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
	else if ( e.detail.osd_type == "proxy-reload" )
	{
		OSD.new("Proxy changed. Reloading...");
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
