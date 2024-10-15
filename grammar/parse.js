class AST {
	static REPLACE_KEY = Symbol("replace");
	static START_KEY = Symbol("start");
	static END_KEY = Symbol("end");
	static TOKENS_KEY = Symbol("tokens");
	
	#textContent;

	constructor(startIndex) {
		this[AST.START_KEY] = startIndex;
	}

	set textContent(value) {
		this.#textContent = value;
	}

	get textContent() {
		if (this.#textContent === undefined) {
			const { START_KEY, END_KEY, TOKENS_KEY } = AST;
			if (!(START_KEY in this && END_KEY in this && TOKENS_KEY in this))
				return "";
			const start = this[TOKENS_KEY][this[START_KEY]];
			const end = this[TOKENS_KEY][this[END_KEY]];
			this.#textContent = start.source.slice(
				start.position,
				end.position + end.content.length
			);
		}

		return this.#textContent;
	}

	finalize(tokens) {
		const { REPLACE_KEY, TOKENS_KEY } = AST;

		const { replace } = this;
		if (replace) return replace;

		const replacement = this[REPLACE_KEY];
		if (replacement && !Object.keys(this).length)
			return replacement;

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
	
	from(node) {
		this.textContent = node.textContent;
		return this;
	}

	transformAll(transf) {
		return AST.transformAll(this, transf);
	}

	transform(match, transf) {
		return this.transformAll(
			node => AST.match(node, match) ? transf(node) : node
		);
	}

	forAll(fn, afterFn) {
		AST.forAll(this, fn, afterFn);
	}

	forEach(match, fn, afterFn) {
		this.forAll(node => {
			if (AST.match(node, match))
				return fn(node);
		}, afterFn ? node => {
			if (AST.match(node, match))
				afterFn(node);
		} : undefined);
	}

	#getPrintKey(key, repeat) {
		const value = this[key];
		return repeat ? value?.[repeat.index] : value; 
	}

	#print(printer, repeat) {
		if (typeof printer === "string")
			return [printer];

		if (Array.isArray(printer)) {
			const result = [];
			for (const element of printer)
				result.push(...this.#print(element, repeat));
			return result;
		}

		if (printer.key) {
			const result = this.#getPrintKey(printer.key, repeat);
			if (repeat) repeat.value = result;

			if (result !== undefined && printer.type) {
				const Type = AST[printer.type];
				if (Type && !(result instanceof Type)) {
					const ast = new Type();
					ast.replace = result;
					return [ast];
				}
			}

			return [result ?? ""];
		}

		if (printer.options) {
			for (const option of printer.options)
				if (option[0].some(key => this[key]))
					return this.#print(option[1], repeat);
			for (const option of printer.options) {
				const { key, type } = option[1];
				const ast = AST[type];
				const value = this.#getPrintKey(key, repeat);
				if (value === undefined) continue;
				if (
					(!ast && typeof value === "string") ||
					(ast && ast.replacements.includes(value.constructor.name))
				) return this.#print(option[1], repeat);
			}
			return this.#print(printer.options.at(-1)[1], repeat);
		}

		if (printer.repeat) {
			const repeat = { index: 0, value: null };
			const result = [];
			while (true) {
				const step = this.#print(printer.repeat, repeat);
				if (repeat.value === undefined) break;

				if (repeat.index && printer.delimiter) {
					repeat.index--;
					result.push(...this.#print(printer.delimiter, repeat));
					repeat.index++;
				}

				result.push(...step);
				repeat.index++;
			}
			return result;
		}
	}

	joinStrings(strs) {
		return strs.join(" ");
	}

	toString() {
		return this.joinStrings(
			this.#print(this.constructor.printer).map(String)
		);
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

	static match(node, cls) {
		if (Array.isArray(cls)) return cls.some(one => node instanceof one);
		return node instanceof cls;
	}

	static is(value) {
		return Array.isArray(value) || value instanceof AST;
	}

	static transformAll(node, transf) {
		const result = transf(node);
		if (result === false) return node;
		node = result;
		if (AST.is(node)) {
			for (const key in node) {
				const init = node[key];
				const result = AST.transformAll(init, transf);
				if (result === false) delete node[key];
				else if (result !== init) node[key] = result;
			}
		}
		return node;
	}

	static forAll(node, fn, afterFn) {
		if (fn(node) === false) return;
		if (AST.is(node))
			for (const key in node)
				AST.forAll(node[key], fn, afterFn);
		afterFn?.(node);
	}
}

const parse = (function () {
	AST.Reference = class Reference extends AST { static labels = ["name"]; };
AST.NumberValue = class NumberValue extends AST { static labels = ["value"]; };
AST.StringValue = class StringValue extends AST { static labels = ["value"]; };
AST.CharValue = class CharValue extends AST { static labels = ["value"]; };
AST.Value = class Value extends AST { static labels = []; };
AST.Field = class Field extends AST { static labels = ["key","value"]; };
AST.List = class List extends AST { static labels = ["elements"]; };
AST.Parameter = class Parameter extends AST { static labels = ["type","name","value","guard"]; };
AST.Operator = class Operator extends AST { static labels = ["parameters","body"]; };
AST.Nested = class Nested extends AST { static labels = ["replace"]; };
AST.BaseExpression = class BaseExpression extends AST { static labels = []; };
AST.Index = class Index extends AST { static labels = ["start","end"]; };
AST.Arguments = class Arguments extends AST { static labels = ["arguments"]; };
AST.Property = class Property extends AST { static labels = ["key"]; };
AST.Overload = class Overload extends AST { static labels = ["overload"]; };
AST.Suffix = class Suffix extends AST { static labels = []; };
AST.Expression = class Expression extends AST { static labels = ["base","step"]; };
AST.Prefix = class Prefix extends AST { static labels = ["op","target"]; };
AST.Composition = class Composition extends AST { static labels = ["left","op","right"]; };
AST.Exponential = class Exponential extends AST { static labels = ["left","op","right"]; };
AST.Product = class Product extends AST { static labels = ["left","op","right"]; };
AST.Sum = class Sum extends AST { static labels = ["left","op","right"]; };
AST.Type = class Type extends AST { static labels = ["left","op","right"]; };
AST.Compare = class Compare extends AST { static labels = ["left","op","right"]; };
AST.Logic = class Logic extends AST { static labels = ["left","op","right"]; };
AST.Conditional = class Conditional extends AST { static labels = ["condition","ifTrue","ifFalse"]; };
AST.Pipe = class Pipe extends AST { static labels = ["source","step"]; };
AST.Assignment = class Assignment extends AST { static labels = ["isClass","target","op","value"]; };
AST.Precedence = class Precedence extends AST { static labels = []; };
AST.ListDestructure = class ListDestructure extends AST { static labels = ["names"]; };
AST.DestructureField = class DestructureField extends AST { static labels = ["key","name"]; };
AST.ObjectDestructure = class ObjectDestructure extends AST { static labels = ["fields"]; };
AST.WrappedName = class WrappedName extends AST { static labels = ["name"]; };
AST.Name = class Name extends AST { static labels = []; };
AST.Alias = class Alias extends AST { static labels = ["overload","isClass","name"]; };
AST.Reset = class Reset extends AST { static labels = ["value"]; };
AST.Call = class Call extends AST { static labels = ["operator","arguments"]; };
AST.Link = class Link extends AST { static labels = ["name","source"]; };
AST.Body = class Body extends AST { static labels = ["statements"]; };
AST.root = class root extends AST { static labels = []; };
	
	class ParseError {
		constructor(message, token, stack) {
			this.message = message;
			this.token = token;
			this.stack = stack;
		}
		show() {
			const stack = "\n" + this.stack.map(line => `\tat ${line}`).reverse().join("\n");
			if (this.token)
				this.token.error(`${this.message} (at '${this.token.content}')${stack}`);
			else throw new SyntaxError(this.message + stack);
		}
	}
	
	class Graph {
		constructor(name, start, end, nodes) {
			this.name = name;
			this.start = start;
			this.end = end;
			this.nodes = nodes;
		}
		preprocess() {
			this.astClass = AST[this.name];
			for (const node of this.nodes) {
				if (node.reference)
					if (!node.terminal) node.match = definitions[node.match];
				for (const key in node.typeChoices)
					node.typeChoices[key] = node.typeChoices[key].map(index => node.to[index]);
				for (const key in node.literalChoices)
					node.literalChoices[key] = node.literalChoices[key].map(index => node.to[index]);
			}
		}
		static hydrate({ nodes, start, end, name }) {
			for (const node of nodes)
				node.to = node.to.map(inx => nodes[inx]);
			
			return new Graph(name, nodes[start], nodes[end], nodes);
		}
	}
	
	class TokenStream {
		constructor(tokens) {
			this.all = tokens;
		}
		remove(type) {
			this.all = this.all.filter(tok => tok.type !== type);
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
})();class Token {
	constructor(content, type, position = 0, source = content) {
		this.content = content;
		this.type = type;
		this.position = position;
		this.source = source;
	}
	
	get location() {
		if (!this._location) {
			const before = this.source.slice(0, this.position);
			const line = (before.match(/\n/g)?.length ?? 0) + 1;
			const column = before.match(/.*$/)[0].length;
			this._location = { line, column };
		}

		return this._location;
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
}class TokenStreamBuilder {
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

	const regex = [[/^(?:\s+|\/\/.*|\/\*([\w\W]*?)\*\/)/, "comment", null], [/^(?:"((\\.)*([\w\W]*?))*?")/, "string", null], [/^(?:'\\?.')/, "char", null], [/^(?:[{}()\[\];,:.]|\|>|(=(?!=)))/, "symbol", null], [/^(?:\-?\b(\d+(\.\d+)?|\.\d+)([eE][\+\-]?\d+)?\b)/, "number", null], [/^(?:\w+|\|+|[^\w\s(){}\[\]|'",:;.$]+|\$)/, "identifier", null]];
	const types = { };
	const hidden = new Set(["comment"]);
	for (const pair of regex) {
		const name = pair[1];
		types[name] = { name, toString: () => name };
		pair[1] = types[name];
	}
	
	const { definitions, printers, replacements } = JSON.parse("{\"definitions\":{\"Reference\":{\"nodes\":[{\"match\":\"identifier\",\"reference\":true,\"to\":[1],\"label\":\"name\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":1,\"name\":\"Reference\"},\"NumberValue\":{\"nodes\":[{\"match\":\"number\",\"reference\":true,\"to\":[1],\"label\":\"value\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":1,\"name\":\"NumberValue\"},\"StringValue\":{\"nodes\":[{\"match\":\"string\",\"reference\":true,\"to\":[1],\"label\":\"value\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":1,\"name\":\"StringValue\"},\"CharValue\":{\"nodes\":[{\"match\":\"char\",\"reference\":true,\"to\":[1],\"label\":\"value\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":1,\"name\":\"CharValue\"},\"Value\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"number\":[0],\"string\":[1],\"char\":[2]},\"literalChoices\":{}},{\"match\":\"NumberValue\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"StringValue\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"CharValue\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}}],\"start\":0,\"end\":2,\"name\":\"Value\"},\"Field\":{\"nodes\":[{\"match\":\"identifier\",\"reference\":true,\"to\":[1],\"label\":\"key\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\":\":[0]}},{\"match\":\":\",\"reference\":false,\"to\":[2,3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0,1]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0,1],\"/\":[0,1],\"!\":[0,1],\"++\":[0,1],\"--\":[0,1],\"class\":[0,1],\"}\":[1],\",\":[1]}},{\"match\":\"Precedence\",\"reference\":true,\"to\":[3],\"label\":\"value\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"symbol\":[0]},\"literalChoices\":{\"}\":[0],\",\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"Field\"},\"List\":{\"nodes\":[{\"match\":\"{\",\"reference\":false,\"to\":[1,3,5,3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,2],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0,1,3]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0,2],\"/\":[0,2],\"!\":[0,2],\"++\":[0,2],\"--\":[0,2],\"class\":[0,2],\"}\":[1,3]}},{\"match\":\"Precedence\",\"reference\":true,\"to\":[2,1,3],\"label\":\"elements\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1,2],\"identifier\":[1],\"number\":[1],\"string\":[1],\"char\":[1]},\"literalChoices\":{\",\":[0],\"{\":[1],\"[\":[1],\"(\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"class\":[1],\"}\":[2]}},{\"match\":\",\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0]}},{\"match\":\"}\",\"reference\":false,\"to\":[4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"Field\",\"reference\":true,\"to\":[6,5,3],\"label\":\"elements\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,2],\"identifier\":[1]},\"literalChoices\":{\",\":[0],\"}\":[2]}},{\"match\":\",\",\"reference\":false,\"to\":[5],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"List\"},\"Parameter\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0,1]},\"literalChoices\":{\"{\":[0,1],\"[\":[0,1],\"(\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2],\"label\":\"type\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0]}},{\"match\":\"Name\",\"reference\":true,\"to\":[3,5,7],\"label\":\"name\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0,2],\"identifier\":[1]},\"literalChoices\":{\":\":[0],\"where\":[1],\",\":[2],\"=\":[2]}},{\"match\":\":\",\"reference\":false,\"to\":[4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Pipe\",\"reference\":true,\"to\":[5,7],\"label\":\"value\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"symbol\":[1]},\"literalChoices\":{\"where\":[0],\",\":[1],\"=\":[1]}},{\"match\":\"where\",\"reference\":false,\"to\":[6],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Pipe\",\"reference\":true,\"to\":[7],\"label\":\"guard\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\",\":[0],\"=\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":7,\"name\":\"Parameter\"},\"Operator\":{\"nodes\":[{\"match\":\"[\",\"reference\":false,\"to\":[1,3,7],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,2],\"number\":[0,2],\"string\":[0,2],\"char\":[0,2],\"symbol\":[0,1,2]},\"literalChoices\":{\"{\":[0,2],\"[\":[0,2],\"(\":[0,2],\"-\":[0,2],\"/\":[0,2],\"!\":[0,2],\"++\":[0,2],\"--\":[0,2],\"class\":[0,2],\"=\":[1]}},{\"match\":\"Parameter\",\"reference\":true,\"to\":[2,3],\"label\":\"parameters\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1]},\"literalChoices\":{\",\":[0],\"=\":[1]}},{\"match\":\",\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0]}},{\"match\":\"=\",\"reference\":false,\"to\":[4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0],\"link\":[0]}},{\"match\":\"Body\",\"reference\":true,\"to\":[5],\"label\":\"body\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"]\":[0]}},{\"match\":\"]\",\"reference\":false,\"to\":[6],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"Precedence\",\"reference\":true,\"to\":[5],\"label\":\"body\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"]\":[0]}}],\"start\":0,\"end\":6,\"name\":\"Operator\"},\"Nested\":{\"nodes\":[{\"match\":\"(\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0]}},{\"match\":\"Precedence\",\"reference\":true,\"to\":[2],\"label\":\"replace\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":\")\",\"reference\":false,\"to\":[3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"Nested\"},\"BaseExpression\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3,4,5,6],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1,2],\"identifier\":[3],\"number\":[4],\"string\":[4],\"char\":[4]},\"literalChoices\":{\"(\":[0],\"[\":[1],\"{\":[2]}},{\"match\":\"Nested\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"Operator\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"List\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"Reference\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"Value\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}}],\"start\":0,\"end\":2,\"name\":\"BaseExpression\"},\"Index\":{\"nodes\":[{\"match\":\"(\",\"reference\":false,\"to\":[1,2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0,1]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0],\":\":[1]}},{\"match\":\"Precedence\",\"reference\":true,\"to\":[2],\"label\":\"start\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\":\":[0]}},{\"match\":\":\",\"reference\":false,\"to\":[3,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0,1]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0],\")\":[1]}},{\"match\":\"Precedence\",\"reference\":true,\"to\":[4],\"label\":\"end\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\")\":[0]}},{\"match\":\")\",\"reference\":false,\"to\":[5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":5,\"name\":\"Index\"},\"Arguments\":{\"nodes\":[{\"match\":\"(\",\"reference\":false,\"to\":[1,3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0,1]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0],\")\":[1]}},{\"match\":\"Precedence\",\"reference\":true,\"to\":[2,3],\"label\":\"arguments\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1]},\"literalChoices\":{\",\":[0],\")\":[1]}},{\"match\":\",\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0]}},{\"match\":\")\",\"reference\":false,\"to\":[4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"Arguments\"},\"Property\":{\"nodes\":[{\"match\":\".\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"identifier\",\"reference\":true,\"to\":[2],\"label\":\"key\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":2,\"name\":\"Property\"},\"Overload\":{\"nodes\":[{\"match\":\"&\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2],\"label\":\"overload\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":2,\"name\":\"Overload\"},\"Suffix\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3,4,5,6],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1,2],\"identifier\":[3],\"Cast\":[4]},\"literalChoices\":{\"(\":[0,1],\".\":[2],\"&\":[3]}},{\"match\":\"Arguments\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"Index\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"Property\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"Overload\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"Cast\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}}],\"start\":0,\"end\":2,\"name\":\"Suffix\"},\"Expression\":{\"nodes\":[{\"match\":\"BaseExpression\",\"reference\":true,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[2,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0,1],\"Cast\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1]},\"literalChoices\":{\"(\":[0,1],\".\":[0,1],\"&\":[0,1],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\")\":[1],\":\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"of\":[1],\"^\":[1],\"**\":[1],\"*\":[1],\"%\":[1],\"+\":[1],\"#\":[1],\"in\":[1],\"==\":[1],\"!=\":[1],\"===\":[1],\"!==\":[1],\"<\":[1],\"<=\":[1],\">\":[1],\">=\":[1],\"&&\":[1],\"||\":[1],\"??\":[1],\"?\":[1],\"|>\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":false,\"to\":[3],\"label\":\"base\",\"enclose\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0],\"Cast\":[0]},\"literalChoices\":{\"(\":[0],\".\":[0],\"&\":[0]}},{\"match\":\"Suffix\",\"reference\":true,\"to\":[1],\"label\":\"step\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0],\"Cast\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\".\":[0],\"&\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"Expression\"},\"Prefix\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,4,5,6,7,8],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1,2,3,4,5],\"number\":[5],\"string\":[5],\"char\":[5],\"symbol\":[5]},\"literalChoices\":{\"-\":[0,5],\"/\":[1,5],\"!\":[2,5],\"++\":[3,5],\"--\":[4,5],\"{\":[5],\"[\":[5],\"(\":[5]}},{\"match\":\"-\",\"reference\":false,\"to\":[2],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Prefix\",\"reference\":true,\"to\":[3],\"label\":\"target\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"/\",\"reference\":false,\"to\":[2],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"!\",\"reference\":false,\"to\":[2],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"++\",\"reference\":false,\"to\":[2],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"--\",\"reference\":false,\"to\":[2],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"of\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}}],\"start\":0,\"end\":3,\"name\":\"Prefix\"},\"Composition\":{\"nodes\":[{\"match\":\"Prefix\",\"reference\":true,\"to\":[1,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1],\"symbol\":[1]},\"literalChoices\":{\"of\":[0,1],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\"(\":[1],\")\":[1],\":\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"^\":[1],\"**\":[1],\"*\":[1],\"%\":[1],\"+\":[1],\"#\":[1],\"in\":[1],\"==\":[1],\"!=\":[1],\"===\":[1],\"!==\":[1],\"<\":[1],\"<=\":[1],\">\":[1],\">=\":[1],\"&&\":[1],\"||\":[1],\"??\":[1],\"?\":[1],\"|>\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":true,\"to\":[2],\"label\":\"left\",\"enclose\":true,\"terminal\":true,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{\"of\":[0]}},{\"match\":\"of\",\"reference\":false,\"to\":[3],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Composition\",\"reference\":true,\"to\":[4],\"label\":\"right\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"^\":[0],\"**\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"Composition\"},\"Exponential\":{\"nodes\":[{\"match\":\"Composition\",\"reference\":true,\"to\":[1,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1],\"symbol\":[1]},\"literalChoices\":{\"^\":[0,1],\"**\":[0,1],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\"(\":[1],\")\":[1],\":\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"*\":[1],\"%\":[1],\"+\":[1],\"#\":[1],\"in\":[1],\"==\":[1],\"!=\":[1],\"===\":[1],\"!==\":[1],\"<\":[1],\"<=\":[1],\">\":[1],\">=\":[1],\"&&\":[1],\"||\":[1],\"??\":[1],\"?\":[1],\"|>\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":true,\"to\":[2,5],\"label\":\"left\",\"enclose\":true,\"terminal\":true,\"typeChoices\":{\"identifier\":[0,1]},\"literalChoices\":{\"^\":[0],\"**\":[1]}},{\"match\":\"^\",\"reference\":false,\"to\":[3],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Exponential\",\"reference\":true,\"to\":[4],\"label\":\"right\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"**\",\"reference\":false,\"to\":[3],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}}],\"start\":0,\"end\":4,\"name\":\"Exponential\"},\"Product\":{\"nodes\":[{\"match\":\"Exponential\",\"reference\":true,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[2,7],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1],\"symbol\":[1]},\"literalChoices\":{\"*\":[0,1],\"/\":[0,1],\"%\":[0,1],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\"(\":[1],\")\":[1],\":\":[1],\"-\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"+\":[1],\"#\":[1],\"in\":[1],\"==\":[1],\"!=\":[1],\"===\":[1],\"!==\":[1],\"<\":[1],\"<=\":[1],\">\":[1],\">=\":[1],\"&&\":[1],\"||\":[1],\"??\":[1],\"?\":[1],\"|>\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":false,\"to\":[3,5,6],\"label\":\"left\",\"enclose\":true,\"typeChoices\":{\"identifier\":[0,1,2]},\"literalChoices\":{\"*\":[0],\"/\":[1],\"%\":[2]}},{\"match\":\"*\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Exponential\",\"reference\":true,\"to\":[1],\"label\":\"right\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"*\":[0],\"%\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"/\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"%\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":7,\"name\":\"Product\"},\"Sum\":{\"nodes\":[{\"match\":\"Product\",\"reference\":true,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[2,7],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1],\"symbol\":[1]},\"literalChoices\":{\"+\":[0,1],\"-\":[0,1],\"#\":[0,1],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\"(\":[1],\")\":[1],\":\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"in\":[1],\"==\":[1],\"!=\":[1],\"===\":[1],\"!==\":[1],\"<\":[1],\"<=\":[1],\">\":[1],\">=\":[1],\"&&\":[1],\"||\":[1],\"??\":[1],\"?\":[1],\"|>\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":false,\"to\":[3,5,6],\"label\":\"left\",\"enclose\":true,\"typeChoices\":{\"identifier\":[0,1,2]},\"literalChoices\":{\"+\":[0],\"-\":[1],\"#\":[2]}},{\"match\":\"+\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Product\",\"reference\":true,\"to\":[1],\"label\":\"right\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"+\":[0],\"#\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"-\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"#\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":7,\"name\":\"Sum\"},\"Type\":{\"nodes\":[{\"match\":\"Sum\",\"reference\":true,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[2,5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1],\"symbol\":[1]},\"literalChoices\":{\"in\":[0,1],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\"(\":[1],\")\":[1],\":\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"==\":[1],\"!=\":[1],\"===\":[1],\"!==\":[1],\"<\":[1],\"<=\":[1],\">\":[1],\">=\":[1],\"&&\":[1],\"||\":[1],\"??\":[1],\"?\":[1],\"|>\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":false,\"to\":[3],\"label\":\"left\",\"enclose\":true,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{\"in\":[0]}},{\"match\":\"in\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Sum\",\"reference\":true,\"to\":[1],\"label\":\"right\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"in\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":5,\"name\":\"Type\"},\"Compare\":{\"nodes\":[{\"match\":\"Type\",\"reference\":true,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[2,12],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1],\"symbol\":[1]},\"literalChoices\":{\"==\":[0,1],\"!=\":[0,1],\"===\":[0,1],\"!==\":[0,1],\"<\":[0,1],\"<=\":[0,1],\">\":[0,1],\">=\":[0,1],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\"(\":[1],\")\":[1],\":\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"&&\":[1],\"||\":[1],\"??\":[1],\"?\":[1],\"|>\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":false,\"to\":[3,5,6,7,8,9,10,11],\"label\":\"left\",\"enclose\":true,\"typeChoices\":{\"identifier\":[0,1,2,3,4,5,6,7]},\"literalChoices\":{\"==\":[0],\"!=\":[1],\"===\":[2],\"!==\":[3],\"<\":[4],\"<=\":[5],\">\":[6],\">=\":[7]}},{\"match\":\"==\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Type\",\"reference\":true,\"to\":[1],\"label\":\"right\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"==\":[0],\"!=\":[0],\"===\":[0],\"!==\":[0],\"<\":[0],\"<=\":[0],\">\":[0],\">=\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"!=\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"===\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"!==\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"<\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"<=\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\">\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\">=\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":12,\"name\":\"Compare\"},\"Logic\":{\"nodes\":[{\"match\":\"Compare\",\"reference\":true,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[2,7],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1],\"symbol\":[1]},\"literalChoices\":{\"&&\":[0,1],\"||\":[0,1],\"??\":[0,1],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\"(\":[1],\")\":[1],\":\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"?\":[1],\"|>\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":false,\"to\":[3,5,6],\"label\":\"left\",\"enclose\":true,\"typeChoices\":{\"identifier\":[0,1,2]},\"literalChoices\":{\"&&\":[0],\"||\":[1],\"??\":[2]}},{\"match\":\"&&\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Compare\",\"reference\":true,\"to\":[1],\"label\":\"right\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"&&\":[0],\"||\":[0],\"??\":[0],\"?\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"||\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"??\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":7,\"name\":\"Logic\"},\"Conditional\":{\"nodes\":[{\"match\":\"Logic\",\"reference\":true,\"to\":[1,6],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1],\"symbol\":[1]},\"literalChoices\":{\"?\":[0,1],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\"(\":[1],\")\":[1],\":\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"|>\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":true,\"to\":[2],\"label\":\"condition\",\"enclose\":true,\"terminal\":true,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{\"?\":[0]}},{\"match\":\"?\",\"reference\":false,\"to\":[3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0]}},{\"match\":\"Precedence\",\"reference\":true,\"to\":[4],\"label\":\"ifTrue\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\":\":[0]}},{\"match\":\":\",\"reference\":false,\"to\":[5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0]}},{\"match\":\"Conditional\",\"reference\":true,\"to\":[6],\"label\":\"ifFalse\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":6,\"name\":\"Conditional\"},\"Pipe\":{\"nodes\":[{\"match\":\"Conditional\",\"reference\":true,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[2,7],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[1],\"number\":[1],\"string\":[1],\"char\":[1]},\"literalChoices\":{\"|>\":[0],\"{\":[1],\",\":[1],\"}\":[1],\"where\":[1],\"[\":[1],\"=\":[1],\"]\":[1],\"(\":[1],\")\":[1],\":\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"class\":[1],\";\":[1]}},{\"match\":null,\"reference\":false,\"to\":[3],\"label\":\"source\",\"enclose\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"|>\":[0]}},{\"match\":\"|>\",\"reference\":false,\"to\":[4,5,6],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1,2],\"number\":[2],\"string\":[2],\"char\":[2],\"symbol\":[2]},\"literalChoices\":{\"&\":[0,2],\"is\":[0,2],\"to\":[1,2],\"{\":[2],\"[\":[2],\"(\":[2]}},{\"match\":\"Alias\",\"reference\":true,\"to\":[1],\"label\":\"step\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"Reset\",\"reference\":true,\"to\":[1],\"label\":\"step\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":\"Call\",\"reference\":true,\"to\":[1],\"label\":\"step\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":7,\"name\":\"Pipe\"},\"Assignment\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,2,7],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1,2],\"symbol\":[1,2],\"number\":[2],\"string\":[2],\"char\":[2]},\"literalChoices\":{\"class\":[0,1,2],\"{\":[1,2],\"[\":[1,2],\"-\":[1,2],\"/\":[1,2],\"!\":[1,2],\"++\":[1,2],\"--\":[1,2],\"(\":[2]}},{\"match\":\"class\",\"reference\":false,\"to\":[2],\"label\":\"isClass\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0]}},{\"match\":\"Name\",\"reference\":true,\"to\":[3,6],\"label\":\"target\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"symbol\":[1]},\"literalChoices\":{\"&=\":[0],\"=\":[1]}},{\"match\":\"&=\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0]}},{\"match\":\"Assignment\",\"reference\":true,\"to\":[5],\"label\":\"value\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"=\",\"reference\":false,\"to\":[4],\"label\":\"op\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0]}},{\"match\":\"Pipe\",\"reference\":true,\"to\":[5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0],\";\":[0]}}],\"start\":0,\"end\":5,\"name\":\"Assignment\"},\"Precedence\":{\"nodes\":[{\"match\":\"Assignment\",\"reference\":true,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"[\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":1,\"name\":\"Precedence\"},\"ListDestructure\":{\"nodes\":[{\"match\":\"{\",\"reference\":false,\"to\":[1,3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"}\":[1]}},{\"match\":\"Name\",\"reference\":true,\"to\":[2,1,3],\"label\":\"names\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1,2],\"identifier\":[1]},\"literalChoices\":{\",\":[0],\"{\":[1],\"[\":[1],\"}\":[2]}},{\"match\":\",\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0]}},{\"match\":\"}\",\"reference\":false,\"to\":[4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\":\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\"&=\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"ListDestructure\"},\"DestructureField\":{\"nodes\":[{\"match\":\"identifier\",\"reference\":true,\"to\":[1],\"label\":\"key\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\":\":[0]}},{\"match\":\":\",\"reference\":false,\"to\":[2,3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1],\"identifier\":[0,1]},\"literalChoices\":{\"{\":[0],\"[\":[0],\",\":[1],\"}\":[1]}},{\"match\":\"Name\",\"reference\":true,\"to\":[3],\"label\":\"name\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"symbol\":[0]},\"literalChoices\":{\",\":[0],\"}\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"DestructureField\"},\"ObjectDestructure\":{\"nodes\":[{\"match\":\"{\",\"reference\":false,\"to\":[1,3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"symbol\":[1]},\"literalChoices\":{\"}\":[1]}},{\"match\":\"DestructureField\",\"reference\":true,\"to\":[2,1,3],\"label\":\"fields\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,2],\"identifier\":[1]},\"literalChoices\":{\",\":[0],\"}\":[2]}},{\"match\":\",\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"}\",\"reference\":false,\"to\":[4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\":\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\"&=\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"ObjectDestructure\"},\"WrappedName\":{\"nodes\":[{\"match\":\"[\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0]}},{\"match\":\"Name\",\"reference\":true,\"to\":[2],\"label\":\"name\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"]\":[0]}},{\"match\":\"]\",\"reference\":false,\"to\":[3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\":\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\"&=\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":3,\"name\":\"WrappedName\"},\"Name\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,3,4,5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0,1,2],\"identifier\":[3]},\"literalChoices\":{\"[\":[0],\"{\":[1,2]}},{\"match\":\"WrappedName\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\":\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\"&=\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"ListDestructure\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\":\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\"&=\":[0],\";\":[0]}},{\"match\":\"ObjectDestructure\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\":\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\"&=\":[0],\";\":[0]}},{\"match\":\"identifier\",\"reference\":true,\"to\":[2],\"label\":null,\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\":\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\"&=\":[0],\";\":[0]}}],\"start\":0,\"end\":2,\"name\":\"Name\"},\"Alias\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,2],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1]},\"literalChoices\":{\"&\":[0],\"is\":[1]}},{\"match\":\"&\",\"reference\":false,\"to\":[2],\"label\":\"overload\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{\"is\":[0]}},{\"match\":\"is\",\"reference\":false,\"to\":[3,4],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"symbol\":[1]},\"literalChoices\":{\"class\":[0,1],\"{\":[1],\"[\":[1]}},{\"match\":\"class\",\"reference\":false,\"to\":[4],\"label\":\"isClass\",\"enclose\":false,\"typeChoices\":{\"symbol\":[0],\"identifier\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0]}},{\"match\":\"Name\",\"reference\":true,\"to\":[5],\"label\":\"name\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":5,\"name\":\"Alias\"},\"Reset\":{\"nodes\":[{\"match\":\"to\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[2],\"label\":\"value\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\",\":[0],\"}\":[0],\"where\":[0],\"[\":[0],\"=\":[0],\"]\":[0],\"(\":[0],\")\":[0],\":\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"|>\":[0],\"class\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":2,\"name\":\"Reset\"},\"Call\":{\"nodes\":[{\"match\":\"Expression\",\"reference\":true,\"to\":[1,2],\"label\":\"operator\",\"enclose\":false,\"typeChoices\":{\"identifier\":[0,1],\"number\":[0,1],\"string\":[0,1],\"char\":[0,1],\"symbol\":[0,1]},\"literalChoices\":{\"{\":[0,1],\"[\":[0,1],\"(\":[0,1],\"where\":[0,1],\"-\":[0,1],\"/\":[0,1],\"!\":[0,1],\"++\":[0,1],\"--\":[0,1],\"class\":[0,1],\",\":[1],\"}\":[1],\"=\":[1],\"]\":[1],\")\":[1],\":\":[1],\"|>\":[1],\";\":[1]}},{\"match\":\"Expression\",\"reference\":true,\"to\":[1,2],\"label\":\"arguments\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0,1],\"number\":[0,1],\"string\":[0,1],\"char\":[0,1],\"symbol\":[0,1]},\"literalChoices\":{\"{\":[0,1],\"[\":[0,1],\"(\":[0,1],\"where\":[0,1],\"-\":[0,1],\"/\":[0,1],\"!\":[0,1],\"++\":[0,1],\"--\":[0,1],\"class\":[0,1],\",\":[1],\"}\":[1],\"=\":[1],\"]\":[1],\")\":[1],\":\":[1],\"|>\":[1],\";\":[1]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":2,\"name\":\"Call\"},\"Link\":{\"nodes\":[{\"match\":\"link\",\"reference\":false,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"identifier\",\"reference\":true,\"to\":[2],\"label\":\"name\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"=\":[0]}},{\"match\":\"=\",\"reference\":false,\"to\":[3],\"label\":null,\"enclose\":false,\"typeChoices\":{\"identifier\":[0]},\"literalChoices\":{}},{\"match\":\"identifier\",\"reference\":true,\"to\":[4],\"label\":\"source\",\"enclose\":false,\"terminal\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"]\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":4,\"name\":\"Link\"},\"Body\":{\"nodes\":[{\"match\":null,\"reference\":false,\"to\":[1,6],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0,1],\"number\":[1],\"string\":[1],\"char\":[1],\"symbol\":[1]},\"literalChoices\":{\"link\":[0,1],\"{\":[1],\"[\":[1],\"(\":[1],\"-\":[1],\"/\":[1],\"!\":[1],\"++\":[1],\"--\":[1],\"class\":[1]}},{\"match\":\"Link\",\"reference\":true,\"to\":[2],\"label\":\"statements\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"]\":[0],\";\":[0]}},{\"match\":null,\"reference\":false,\"to\":[3,4,5],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0,1,2]},\"literalChoices\":{\";\":[0,1],\"]\":[2]}},{\"match\":\";\",\"reference\":false,\"to\":[0],\"label\":null,\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"identifier\":[0],\"number\":[0],\"string\":[0],\"char\":[0],\"symbol\":[0]},\"literalChoices\":{\"{\":[0],\"[\":[0],\"(\":[0],\"-\":[0],\"/\":[0],\"!\":[0],\"++\":[0],\"--\":[0],\"class\":[0],\"link\":[0]}},{\"match\":\";\",\"reference\":false,\"to\":[5],\"label\":null,\"enclose\":false,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"]\":[0]}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":\"Precedence\",\"reference\":true,\"to\":[2],\"label\":\"statements\",\"enclose\":false,\"repeated\":true,\"typeChoices\":{\"symbol\":[0]},\"literalChoices\":{\"]\":[0],\";\":[0]}}],\"start\":0,\"end\":5,\"name\":\"Body\"},\"root\":{\"nodes\":[{\"match\":\"Body\",\"reference\":true,\"to\":[1],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}},{\"match\":null,\"reference\":false,\"to\":[],\"label\":null,\"enclose\":false,\"typeChoices\":{},\"literalChoices\":{}}],\"start\":0,\"end\":1,\"name\":\"root\"}},\"printers\":{\"Reference\":{\"key\":\"name\",\"type\":\"identifier\"},\"NumberValue\":{\"key\":\"value\",\"type\":\"number\"},\"StringValue\":{\"key\":\"value\",\"type\":\"string\"},\"CharValue\":{\"key\":\"value\",\"type\":\"char\"},\"Value\":{\"options\":[[[],{\"key\":\"replace\",\"type\":\"NumberValue\"}],[[],{\"key\":\"replace\",\"type\":\"StringValue\"}],[[],{\"key\":\"replace\",\"type\":\"CharValue\"}]]},\"Field\":[{\"key\":\"key\",\"type\":\"identifier\"},\":\",{\"options\":[[[\"value\"],{\"key\":\"value\",\"type\":\"Precedence\"}],[[],[]]]}],\"List\":[\"{\",{\"options\":[[[],{\"repeat\":{\"key\":\"elements\",\"type\":\"Precedence\"},\"delimiter\":{\"options\":[[[],\",\"],[[],[]]]}}],[[],{\"repeat\":{\"key\":\"elements\",\"type\":\"Field\"},\"delimiter\":{\"options\":[[[],\",\"],[[],[]]]}}]]},\"}\"],\"Parameter\":[{\"options\":[[[\"type\"],{\"key\":\"type\",\"type\":\"Expression\"}],[[],[]]]},{\"key\":\"name\",\"type\":\"Name\"},{\"options\":[[[\"value\"],[\":\",{\"key\":\"value\",\"type\":\"Pipe\"}]],[[],[]]]},{\"options\":[[[\"guard\"],[\"where\",{\"key\":\"guard\",\"type\":\"Pipe\"}]],[[],[]]]}],\"Operator\":[\"[\",{\"options\":[[[\"parameters\"],[{\"repeat\":{\"key\":\"parameters\",\"type\":\"Parameter\"},\"delimiter\":\",\"},\"=\",{\"key\":\"body\",\"type\":\"Body\"}]],[[],{\"key\":\"body\",\"type\":\"Precedence\"}]]},\"]\"],\"Nested\":[\"(\",{\"key\":\"replace\",\"type\":\"Precedence\"},\")\"],\"BaseExpression\":{\"options\":[[[],{\"key\":\"replace\",\"type\":\"Operator\"}],[[],{\"key\":\"replace\",\"type\":\"List\"}],[[],{\"key\":\"replace\",\"type\":\"Reference\"}],[[],{\"key\":\"replace\",\"type\":\"Value\"}],[[],{\"key\":\"replace\",\"type\":\"Nested\"}]]},\"Index\":[\"(\",{\"options\":[[[\"start\"],{\"key\":\"start\",\"type\":\"Precedence\"}],[[],[]]]},\":\",{\"options\":[[[\"end\"],{\"key\":\"end\",\"type\":\"Precedence\"}],[[],[]]]},\")\"],\"Arguments\":[\"(\",{\"repeat\":{\"key\":\"arguments\",\"type\":\"Precedence\"},\"delimiter\":\",\"},\")\"],\"Property\":[\".\",{\"key\":\"key\",\"type\":\"identifier\"}],\"Overload\":[\"&\",{\"key\":\"overload\",\"type\":\"Expression\"}],\"Suffix\":{\"options\":[[[],{\"key\":\"replace\",\"type\":\"Cast\"}],[[],{\"key\":\"replace\",\"type\":\"Arguments\"}],[[],{\"key\":\"replace\",\"type\":\"Index\"}],[[],{\"key\":\"replace\",\"type\":\"Property\"}],[[],{\"key\":\"replace\",\"type\":\"Overload\"}]]},\"Expression\":{\"options\":[[[\"base\",\"step\"],[{\"key\":\"base\",\"type\":\"Expression\"},{\"key\":\"step\",\"type\":\"Suffix\"}]],[[],{\"key\":\"replace\",\"type\":\"BaseExpression\"}]]},\"Prefix\":{\"options\":[[[\"op\",\"target\"],[{\"options\":[[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}]]},{\"key\":\"target\",\"type\":\"Prefix\"}]],[[],{\"key\":\"replace\",\"type\":\"Expression\"}]]},\"Composition\":{\"options\":[[[\"left\",\"op\",\"right\"],[{\"key\":\"left\",\"type\":\"Prefix\"},{\"key\":\"op\"},{\"key\":\"right\",\"type\":\"Composition\"}]],[[],{\"key\":\"replace\",\"type\":\"Prefix\"}]]},\"Exponential\":{\"options\":[[[\"left\",\"op\",\"right\"],[{\"key\":\"left\",\"type\":\"Composition\"},{\"options\":[[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}]]},{\"key\":\"right\",\"type\":\"Exponential\"}]],[[],{\"key\":\"replace\",\"type\":\"Composition\"}]]},\"Product\":{\"options\":[[[\"left\",\"op\",\"right\"],[{\"key\":\"left\",\"type\":\"Product\"},{\"options\":[[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}]]},{\"key\":\"right\",\"type\":\"Exponential\"}]],[[],{\"key\":\"replace\",\"type\":\"Exponential\"}]]},\"Sum\":{\"options\":[[[\"left\",\"op\",\"right\"],[{\"key\":\"left\",\"type\":\"Sum\"},{\"options\":[[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}]]},{\"key\":\"right\",\"type\":\"Product\"}]],[[],{\"key\":\"replace\",\"type\":\"Product\"}]]},\"Type\":{\"options\":[[[\"left\",\"op\",\"right\"],[{\"key\":\"left\",\"type\":\"Type\"},{\"key\":\"op\"},{\"key\":\"right\",\"type\":\"Sum\"}]],[[],{\"key\":\"replace\",\"type\":\"Sum\"}]]},\"Compare\":{\"options\":[[[\"left\",\"op\",\"right\"],[{\"key\":\"left\",\"type\":\"Compare\"},{\"options\":[[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}]]},{\"key\":\"right\",\"type\":\"Type\"}]],[[],{\"key\":\"replace\",\"type\":\"Type\"}]]},\"Logic\":{\"options\":[[[\"left\",\"op\",\"right\"],[{\"key\":\"left\",\"type\":\"Logic\"},{\"options\":[[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}]]},{\"key\":\"right\",\"type\":\"Compare\"}]],[[],{\"key\":\"replace\",\"type\":\"Compare\"}]]},\"Conditional\":{\"options\":[[[\"condition\",\"ifTrue\",\"ifFalse\"],[{\"key\":\"condition\",\"type\":\"Logic\"},\"?\",{\"key\":\"ifTrue\",\"type\":\"Precedence\"},\":\",{\"key\":\"ifFalse\",\"type\":\"Conditional\"}]],[[],{\"key\":\"replace\",\"type\":\"Logic\"}]]},\"Pipe\":{\"options\":[[[\"source\",\"step\"],[{\"key\":\"source\",\"type\":\"Pipe\"},\"|>\",{\"options\":[[[],{\"key\":\"step\",\"type\":\"Alias\"}],[[],{\"key\":\"step\",\"type\":\"Reset\"}],[[],{\"key\":\"step\",\"type\":\"Call\"}]]}]],[[],{\"key\":\"replace\",\"type\":\"Conditional\"}]]},\"Assignment\":{\"options\":[[[\"isClass\",\"target\",\"op\",\"value\"],[{\"options\":[[[\"isClass\"],{\"key\":\"isClass\"}],[[],[]]]},{\"key\":\"target\",\"type\":\"Name\"},{\"options\":[[[],{\"key\":\"op\"}],[[],{\"key\":\"op\"}]]},{\"key\":\"value\",\"type\":\"Assignment\"}]],[[],{\"key\":\"replace\",\"type\":\"Pipe\"}]]},\"Precedence\":{\"key\":\"replace\",\"type\":\"Assignment\"},\"ListDestructure\":[\"{\",{\"repeat\":{\"key\":\"names\",\"type\":\"Name\"},\"delimiter\":{\"options\":[[[],\",\"],[[],[]]]}},\"}\"],\"DestructureField\":[{\"key\":\"key\",\"type\":\"identifier\"},\":\",{\"options\":[[[\"name\"],{\"key\":\"name\",\"type\":\"Name\"}],[[],[]]]}],\"ObjectDestructure\":[\"{\",{\"repeat\":{\"key\":\"fields\",\"type\":\"DestructureField\"},\"delimiter\":{\"options\":[[[],\",\"],[[],[]]]}},\"}\"],\"WrappedName\":[\"[\",{\"key\":\"name\",\"type\":\"Name\"},\"]\"],\"Name\":{\"options\":[[[],{\"key\":\"replace\",\"type\":\"identifier\"}],[[],{\"key\":\"replace\",\"type\":\"WrappedName\"}],[[],{\"key\":\"replace\",\"type\":\"ListDestructure\"}],[[],{\"key\":\"replace\",\"type\":\"ObjectDestructure\"}]]},\"Alias\":[{\"options\":[[[\"overload\"],{\"key\":\"overload\"}],[[],[]]]},\"is\",{\"options\":[[[\"isClass\"],{\"key\":\"isClass\"}],[[],[]]]},{\"key\":\"name\",\"type\":\"Name\"}],\"Reset\":[\"to\",{\"key\":\"value\",\"type\":\"Expression\"}],\"Call\":[{\"key\":\"operator\",\"type\":\"Expression\"},{\"repeat\":{\"key\":\"arguments\",\"type\":\"Expression\"}}],\"Link\":[\"link\",{\"key\":\"name\",\"type\":\"identifier\"},\"=\",{\"key\":\"source\",\"type\":\"identifier\"}],\"Body\":[{\"repeat\":{\"options\":[[[],{\"key\":\"statements\",\"type\":\"Link\"}],[[],{\"key\":\"statements\",\"type\":\"Precedence\"}]]},\"delimiter\":\";\"},{\"options\":[[[],\";\"],[[],[]]]}],\"root\":{\"key\":\"replace\",\"type\":\"Body\"}},\"replacements\":{\"Reference\":[\"Reference\"],\"NumberValue\":[\"NumberValue\"],\"StringValue\":[\"StringValue\"],\"CharValue\":[\"CharValue\"],\"Value\":[\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Field\":[\"Field\"],\"List\":[\"List\"],\"Parameter\":[\"Parameter\"],\"Operator\":[\"Operator\"],\"Nested\":[\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"BaseExpression\":[\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Index\":[\"Index\"],\"Arguments\":[\"Arguments\"],\"Property\":[\"Property\"],\"Overload\":[\"Overload\"],\"Suffix\":[\"Suffix\",\"Arguments\",\"Index\",\"Property\",\"Overload\",\"Cast\"],\"Expression\":[\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Prefix\":[\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Composition\":[\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Exponential\":[\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Product\":[\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Sum\":[\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Type\":[\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Compare\":[\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Logic\":[\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Conditional\":[\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Pipe\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Pipe\":[\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Assignment\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Assignment\":[\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Precedence\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"Precedence\":[\"Precedence\",\"Assignment\",\"Pipe\",\"Conditional\",\"Logic\",\"Compare\",\"Type\",\"Sum\",\"Product\",\"Exponential\",\"Composition\",\"Prefix\",\"Expression\",\"BaseExpression\",\"Nested\",\"Operator\",\"List\",\"Reference\",\"Value\",\"NumberValue\",\"StringValue\",\"CharValue\"],\"ListDestructure\":[\"ListDestructure\"],\"DestructureField\":[\"DestructureField\"],\"ObjectDestructure\":[\"ObjectDestructure\"],\"WrappedName\":[\"WrappedName\"],\"Name\":[\"Name\",\"WrappedName\",\"ListDestructure\",\"ObjectDestructure\",\"identifier\"],\"Alias\":[\"Alias\"],\"Reset\":[\"Reset\"],\"Call\":[\"Call\"],\"Link\":[\"Link\"],\"Body\":[\"Body\"],\"root\":[\"root\",\"Body\"]}}");
	const definitionNames = ["Reference","NumberValue","StringValue","CharValue","Value","Field","List","Parameter","Operator","Nested","BaseExpression","Index","Arguments","Property","Overload","Suffix","Expression","Prefix","Composition","Exponential","Product","Sum","Type","Compare","Logic","Conditional","Pipe","Assignment","Precedence","ListDestructure","DestructureField","ObjectDestructure","WrappedName","Name","Alias","Reset","Call","Link","Body","root"];
	for (const name of definitionNames) {
		definitions[name] = Graph.hydrate(definitions[name]);
		AST[name].printer = printers[name];
		AST[name].replacements = replacements[name];
	}

	for (const name of definitionNames)
		definitions[name].preprocess();
	
	function parse(source, showError = true) {
		source = source.replace(/\r/g, "");
		const stream = TokenStreamBuilder.regex(source, regex);
		
		const tokens = stream.all.filter(token => !hidden.has(token.type.name));

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

		function makeIndent(add) {
			const colors = ["magenta", "cyan", "blue", "yellow"];
			const count = add ? makeIndent.count++ : --makeIndent.count;
			let result = "";
			for (let i = 0; i < count; i++)
				result += color(colors[i % colors.length], "│ ");
			return result;
		}
		makeIndent.count = 0;

		function matchTerm(graph, index) {
			termStack.push(graph.name);
			// console.log(`${makeIndent(true)}├ ${graph.name}?`);
			const match = matchFromNode(new graph.astClass(index), graph.start, index);
			// console.log(`${makeIndent(false)}├ ${match === null ? color("red", "no.") : color("green", "yes!")}`);
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
					to = node.literalChoices[token.content];
					if (to === undefined || typeof to !== "object")
						to = node.typeChoices[token.type.name];
					if (to === undefined || typeof to !== "object")
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
					const enclosed = result.copy().finalize(tokens);
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
	
		if (result === null) {
			if (showError) lastError.show();
			else throw lastError;
		}

		return result[0];
	}

	return parse;
})();