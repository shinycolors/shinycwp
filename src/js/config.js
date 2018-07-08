if ( typeof SCWP !== "object" ) { SCWP = {}; }
SCWP.config = {
	_default: {
		proxy: { active: true, custom: null, cache_list: [] },
		sound: { afk_mute: false },
		hiori: { dialogs: true, menus: true },
	},

	_cache: {},

	merge: function(obj1, obj2, name1 = 'obj1', name2 = 'obj2')
	{
		// For each object/property from object 2...
		for (var p in obj2) 
		{
			//console.log("Merging property '" + p + "'");
			try 
			{
				if ( obj2[p].constructor == Object ) {
					//console.info("---- recurse -----"); // [!DEBUG]
					obj1[p] = this.merge(obj1[p], obj2[p], name1, name2);
				} else {
					// [!DEBUG]
					//console.log(name1 + "." + p + " '" + obj1[p] + 
					//            "' will now be '" + obj2[p] + "'");
					obj1[p] = obj2[p];
				}

			}
			// non-existing property/invalid existing property
			catch(e) { obj1[p] = obj2[p]; }
		}

		return obj1;
	},

	load: function()
	{
		// Load config from localStorage or defaults if not available, then process the data as JSON 
		var stored_conf = localStorage.getItem("scwp_config") || JSON.stringify(this._default);
		stored_conf = JSON.parse(stored_conf);

		var def = JSON.parse(JSON.stringify(this._default));
		this.merge(def, stored_conf, "def", "stored_conf");

		return def;
	},

	get_all: function() { return this.load(); },

	get: function(secc, cache = true)
	{
		if (this._cache[secc] && cache) { return this._cache[secc]; }

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
		localStorage.setItem("scwp_config", JSON.stringify(config));
	},

	def: function(secc, prop)
	{
		return this._default[secc][prop] || null
	}
}