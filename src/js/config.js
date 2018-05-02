if ( typeof SCWP !== "object" ) { SCWP = {}; }
SCWP.config = {
	_default: {
		proxy: { active: true, custom: null }
	},

	_cache: {},

	load: function()
	{
		var config = localStorage.getItem("config") || JSON.stringify(this._default);
		config = JSON.parse(config);
		return config;
	},

	get_all: function() { return this.load(); },

	get: function(secc)
	{
		if (this._cache[secc]) { return this._cache[secc]; }

		var config = this.load();
		var ret = config[secc] || this._default[secc] || null;

		this._cache[secc] = ret;
		return ret;
	},

	set: function(secc, objdata)
	{
		var config = this.load();
		config[secc] = objdata;

		this._cache[secc] = config[secc];
		localStorage.setItem("config", JSON.stringify(config));
	},

	def: function(secc, prop)
	{
		return this._default[secc][prop] || null
	}
}