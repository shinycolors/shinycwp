OSD = {
	_timer: null,
	container: document.getElementById('overlay')
};

OSD.close = function()
{
	console.log("close called");
	OSD.container.classList.add("hide");
}

OSD.new = function(message)
{
	this.container.getElementsByClassName("message")[0].innerText = message;
	this.container.classList.remove("hide");
	
	if (this._timer) { clearTimeout(this._timer); }
	this._timer = setTimeout(function() {OSD.close()}, 2000);
}