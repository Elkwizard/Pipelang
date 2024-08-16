class AST {
	static REPLACE_KEY = Symbol("replace");
	static START_KEY = Symbol("start");
	static END_KEY = Symbol("end");
	static TOKENS_KEY = Symbol("tokens");

	constructor(startIndex) {
		this[AST.START_KEY] = startIndex;
	}

	set textContent(value) {
		this._textContent = value;
	}

	get textContent() {
		if (this._textContent === undefined) {
			const { START_KEY, END_KEY, TOKENS_KEY } = AST;
			if (!(START_KEY in this && END_KEY in this && TOKENS_KEY in this))
				return "";
			const start = this[TOKENS_KEY][this[START_KEY]];
			const end = this[TOKENS_KEY][this[END_KEY]];
			this._textContent = start.source.slice(
				start.position,
				end.position + end.content.length
			);
		}

		return this._textContent;
	}

	finalize(tokens) {
		const { REPLACE_KEY, TOKENS_KEY } = AST;
		const replacement = this[REPLACE_KEY];
		if (replacement && !Object.keys(this).length)
			return this[REPLACE_KEY];
		this[TOKENS_KEY] = tokens;
		return this;
	}

	setProperty(node, value, index) {
		const { REPLACE_KEY, END_KEY } = AST;
		const key = node.label ?? REPLACE_KEY;

		const current = this[key];
		if (current !== undefined) {
			if (key === REPLACE_KEY) this[REPLACE_KEY] = null;
			else current.push(value);
		} else this[key] = node.repeated ? [value] : value;

		this[END_KEY] = index;
	}

	copy() {
		return Object.assign(new this.constructor(), this);
	}

	clear() {
		for (const key in this)
			delete this[key];
	}

	transformAll(transf) {
		return AST.transformAll(this, transf);
	}

	transform(match, transf) {
		return this.transformAll(
			node => node instanceof match ? transf(node) : node
		);
	}

	forAll(fn) {
		return AST.forAll(this, fn);
	}

	forEach(match, fn) {
		return this.forAll(node => {
			if (node instanceof match) fn(node);
		});
	}

	static make = new Proxy({}, {
		get(_, key) {
			const cls = AST[key];
			const { labels } = cls;

			return (...args) => {
				const result = new cls();
				const count = Math.min(labels.length, args.length);
				for (let i = 0; i < count; i++) {
					const value = args[i];
					if (value !== undefined)
						result[labels[i]] = value;
				}
				return result;
			};
		}
	});

	static is(value) {
		return Array.isArray(value) || value instanceof AST;
	}

	static transformAll(node, transf) {
		if (AST.is(node))
			for (const key in node) {
				const result = AST.transformAll(node[key], transf);
				if (result === false) delete node[key];
				else node[key] = result;
			}
		node = transf(node);
		return node;
	}

	static forAll(node, fn) {
		if (AST.is(node))
			for (const key in node)
				AST.forAll(node[key], fn);
		fn(node);
	}
}

const parse = (function () {
	AST.Reference = class Reference extends AST { static labels = ["name"]; }
AST.NumberValue = class NumberValue extends AST { static labels = ["value"]; }
AST.StringValue = class StringValue extends AST { static labels = ["value"]; }
AST.CharValue = class CharValue extends AST { static labels = ["value"]; }
AST.Value = class Value extends AST { static labels = []; }
AST.Field = class Field extends AST { static labels = ["key","value"]; }
AST.List = class List extends AST { static labels = ["elements"]; }
AST.Dimension = class Dimension extends AST { static labels = ["length"]; }
AST.Type = class Type extends AST { static labels = ["base","dimensions"]; }
AST.Parameter = class Parameter extends AST { static labels = ["type","name"]; }
AST.Operator = class Operator extends AST { static labels = ["parameters","body"]; }
AST.BaseExpression = class BaseExpression extends AST { static labels = []; }
AST.FromIndex = class FromIndex extends AST { static labels = ["start"]; }
AST.ToIndex = class ToIndex extends AST { static labels = ["end"]; }
AST.IndexRange = class IndexRange extends AST { static labels = ["start","end"]; }
AST.Index = class Index extends AST { static labels = []; }
AST.Arguments = class Arguments extends AST { static labels = ["arguments"]; }
AST.Property = class Property extends AST { static labels = ["key"]; }
AST.Overload = class Overload extends AST { static labels = ["overload"]; }
AST.Expression = class Expression extends AST { static labels = ["base","step"]; }
AST.Call = class Call extends AST { static labels = ["operator","arguments"]; }
AST.Alias = class Alias extends AST { static labels = ["name"]; }
AST.Reset = class Reset extends AST { static labels = ["value"]; }
AST.Step = class Step extends AST { static labels = []; }
AST.InitialCall = class InitialCall extends AST { static labels = ["operator","arguments"]; }
AST.FullExpression = class FullExpression extends AST { static labels = ["base","step"]; }
AST.Assignment = class Assignment extends AST { static labels = ["target","value"]; }
AST.Statement = class Statement extends AST { static labels = []; }
AST.Body = class Body extends AST { static labels = ["statements"]; }
AST.root = class root extends AST { static labels = []; }
	
	class ParseError {
		constructor(message, token, stack) {
			this.message = message;
			this.token = token;
			this.stack = stack;
		}
		show() {
			const stack = "\n" + this.stack.map(line => `\tat ${line}`).join("\n");
			if (this.token)
				this.token.error(`${this.message} (at '${this.token.content}')${stack}`);
			else throw new SyntaxError(this.message + stack);
		}
	}
	
	class Graph {
	constructor(label, start, end = start, repeated = false) {
		this.start = start;
		this.end = end;
		if (label) {
			this.start.label = label;
			this.end.label = label;
		}

		if (repeated)
			this.forEach(node => node.repeated = true);

		this.simplify();
	}
	get initialNodes() {
		const getInitialNodes = node => {
			if (node.match) return [node];
			return node.to.flatMap(getInitialNodes);
		};
		return getInitialNodes(this.start);
	}
	copy() {
		return Graph.hydrate(this.flatten());
	}
	forEach(fn) {
		this.start.forEach(fn);
	}
	simplify() {
		const toRemove = [];
		this.forEach(node => {
			const from = node.from.length;
			const to = node.to.length;
			if (
				!node.match &&
				!node.enclose &&
				node !== this.start &&
				node !== this.end &&
				(from <= 1 || to <= 1)
			) toRemove.push(node);
		});

		for (const node of toRemove)
			node.merge();
	}
	preprocess(definitions, asts) {
		this.astClass = asts[this.name];
		this.forEach(node => {
			if (node.reference)
				if (!node.terminal) node.match = definitions[node.match];
			for (const key in node.typeChoices)
				node.typeChoices[key] = node.typeChoices[key].map(index => node.to[index]);
			for (const key in node.literalChoices)
				node.literalChoices[key] = node.literalChoices[key].map(index => node.to[index]);
		});
	}
	categorize(definitions, types) {
		this._definitions = definitions;
		this._types = types;
		this.labels = new Set();
		this.forEach(node => {
			node._definitions = definitions;
			node._types = types;
			node._graph = this;
			if (node.reference && !(node.match in definitions))
				node.terminal = true;

			if (node.label) this.labels.add(node.label);
		});
		this.labels = [...this.labels];
		this._references = [];
		for (const key in definitions) {
			const graph = definitions[key];
			graph.forEach(node => {
				if (node.reference && node.match === this.name)
					this._references.push(node);
			});
		}
	}
	removeInitialRecursion() {
		const toRemove = this.initialNodes
			.filter(node => node.reference && node.match === this.name);

		const end = this.end;
		this.end = new Node();

		const start = this.start;
		this.start = new Node();
		this.start.connect(start);

		for (const node of toRemove) {
			node.reference = false;
			node.match = null;
			node.enclose = true;
			
			for (const from of [...node.from])
				from.replaceConnection(node, start);
			end.connect(node);
		}
		
		end.connect(this.end);

		this.simplify();
	}
	computeFastChoices() {
		this.forEach(node => node.computeFastChoices());
	}
	flatten() {
		const nodeSet = new Set();

		function search(node) {
			if (nodeSet.has(node)) return;
			nodeSet.add(node);
			node.to.map(search);
		}

		search(this.start);

		const nodes = [...nodeSet];
		const start = nodes.indexOf(this.start);
		const end = nodes.indexOf(this.end);
		const result = [];
		for (let i = 0; i < nodes.length; i++) {
			const node = { };
			const source = nodes[i];
			for (const key in source)
				if (key[0] !== "_")
					node[key] = source[key];
			node.to = node.to.map(node => nodes.indexOf(node));
			delete node.from;
			result.push(node);
		}

		return {
			nodes: result,
			start, end,
			name: this.name,
			replaced: this.replaced
		};
	}
	static hydrate(graph) {
		const nodes = graph.nodes.map(node => {
			const result = new Node(node.match);
			Object.assign(result, node);
			result.baseTo = node.to;
			result.to = [];
			return result;
		});

		for (const node of nodes) {
			for (const dst of node.baseTo)
				node.connect(nodes[dst]);
			delete node.baseTo;
		}
		
		const result = new Graph(null, nodes[graph.start], nodes[graph.end]);
		result.name = graph.name;
		result.replaced = graph.replaced;
		return result;
	}
}
	
	class Node {
	constructor(match = null) {
		this.match = match;
		this.reference = false;
		this.from = [];
		this.to = [];
		this.label = null;
		this.enclose = false;
	}
	get canComplete() {
		if (this._canComplete === undefined) {
			if (this === this._graph.end) this._canComplete = true;
			else this._canComplete = this.to.some(node => !node.match && node.canComplete);
		}

		return this._canComplete;
	}
	get initialTerminals() {
		if (!this._initialTerminals) {
			this._initialTerminals = this.computeInitialTerminals();
		}

		return this._initialTerminals;
	}
	computeInitialTerminals() {
		if (this._computingTerminals) return [];
		this._computingTerminals = true;
		const result = this.getInitialTerminals();
		this._computingTerminals = false;
		return result;
	}
	getInitialTerminals() {
		if (this._initialTerminals) return this._initialTerminals;
		
		if (!this.match) {
			if (this === this._graph.end)
				return this._graph._references
					.flatMap(ref => ref.to.flatMap(node => node.computeInitialTerminals()));
			return this.to.flatMap(node => node.computeInitialTerminals());
		}

		if (!this.reference || this.terminal)
			return [this];
		
		return this._definitions[this.match].start.computeInitialTerminals();
	}
	get initialLiterals() {
		return new Set(
			this.initialTerminals
				.filter(node => !node.reference)
				.map(node => node.match)
		);
	}
	get initialTypes() {
		return new Set(
			this.initialTerminals
				.filter(node => node.reference && node.terminal)
				.map(node => node.match)
		);
	}
	get initialTerminalTypes() {
		return new Set(
			this.initialTerminals
				.filter(node => !node.reference || node.terminal)
				.flatMap(node => {
					const { match } = node;
					if (node.terminal) return [match];
					return this.literalTypes(match);
				})
		);
	}
	literalTypes(match) {
		const types = [];
		for (const key in this._types) {
			const [regex, js] = this._types[key];
			if (regex.test(match)) {
				types.push(key);
				if (!js) break;
			}
		}
		return types;
	}
	computeFastChoices() {
		{ // types
			this.typeChoices = { };

			for (let i = 0; i < this.to.length; i++) {
				const node = this.to[i];
				for (const type of node.initialTerminalTypes)
					(this.typeChoices[type] ??= []).push(i);
			}
		}

		{ // literals
			this.literalChoices = { }; 
			
			const literals = new Set(this.to.flatMap(node => [...node.initialLiterals]));
			const typeToLiterals = { };
			for (const literal of literals)
				for (const type of this.literalTypes(literal))
					(typeToLiterals[type] ??= []).push(literal);

			for (let i = 0; i < this.to.length; i++) {
				const node = this.to[i];
				for (const literal of node.initialLiterals)
					(this.literalChoices[literal] ??= []).push(i);
				for (const type of node.initialTypes)
					for (const literal of typeToLiterals[type] ?? [])
						(this.literalChoices[literal] ??= []).push(i);
			}

			for (const key in this.literalChoices)
				this.literalChoices[key] = [...new Set(this.literalChoices[key])];
		}
	}
	replace(graph) {
		for (const from of this.from)
			from.replaceConnection(this, graph.start);
		for (const to of this.to)
			graph.end.connect(to);
	}
	becomeStart() {
		for (const from of this.from)
			from.to.splice(from.to.indexOf(this), 1);
		this.from = [];
	}
	becomeEnd() {
		for (const to of this.to)
			to.from.splice(to.from.indexOf(this), 1);
		this.to = [];
	}
	remove() {
		this.becomeStart();
		this.becomeEnd();
	}
	merge() {
		for (const from of this.from)
			from.to.splice(from.to.indexOf(this), 1, ...this.to);
		for (const to of this.to)
			to.from.splice(to.from.indexOf(this), 1, ...this.from);
	}
	validConnection(to) {
		return this.match || this !== to;
	}
	replaceConnection(find, replace) {
		if (find === replace) return;
		const valid = this.validConnection(replace);
		this.to.splice(this.to.indexOf(find), 1, ...(valid ? [replace] : []));
		find.from.splice(find.from.indexOf(this), 1);
		if (valid) replace.from.push(this);
	}
	connect(to) {
		if (!this.validConnection(to)) return;
		to.from.push(this);
		this.to.push(to);
	}
	forEach(fn, found = new Set()) {
		if (found.has(this)) return;
		found.add(this);
		fn(this);
		for (const dst of this.to)
			dst.forEach(fn, found);
	}
}
	
	class Token {
	constructor(content, type, position = 0, source = content) {
		this.content = content;
		this.type = type;
		this.position = position;
		this.source = source;
	}

	plus(token, type) {
		return new Token(
			this.content + token.content,
			type ?? this.type,
			this.position,
			this.source
		);
	}

	error(message) {
		const prefix = this.source.slice(0, this.position);
		const suffix = this.source.slice(this.position + this.content.length);
		const newSource = prefix + background("red", this.content) + suffix;
		const lines = newSource.split("\n");
		
		let index = 0;
		for (let i = 0; i < this.position; i++)
			if (this.source[i] === "\n") index++;
		
		const startIndex = Math.max(0, index - 1);

		const excerptLines = lines.slice(
			startIndex,
			Math.min(lines.length, index + 2)
		);

		const maxWidth = String(excerptLines.length + startIndex).length;

		const excerpt = excerptLines
			.map((line, i) => `${String(i + startIndex + 1).padStart(maxWidth)} | ${line}`)
			.join("\n");

		const bar = "=".repeat(40);
		const output = `\n\n${bar}\n${excerpt}\n${bar}\n${message} (line ${index + 1})\n\n`;
		throw new SyntaxError(output);
		// throw new SyntaxError(message + "\n\n" + excerpt);
	}

	toString() {
		return `(${this.type.toString()}: ${color("blue", this.content)})`;
	}
}

class TokenStream {
	constructor(tokens = []) {
		this.tokens = [...tokens].reverse();
	}

	get length() {
		return this.tokens.length;
	}

	get all() {
		return [...this.tokens].reverse();
	}

	copy() {
		return new TokenStream(this.all);
	}

	prepend(token) {
		this.tokens.push(token);
	}

	has(content, index = 0) {
		if (index >= this.tokens.length)
			return false;
		
		const token = this.tokens[this.tokens.length - index - 1];
		if (typeof content === "string")
			return token.content === content;
		return token.type === content;
	}

	hasAny(...options) {
		let index = 0;
		if (typeof options[options.length - 1] === "number")
			index = options.pop();

		for (let i = 0; i < options.length; i++)
			if (this.has(options[i], index))
				return true;

		return false;
	}

	get(index, quiet) {
		return this.getToken(index, quiet).content;
	}

	getToken(index = 0, quiet = false) {
		if (index >= this.tokens.length && !quiet)
			throw new RangeError("Desired index is out of bounds");
		return this.tokens[this.tokens.length - index - 1];
	}

	skip(amount) {
		if (amount > this.tokens.length)
			throw new RangeError("Cannot skip over tokens in an empty stream");
		this.tokens.length -= amount;
	}
	
	skipAll(tok) {
		while (this.has(tok)) this.next();
	}

	remove(content) {
		if (typeof content === "string")
			this.tokens = this.tokens.filter(token => token.content !== content);
		else
			this.tokens = this.tokens.filter(token => token.type !== content);
	}

	nextToken() {
		if (!this.tokens.length)
			throw new RangeError("Cannot advance an empty stream");

		return this.tokens.pop();
	}

	next(expected) {
		if (!this.tokens.length)
			throw new RangeError("Cannot advance an empty stream");
		
		const token = this.tokens.pop();

		if (expected !== undefined) {
			if (typeof expected === "string") {
				if (token.content !== expected)
					token.error(`Unexpected token '${token.content}', expected '${String(expected)}'`);
			} else {
				if (token.type !== expected)
					token.error(`Unexpected token '${token.content}', expected token of type '${String(expected)}'`);
			}
		}

		return token.content;
	}

	optional(content) {
		if (this.has(content)) {
			this.next();
			return true;
		}

		return false;
	}

	until(tok) {
		const result = [];
		while (this.tokens.length && !this.has(tok))
			result.push(this.nextToken());
		return new TokenStream(result);
	}

	endOf(open, close) {
		const result = [];

		this.until(open);
		if (!this.tokens.length)
			throw new RangeError(`The specified boundaries "${open}${close}" don't exist`);
		this.next();

		let depth = 1;
		while (this.tokens.length && depth) {
			if (this.has(open)) depth++;
			if (this.has(close)) depth--;
			result.push(this.nextToken());
		}

		result.pop();
		return new TokenStream(result);
	}

	delimitedList(parseItem, delimiter, interrupt) {
		const results = [];

		while (this.tokens.length) {
			results.push(parseItem(this));

			if (interrupt !== undefined && this.has(interrupt))
				break;

			if (this.tokens.length)
				this.next(delimiter);
		}

		return results;
	}

	toString() {
		return this.all.join(" ");
	}
}

class TokenStreamBuilder {
	constructor(source) {
		this.source = source;
		this.index = 0;
		this.tokens = [];
	}

	get stream() {
		return new TokenStream(this.tokens);
	}

	append(content, type) {
		const position = this.source.indexOf(content, this.index);
		this.index = position + content.length;
		this.tokens.push(new Token(content, type, position, this.source));
	}

	static regex(source, regexes) {
		const builder = new TokenStreamBuilder(source);

		tokenize: while (source.length) {
			source = source.replace(/^\s*/, "");
			for (let i = 0; i < regexes.length; i++) {
				const [regex, type, assert] = regexes[i];
				if (regex.test(source)) {
					const content = source.match(regex)[0];
					if (assert && !assert(content, builder.tokens)) continue;
					builder.append(content, type);
					source = source.slice(content.length);
					continue tokenize;
				}
			}

			if (source.length) throw new SyntaxError(`Tokenization failed at position ${builder.index}: '${source[0]}'`);
		}

		return builder.stream;
	}
}
const { color, background, indent } = (() => {
	const FOREGROUND_OFFSET = 30;
	const BACKGROUND_OFFSET = 40;
	const COLOR_MAP = {
		"black": 0,
		"red": 1,
		"green": 2,
		"yellow": 3,
		"blue": 4,
		"magenta": 5,
		"cyan": 6,
		"light gray": 7,
		"dark gray": 60,
		"light red": 61,
		"light green": 62,
		"light yellow": 63,
		"light blue": 64,
		"light magenta": 65,
		"light cyan": 66,
		"white": 67
	};
	
	function color(name, text) {
		const code = COLOR_MAP[name] + FOREGROUND_OFFSET;
		return `\x1b[${code}m${text}\x1b[0m`;
	}

	function background(name, text) {
		const code = COLOR_MAP[name] + BACKGROUND_OFFSET;
		return `\x1b[${code}m${text}\x1b[0m`;
	}
	
	function indent(str) {
		return str
			.split("\n")
			.map(line => "    " + line)
			.join("\n");
	}


	return { color, background, indent };
})();
	
	const regex = [[/^(?:\/\/.*|\/\*([\w\W]*?)\*\/)/, "comment", null], [/^(?:"((\\.)*(.*?))*?")/, "string", null], [/^(?:'\\?.')/, "char", null], [/^(?:[{}()\[\];,:.#]|\|>|(=(?!=)))/, "symbol", null], [/^(?:\-?\b(\d+\.?\d*|\.\d+)([eE][\+\-]?\d+)?\b)/, "number", null], [/^(?:\w+|\|+|[^\w\s(){}\[\]|'",:;.#]+)/, "identifier", null]];
	const types = { };
	for (const pair of regex) {
		const name = pair[1];
		types[name] = { name, toString: () => name };
		pair[1] = types[name];
	}
	
	const definitions = JSON.parse("{\"Reference\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"identifier\",\"reference\":true,\"to\":[2],\"label\":\"name\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":2,\"name\":\"Reference\"},\"NumberValue\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"number\":[0]},\"literalChoices\":{}},{\"match\":\"number\",\"reference\":true,\"to\":[2],\"label\":\"value\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":2,\"name\":\"NumberValue\"},\"StringValue\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"string\":[0]},\"literalChoices\":{}},{\"match\":\"string\",\"reference\":true,\"to\":[2],\"label\":\"value\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":2,\"name\":\"StringValue\"},\"CharValue\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"char\":[0]},\"literalChoices\":{}},{\"match\":\"char\",\"reference\":true,\"to\":[2],\"label\":\"value\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":2,\"name\":\"CharValue\"},\"Value\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"number\":[0],\"string\":[1],\"char\":[2]},\"literalChoices\":{}},{\"match\":\"NumberValue\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"StringValue\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":\"CharValue\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}}],\"start\":0,\"end\":2,\"name\":\"Value\"},\"Field\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"identifier\",\"reference\":true,\"to\":[2],\"label\":\"key\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\":\":[0]}},{\"match\":\":\",\"reference\":false,\"to\":[3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[4],\"label\":\"value\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0]},\"literalChoices\":{\",\":[0],\"}\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"Field\"},\"List\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"{\":[0]}},{\"match\":\"{\",\"reference\":false,\"to\":[2,4,6,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1,3],\"identifier\":[0,2],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0],\"}\":[1,3]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[3,2,4],\"label\":\"elements\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1,2],\"identifier\":[1],\"number\":[1],\"string\":[1],\"char\":[1]},\"literalChoices\":{\",\":[0],\"[\":[1],\"{\":[1],\"}\":[2]}},{\"match\":\",\",\"reference\":false,\"to\":[2],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"}\",\"reference\":false,\"to\":[5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"Field\",\"reference\":true,\"to\":[7,6,4],\"label\":\"elements\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,2],\"identifier\":[1]},\"literalChoices\":{\",\":[0],\"}\":[2]}},{\"match\":\",\",\"reference\":false,\"to\":[6],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}}],\"start\":0,\"end\":5,\"name\":\"List\"},\"Dimension\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"(\":[0]}},{\"match\":\"(\",\"reference\":false,\"to\":[2,3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"number\":[0],\"symbol\":[1]},\"literalChoices\":{\")\":[1]}},{\"match\":\"number\",\"reference\":true,\"to\":[3],\"label\":\"length\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":\")\",\"reference\":false,\"to\":[4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0]},\"literalChoices\":{\"(\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"Dimension\"},\"Type\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,4,5,6],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1,2,3]},\"literalChoices\":{\"any\":[0],\"real\":[1],\"operator\":[2],\"primitive\":[3]}},{\"match\":\"any\",\"reference\":false,\"to\":[2,3],\"label\":\"base\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[1]},\"literalChoices\":{\"(\":[0]}},{\"match\":\"Dimension\",\"reference\":true,\"to\":[2,3],\"label\":\"dimensions\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[1]},\"literalChoices\":{\"(\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"real\",\"reference\":false,\"to\":[2,3],\"label\":\"base\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[1]},\"literalChoices\":{\"(\":[0]}},{\"match\":\"operator\",\"reference\":false,\"to\":[2,3],\"label\":\"base\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[1]},\"literalChoices\":{\"(\":[0]}},{\"match\":\"primitive\",\"reference\":false,\"to\":[2,3],\"label\":\"base\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[1]},\"literalChoices\":{\"(\":[0]}}],\"start\":0,\"end\":3,\"name\":\"Type\"},\"Parameter\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1]},\"literalChoices\":{\"any\":[0,1],\"real\":[0,1],\"operator\":[0,1],\"primitive\":[0,1]}},{\"match\":\"Type\",\"reference\":true,\"to\":[2],\"label\":\"type\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"identifier\",\"reference\":true,\"to\":[3],\"label\":\"name\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\",\":[0],\"=\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"Parameter\"},\"Operator\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"[\":[0]}},{\"match\":\"[\",\"reference\":false,\"to\":[2,4,5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,2],\"symbol\":[1,2],\"number\":[2],\"string\":[2],\"char\":[2]},\"literalChoices\":{\"any\":[0,2],\"real\":[0,2],\"operator\":[0,2],\"primitive\":[0,2],\"=\":[1],\"[\":[2],\"{\":[2]}},{\"match\":\"Parameter\",\"reference\":true,\"to\":[3,4],\"label\":\"parameters\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1]},\"literalChoices\":{\",\":[0],\"=\":[1]}},{\"match\":\",\",\"reference\":false,\"to\":[2],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{\"any\":[0],\"real\":[0],\"operator\":[0],\"primitive\":[0]}},{\"match\":\"=\",\"reference\":false,\"to\":[5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"symbol\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Body\",\"reference\":true,\"to\":[6],\"label\":\"body\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"]\":[0]}},{\"match\":\"]\",\"reference\":false,\"to\":[7],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":7,\"name\":\"Operator\"},\"BaseExpression\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3,4,5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[2],\"number\":[3],\"string\":[3],\"char\":[3]},\"literalChoices\":{\"[\":[0],\"{\":[1]}},{\"match\":\"Operator\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"List\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":\"Reference\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":\"Value\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}}],\"start\":0,\"end\":2,\"name\":\"BaseExpression\"},\"FromIndex\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2],\"label\":\"start\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\":\":[0]}},{\"match\":\":\",\"reference\":false,\"to\":[3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"FromIndex\"},\"ToIndex\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\":\":[0]}},{\"match\":\":\",\"reference\":false,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[3],\"label\":\"end\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"ToIndex\"},\"IndexRange\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2],\"label\":\"start\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\":\":[0]}},{\"match\":\":\",\"reference\":false,\"to\":[3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[4],\"label\":\"end\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"IndexRange\"},\"Index\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1,2],\"identifier\":[1,2],\"number\":[1,2],\"string\":[1,2],\"char\":[1,2]},\"literalChoices\":{\":\":[0],\"[\":[1,2],\"{\":[1,2]}},{\"match\":\"ToIndex\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"IndexRange\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":\"FromIndex\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}}],\"start\":0,\"end\":2,\"name\":\"Index\"},\"Arguments\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0],\")\":[1]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2,1,3],\"label\":\"arguments\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1,2],\"identifier\":[1],\"number\":[1],\"string\":[1],\"char\":[1]},\"literalChoices\":{\",\":[0],\"[\":[1],\"{\":[1],\")\":[2]}},{\"match\":\",\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"Arguments\"},\"Property\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\".\":[0]}},{\"match\":\".\",\"reference\":false,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"identifier\",\"reference\":true,\"to\":[3],\"label\":\"key\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"Property\"},\"Overload\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{\"&\":[0]}},{\"match\":\"&\",\"reference\":false,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[3],\"label\":\"overload\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"Overload\"},\"Expression\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"BaseExpression\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[3,10],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1]},\"literalChoices\":{\"(\":[0,1],\".\":[0,1],\"&\":[0,1],\",\":[1],\"}\":[1],\"[\":[1],\"{\":[1],\":\":[1],\")\":[1],\"|>\":[1],\";\":[1],\"]\":[1]}},{\"match\":null,\"reference\":false,\"to\":[4,8,9],\"label\":\"base\",\"enclose\":true,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[2]},\"literalChoices\":{\"(\":[0],\".\":[1],\"&\":[2]}},{\"match\":\"(\",\"reference\":false,\"to\":[5,7],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0,1],\"number\":[0,1],\"string\":[0,1],\"char\":[0,1]},\"literalChoices\":{\":\":[0],\"[\":[0,1],\"{\":[0,1],\")\":[1]}},{\"match\":\"Index\",\"reference\":true,\"to\":[6],\"label\":\"step\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":\")\",\"reference\":false,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":\"Arguments\",\"reference\":true,\"to\":[6],\"label\":\"step\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":\"Property\",\"reference\":true,\"to\":[2],\"label\":\"step\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":\"Overload\",\"reference\":true,\"to\":[2],\"label\":\"step\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"{\":[0],\":\":[0],\")\":[0],\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":10,\"name\":\"Expression\"},\"Call\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2,3],\"label\":\"operator\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0],\"|>\":[1],\";\":[1],\"]\":[1]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2,3],\"label\":\"arguments\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0],\"|>\":[1],\";\":[1],\"]\":[1]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"Call\"},\"Alias\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{\"is\":[0]}},{\"match\":\"is\",\"reference\":false,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"identifier\",\"reference\":true,\"to\":[3],\"label\":\"name\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"Alias\"},\"Reset\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{\"to\":[0]}},{\"match\":\"to\",\"reference\":false,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[3],\"label\":\"value\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"Reset\"},\"Step\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1,2],\"symbol\":[2],\"number\":[2],\"string\":[2],\"char\":[2]},\"literalChoices\":{\"is\":[0,2],\"to\":[1,2],\"[\":[2],\"{\":[2]}},{\"match\":\"Alias\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"Reset\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":\"Call\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0],\";\":[0],\"]\":[0]}}],\"start\":0,\"end\":2,\"name\":\"Step\"},\"InitialCall\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2],\"label\":\"operator\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2,3],\"label\":\"arguments\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0],\"|>\":[1],\";\":[1],\"]\":[1]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"InitialCall\"},\"FullExpression\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,7],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0,1],\"number\":[0,1],\"string\":[0,1],\"char\":[0,1]},\"literalChoices\":{\"[\":[0,1],\"{\":[0,1]}},{\"match\":\"InitialCall\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[3,6],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1]},\"literalChoices\":{\"|>\":[0],\";\":[1],\"]\":[1]}},{\"match\":null,\"reference\":false,\"to\":[4],\"label\":\"base\",\"enclose\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0]}},{\"match\":\"|>\",\"reference\":false,\"to\":[5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"symbol\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"is\":[0],\"to\":[0],\"[\":[0],\"{\":[0]}},{\"match\":\"Step\",\"reference\":true,\"to\":[2],\"label\":\"step\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0],\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0],\";\":[0],\"]\":[0]}}],\"start\":0,\"end\":6,\"name\":\"FullExpression\"},\"Assignment\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"identifier\",\"reference\":true,\"to\":[2],\"label\":\"target\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"=\":[0]}},{\"match\":\"=\",\"reference\":false,\"to\":[3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"FullExpression\",\"reference\":true,\"to\":[4],\"label\":\"value\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"Assignment\"},\"Statement\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"symbol\":[1],\"number\":[1],\"string\":[1],\"char\":[1]},\"literalChoices\":{\"[\":[1],\"{\":[1]}},{\"match\":\"Assignment\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\";\":[0],\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"FullExpression\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\";\":[0],\"]\":[0]}}],\"start\":0,\"end\":2,\"name\":\"Statement\"},\"Body\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"symbol\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Statement\",\"reference\":true,\"to\":[2,3,4],\"label\":\"statements\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1,2]},\"literalChoices\":{\";\":[0,1],\"]\":[2]}},{\"match\":\";\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0],\"symbol\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\";\",\"reference\":false,\"to\":[4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"Body\"},\"root\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"symbol\":[0],\"number\":[0],\"string\":[0],\"char\":[0]},\"literalChoices\":{\"[\":[0],\"{\":[0]}},{\"match\":\"Body\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":2,\"name\":\"root\"}}");
	const definitionNames = ["Reference","NumberValue","StringValue","CharValue","Value","Field","List","Dimension","Type","Parameter","Operator","BaseExpression","FromIndex","ToIndex","IndexRange","Index","Arguments","Property","Overload","Expression","Call","Alias","Reset","Step","InitialCall","FullExpression","Assignment","Statement","Body","root"];
	for (const name of definitionNames)
		definitions[name] = Graph.hydrate(definitions[name]);

	for (const name of definitionNames)
		definitions[name].preprocess(definitions, AST);
	
	function parse(source) {
		source = source.replace(/\r/g, "");
		const stream = TokenStreamBuilder.regex(source, regex);

		if ("comment" in types)
			stream.remove(types.comment);
		
		const tokens = stream.all;

		let lastErrorPosition = -1;
		let lastError = null;
		let termStack = [];
	
		function error(message, index) {
			const position = index ?? 0;
			if (position > lastErrorPosition) {
				lastErrorPosition = position;
				const index = Math.min(position, tokens.length - 1);
				const token = index < 0 ? null : tokens[index];
				lastError = new ParseError(message, token, [...termStack]);
			}
	
			return null;
		}

		function matchTerm(graph, index) {
			termStack.push(graph.name);
			const match = matchFromNode(new graph.astClass(index), graph.start, index);
			termStack.pop();
	
			if (match === null)
				return null;
	
			match[0] = match[0].finalize(tokens);

			return match;
		}
	
		function matchFromNode(result, node, index) {
			while (true) {
				const match = matchNode(result, node, index);
		
				if (match === null)
					return null;
		
				if (node.to.length === 0) {
					if (termStack.length === 1 && match < tokens.length)
						return error(`Grammar couldn't explain complete input`, index);
					return [result, match];
				}

				const token = tokens[match];
				let { to } = node;
				if (token) {
					to = node.literalChoices[token.content] ?? node.typeChoices[token.type.name];
					if (to === undefined)
						return error("Unexpected token", match);
					
					if (to.length > 1) {
						for (let i = 0; i < to.length; i++) {
							const subMatch = matchFromNode(result.copy(), to[i], match);
							if (subMatch !== null) return subMatch;
						}

						return null;
					}
				}
	
				node = to[to.length - 1];
				index = match;
			}
		}
	
		function matchNode(result, node, index) {
			const { match } = node;
			
			if (match === null) {
				if (node.enclose) {
					const enclosed = result.copy().finalize();
					result.clear();
					result.setProperty(node, enclosed, index);
				}
				return index;
			}
	
			const token = tokens[index];

			if (!token) 
				return error("Unexpected end of input", index);

			let value;

			if (node.reference) {
				if (node.terminal) {
					if (token.type.name === match) {
						value = token.content;
						index++;
					} else return error(`Unexpected token, expected a token of type '${match}'`, index);
				} else {
					const term = matchTerm(match, index);
					if (term === null) return null;

					value = term[0];
					index = term[1];
				}
			} else {
				if (token.content === match) {
					value = token.content;
					index++;
				} else return error(`Unexpected token, expected '${match}'`, index);
			}

			result.setProperty(node, value, index - 1);
	
			return index;
		}
	
		const result = matchTerm(definitions.root, 0);
	
		if (result === null)
			lastError.show();

		return result[0];
	}

	return parse;
})();