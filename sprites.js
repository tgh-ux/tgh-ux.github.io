/*
 * Sprite sheets.
 *
 * Owns the icon sprite sheets (cards, roles, tokens): which image each sheet uses, the sheet geometry, and creation of positioned sprite
 * elements. Each sheet image is resolved in priority order:
 *   1. files the user loaded locally (persisted in IndexedDB, see loadFiles())
 *   2. the hosted sheet under Sprites/ (language-specific where the table says so)
 *   3. the hosted placeholder sheet
 * Geometry (cell size, grid size, display scale) defaults to the --<type>-sprite-* CSS custom properties and can be overridden by a
 * manifest (sprites.json) loaded together with locally supplied sheets.
 *
 * Local files are recognized by name (case-insensitive, a trailing " (1)" from duplicate downloads is ignored): sprites.json is the
 * manifest, and each sheet is the file the manifest names in its entry's "file" field, or, failing that, the SHEETS localName of its
 * type (cards, roles, tokens) with any extension.
 */
const Sprites = (() => {

	/* =========================
	   Data
	   ========================= */

	/*
	 * Sprite sheets, one entry per sprite type.
	 *
	 *   type         - sprite type; also names the CSS custom properties --<type>-sprite + -sheet, -width, -height, -columns, -rows, -scale.
	 *   localName    - base file name that identifies a locally loaded sheet of this type.
	 *   path         - hosted asset path; %LANGUAGE% is replaced with the lower-case language code.
	 *   fallbackPath - hosted asset used when `path` cannot be loaded.
	 */
	const SHEETS = [
		{
			type: "card",
			localName: "cards",
			path: "Sprites/cards_%LANGUAGE%.jpg",
			fallbackPath: "Sprites/placeholder_cards.jpg",
		},
		{
			type: "role",
			localName: "roles",
			path: "Sprites/roles.png", // No localized sheets currently, add if needed
			fallbackPath: "Sprites/placeholder_roles.png",
		},
		{
			type: "token",
			localName: "tokens",
			path: "Sprites/tokens.png", // No localized sheets currently, add if needed
			fallbackPath: "Sprites/placeholder_tokens.png",
		},
	];

	// Sprite types, derived from the table.
	const TYPES = SHEETS.map(sheet => sheet.type);

	// Full file name of the optional geometry manifest.
	const MANIFEST_FILE = "sprites.json";

	// IndexedDB location. Sheets are stored under their type name, the parsed manifest under MANIFEST_KEY.
	const DB_NAME = "onuw_local_sprites";
	const DB_STORE = "files";
	const MANIFEST_KEY = "manifest";

	// Geometry fields a manifest entry may set; `integer` fields must be whole numbers.
	const MANIFEST_FIELDS = {
		width: { integer: false },
		height: { integer: false },
		columns: { integer: true },
		rows: { integer: true },
		scale: { integer: false }
	};

	/*
	 * Module state.
	 *
	 * language  - language code used for hosted sheet paths, set by init().
	 * db        - cached promise for the open IndexedDB database (null until first use or after a failed open).
	 * manifest  - the manifest currently applied (sanitized object), or null for the stylesheet defaults.
	 * sizes     - pixel size {width, height} of each locally loaded sheet currently applied, used to validate layout changes.
	 * urls      - object URL currently applied for each type that uses a locally loaded sheet.
	 * fileInput - hidden file input used by promptLoad(), created on first use.
	 */
	const state = {
		language: null,
		db: null,
		manifest: null,
		sizes: new Map(),
		urls: new Map(),
		fileInput: null
	};


	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		_resetState();
	}

	/**
	 * Resets the module state to its initial values.
	 */
	function _resetState() {
		state.language = null;
		state.db = null;
		state.manifest = null;
		state.sizes.clear();
		state.urls.clear();

		if (state.fileInput) {
			state.fileInput.remove();
			state.fileInput = null;
		}
	}
	
	
	_init();


	/* =========================
	   Private functions
	   ========================= */

	/* ---- CSS ---- */

	/**
	 * Builds the name of a sprite CSS custom property.
	 *
	 * @param {string} type - Sprite type.
	 * @param {string} name - Property suffix: "sheet", "width", "height", "columns", "rows", "scale", "x" or "y".
	 * @returns {string} Custom property name, e.g. "--role-sprite-width".
	 */
	function _prop(type, name) {
		return `--${type}-sprite-${name}`;
	}

	/**
	 * Reads the CSS-defined sprite-sheet geometry for a sprite type.
	 *
	 * @param {string} type - Sprite type.
	 * @returns {{width: number, height: number, scale: number, columns: number, rows: number}}
	 *     Sprite cell dimensions, display scale, and sheet dimensions in cells.
	 */
	function _getGeometry(type) {
		const styles = getComputedStyle(document.documentElement);

		return {
			width: parseFloat(styles.getPropertyValue(_prop(type, "width"))),
			height: parseFloat(styles.getPropertyValue(_prop(type, "height"))),
			scale: parseFloat(styles.getPropertyValue(_prop(type, "scale"))),
			columns: parseInt(styles.getPropertyValue(_prop(type, "columns")), 10),
			rows: parseInt(styles.getPropertyValue(_prop(type, "rows")), 10)
		};
	}

	/**
	 * Sets the CSS offsets needed to display a sprite at the specified sheet position.
	 *
	 * The type and position are recorded on the element so _refreshOffsets() can recompute them if the geometry changes later.
	 *
	 * @param {HTMLElement} el - Sprite element to update.
	 * @param {string} type - Sprite type.
	 * @param {{x: number, y: number}} position - Zero-based sprite coordinates.
	 */
	function _applyOffset(el, type, position) {
		const { width, height } = _getGeometry(type);

		el.dataset.spriteType = type;
		el.dataset.spriteX = position.x;
		el.dataset.spriteY = position.y;

		el.style.setProperty(_prop(type, "x"), `${-position.x * width}px`);
		el.style.setProperty(_prop(type, "y"), `${-position.y * height}px`);
	}

	/**
	 * Recomputes the CSS offsets of every existing sprite element against the current geometry.
	 *
	 * Needed when the geometry changes after sprites were created (e.g. a locally loaded manifest with a different cell size).
	 */
	function _refreshOffsets() {
		document.querySelectorAll(".sprite[data-sprite-type]").forEach(el => {
			_applyOffset(el, el.dataset.spriteType, { x: Number(el.dataset.spriteX), y: Number(el.dataset.spriteY) });
		});
	}

	/**
	 * Points a sprite type's CSS sheet property at an object URL, revoking the previously applied one.
	 *
	 * @param {string} type - Sprite type.
	 * @param {string} url - Object URL of the sheet image.
	 * @param {{width: number, height: number}} size - Pixel size of the image.
	 */
	function _setSheetUrl(type, url, size) {
		const previous = state.urls.get(type);

		document.documentElement.style.setProperty(_prop(type, "sheet"), `url("${url}")`);
		state.urls.set(type, url);
		state.sizes.set(type, size);

		if (previous) {
			URL.revokeObjectURL(previous);
		}
	}


	/* ---- Manifest ---- */

	/**
	 * Parses and validates a sprite geometry manifest.
	 *
	 * Expected format: an object keyed by sprite type, each holding any of file, width, height, columns, rows, scale. `file` names the
	 * sheet image among the files being loaded (a directory part is ignored); the rest are the same values as the --<type>-sprite-* CSS
	 * properties (width/height in sheet pixels, scale is the display scale). Absent types or fields keep their defaults. ...
	 *
	 * @param {string} text - Manifest file contents.
	 * @returns {{manifest: object, warnings: string[]}} The sanitized manifest and any warnings.
	 * @throws {Error} If the text is not valid JSON or not a JSON object.
	 */
	function _parseManifest(text) {
		const data = JSON.parse(text);

		if (!data || typeof data !== "object" || Array.isArray(data)) {
			throw new Error("manifest must be a JSON object");
		}

		const manifest = {};
		const warnings = [];

		for (const [type, entry] of Object.entries(data)) {
			if (!TYPES.includes(type)) {
				warnings.push(`unknown sprite type '${type}' ignored`);
				continue;
			}

			if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
				warnings.push(`entry '${type}' must be an object, ignored`);
				continue;
			}

			const geometry = {};

			for (const [field, value] of Object.entries(entry)) {
				if (field === "file") {
					const name = typeof value === "string" ? value.split(/[\\/]/).pop().trim() : "";

					if (name) {
						geometry.file = name;
					} else {
						warnings.push(`invalid value for '${type}.file' ignored`);
					}

					continue;
				}

				const spec = Object.hasOwn(MANIFEST_FIELDS, field) ? MANIFEST_FIELDS[field] : null;

				if (!spec) {
					warnings.push(`unknown field '${type}.${field}' ignored`);
				} else if (!Number.isFinite(value) || value <= 0 || (spec.integer && !Number.isInteger(value))) {
					warnings.push(`invalid value for '${type}.${field}' ignored`);
				} else {
					geometry[field] = value;
				}
			}

			manifest[type] = geometry;
		}

		return { manifest, warnings };
	}

	/**
	 * Applies a manifest's geometry to the sprite CSS custom properties.
	 *
	 * Every manifest-controllable property is first reset, so a manifest fully replaces any previous one: whatever it does not specify goes
	 * back to the stylesheet default. Pass null to reset everything.
	 *
	 * @param {object|null} manifest - Sanitized manifest from _parseManifest(), or null.
	 */
	function _applyManifest(manifest) {
		const root = document.documentElement;

		TYPES.forEach(type => {
			Object.keys(MANIFEST_FIELDS).forEach(field => {
				const value = manifest?.[type]?.[field];

				if (value !== undefined) {
					root.style.setProperty(_prop(type, field), String(value));
				} else {
					root.style.removeProperty(_prop(type, field));
				}
			});
		});
	}


	/* ---- Image handling ---- */

	/**
	 * Decodes an image blob to verify it is a usable image.
	 *
	 * @param {Blob} blob - Image file or stored blob.
	 * @returns {Promise<{url: string, width: number, height: number}>} Object URL for the blob (owned by the caller) and the image's
	 *     pixel size. Rejects if the blob cannot be decoded as an image.
	 */
	function _decodeImage(blob) {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(blob);
			const img = new Image();

			img.onload = () => resolve({ url, width: img.naturalWidth, height: img.naturalHeight });
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error("not a valid image"));
			};

			img.src = url;
		});
	}

	/**
	 * Compares an image's size with the sheet size implied by the current CSS geometry.
	 *
	 * @param {string} label - What is being checked, for the message (a file name, or e.g. "stored role sheet").
	 * @param {string} type - Sprite type.
	 * @param {number} imageWidth - Image width in pixels.
	 * @param {number} imageHeight - Image height in pixels.
	 * @returns {string|null} A description of the mismatch, or null if the sizes agree (within 1px).
	 */
	function _describeGeometryMismatch(label, type, imageWidth, imageHeight) {
		const { width, height, columns, rows } = _getGeometry(type);
		const expectedWidth = width * columns;
		const expectedHeight = height * rows;

		if (Math.abs(imageWidth - expectedWidth) <= 1 && Math.abs(imageHeight - expectedHeight) <= 1) {
			return null;
		}

		return `${label} is ${imageWidth}x${imageHeight}px but the layout (${columns}x${rows} cells of ${width}x${height}px) ` +
			`expects ${expectedWidth}x${expectedHeight}px (the layout comes from ${MANIFEST_FILE} or the CSS defaults)`;
	}

	/**
	 * Normalizes a file name for matching: lower-case, with a trailing " (1)" counter from duplicate downloads removed.
	 *
	 * @param {string} name - File name.
	 * @returns {string} Normalized name, extension included.
	 */
	function _normalizeName(name) {
		return name.toLowerCase().replace(/\s*\(\d+\)(?=\.[^.]*$|$)/, "");
	}

	/**
	 * Normalizes a file name for matching and strips its extension.
	 *
	 * @param {string} name - File name.
	 * @returns {string} Normalized name without extension, e.g. "Cards (1).JPG" -> "cards".
	 */
	function _baseName(name) {
		return _normalizeName(name).replace(/\.[^.]*$/, "");
	}


	/* ---- Storage ---- */

	/**
	 * Copies a file's bytes into a fresh in-memory blob, so the stored data does not depend on the original file on disk.
	 *
	 * @param {File} file - File chosen by the user.
	 * @returns {Promise<Blob>} Independent copy of the file's contents.
	 */
	async function _copyFile(file) {
		return new Blob([await file.arrayBuffer()], { type: file.type });
	}

	/**
	 * Opens (once) the IndexedDB database holding the local sprite files.
	 *
	 * @returns {Promise<IDBDatabase>} The open database. Rejects if IndexedDB is unavailable (e.g. some private modes).
	 */
	function _openDB() {
		if (!state.db) {
			state.db = new Promise((resolve, reject) => {
				const request = indexedDB.open(DB_NAME, 1);
				request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});

			// Allow a retry on the next call if opening failed
			state.db.catch(() => { state.db = null; });
		}

		return state.db;
	}

	/**
	 * Runs one transaction against the local sprite object store.
	 *
	 * @param {"readonly"|"readwrite"} mode - Transaction mode.
	 * @param {function(IDBObjectStore): (IDBRequest|undefined)} action - Issues the store operations; may return a request whose result is wanted.
	 * @returns {Promise<*>} The returned request's result, resolved once the transaction has completed.
	 */
	function _useStore(mode, action) {
		return _openDB().then(db => new Promise((resolve, reject) => {
			const transaction = db.transaction(DB_STORE, mode);
			const request = action(transaction.objectStore(DB_STORE));

			transaction.oncomplete = () => resolve(request ? request.result : undefined);
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		}));
	}

	/**
	 * Asks the browser to protect this origin's storage from automatic eviction. Fire-and-forget; the browser may ignore it.
	 */
	function _requestPersistence() {
		if (navigator.storage && navigator.storage.persist) {
			navigator.storage.persist().catch(() => {});
		}
	}


	/* ---- Sheet loading ---- */

	/**
	 * Applies any previously stored local sprite files and manifest.
	 *
	 * Never rejects: storage errors and corrupt entries are logged and treated as "nothing stored" for that sheet, so the caller can fall back
	 * to hosted sheets.
	 *
	 * @returns {Promise<Set<string>>} The sprite types that now use a local sheet.
	 */
	async function _loadStored() {
		
		const applied = new Set();

		try {
			const keys = [...TYPES, MANIFEST_KEY];
			const values = await Promise.all(keys.map(key =>
				_useStore("readonly", store => store.get(key)).catch(error => {
					console.warn(`Unable to read stored sprite data '${key}':`, error);
					return undefined;
				})
			));
			const stored = Object.fromEntries(keys.map((key, i) => [key, values[i]]));
			
			if (stored[MANIFEST_KEY]) {
				_applyManifest(stored[MANIFEST_KEY]);
				state.manifest = stored[MANIFEST_KEY];
			}

			await Promise.all(TYPES.map(async type => {
				if (!(stored[type] instanceof Blob)) return;

				try {
					const image = await _decodeImage(stored[type]);
					_setSheetUrl(type, image.url, { width: image.width, height: image.height });
					applied.add(type);
				} catch (error) {
					console.warn(`Stored local sprite sheet '${type}' is unusable, ignoring it:`, error);
				}
			}));

			_refreshOffsets();
		} catch (error) {
			console.warn("Unable to read locally stored sprite sheets:", error);
		}

		return applied;
	}

	/**
	 * Loads one sprite sheet from its hosted localized path, falling back to its fallback asset on failure.
	 *
	 * The CSS custom property is updated when an image loads successfully, unless a local sheet has been applied for that type in the meantime.
	 *
	 * @param {object} sheet - Entry of SHEETS.
	 */
	function _loadHosted(sheet) {
		const cssVar = _prop(sheet.type, "sheet");
		const sheetPath = sheet.path.replace(/%LANGUAGE%/, state.language.toLowerCase());
		const img = new Image();

		// Set the path if the image loads successfully
		img.onload = () => {
			if (!state.urls.has(sheet.type)) {
				document.documentElement.style.setProperty(cssVar, `url("${sheetPath}")`);
			}
		};

		// Otherwise (e.g. missing asset) fall back to the default asset
		img.onerror = () => {
			//console.warn("Unable to load localized asset '" + sheetPath + "' for sprite sheet '" + cssVar + "'");

			if (!sheet.fallbackPath) {
				console.error("No fallback asset defined");
				return;
			}

			//console.warn("Attempting to use fallback asset '" + sheet.fallbackPath + "'");
			const fallbackImg = new Image();

			fallbackImg.onload = () => {
				if (!state.urls.has(sheet.type)) {
					document.documentElement.style.setProperty(cssVar, `url("${sheet.fallbackPath}")`);
				}
			};

			fallbackImg.onerror = () => {
				console.error("Unable to load fallback asset '" + sheet.fallbackPath + "'");
			};

			fallbackImg.src = sheet.fallbackPath;
		};

		img.src = sheetPath;
	}

	/**
	 * Resolves every sheet in priority order: stored local sheets, then hosted sheets for the remaining types.
	 *
	 * @returns {Promise<void>} Resolves once local sheets are applied; hosted sheets then load asynchronously.
	 */
	function _loadSheets() {
		return _loadStored().then(localTypes => {
			SHEETS.forEach(sheet => {
				if (!localTypes.has(sheet.type)) {
					_loadHosted(sheet);
				}
			});
		});
	}
	
	/* ---- User interface ---- */

	/**
	 * Shows the outcome of a file load to the user. Kept separate so it can be replaced by proper (localized) UI later.
	 *
	 * @param {{loaded: string[], ignored: string[], warnings: string[]}} result - Result of loadFiles().
	 */
	function _report(result) {
		console.log("Sprite files loaded:", result.loaded, "ignored:", result.ignored, "unused:", result.unused);
		result.warnings.forEach(warning => console.warn("Sprite files: " + warning));

		if (result.loaded.length === 0) {
			alert("No sprite files were loaded. See the console for details.");
		} else if (result.ignored.length > 0 || result.warnings.length > 0) {
			alert("Some sprite files had problems. See the console for details.");
		}
	}

	/**
	 * Change listener of the hidden file input: loads the chosen files and reports the outcome.
	 */
	async function _onFilesChosen() {
		const files = Array.from(state.fileInput.files);
		state.fileInput.value = "";  // so choosing the same files again still triggers a change event

		if (files.length === 0) return;

		try {
			_report(await loadFiles(files));
		} catch (error) {
			console.error("Unable to load sprite files:", error);
			alert("Unable to load sprite files. See the console for details.");
		}
	}


	/* =========================
	   Public functions
	   ========================= */

	/**
	 * Initializes the module and applies the sprite sheets for the supplied language.
	 *
	 * Stored local sheets take priority; every other sheet is loaded from its hosted path, falling back to its placeholder. Sprites created
	 * before the sheets finish loading are corrected automatically when the geometry changes.
	 *
	 * @param {string} lang - Language code used to construct localized asset paths.
	 * @returns {Promise<void>} Resolves once stored local sheets are applied. Hosted sheets continue loading afterwards.
	 */
	function init(lang) {
		state.language = lang;

		return _loadSheets();
	}

	/**
	 * Creates a generic sprite element positioned at the specified sprite-sheet coordinates.
	 *
	 * Adds the common sprite classes and any additional classes supplied by the caller.
	 *
	 * @param {string} type - Sprite type: "role", "card", or "token".
	 * @param {{x: number, y: number}} position - Zero-based sprite coordinates.
	 * @param {...string} classes - Additional CSS classes.
	 * @returns {HTMLDivElement} Configured sprite element.
	 */
	function create(type, position, ...classes) {
		const el = document.createElement("div");

		el.classList.add(
			"sprite",
			`${type}-sprite`,
			...classes
		);

		_applyOffset(el, type, position);

		return el;
	}

	/**
	 * Loads user-supplied sprite files, applies them immediately, and stores them for future visits.
	 *
	 * Only the types present in `files` are replaced; sheets loaded earlier stay as they are. If a manifest is included it replaces the
	 * previously stored manifest entirely. Unrecognized, duplicate, and undecodable files are skipped and reported, never fatal.
	 *
	 * @param {FileList|File[]} files - Files chosen by the user.
	 * @returns {Promise<{loaded: string[], ignored: string[], unused: string[], warnings: string[]}>}
	 *     File names applied, skipped, and valid-but-unreferenced (only with a manifest), plus human-readable warnings (...).
	 */
	async function loadFiles(files) {
		const result = { loaded: [], ignored: [], unused: [], warnings: [] };
		const candidates = Array.from(files);

		// The manifest, if any; later duplicates win
		const manifestFiles = candidates.filter(file => _normalizeName(file.name) === MANIFEST_FILE);
		let manifestFile = manifestFiles.length > 0 ? manifestFiles[manifestFiles.length - 1] : null;
		manifestFiles.slice(0, -1).forEach(file => result.ignored.push(file.name));

		// Manifest: a bad one is reported and skipped, the images are then picked by their default names
		let manifest = null;

		if (manifestFile) {
			try {
				const parsed = _parseManifest(await manifestFile.text());
				manifest = parsed.manifest;
				parsed.warnings.forEach(warning => result.warnings.push(`${manifestFile.name}: ${warning}`));
			} catch (error) {
				result.ignored.push(manifestFile.name);
				result.warnings.push(`${manifestFile.name}: ${error.message}`);
				manifestFile = null;
			}
		}

		// Pick each type's sheet: the file the manifest names, or else the default name. Later duplicates win.
		const others = candidates.filter(file => !manifestFiles.includes(file));
		const imageFiles = new Map();
		const superseded = new Set();

		SHEETS.forEach(({ type, localName }) => {
			const named = manifest?.[type]?.file;
			let matches;

			if (named) {
				matches = others.filter(file => _normalizeName(file.name) === _normalizeName(named));

				if (matches.length === 0) {
					result.warnings.push(`${manifestFile.name}: ${type} sheet '${named}' was not among the selected files`);
				}
			} else {
				matches = others.filter(file => _baseName(file.name) === localName);
			}

			if (matches.length > 0) {
				imageFiles.set(type, matches[matches.length - 1]);
				matches.slice(0, -1).forEach(file => superseded.add(file));
			}
		});

		// Everything not picked: with a manifest the selection is expected to contain extra files, otherwise they are reported
		const picked = new Set(imageFiles.values());

		others.forEach(file => {
			if (picked.has(file)) return;

			if (superseded.has(file) || !manifest) {
				result.ignored.push(file.name);
			} else {
				result.unused.push(file.name);
			}
		});

		// Images: verify each decodes before anything is changed or stored
		const sheets = new Map();

		for (const [type, file] of imageFiles) {
			try {
				sheets.set(type, { file, ...(await _decodeImage(file)) });
			} catch (error) {
				result.ignored.push(file.name);
				result.warnings.push(`${file.name}: ${error.message}`);
			}
		}

		if (sheets.size === 0 && !manifest) {
			return result;
		}

		// Validate sheet sizes against the layout that would be in effect after this load: the new manifest if there is one (it replaces the
		// old one), otherwise the current layout. The manifest is applied only tentatively and rolled back at once; there is no await in
		// between, so nothing is painted with it.
		const mismatches = [];

		if (manifest) _applyManifest(manifest);

		const sizes = new Map(state.sizes);
		sheets.forEach((sheet, type) => sizes.set(type, { width: sheet.width, height: sheet.height }));

		sizes.forEach((size, type) => {
			if (!manifest && !sheets.has(type)) return;  // without a new manifest, only the new sheets can be inconsistent

			const label = sheets.has(type) ? sheets.get(type).file.name : `stored ${type} sheet`;
			const message = _describeGeometryMismatch(label, type, size.width, size.height);
			if (message) mismatches.push({ type, message });
		});

		if (manifest) _applyManifest(state.manifest);

		if (mismatches.length > 0) {
			mismatches.forEach(mismatch => result.warnings.push(mismatch.message));

			if (manifest) {
				// With a manifest the load is all-or-nothing: the layout and the sheets it describes must agree
				sheets.forEach(sheet => {
					URL.revokeObjectURL(sheet.url);
					result.ignored.push(sheet.file.name);
				});
				result.ignored.push(manifestFile.name);
				return result;
			}

			// Without a manifest each sheet is accepted or rejected on its own
			mismatches.forEach(({ type }) => {
				const sheet = sheets.get(type);
				URL.revokeObjectURL(sheet.url);
				result.ignored.push(sheet.file.name);
				sheets.delete(type);
			});

			if (sheets.size === 0) {
				return result;
			}
		}

		// Persist for later visits
		try {
			const entries = {};

			for (const [type, sheet] of sheets) {
				entries[type] = await _copyFile(sheet.file);
			}

			if (manifest) entries[MANIFEST_KEY] = manifest;

			await _useStore("readwrite", store => {
				Object.entries(entries).forEach(([key, value]) => store.put(value, key));
			});
			_requestPersistence();
		} catch (error) {
			console.warn("Unable to store local sprite files:", error);
			result.warnings.push("Could not store the files for later visits; they will only last until the page is reloaded");
		}

		// Apply: geometry first so offsets are computed against the new layout
		if (manifest) {
			_applyManifest(manifest);
			state.manifest = manifest;
			result.loaded.push(manifestFile.name);
		}

		sheets.forEach((sheet, type) => {
			_setSheetUrl(type, sheet.url, { width: sheet.width, height: sheet.height });
			result.loaded.push(sheet.file.name);
		});

		_refreshOffsets();

		return result;
	}

	/**
	 * Deletes all stored local sprite files and the manifest, and returns to the hosted sheets (or placeholders).
	 *
	 * Requires init() to have been called.
	 *
	 * @returns {Promise<void>} Resolves when storage is cleared and local sheets are removed; hosted sheets then load asynchronously.
	 *     Rejects if storage could not be cleared.
	 */
	async function clear() {
		await _useStore("readwrite", store => store.clear());

		const root = document.documentElement;

		state.urls.forEach((url, type) => {
			root.style.removeProperty(_prop(type, "sheet"));  // back to the stylesheet placeholder until the hosted sheet loads
			URL.revokeObjectURL(url);
		});
		state.urls.clear();
		state.sizes.clear();
		state.manifest = null;

		_applyManifest(null);
		_refreshOffsets();

		return _loadSheets();
	}
	
	/**
	 * Opens a file picker for locally stored sprite files (cards, roles, tokens, and optionally sprites.json), loads the chosen files, and
	 * reports the outcome to the user. Must be called from a user gesture such as a click handler.
	 */
	function promptLoad() {
		if (!state.fileInput) {
			state.fileInput = document.createElement("input");
			state.fileInput.type = "file";
			state.fileInput.multiple = true;
			state.fileInput.accept = "image/*,.json,application/json";
			state.fileInput.hidden = true;
			state.fileInput.addEventListener("change", _onFilesChosen);
			document.body.appendChild(state.fileInput);  // kept in the DOM so the change event isn't lost on some browsers
		}

		state.fileInput.click();
	}

	/**
	 * Asks for confirmation, then deletes the stored local sprite files and returns to the hosted sheets (or placeholders).
	 */
	async function promptClear() {
		if (!confirm("Remove the stored sprite files and return to the default sprites?")) return;

		try {
			await clear();
		} catch (error) {
			console.error("Unable to clear stored sprite files:", error);
			alert("Unable to clear stored sprite files. See the console for details.");
		}
	}


	return {
		init,
		create,
		loadFiles,
		clear,
		promptLoad,
		promptClear
	};

})();