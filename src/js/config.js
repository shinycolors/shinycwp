if ( typeof SCWP !== "object" ) { SCWP = {}; }
SCWP.config = {
	_default: {
		proxy: { active: true, custom: null },
		sound: { afk_mute: false },
		hiori: { dialogs: true }
	},

	_cache: {},

	merge: function(obj1, obj2) {
		//console.log("Merging\n", obj1, "\nwith\n", obj2); // [!DEBUG]
		for (var p in obj2) 
		{
			try 
			{
				// Property in destination object set; update its value.
				if ( obj2[p].constructor == Object ) {
					obj1[p] = extend(obj1[p], obj2[p]);
				} else {
					obj1[p] = obj2[p];
				}

			}
			catch(e) { obj1[p] = obj2[p]; }
		}

		return obj1;
	},

	load: function()
	{
		var config = localStorage.getItem("config") || JSON.stringify(this._default);
		config = JSON.parse(config);

		var temp = this._default;
		this.merge(temp, config);

		config = temp;

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