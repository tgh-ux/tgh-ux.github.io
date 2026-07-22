const Interpreter = (() => {

	/* =========================
	   Data
	   ========================= */

	// Every primitive receives (data, ...args) where `data` is the turn's
	// resolved field bag (see _buildFieldBag) — never ctx, never Roles/Settings.
	// A primitive either returns literal text, or a bare "{KEY}" string for the
	// outer resolver loop to pick up and resolve as an ordinary locale key.
	const PRIMITIVES = {

		// {Identity:field[,form]} — field holds a ROLE_X/TEAM_X id (already prefixed
		// by rules.js). form is "definite" | "plural" | omitted.
		Identity: (data, field, ...form) => {
			const id = data[field];
			if (id == null)
				throw new Error(`Identity: field '${field}' missing from turn data`);
			
			const key = _identityKey(id, form);
			if (key === null)
				throw new Error(`Identity: unrecognized form modifier(s) [${form.join(", ")}] on field '${field}'`);
			
			return key;
		},

		RoleName: (data, field, ...form) => {
			const role = data[field];
			if (role == null)
				throw new Error(`RoleName: field '${field}' missing from turn data`);
			
			const key = _identityKey(`ROLE_${role}`, form)
			if (key === null)
				throw new Error(`RoleName: unrecognized form modifier(s) [${form.join(", ")}] on field '${field}'`);
			
			return key
		},

		RoleAction: (data, field) => {
			const role = data[field];
			if (role == null)
				throw new Error(`RoleAction: field '${field}' missing from turn data`);

			return `{PROMPT_${role}_ACTION}`;
		},
		
		// {Value:field} — insert a scalar as-is. No lookup, no recursion.
		Value: (data, field) => {
			const v = data[field];
			if (v == null)
				throw new Error(`Value: field '${field}' missing from turn data`);
			
			return String(v);
		},
		
		// {LocalizedValue:field} - inserts a template tag that gets parsed
		LocalizedValue: (data, field) => {
			const v = data[field];
			return `{${v}}`;
		},

		// {IdentityList:field[,join]} — field holds an array of bare role ids
		// (e.g. from ctx.getRolesPresentWithTag). Each element gets ROLE_-prefixed
		// and resolved; join is "and" (default) or "or".
		IdentityList: (data, field, join = "and") => {
			const list = data[field];
			if (!Array.isArray(list))
				throw new Error(`IdentityList: list '${field}' is not an array`);
			if (list.length === 0)
				return "";

			return _joinList(list.map(id => `{ROLE_${id}}`), join);
		},

		// {ValueList:field[,join]} — field holds an array of display-ready values
		// (e.g. player numbers). No per-item resolution, just joins.
		ValueList: (data, field, join = "and") => {
			const list = data[field];
			if (!Array.isArray(list))
				throw new Error(`ValueList: list '${field}' is not an array`);
			if (list.length === 0)
				return "";

			return _joinList(list.map(String), join);
		},

		// {If:field,key} — insert `key` iff data[field] is truthy, else nothing.
		// Sugar over Select's two-arm case; kept separate because it's the
		// overwhelmingly common case and reads better at the call site.
		If: (data, field, keyTrue, keyFalse) => {
			if (data[field]) return `{${keyTrue}}`;
			return keyFalse ? `{${keyFalse}}` : "";
		},

		// {Select:field,label,key,label,key,...,*,key} — match data[field] against
		// each label (string-compared), "*" is the catch-all. Used for both
		// type-based branching (Tier 4 outcomes) and grammatical selection
		// (e.g. {Select:count,1,CARD_SINGULAR,*,CARD_PLURAL}).
		Select: (data, field, ...arms) => {
			const value = String(data[field]);
			for (let i = 0; i < arms.length; i += 2) {
				if (String(arms[i]) === value || arms[i] === "*")
					return `{${arms[i + 1]}}`;
			}
			throw new Error(`Select: no matching arm for field '${field}'='${value}' (no '*' catch-all provided)`);
		},
	};

	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		
	}

	/* =========================
	   Private functions
	   ========================= */

	function _identityKey(id, form) {
		const known = new Set(["plural", "definite", "genitive"]);
		const bad = form.filter(f => !known.has(f));
		if (bad.length > 0) return null;

		let suffix = "";
		if (form.includes("plural")) suffix += "_PLURAL";
		if (form.includes("definite")) suffix += "_DEFINITE";
		if (form.includes("genitive")) suffix += "_GENITIVE";
		
		return `{${id}${suffix}}`;
	}

	// Joins already-resolved-or-literal string fragments with LIST_AND/LIST_OR,
	// matching however Localization's existing list-joining locale keys are shaped.
	function _joinList(items, join) {
		if (items.length === 0) return "";
		if (items.length === 1) return items[0];

		const sepKey = join === "or" ? "LIST_OR" : "LIST_AND";
		if (items.length === 2)
			return `${items[0]} {${sepKey}} ${items[1]}`;

		return items.slice(0, -1).join(", ") + ` {${sepKey}} ` + items[items.length - 1];
	}
	
	// Merges a turn's action/instigator into its own data bag, so {Identity:instigator}
	// and {Identity:action} go through the exact same primitive as everything else —
	// no special-casing those two fields anywhere else in the interpreter.
	function _buildFieldBag(turn) {
		return { ...turn.data, action: turn.action, instigator: turn.instigator };
	}

	// Picks PROMPT_<action>_VERBOSE or PROMPT_<action>_BRIEF depending on mode.
	function _entryPointKey(action, verbosity) {
		return `PROMPT${verbosity === "brief" ? "_BRIEF_" : "_"}${action}`;
	}

	function _strictTemplateError(turn) {
		return (type, key) => {
			if (type === "max_iterations")
				throw new Error(`_resolveTemplate: max resolution iterations reached for '${turn.action}', '${turn.instigator}'`);

			console.warn(`Missing localization key: ${key} (action=${turn.action}, instigator=${turn.instigator})`);
			return `UNDEF: ${key}`;
		};
	}

	function _formatErrorText(turn) {
		const detail = turn.error?.message ?? String(turn.error);
		console.error(`Failed to render turn (action=${turn.action}, instigator=${turn.instigator}):`, turn.error);
		return `⚠ COULD NOT RENDER [${turn.action ?? "?"} / ${turn.instigator ?? "?"}]: ${detail}`;
	}

	function _renderTurnSafe(turn, options) {
		if (turn.error)
			return { text: _formatErrorText(turn), error: turn.error };

		const verbosity = options.verbosity ?? "verbose";
		const data = _buildFieldBag(turn);
		const entryKey = _entryPointKey(turn.action, verbosity);

		try {
			const text = Localization.localize(entryKey, PRIMITIVES, data, _strictTemplateError(turn));
			return { text: text, error: null };
		} catch (error) {
			return { text: _formatErrorText({ ...turn, error }), error: error };
		}
	}

	/* =========================
	   Public functions
	   ========================= */
	   
	function renderTurn(turn, options = {}) {
		return _renderTurnSafe(turn, options).text;
	}

	function renderAll(turns, options = {}) {
		return turns.map(turn => {
			const { text, error } = _renderTurnSafe(turn, options);
			return { action: turn.action, instigator: turn.instigator, text: text, error: error };
		});
	}

	//Initialization
	_init();

	return {
		renderTurn,
		renderAll,
	};

})();
