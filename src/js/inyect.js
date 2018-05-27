/**
 * inyect.js
 *    For you, who likes to read source code.
 *    
 *    If you are from the "new JS generation" (ES6+, classes, npm, frameworks, etc.)
 *    this code will most likely trigger your senses as it's pure -not well organized-
 *    vainilla JavaScript that mixes a lot of (bad) programming practises. I'm sorry.
 */

// Node libraries
const fs = require("fs");
const version = nw.App.manifest.version;

// Set version in title bar
document.getElementById('title-version').innerText = version;

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## GLOBAL VARIABLES
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

var iframe = document.getElementById('iframe'); // Game iframe
var config = SCWP.config.get_all(); // Config

var remote = null, rnd_proxind = -1, retries = 0, proxy_changed = false, isAOT = false;

var valid_ipv4 = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\:[\d]{1,6})?$/g;

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## UPDATE/NOtIF UTILITIES
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

// Get the remote info and save it in the remote var
function getUpdateInfo()
{
	var url = __REMOTE_APP_URL__;
	var opt = {
		cache: "no-cache, no-store, must-revalidate",
		credentials: "same-origin",
		headers: {
			"pragma": "no-cache"
		}
	};

	fetch(url, opt)
		.then(response => response.json())
		.then(jsondata => { 
			remote = jsondata;
			procRemoteInfo();
		});
}

// Extremely long function to process remote info
function procRemoteInfo()
{
	// If there isn't any config set in the remote var, quit
	if ( !remote ) { return; }

	// Init variables and set a shortcut for shadow's querySelector
	var shadow = null, count = 0;
	var QS = function(e) {return shadow.querySelector(e);}

	// Local function to create a new notification in the dialog.
	function createNotification( data )
	{
		// Create new instance of template and remove template properties.
		shadow = document.querySelector("#notifications > .template").cloneNode(true);
		shadow.classList.remove("template");

		// Edit its contents according to remote info.
		QS("h4").innerText = data.title;
		QS("span").innerText = data.text;

		// Create link with external browser handling.
		if ( data.url )
		{
			var link = QS("a");
			link.href = atob(data.url);
			link.style.display = "block";
			link.onclick = function(e) { nw.Shell.openExternal(this.href); return false; }
		}

		// Append the new notification and increase counter.
		document.getElementById("notifications").appendChild(shadow);
		count++;
	}

	// If there's a new version greater than actual one
	if ( remote.app.version > version )	
	{
		createNotification({
			title: "Update available (v." + remote.app.version + ")",
			text: "Click here to go to download site.",
			url: remote.app.update.url
		});
	}

	// Get notifications and iterate through them
	var notifs = remote.notifications;
	for ( var i in notifs )
	{
		// If there isn't a min version OR there is min version and such is less than actual AND
		// If there isn't a max version OR there is max version and such is greater than actual..
		if ( (!notifs[i].minVer || notifs[i].minVer <= version) &&
			 (!notifs[i].maxVer || notifs[i].maxVer >= version) )
		{
			createNotification({
				title: notifs[i].content.title || "Notice",
				text:  notifs[i].content.text,
				url:   notifs[i].content.url
			});
		}
	}

	// If there's at least one notification...
	if ( count ) {
		// Select the notif icon link and add "on" icon
		var elem = document.querySelector(".dropdown-updates > a");
			elem.classList.add("icon-notif");

		// Remote placeholder
		document.querySelector("#notifications > .placeholder").style.display = "none";
	}

	// Set the remote proxy list from the remote and save it the config
	var proxy_config = SCWP.config.get("proxy");
	proxy_config.cache_list = remote.shipuroku;

	SCWP.config.set("proxy", proxy_config);
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## PROXY HANDLING
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

function setProxyConfig( config_obj )
{
	// If the proxy is active in the config...
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

// Function to set a new proxy from the remote list
function tryAltProxy()
{
	// Get non-cached version of proxy config
	var proxy_config = SCWP.config.get("proxy", false);
	//var hasCustom = (proxy_config.custom ? true : false);

	// if there's a cache list from remote
	if ( proxy_config.cache_list )
	{
		// Get length and randomize between 0 and len
		var len = proxy_config.cache_list.length - 1;
		rnd_proxind = Math.floor( Math.random() * len );

		// Set custom proxy to a random in the list
		proxy_config.custom = proxy_config.cache_list[rnd_proxind];

		// Use this data and set it using the method
		setProxyConfig(proxy_config);

		// Create OSD event and dispotch
		var event = new CustomEvent('osd-message', {
			detail: { osd_type: "proxy-fallback" }
		});
		window.dispatchEvent(event);

		// Reload the iframe in the current location (without OSD)
		reload_iframe(true);

		// Save the config, so next time (hopefully) we don't run into this problem
		SCWP.config.set("proxy", proxy_config);
	}
}

function handleProxyChange()
{
	// Always retrieve last version.
	var proxy_config = SCWP.config.get("proxy");

	if ( proxy_config.active ) { setProxyConfig(proxy_config); }
	else { nw.App.setProxyConfig(""); }

	var event = new CustomEvent('osd-message', {
		detail: { osd_type: "proxy-reload" }
	});

	window.dispatchEvent(event);

	reload_iframe(true);
	proxy_changed = false;
}


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
					//console.log("VALID IP:PORT"); // [!DEBUG]
				}
				else { save = false; }
			}

			else if ( key == "active" )
			{
				proxy_changed = true;
				//console.log("Proxy status: ", value); // [!DEBUG]
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
		else if ( action == "delete-cache" && e.shiftKey == true ) {
			nw.App.clearCache();
			toggle_config();
		}
	});
});

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## GOBAL HELPER FUNCTIONS
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

function hide_notice()
{
	var read_timeout = 6500, anim_ms = 2001;
	var prem = document.getElementById("pre-message");

	var timer = null;
	
	// Hide the preload message screen after read_timeout milisecs
	// please pay attention to the duration of the hide animation on 'styles.css'
	timer = setTimeout(function() {
		prem.classList.add("hide");
		iframe.focus();

		// Save some memory (?)
		timer = setTimeout(function() { 
			prem.style.display = "none";
		}, anim_ms);
	}, read_timeout);
}

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
	iframe.contentWindow.stop();
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

function toggle_updates()
{
	var elem_updates = document.getElementById("notifications");
	var display_prop = elem_updates.style.display;

	elem_updates.style.display = (display_prop == "none" ? "block" : "none");
	elem_updates.classList.toggle("hide");
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

function bench_result(start_time, section = "Load")
{
	console.log(section + " took " + (Date.now() - bench_start) + " ms."); // [!DEBUG]
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## SC FRAME ONLOAD INJECTS
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

// Every time the outerframe of the iframe loads a page...
document.querySelector('#iframe').onload = function()
{
	// Check if the frame loaded is a Chrome error page
	if ( iframe.contentDocument.body.classList.contains("neterror") )
	{
		var err_cod = iframe.contentDocument.getElementsByClassName("error-code")[0];

		// If error is related to proxy or tunneling...
		if ( err_cod.innerText.indexOf("ERR_PROXY") != -1 ||
			 err_cod.innerText.indexOf("ERR_TUNNEL") != -1 )
		{
			// Check retry count, if it's only first time, reload and finish.
			if ( retries < 1 ) { reload_iframe(); retries++; return; }

			// Call function to try alternate proxy.
			//console.error("Proxy error detected."); // [!DEBUG]
			tryAltProxy();
		}
	}

	// Verify if frame domain is from ShinyColors
	else if ( iframe.contentDocument.location.hostname.indexOf("shinycolors.enza.fun") != -1 )
	{
		// Get Hiori config
		var hiori_conf = SCWP.config.get("hiori");

		// If config is set to enable dialog translations...
		if ( hiori_conf.dialogs )
		{
			// Inject the script directly into the frame content.
			var script = iframe.contentDocument.createElement("script");
			script.src = chrome.extension.getURL("hiori/injects.js");
			iframe.contentDocument.head.appendChild(script);
		}

		// Start a timer to hook their sound manager so that we can unmute the window.
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

	// Bind basic keyboard commands to app
	document.onkeydown = function(e) {
		// Esc
		if ( e.which == 27 )
		{
			var fullscreen = win.isFullscreen;
			if ( fullscreen ) { e.preventDefault(); toggle_fs(); }
		}

		// F11 or Alt + Enter
		if ( e.which == 122 || e.altKey == true && e.which == 13 )
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

	// Hook iframe keydown and replicate/dispatch its events back to our app
	iframe.contentDocument.onkeydown = function(e) {
		new_e = new e.constructor(e.type, e);
		document.dispatchEvent(new_e);
	}

	// We change the focus of the document to the iframe, so that
	// all interaction happens withing the iframe.
	iframe.focus();
}


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
	// Call function to retrieve updates.
	getUpdateInfo();

	// Load main url and hide the startup notice.
	iframe.src = "https://shinycolors.enza.fun";
	hide_notice();

	//bench_result(bench_start, "Window load event"); // [!DEBUG]
});


/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ## INIT CALLS
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

//var bench_start = Date.now(); // [!DEBUG]

setProxyConfig(config.proxy);
OSD.bind(window);

//bench_result(bench_start, "Init calls"); // [!DEBUG]