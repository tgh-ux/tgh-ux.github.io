/*
 * Narration interpreter.
 *
 * Bridges the structured turn data produced by Rules with the structural narration model consumed by the GUI.
 *
 * The interpreter has two separate jobs:
 *   1. compile a Rules turn into language-independent narration data; and
 *   2. render part of that narration data into the active language when a consumer actually needs text.
 *
 * No localized text is stored in NarrationData during normal operation. Localization references and raw values remain structural until
 * renderText(), renderContent(), or renderInput() is called.
 */
const Interpreter = (() => {

	/* =========================
	   Data
	   ========================= */

	// Named pause durations, in seconds. Values are replaced from Settings at runtime.
	const PAUSE_LEVELS = {
		short: 15,
		medium: 30,
		long: 45,
	};

	// Multiplier applied to all resolved pause durations.
	let PAUSE_SCALE = 1;

	// Maximum nesting depth allowed when resolving localization-key references.
	const MAX_RESOLUTION_DEPTH = 20;


	/* =========================
	   Private functions
	   ========================= */

	/*
	 * Internal handlers for the template expression language.
	 *
	 * Each handler receives the current template data followed by the expression's arguments, and returns a structural descriptor for
	 * _compileDescriptor().
	 *
	 * Handlers do not produce localized text directly.
	 */
	const EXPRESSION_HANDLERS = {
		// {Identity:field[,form]} — Field holds ROLE_X/TEAM_X string. form is "definite" | "plural" | "genitive" | omitted. Returns the localization key corresponding to the identity with applied form(s).
		Identity: (data, field, ...form) => {
			const id = data[field];

			if (id == null)
				throw new Error(`Identity: field '${field}' missing from turn data`);

			const key = _identityKey(id, form);

			if (key === null)
				throw new Error(`Identity: unrecognized form modifier(s) [${form.join(", ")}] on field '${field}'`);

			return { kind: "key", key };
		},
		// {RoleName:field[,form]} - Near-identical to Identity, but takes a role ID and adds the role key prefix.
		RoleName: (data, field, ...form) => {
			const role = data[field];

			if (role == null)
				throw new Error(`RoleName: field '${field}' missing from turn data`);

			const key = _identityKey(`ROLE_${role}`, form);

			if (key === null)
				throw new Error(`RoleName: unrecognized form modifier(s) [${form.join(", ")}] on field '${field}'`);

			return { kind: "key", key };
		},
		// {RoleAction:field} - Field must hold a role ID string. Indirection allowing one role's prompt to reuse another role's action text.
		RoleAction: (data, field) => {
			const role = data[field];

			if (role == null)
				throw new Error(`RoleAction: field '${field}' missing from turn data`);

			return { kind: "key", key: `PROMPT_${role}_ACTION` };
		},
		// {Value:field} — insert a scalar as-is. No lookup, no recursion.
		Value: (data, field) => {
			const value = data[field];

			if (value == null)
				throw new Error(`Value: field '${field}' missing from turn data`);

			return { kind: "value", value: String(value) };
		},
		// {LocalizedValue:field} - inserts the field value as a localization key
		LocalizedValue: (data, field) => ({ kind: "key", key: String(data[field]) }),
		// {IdentityList:field[,join]} — field holds an array of bare role IDs (e.g. from ctx.getRolesPresentWithTag). If the element has either a ROLE_ or TEAM_ prefix
		// it gets resolved as-is. If it has no prefix, it gets the ROLE_-prefix first. Join is "and" (default) or "or".
		IdentityList: (data, field, join = "and") => {
			const list = data[field];

			if (!Array.isArray(list))
				throw new Error(`IdentityList: list '${field}' is not an array`);

			if (list.length === 0)
				return null;

			return { kind: "list", join, items: list.map(id => ({ kind: "key", key: id.startsWith("ROLE_") || id.startsWith("TEAM_") ? id : `ROLE_${id}` })) };
		},
		// {ValueList:field[,join]} — field holds an array of display-ready values (e.g. player numbers). No per-item resolution, just joins.
		ValueList: (data, field, join = "and") => {
			const list = data[field];

			if (!Array.isArray(list))
				throw new Error(`ValueList: list '${field}' is not an array`);

			if (list.length === 0)
				return null;

			return { kind: "list", join, items: list.map(value => ({ kind: "value", value: String(value) })) };
		},
		// {Literal:value} — returns `value` as-is (already display-ready, needs no lookup).
		Literal: (data, value) => ({ kind: "literal", value: String(value) }),
		// {If:field,keyTrue[,keyFalse]} — insert `keyTrue` iff data[field] is truthy, else keyFalse if provided, or empty string.
		If: (data, field, keyTrue, keyFalse) => {
			return data[field] ? _branchDescriptor(keyTrue) : _branchDescriptor(keyFalse);
		},
		//{Select:field,label,key,label,key,...,*,key} — match data[field] against each label (string-compared), "*" is the catch-all.
		Select: (data, field, ...arms) => {
			const value = String(data[field]);

			for (let i = 0; i < arms.length; i += 2) {
				if ( String(arms[i]) === value || arms[i] === "*") {
					return _branchDescriptor(arms[i + 1]);
				}
			}

			throw new Error(`Select: no matching arm for field '${field}'='${value}' (and no '*' catch-all provided)`);
		},
		//{Random:branch,branch,...,branch} - selects a random branch in the list, a localization key or literal, using either data.rndSeed or a rolled random value
		Random: (data, ...arms) => {
			const r = data.rndSeed ?? Math.random();
			const i = Math.floor(r * arms.length);
			return _branchDescriptor(arms[i]);
		},
		/*
		 * {Pause:level|seconds} — narration-timing marker, not narration content. `level` is one of PAUSE_LEVELS' keys (a shared vocabulary
		 * for "how long does this kind of action take", so pause lengths stay consistent across roles and are tunable in one place rather than
		 * as scattered literals); a plain number is used as-is. Either way the result is scaled by a settings value before being embedded.
		 */
		Pause: (data, level) => ({ kind: "node", node: _pauseNode(level) }),
		/*
		 * {Break} — manual narration-split marker, not narration content. Splits what would otherwise be one text segment into two, with no
		 * pause between them. Sentences already split automatically; Break is for cutting a segment inside what would otherwise stay one sentence
		 * e.g. before/after a long role list - so the TTS overlay never has to display more than one clause-ish chunk at a time.
		 */
		Break: () => ({ kind: "node", node: _breakNode() }),

		// {AutoKey:manualKey,autoKey} - Special, branches depending on narration mode. See _compileExpression().

		/*
		 * {Input:field,kind,manualKey,duration,defaultField,...args}
		 * Where args are either:
		 *   value,label,continuationKey,...  - for kind "choice"
		 *   optionsField,continuationKey     - for kind "value"
		 * 
		 * Creates an input sequence, pausing the narration and displays buttons on screen, then handles the input and continues resolving.
		 * Valid in any mode; only produces an interactive node in automatic mode - manual modes (verbose/brief) resolve straight to manualKey
		 * instead. For use inside PROMPT_ keys only. See _compileExpression().
		 */
	};


	/**
	 * Builds a localization key for a role or team identity with grammatical modifiers.
	 *
	 * @param {string} id - Identity key, such as ROLE_X or TEAM_X.
	 * @param {string[]} form - Optional grammatical modifiers: plural, definite, genitive.
	 * @returns {string|null} Localization key, or null if a modifier is invalid.
	 */
	function _identityKey(id, form) {
		const known = new Set(["plural", "definite", "genitive"]);
		const bad = form.filter(f => !known.has(f));
		if (bad.length > 0) return null;

		let suffix = "";
		if (form.includes("plural")) suffix += "_PLURAL";
		if (form.includes("definite")) suffix += "_DEFINITE";
		if (form.includes("genitive")) suffix += "_GENITIVE";

		return `${id}${suffix}`;
	}

	/**
	 * Converts a conditional branch argument into a structural descriptor.
	 *
	 * Quoted values are treated as literals; other values are treated as localization keys.
	 *
	 * @param {string|undefined} branch - Branch value from a template expression.
	 * @returns {{kind: string, value?: string, key?: string}|null} Structural descriptor.
	 */
	function _branchDescriptor(branch) {
		if (branch === undefined)
			return null;

		if (Localization.isLiteral(branch))
			return { kind: "literal", value: String(branch) };

		return { kind: "key", key: String(branch) };
	}

	/**
	 * Resolves a named or numeric pause duration and applies the global pause scale.
	 *
	 * @param {string|number} level - Named pause level or duration in seconds.
	 * @returns {number} Scaled duration in seconds.
	 * @throws {Error} If the duration is not recognized or numeric.
	 */
	function _resolveDuration(level) {
		const base = PAUSE_LEVELS[level] ?? Number(level);
		if (!Number.isFinite(base))
			throw new Error(`Duration: '${level}' is neither a known pause level (${Object.keys(PAUSE_LEVELS).join(", ")}) nor a number`);

		return base * PAUSE_SCALE;
	}

	/**
	 * Selects the localization entry-point key for a narration action and presentation mode.
	 *
	 * Automatic mode uses PROMPT_AUTO_<action> when available and otherwise falls back to PROMPT_<action>.
	 *
	 * @param {string} action - Narration action.
	 * @param {"verbose"|"brief"|"automatic"} mode - Presentation mode.
	 * @returns {string} Localization entry-point key.
	 * @throws {Error} If the mode is unknown.
	 */
	function _entryPointKey(action, mode) {
		switch (mode) {
			case "verbose":
				return `PROMPT_${action}`;

			case "brief":
				return `PROMPT_BRIEF_${action}`;

			case "automatic": {
				const autoKey = `PROMPT_AUTO_${action}`;
				return Localization.hasKey(autoKey) ? autoKey : `PROMPT_${action}`;
			}

			default:
				throw new Error(`_entryPointKey: unrecognized narration mode '${mode}'`);
		}
	}

	/**
	 * Builds the data object used while resolving a narration template.
	 *
	 * Precedence is narration data, bound input values, then call-specific overrides. Action and instigator are always restored from the
	 * narration object.
	 *
	 * @param {object} narration - Compiled narration data.
	 * @param {object} boundValues - Values retained from earlier automatic inputs.
	 * @param {object} overrides - Values specific to the current resolution step.
	 * @returns {object} Data available to template expressions.
	 */
	function _buildData(narration, boundValues = {}, overrides = {}) {
		return { ...narration.data, ...boundValues, ...overrides, action: narration.action, instigator: narration.instigator };
	}

	/** Creates a content node containing the supplied structural parts. */
	function _contentNode(parts) {
		return { type: "content", parts };
	}

	/**  Creates a pause control node with the resolved duration. */
	function _pauseNode(level) {
		return { type: "pause", duration: _resolveDuration(level) };
	}

	/**  Creates a narration break control node. */
	function _breakNode() {
		return { type: "break" };
	}

	/** Appends a node to the result, merging adjacent content nodes and discarding empty content nodes. */
	function _pushNode(nodes, node) {
		if (!node)
			return;

		if (node.type === "content" && node.parts.length === 0)
			return;

		const previous = nodes[nodes.length - 1];

		if (previous?.type === "content" && node.type === "content") {
			previous.parts.push(...node.parts);
			return;
		}

		nodes.push(node);
	}

	/** Creates a placeholder content node for a missing localization key. */
	function _missingKey(key) {
		console.warn(`Missing localization key: ${key}`);
		return _contentNode([ { type: "literal", value: `UNDEF: ${key}` } ]);
	}

	/**
	 * Converts a structural template descriptor into narration nodes.
	 *
	 * Key descriptors recurse into localization, while value, literal, list and node descriptors are converted into their corresponding
	 * structural node forms.
	 *
	 * @param {object|null} descriptor - Structural descriptor.
	 * @param {object} data - Current template data.
	 * @param {"verbose"|"brief"|"automatic"} mode - Presentation mode.
	 * @param {string[]} stack - Localization keys currently being resolved.
	 * @returns {object[]} Structural narration nodes.
	 */
	function _compileDescriptor(descriptor, data, mode, stack) {
		if (!descriptor)
			return [];

		switch (descriptor.kind) {
			case "key":
				return _compileKey(descriptor.key, data, mode, stack);

			case "value":
				return [ _contentNode([ { type: "value", value: descriptor.value } ]) ];

			case "literal":
				return [ _contentNode([ { type: "literal", value: descriptor.value } ]) ];

			case "list": {
				const items = descriptor.items.map(item => {
					const itemNodes = _compileDescriptor(item, data, mode, stack);

					return itemNodes.flatMap(node => node.type === "content" ? node.parts : [] );
				});

				const conjunctionKey = descriptor.join === "or" ? "LIST_OR" : "LIST_AND";

				return [ _contentNode([ { type: "list", items, conjunction: _compileKeyParts(conjunctionKey, data, mode, stack) } ]) ];
			}

			case "node":
				return [descriptor.node];

			default:
				throw new Error(`Unknown interpreter descriptor '${descriptor.kind}'`);
		}
	}

	/**
	 * Resolves a localization key and returns only its content parts.
	 *
	 * Intended for contexts such as list conjunctions where control nodes are not meaningful.
	 *
	 * @param {string} key - Localization key.
	 * @param {object} data - Current template data.
	 * @param {"verbose"|"brief"|"automatic"} mode - Presentation mode.
	 * @param {string[]} stack - Localization resolution stack.
	 * @returns {object[]} Structural content parts.
	 */
	function _compileKeyParts(key, data, mode, stack) {
		const nodes = _compileKey(key, data, mode, stack);

		return nodes.flatMap(node => node.type === "content" ? node.parts : []);
	}

	/**
	 * Compiles an Input template expression into either an interactive input node or its manual narration branch.
	 *
	 * Automatic choice inputs retain their continuation keys for later resolution; value inputs obtain their options from a data field.
	 *
	 * @param {string[]} args - Input expression arguments.
	 * @param {object} data - Current template data.
	 * @param {"verbose"|"brief"|"automatic"} mode - Presentation mode.
	 * @param {string[]} stack - Localization resolution stack.
	 * @returns {object[]} Structural narration nodes.
	 * @throws {Error} If the input kind or value-input options are invalid.
	 */
	function _compileInput(args, data, mode, stack) {
		const [ field, kind, manualKey, duration, defaultField, ...rest ] = args;

		// Manual narration does not contain an interactive input node. It simply follows the manual prompt key.
		if (mode !== "automatic")
			return _compileKey(manualKey, data, mode, stack);

		const node = { type: "input", field, timeoutSeconds: _resolveDuration(duration), defaultValue: data[defaultField] };

		if (kind === "choice") {
			const options = [];
			const branches = [];

			for (let i = 0; i < rest.length; i += 3) {
				const [ value, label, continuationKey ] = rest.slice(i, i + 3);
				options.push({ value, label: _compileKey(String(label), data, "automatic", stack) });
				branches.push({ value, key: continuationKey });
			}

			node.options = options;
			node.continuation = { type: "choice", branches };

			return [node];
		}

		if (kind === "value") {
			const [ optionsField, continuationKey ] = rest;
			const rawOptions = data[optionsField];

			if (!Array.isArray(rawOptions))
				throw new Error(`Input: options field '${optionsField}' is not an array`);

			node.options = rawOptions.map(option => ({ value: option.value, label: _compileKey(option.label, data, "automatic", stack) }));
			node.continuation = { type: "value", key: continuationKey };

			return [node];
		}

		throw new Error(`Input: unrecognized kind '${kind}'`);
	}

	/**
	 * Compiles a FakeInput expression.
	 *
	 * In automatic mode it produces an input node whose selected value is ignored and whose continuation is fixed; manual modes resolve
	 * directly to the manual key.
	 *
	 * @param {string[]} args - FakeInput expression arguments.
	 * @param {object} data - Current template data.
	 * @param {"verbose"|"brief"|"automatic"} mode - Presentation mode.
	 * @param {string[]} stack - Localization resolution stack.
	 * @returns {object[]} Structural narration nodes.
	 */
	function _compileFakeInput(args, data, mode, stack) {
		const [duration, manualKey, continuationKey, ...labels] = args;

		if (mode !== "automatic")
			return _compileKey(manualKey, data, mode, stack);

		const node = {
			type: "input",
			timeoutSeconds: _resolveDuration(duration),
			options: labels.map(label => ({
				value: label,
				label: _compileDescriptor(_branchDescriptor(label), data, "automatic", stack)
			})),
			continuation: {
				type: "fixed",
				key: continuationKey
			},
		};

		return [node];
	}

	/* Structural compilation */

	/**
	 * Resolves one localization key into structural narration nodes.
	 *
	 * Detects cyclic references and excessive nesting before recursively compiling the parsed template.
	 *
	 * @param {string} key - Localization key to resolve.
	 * @param {object} data - Current template data.
	 * @param {"verbose"|"brief"|"automatic"} mode - Presentation mode.
	 * @param {string[]} stack - Localization keys already being resolved.
	 * @returns {object[]} Structural narration nodes.
	 * @throws {Error} On cyclic references or excessive resolution depth.
	 */
	function _compileKey(key, data, mode, stack = []) {
		if (stack.includes(key))
			throw new Error(`Cyclic localization reference: ${[...stack, key].join(" -> ")}`);

		if (stack.length >= MAX_RESOLUTION_DEPTH)
			throw new Error(`Maximum localization resolution depth reached while resolving '${key}'`);

		const template = Localization.parseTemplate(key);

		if (template === undefined)
			return [_missingKey(key)];

		const nextStack = [...stack, key];
		const nodes = [];

		for (const templateNode of template) {

			if (templateNode.type === "span") {
				_pushNode(nodes, _contentNode([ { type: "span", ref: { type: "span", key: templateNode.key, index: templateNode.index } } ]));
				continue;
			}

			for (const node of _compileExpression(templateNode, data, mode, nextStack)) {
				_pushNode(nodes, node);
			}
		}

		return nodes;
	}

	/**
	 * Dispatches one parsed template expression to the appropriate compiler or handler.
	 *
	 * @param {object} expression - Parsed localization expression.
	 * @param {object} data - Current template data.
	 * @param {"verbose"|"brief"|"automatic"} mode - Presentation mode.
	 * @param {string[]} stack - Localization resolution stack.
	 * @returns {object[]} Structural narration nodes.
	 */
	function _compileExpression(expression, data, mode, stack) {
		if (expression.name === "AutoKey") {
			const [ manualKey, autoKey ] = expression.args;
			const selectedKey = mode === "automatic" ? String(autoKey) : String(manualKey);

			return _compileKey(selectedKey, data, mode, stack);
		}

		if (expression.name === "Input")
			return _compileInput(expression.args, data, mode, stack);

		if (expression.name === "FakeInput")
			return _compileFakeInput(expression.args, data, mode, stack);

		const handler = EXPRESSION_HANDLERS[expression.name];

		if (handler) {
			const descriptor = handler(data, ...expression.args);

			return _compileDescriptor(descriptor, data, mode, stack);
		}

		// A bare {...} expression is a localization-key reference.
		return _compileKey(expression.name, data, mode, stack);
	}


	/* Final text rendering */

	/**
	 * Converts one structural content part into localized text fragments.
	 *
	 * @param {object} part - Structural content part.
	 * @returns {{text: string, ref: object|null}[]} Localized fragments with structural references.
	 * @throws {Error} If the part type is unknown.
	 */
	function _renderPart(part) {
		switch (part.type) {
			case "span":
				return [{ text: Localization.getTemplateSpan(part.ref), ref: part.ref }];

			case "value":
				return [{ text: String(part.value), ref: { type: "value", value: String(part.value) }}];

			case "literal":
				return [{ text: String(part.value), ref: null }];

			case "list": {
				const rendered = [];

				if (part.items.length === 0)
					return rendered;

				const conjunction = part.conjunction ?? [];
				const renderItem = itemParts => itemParts.flatMap(_renderPart);

				for (let i = 0; i < part.items.length; i++) {
					if (i > 0) {
						if (part.items.length === 2) {
							rendered.push({ text: " ", ref: null });
							rendered.push(...conjunction.flatMap(_renderPart));
							rendered.push({ text: " ", ref: null });
						} else if (i === part.items.length - 1) {
							rendered.push({ text: ", ", ref: null });
							rendered.push(...conjunction.flatMap(_renderPart));
							rendered.push({ text: " ", ref: null });
						} else {
							rendered.push({ text: ", ", ref: null });
						}
					}

					rendered.push(...renderItem(part.items[i]));
				}

				return rendered;
			}

			default:
				throw new Error(`Unknown narration part '${part.type}'`);
		}
	}

	/**
	 * Splits rendered fragments into sentence-sized units while preserving their source references.
	 *
	 * Text is normalized at this final language-text boundary.
	 *
	 * @param {{text: string, ref: object|null}[]} parts - Rendered text fragments.
	 * @returns {{text: string, source: object[]}[]} Rendered sentences and their source references.
	 */
	function _splitRenderedParts(parts) {
		const sentences = [];
		let sentenceSource = [];
		let sentenceText = "";

		const flush = () => {
			if (sentenceText.trim() === "") {
				sentenceSource = [];
				sentenceText = "";
				return;
			}

			sentences.push({ text: Localization.normalizeText(sentenceText), source: sentenceSource.filter(part => 
				/[\p{L}\p{N}]/u.test(part.text)).map(part => ({ ref: part.ref }))
			});

			sentenceSource = [];
			sentenceText = "";
		};

		for (const part of parts) {
			let remaining = part.text ?? "";

			while (remaining !== "") {
				const boundary = Localization.firstSentenceBoundary(remaining);

				if (boundary === -1) {
					sentenceSource.push({ text: remaining, ref: part.ref });
					sentenceText += remaining;
					break;
				}

				const head = remaining.slice(0, boundary);
				sentenceSource.push({ text: head, ref: part.ref });
				sentenceText += head;
				flush();
				remaining = remaining.slice(boundary);
			}
		}

		flush();

		return sentences;
	}

	/**
	 * Converts all content nodes into plain text, separated by spaces.
	 *
	 * @param {object[]} nodes - Structural narration nodes.
	 * @returns {string} Combined rendered text.
	 */
	function _renderNodesToText(nodes) {
		return nodes
			.filter(node => node.type === "content")
			.flatMap(node => renderContent(node)
			.map(sentence => sentence.text))
			.join(" ");
	}

	/**
	 * Formats a narration-resolution error for manual display and logs the original error.
	 *
	 * @param {object} narration - Narration being rendered.
	 * @param {Error} error - Rendering error.
	 * @returns {string} User-facing error text.
	 */
	function _formatErrorText(narration, error) {
		console.error(`Failed to render narration (action=${narration.action}, instigator=${narration.instigator}):`, error);
		return `⚠ COULD NOT RENDER [${narration.action ?? "?"} / ${narration.instigator ?? "?"}]: ${error?.message ?? String(error)}`;
	}


	/* =========================
	   Public functions
	   ========================= */

	/**
	 * Converts one Rules turn into deferred NarrationData.
	 *
	 * Localization is not evaluated until the narration is rendered or resolved.
	 *
	 * @param {object} turn - Structured turn produced by Rules.
	 * @returns {object} Compiled narration data.
	 */
	function compileTurn(turn) {
		return { action: turn.action, instigator: turn.instigator, data: { ...(turn.data ?? {}) }, error: turn.error ?? null };
	}

	/**
	 * Converts all Rules turns into deferred NarrationData.
	 *
	 * @param {object[]} turns - Structured turns produced by Rules.
	 * @returns {object[]} Compiled narration data.
	 */
	function compileAll(turns) {
		return turns.map(compileTurn);
	}

	/**
	 * Evaluates a NarrationData object into structural narration nodes.
	 *
	 * The mode determines which localization entry point is used. In automatic mode, bound values from earlier interactive inputs can be
	 * supplied so later template expressions are evaluated using the current session state.
	 *
	 * @param {object} narration - Compiled narration data.
	 * @param {"verbose"|"brief"|"automatic"} mode - Presentation mode.
	 * @param {object} boundValues - Values already selected by earlier inputs.
	 * @returns {object[]} Structural narration nodes.
	 * @throws {Error} If the narration contains an error or localization evaluation fails.
	 */
	function getNodes(narration, mode = "automatic", boundValues = {}) {
		if (narration.error)
			throw narration.error;

		const key = _entryPointKey(narration.action, mode);
		const data = _buildData(narration, boundValues);

		return _compileKey(key, data, mode);
	}

	/**
	 * Renders a complete narration into plain localized text for manual narration.
	 *
	 * Only the `verbose` and `brief` modes are supported. Rendering errors are converted into displayable error text rather than being
	 * thrown.
	 *
	 * @param {object} narration - Compiled narration data.
	 * @param {"verbose"|"brief"} mode - Manual presentation mode.
	 * @returns {string} Rendered narration text or formatted error text.
	 * @throws {Error} If the narration mode is not one of the known manual modes.
	 */
	function renderText(narration, mode = "verbose") {
		if (mode !== "verbose" && mode !== "brief")
			throw new Error(`renderText only supports manual modes ('verbose' or 'brief'), not '${mode}'`);

		if (narration.error)
			return _formatErrorText(narration, narration.error);

		try {
			return _renderNodesToText(getNodes(narration, mode, {}));
		} catch (error) {
			return _formatErrorText(narration, error);
		}
	}

	/**
	 * Renders one structural content node into localized sentence units.
	 *
	 * Each sentence contains its rendered text and the structural source references associated with the parts that produced it.
	 *
	 * @param {object} node - Structural content node.
	 * @returns {{text: string, source: object[]}[]} Rendered sentences with source references.
	 * @throws {Error} If the supplied node is not a content node.
	 */
	function renderContent(node) {
		if (node?.type !== "content")
			throw new Error("renderContent expects a content node");

		const parts = node.parts
			.flatMap(_renderPart)
			.filter(part => part.text !== undefined && part.text !== null);

		return _splitRenderedParts(parts);
	}

	/**
	 * Renders an automatic input node's option labels into localized text.
	 *
	 * The input field and option values are preserved; only the structural labels are converted to display text.
	 *
	 * @param {object} node - Automatic input node.
	 * @returns {{field: string, options: object[]}} Input field and localized options.
	 * @throws {Error} If the supplied node is not an input node.
	 */
	function renderInput(node) {
		if (node?.type !== "input")
			throw new Error("renderInput expects an input node");

		return { field: node.field, options: node.options.map(option => ({ value: option.value, label: _renderNodesToText(option.label) })) };
	}

	/**
	 * Resolves an automatic input and returns the structural nodes for its continuation.
	 *
	 * Choice inputs select the continuation associated with the supplied value. Value and fixed inputs use their stored continuation
	 * directly. The selected value is added to the narration data together with any values already bound by earlier inputs.
	 *
	 * @param {object} narration - Compiled narration data containing the input.
	 * @param {object} inputNode - Input node being resolved.
	 * @param {*} value - Value selected or entered by the user.
	 * @param {object} boundValues - Values already selected by earlier inputs.
	 * @returns {object[]} Structural narration nodes for the continuation.
	 * @throws {Error} If the node, continuation, or selected value is invalid.
	 */
	function resolveInput(narration, inputNode, value, boundValues = {}) {
		if (inputNode?.type !== "input")
			throw new Error("resolveInput expects an input node");

		const continuation = inputNode.continuation;

		if (!continuation)
			throw new Error("Input: missing continuation");

		let key;

		if (continuation.type === "choice") {
			const branch = continuation.branches.find(candidate => Object.is(candidate.value, value) || String(candidate.value) === String(value));

			if (!branch)
				throw new Error(`Input: no continuation for value '${value}'`);

			key = branch.key;
		} else if (continuation.type === "value") {
			key = continuation.key;
		} else if (continuation.type === "fixed") {
			key = continuation.key;
		} else {
			throw new Error(`Input: unrecognized continuation type '${continuation.type}'`);
		}

		const data = _buildData(narration, boundValues, { [inputNode.field]: value });

		return _compileKey(key, data, "automatic");
	}

	/**
	 * Reloads narration pause values from Settings.
	 *
	 * Updates the named pause durations and global pause scale used by subsequent template evaluation.
	 */
	function refreshPauseSettings() {
		PAUSE_SCALE = Settings.getValue("narration.pause_scale") ?? PAUSE_SCALE;
		PAUSE_LEVELS.short =Settings.getValue("narration.pause_short") ?? PAUSE_LEVELS.short;
		PAUSE_LEVELS.medium =Settings.getValue("narration.pause_medium") ?? PAUSE_LEVELS.medium;
		PAUSE_LEVELS.long =Settings.getValue("narration.pause_long") ?? PAUSE_LEVELS.long;
	}


	return {
		compileAll,
		compileTurn,
		getNodes,
		renderText,
		renderContent,
		renderInput,
		resolveInput,
		refreshPauseSettings,
	};

})();