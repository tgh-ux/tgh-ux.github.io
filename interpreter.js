/*
 * Narration interpreter.
 *
 * Bridges the structured turn data produced by Rules with the structural narration model consumed by the GUI.
 *
 * The interpreter has two separate jobs:
 *   1. compile a Rules turn into language-independent narration data; and
 *   2. render part of that narration data into the active language when a consumer actually needs text.
 *
 * No localized text is stored in NarrationData during normal operation. Localization references and raw values remain
 * structural until renderText(), renderContent(), or renderInput() is called.
 */

const Interpreter = (() => {

	/* =========================
	   Data
	   ========================= */

	// Named pause presets, in seconds, with defaults overwritten from Settings.
	const PAUSE_LEVELS = {
		short: 10,
		medium: 20,
		long: 30,
	};

	// Global multiplier applied to every pause duration.
	let PAUSE_SCALE = 1;

	// Maximum depth for recursively expanding localization keys.
	const MAX_RESOLUTION_DEPTH = 20;


	/* =========================
	   Private functions
	   ========================= */

	/*
	 * Builds the localization key for an identity (ROLE_X or TEAM_X) with the requested grammatical form(s).
	 *
	 * Returns the raw key rather than a template string. NarrationData stores structure, not "{KEY}" strings.
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

	/*
	 * Converts an If/Select branch into a structural descriptor.
	 *
	 * A quoted template argument is an authored literal; everything else is treated as a localization key.
	 */
	function _branchDescriptor(branch) {
		if (branch === undefined)
			return null;

		if (Localization.isLiteral(branch))
			return { kind: "literal", value: String(branch) };

		return { kind: "key", key: String(branch) };
	}

	function _resolveDuration(level) {
		const base = PAUSE_LEVELS[level] ?? Number(level);
		if (!Number.isFinite(base))
			throw new Error(`Duration: '${level}' is neither a known pause level (${Object.keys(PAUSE_LEVELS).join(", ")}) nor a number`);

		return base * PAUSE_SCALE;
	}

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
	
	/*
	 * Merges the data a compiled node needs to resolve, in increasing precedence: the turn's own narration data,
	 * then any values bound by earlier inputs in this session, then any one-off overrides for this call - with
	 * action/instigator always attached last so a caller can never accidentally shadow them via overrides.
	 */
	function _buildData(narration, boundValues = {}, overrides = {}) {
		return { ...narration.data, ...boundValues, ...overrides, action: narration.action, instigator: narration.instigator };
	}

	function _contentNode(parts) {
		return { type: "content", parts };
	}

	function _pauseNode(level) {
		return { type: "pause", duration: _resolveDuration(level) };
	}

	function _breakNode() {
		return { type: "break" };
	}

	/*
	 * Adjacent content nodes do not need to remain separate.
	 *
	 * This is primarily a structural convenience: a template can expand through several localization references and still
	 * result in one contiguous piece of presentable content until a real control node (pause/input/break) intervenes.
	 */
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

	function _missingKey(key) {
		console.warn(`Missing localization key: ${key}`);
		return _contentNode([ { type: "literal", value: `UNDEF: ${key}` } ]);
	}

	/*
	 * Converts a structural descriptor returned by an expression handler into NarrationData nodes.
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

	/*
	 * Compiles key and flattens it down to its content parts only, discarding anything that isn't a content node
	 * (e.g. a stray pause or break). Assumes the key resolves to pure content - meant for callers like list
	 * conjunctions, never for a key that might reasonably contain control nodes.
	 */
	function _compileKeyParts(key, data, mode, stack) {
		const nodes = _compileKey(key, data, mode, stack);

		return nodes.flatMap(node => node.type === "content" ? node.parts : []);
	}

	/*
	 * Compiles the automatic representation of an Input primitive.
	 *
	 * Choice branches are deliberately stored as continuation descriptors rather than being resolved immediately.
	 * This means a continuation can see values that an earlier input in the same narration session has bound.
	 *
	 * Value inputs behave the same way; their continuation is always resolved later.
	 */
	function _compileInput(args, data, mode, stack) {
		const [ field, kind, manualKey, duration, defaultField, ...rest ] = args;

		/*
		 * Manual narration does not contain an interactive input node.
		 * It simply follows the manual prompt key.
		 */
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


	/* =========================
	   Template expression handlers
	   ========================= */

	/*
	 * These handlers no longer generate template strings.
	 *
	 * They return structural descriptors which _compileDescriptor() turns into NarrationData.
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


	/* =========================
	   Structural compilation
	   ========================= */

	/*
	 * Compiles one localization key into structural narration nodes.
	 *
	 * Localization.parseTemplate() supplies the parsed template without resolving it to text.
	 * Literal spans become stable span references; expressions are evaluated structurally and recurse into their target keys.
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

	function _compileExpression(expression, data, mode, stack) {
		if (expression.name === "AutoKey") {
			const [ manualKey, autoKey ] = expression.args;
			const selectedKey = mode === "automatic" ? String(autoKey) : String(manualKey);

			return _compileKey(selectedKey, data, mode, stack);
		}

		if (expression.name === "Input")
			return _compileInput(expression.args, data, mode, stack);

		const handler = EXPRESSION_HANDLERS[expression.name];

		if (handler) {
			const descriptor = handler(data, ...expression.args);

			return _compileDescriptor(descriptor, data, mode, stack);
		}

		/*
		 * A bare {...} expression is a localization-key reference.
		 */
		return _compileKey(expression.name, data, mode, stack);
	}


	/* =========================
	   Final text rendering
	   ========================= */

	/*
	 * Renders one structural part into one or more localized source fragments.
	 *
	 * This is the point where Localization text is finally introduced.
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

	/*
	 * Splits localized source fragments into sentence-sized rendered units while preserving the structural reference belonging to each fragment.
	 *
	 * The sentence text is normalized only here, at the language-text boundary.
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
	
	function _renderNodesToText(nodes) {
		return nodes
			.filter(node => node.type === "content")
			.flatMap(node => renderContent(node)
			.map(sentence => sentence.text))
			.join(" ");
	}


	/* =========================
	   Public functions
	   ========================= */

	/*
	 * Converts one Rules-produced turn into NarrationData.
	 *
	 * NarrationData stores only the information that describes the turn itself. The localization entry point is
	 * derived when the narration is evaluated, because it is completely determined by the turn's action and the
	 * requested presentation mode.
	 *
	 * Evaluation is therefore fully deferred until getNodes() is called. This is important for automatic narration:
	 * bound values from earlier inputs must be able to affect the interpretation of later turns.
	 */
	function compileTurn(turn) {
		return { action: turn.action, instigator: turn.instigator, data: { ...(turn.data ?? {}) }, error: turn.error ?? null };
	}

	function compileAll(turns) {
		return turns.map(compileTurn);
	}

	/*
	 * Evaluates one NarrationData object into its current structural node list.
	 *
	 * The presentation mode determines the localization entry point at evaluation time. `boundValues` is also
	 * supplied at evaluation time so automatic narration can incorporate values selected during earlier turns.
	 */
	function getNodes(narration, mode = "automatic", boundValues = {}) {
		if (narration.error)
			throw narration.error;

		const key = _entryPointKey(narration.action, mode);
		const data = _buildData(narration, boundValues);

		return _compileKey(key, data, mode);
	}

	/*
	 * Resolves a complete manual NarrationData object to plain text.
	 *
	 * Structural branching is evaluated here using the supplied narration data. Manual modes have no interactive
	 * inputs, so no persistent bound-value context is required.
	 */
	function renderText(narration, mode = "verbose") {
		if (mode !== "verbose" && mode !== "brief") {
			throw new Error(`renderText only supports manual modes ('verbose' or 'brief'), not '${mode}'`);
		}

		if (narration.error)
			return _formatErrorText(narration, narration.error);

		try {
			return _renderNodesToText(getNodes(narration, mode, {}));
		} catch (error) {
			return _formatErrorText(narration, error);
		}
	}

	/*
	 * Resolves one structural content node into localized sentence units.
	 *
	 * The result deliberately contains both:
	 *   text   - what the GUI displays / a synthesis engine speaks
	 *   source - the structural provenance that a renderer such as TTSManifest can use for clip matching
	 */
	function renderContent(node) {
		if (node?.type !== "content")
			throw new Error("renderContent expects a content node");

		const parts = node.parts
			.flatMap(_renderPart)
			.filter(part => part.text !== undefined && part.text !== null);

		return _splitRenderedParts(parts);
	}

	/*
	 * Resolves an automatic input node's labels into native-language strings for GUI presentation.
	 */
	function renderInput(node) {
		if (node?.type !== "input")
			throw new Error("renderInput expects an input node");

		return { field: node.field, options: node.options.map(option => ({ value: option.value, label: _renderNodesToText(option.label) })) };
	}

	/*
	 * Resolves the continuation of an automatic input using the selected value and any values already bound by earlier inputs.
	 *
	 * Choice and value inputs intentionally use the same public operation.
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
		} else {
			throw new Error(`Input: unrecognized continuation type '${continuation.type}'`);
		}

		const data = _buildData(narration, boundValues, { [inputNode.field]: value });

		return _compileKey(key, data, "automatic");
	}

	function refreshPauseSettings() {
		PAUSE_SCALE = Settings.getValue("narration.pause_scale") ?? PAUSE_SCALE;
		PAUSE_LEVELS.short =Settings.getValue("narration.pause_short") ?? PAUSE_LEVELS.short;
		PAUSE_LEVELS.medium =Settings.getValue("narration.pause_medium") ?? PAUSE_LEVELS.medium;
		PAUSE_LEVELS.long =Settings.getValue("narration.pause_long") ?? PAUSE_LEVELS.long;
	}

	function _formatErrorText(narration, error) {
		console.error(`Failed to render narration (action=${narration.action}, instigator=${narration.instigator}):`, error);
		return `⚠ COULD NOT RENDER [${narration.action ?? "?"} / ${narration.instigator ?? "?"}]: ${error?.message ?? String(error)}`;
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