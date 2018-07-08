OSD = {
	_timer: null,
	container: document.getElementById('overlay')
};

OSD.close = function()
{
	OSD.container.classList.add("hide");
}

OSD.new = function(message)
{
	this.container.getElementsByClassName("message")[0].innerText = message;
	this.container.classList.remove("hide");
	
	if (this._timer) { clearTimeout(this._timer); }
	this._timer = setTimeout(function() {OSD.close()}, 3000);
}

OSD.bind = function(elem)
{
	elem.addEventListener('osd-message', function (e) {
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
		else if ( e.detail.osd_type == "proxy-fallback" )
		{
			OSD.new("Main proxy couldn't connect. Trying alternate...");
		}
		else if ( e.detail.osd_type == "proxy-over" )
		{
			OSD.new("No proxies alive, please report in Discord");
		}
		else
		{
			console.log("Uncaught type" + e.detail.osd_type);
		}
	});
}