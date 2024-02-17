// syntax
const OPERATOR_OPEN = "[";
const OPERATOR_CLOSE = "]";
const LIST_OPEN = "{";
const LIST_CLOSE = "}";
const INDEX_OPEN = "(";
const INDEX_CLOSE = ")";

class Type {
	constructor(baseType, dimensions = []) {
		if (baseType === null) this.ignore = true;
		else {
			this.ignore = false;
			this.baseType = baseType;
			this.dimensions = dimensions;
		}
	}
	*[Symbol.iterator]() {
		for (let i = 0; i < this.dimensions.length; i++)
			yield new Type(this.baseType, this.dimensions.slice(0, i));
	}
	slice(base) {
		return base.ignore ? this.dimensions : this.dimensions.slice(base.dimensions.length);
	}
	equals(type) {
		if (type.ignore) return true;
		
		if (type.baseType === "any") {
			if (type.dimensions.length > this.dimensions.length) return false;

			for (let i = 0; i < type.dimensions.length; i++) {
				const thisDim = this.dimensions[this.dimensions.length - 1 - i];
				const typeDim = type.dimensions[type.dimensions.length - 1 - i];
			
				if (thisDim !== null && typeDim !== null && thisDim !== typeDim)
					return false;
			}

			return true;
		}

		if (type.dimensions.length !== this.dimensions.length) return false;

		if (
			type.baseType !== this.baseType &&
			type.baseType !== "primitive" &&
			this.baseType !== "primitive"
		) return false;

		for (let i = 0; i < type.dimensions.length; i++) {
			const typeDim = type.dimensions[i];
			const thisDim = this.dimensions[i];
			
			if (typeDim === null || thisDim === null) continue;
			if (typeDim !== thisDim) return false;
		}
		return true;
	}
	hasElementsOfType(type) {
		if (type.ignore) return true;
		
		if (type.dimensions.length > this.dimensions.length) return false;
		
		if (type.baseType === "any") {
			offsetLoop: for (let i = 0; i < this.dimensions.length - type.dimensions.length + 1; i++) {
				for (let j = 0; j < type.dimensions.length; j++) {
					const typeDim = type.dimensions[i + j];
					const thisDim = this.dimensions[j];
					if (typeDim !== null && thisDim !== null && typeDim !== thisDim)
						continue offsetLoop;
				}

				return true;
			}

			return false;
		}

		if (
			type.baseType !== this.baseType &&
			type.baseType !== "primitive" &&
			this.baseType !== "primitive"
		) return false;

		for (let i = 0; i < type.dimensions.length; i++) {
			const typeDim = type.dimensions[i];
			const thisDim = this.dimensions[i];
			
			if (typeDim !== null && thisDim !== null && typeDim !== thisDim)
				return false;
		}
		return true;
	}
	toString() {
		return this.ignore ? "ignore" : `${this.baseType}${this.dimensions.map(dim => INDEX_OPEN + (dim ?? "") + INDEX_CLOSE).reverse().join("")}`;
	}
}

class List {
	constructor(elements) {
		// validate
		// if (!elements.length)
		// 	throw new RangeError("No elements provided");
		const types = elements.map(typeOf);
		for (let i = 0; i < types.length - 1; i++) {
			if (!types[i].equals(types[i + 1]))
				throw new TypeError("Not all elements are the same type");
		}
		
		if (types.length > 0 && types[0].baseType === "void")
			throw new TypeError("List elements cannot be of type void");

		this.elements = elements;
		this.length = elements.length;
	}
	invalidIndex(index) {
		return index < 0 || index >= this.length;
	}
	slice(start, end = this.length) {
		if (start < 0) start += this.length;
		if (end < 0) end += this.length;
		if (start === end) {
			if (start < 0 || start > this.length) throw new RangeError(`Range ${start}:${end} is out of bounds for type '${typeOf(this)}'`);
			return new List([]);
		}
		if (this.invalidIndex(start) || this.invalidIndex(end - 1)) throw new RangeError(`Range ${start}:${end} is out of bounds for type '${typeOf(this)}'`);
		return new List(this.elements.slice(start, end));
	}
	at(index) {
		if (this.invalidIndex(index)) throw new RangeError(`Index '${index}' is out of bounds for type '${typeOf(this)}'`);
		return this.elements[index];
	}
	toArray() {
		if (this.elements.length) {
			if (this.elements[0] instanceof List) return this.elements.map(element => element.toArray());
			else return [...this.elements];
		} else return [];
	}
	toString() {
		if (this.elements.length) {
			// if (this.elements[0] instanceof List) return `${LIST_OPEN}\n${this.elements.map(el => "\t" + el).join(",\n")}\n${LIST_CLOSE}`;
			return `${LIST_OPEN} ${this.elements.join(", ")} ${LIST_CLOSE}`;
		}
		return `${LIST_OPEN} ${LIST_CLOSE}`;
	}
}

function format(source) {
	return source
		.replace(/ (\,|\]|\)|\(|\:)/g, "$1")
		.replace(/(\[|\(|\:) /g, "$1");
}

class OperandError extends TypeError {
	constructor(name, types) {
		super((() => {
			let operands;

			types = types.map(type => `'${type}'`);
			switch (types.length) {
				case 0:
					operands = `no operands`;
					break;
				case 1:
					operands = `an operand of type ${types[0]}`;
					break;
				case 2:
					operands = `operands of types ${types[0]} and ${types[1]}`;
					break;
				default:
					operands = `operands of types ${types.slice(0, -1).join(", ")}, and ${types[types.length - 1]}`;
					break;
			}

			return `No operator '${name}' exists with ${operands}`;
		})());
	}
}

class Operator {
	constructor(operands, method) {
		this.operands = operands;
		this.operandTypes = operands.map(op => op[0]);
		this.operandNames = operands.map(op => op[1]);
		this.method = method;
		this.sourceCode = "...";
		this.localName = "anonymous";
	}
	operate(...args) {
		const { operandTypes } = this;
		const actualTypes = args.map(typeOf);

		if (actualTypes.length !== operandTypes.length)
			throw new OperandError(this.localName, actualTypes);

		const correctTypes = actualTypes.every((type, i) => type.hasElementsOfType(operandTypes[i]));
		if (!correctTypes)
			throw new OperandError(this.localName, actualTypes);

		const exactTypes = actualTypes.every((type, i) => type.equals(operandTypes[i]));
		if (exactTypes) return this.method(...args);

		const structs = actualTypes.map((type, i) => type.slice(operandTypes[i]));
		const maxDims = Math.max(...structs
			.filter((_, i) => !operandTypes[i].ignore)
			.map(struct => struct.length)
		);
		const baseIndex = structs.findIndex(
			(struct, i) => !operandTypes[i].ignore && struct.length === maxDims
		);
		const baseStruct = structs[baseIndex];
		const base = args[baseIndex];

		const elements = [];
		for (let i = 0; i < base.length; i++) {
			const subValue = this.operate(...args.map((arg, argInx) => {
				return (structs[argInx].length === baseStruct.length && !operandTypes[argInx].ignore) ? arg.at(i) : arg;
			}));
			elements.push(subValue);
		}

		return new List(elements);
	}
	toString() {
		const normalized = `${OPERATOR_OPEN}${this.operands.map(([type, name]) => type.ignore ? name : type + " " + name).join(", ")} = ${this.sourceCode}${OPERATOR_CLOSE}`
		// .replace(/\|>/g, "\n|>");
		return normalized;
		// let indent = 0;
		// let result = "";
		// let nextShouldIndent = false;
		// let extraIndent = false;
		// for (let i = 0; i < normalized.length; i++) {
		// 	const char = normalized[i];
		// 	if (char === OPERATOR_CLOSE) {
		// 		indent--;
		// 		if (extraIndent) indent--;
		// 		result += "\n" + "\t".repeat(indent);
		// 	}
		// 	result += char;
		// 	if (char === "\n") {
		// 		if (nextShouldIndent) {
		// 			indent++;
		// 			nextShouldIndent = false;
		// 			extraIndent = true;
		// 		}
		// 		result += "\t".repeat(indent);
		// 	} else if (char === OPERATOR_OPEN) {
		// 		indent++;
		// 		if (nextShouldIndent) indent++;
		// 		result += "\n" + "\t".repeat(indent);
		// 		nextShouldIndent = true;
		// 		extraIndent = false;
		// 	}
		// }
		// return result;
	}
}

function typeOf(value) {
	if (value === undefined)
		return new Type("void");
	
	switch (value.constructor) {
		case Number:
			return new Type("real");
		case Operator:
			return new Type("operator");
		case List:
			if (!value.elements.length) return new Type("primitive", [0]);
			const subType = typeOf(value.elements[0]);
			return new Type(subType.baseType, [...subType.dimensions, value.length]);
	}
}

// token management
function split(tokens, sep) {
	const inx = tokens.indexOf(sep);
	if (inx > -1) return [
		...split(tokens.slice(0, inx), sep),
		...split(tokens.slice(inx + 1), sep)
	];
	return [tokens];
}

class TokenStream {
	constructor(tokens) {
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
	until(tok) {
		const result = [];
		while (this.length && !this.has(tok)) result.push(this.next());
		return new TokenStream(result);
	}
	endOf(open, close) {
		const result = [];
		this.until(open);
		if (!this.length) return result;
		this.next();
		let depth = 1;
		while (this.length && depth) {
			if (this.has(open)) depth++;
			if (this.has(close)) depth--;
			result.push(this.get());
			this.next();
		}
		result.pop();
		return new TokenStream(result);
	}
	hasAny(...toks) {
		for (let i = 0; i < toks.length; i++) if (this.has(toks[i])) return true;
	}
	skip(amt) {
		for (let i = 0; i < amt; i++) this.next();
		return this;
	}
	get(inx = 0) {
		return this.tokens[this.tokens.length - 1 - inx];
	}
	has(tok, inx) {
		return this.get(inx) === tok;
	}
	type(type, inx) {
		return typeOfToken(this.get(inx)) === type;
	}
	next() {
		return this.tokens.pop();
	}
	toString() {
		return this.all.join(" ");
	}
}

const syntaxCharacters = new Set([
	OPERATOR_OPEN, OPERATOR_CLOSE,
	LIST_OPEN, LIST_CLOSE,
	INDEX_OPEN, INDEX_CLOSE,
	",", ":", ";", "|>"
]);

const NUMBER_REGEX = /\-?\b(\d+\.?\d*|\.\d+)([eE][\+\-]?\d+)?\b/g;

function typeOfToken(tok) {
	if (tok.trim() === "") return "whitespace";
	const match = tok.match(NUMBER_REGEX);
	if (match && match[0] === tok) return "number";
	if (syntaxCharacters.has(tok)) return "syntax";
	return "identifier";
}

function tokenize(string) {
	const tws = new TokenStream(
		string
			.replace(/\s+/g, " ")
			.split(/(\b| )/g)
			.filter(tok => tok)
			.map(tok => tok.trim())
	);

	const separatedTokens = [];
	const syntaxRegex = new RegExp(`(${[...syntaxCharacters].map(synt => synt.split("").map(char => "\\" + char).join("")).join("|")})`, "g");
	while (tws.length) {
		const tok = tws.next();
		if (tok.match(/^(\W*)$/g)) { // symbols
			const matches = tok.match(syntaxRegex);
			if (matches) {
				separatedTokens.push(
					...tok
						.split(syntaxRegex)
						.filter(tok => tok)
				);
			} else separatedTokens.push(tok);
		} else separatedTokens.push(tok);
	}

	const st = new TokenStream(separatedTokens);
	const tokens = [];
	while (st.length) {
		const tok = st.get();
		const symbolStart = st.hasAny("-", "-.", ".");
		const numberStart = st.type("number");
		const expStart = tok.length > 1 && typeOfToken(tok.slice(0, -1)) === "number" && tok[tok.length - 1].toLowerCase() === "e"; // 1e
		if (symbolStart || numberStart || expStart) {
			// longest number is 6 tokens: [- DIGITS . DIGITSe SIGN DIGITS]
			let longest = null;
			const acc = [];
			for (let i = 0; i < 6 && st.length; i++) {
				if (typeOfToken(acc.join("")) === "number") longest = [...acc];
				if (st.get(i)) acc.push(st.get(i));
				else break;
			}
			if (typeOfToken(acc.join("")) === "number") longest = [...acc];

			if (longest) {
				st.skip(longest.length);
				tokens.push(longest.join(""));
				continue;
			}
		}

		if (st.get()) tokens.push(st.get());
		st.next();
	}

	return new TokenStream(tokens);
}

// scope & built-ins
const variables = {
	"true": 1,
	"false": 0,
	"NaN": NaN,
	"Infinity": Infinity,
};
let scopes = [];
function getFunctionScope() {
	if (!scopes.length) return {};
	const scope = scopes[scopes.length - 1];
	const closure = scope.constructor.closure;
	const result = {};
	for (const key in closure) result[key] = closure[key];
	for (const key in scope) result[key] = scope[key];
	return result;
}
const currentScope = new Proxy({}, {
	get(obj, key) {
		const scope = getFunctionScope();
		let rv;
		if (key in scope) rv = scope[key];
		else if (key in variables) rv = variables[key];
		if (rv !== undefined) {
			if (rv instanceof Operator) rv.localName = key;
			return rv;
		}
		throw new ReferenceError(`No variable exists with name '${key}'`);
	},
	has(obj, key) {
		const scope = getFunctionScope();
		if (key in variables || key in scope) return true;
		return false;
	},
	set(obj, key, value) {
		if (value === undefined) throw new TypeError(`Cannot assign void to a variable (assigning '${key}')`);
		if (scopes.length) scopes[scopes.length - 1][key] = value;
		else variables[key] = value;
	}
});
function pushScope(scopeType) {
	const scope = new scopeType();
	scopes.push(scope);
	return scope;
}
function popScope() {
	scopes.pop();
}

// eval
function evalValue(s, closures = []) {
	let value;
	if (s.has(LIST_OPEN)) { // list
		const elements = [];
		s.next(); // {
		while (!s.has(LIST_CLOSE)) elements.push(evalValue(s, closures));
		s.next(); // }
		value = new List(elements);
	} else if (s.has(OPERATOR_OPEN)) { // operator
		const body = s.endOf(OPERATOR_OPEN, OPERATOR_CLOSE);
		const sig = body.until("=");
		body.next(); // =
		if (!body.length) throw new SyntaxError("Operator body is missing");

		const operands = [];
		while (sig.length) {
			const operand = sig.until(",");
			sig.next(); // ,
			if (operand.length === 1) operands.push([new Type(null), operand.next()]);
			else {
				const baseType = operand.next();
				const dimensions = [];
				while (operand.length > 1) {
					if (operand.has(INDEX_CLOSE, 1)) {
						operand.skip(2);
						dimensions.push(null);
						continue;
					}
					operand.next();
					const dim = evalValue(operand, closures);
					if (typeof dim === "number") {
						operand.next();
						dimensions.push(dim);
					} else throw new TypeError(`Type '${typeOf(dim)}' cannot be used as a dimension size`);
				}
				operands.push([
					new Type(baseType, dimensions.reverse()),
					operand.next()
				]);
			}
		}

		class StackFrame { }

		const closure = {};
		for (let i = 0; i < closures.length; i++) {
			const scope = closures[i];
			for (const key in scope)
				closure[key] = scope[key];
		}

		const operator = new Operator(operands, (...args) => {
			const scope = pushScope(StackFrame);
			for (let i = 0; i < operator.operandNames.length; i++) {
				const name = operator.operandNames[i];
				currentScope[name] = args[i];
			}
			const result = evalExpression(
				body.copy(),
				[...closures, scope]
			);
			popScope();
			return result;
		});

		operator.sourceCode = format(body.toString());
		operator.closure = closure;
		operator.scopeType = StackFrame;

		StackFrame.operator = operator;
		StackFrame.closure = closure;

		value = operator;
	} else if (s.type("identifier")) { // variable
		value = currentScope[s.next()];
	} else if (s.type("number")) { // number
		value = parseFloat(s.next());
	} else throw new SyntaxError(`Unexpected token '${s.get()}'`);

	while (s.has(INDEX_OPEN)) {
		if (value instanceof Operator) {
			const operands = [];
			s.next();
			while (!s.has(INDEX_CLOSE) && s.length) operands.push(evalValue(s, closures));
			s.next();
			value = value.operate(...operands);
		} else if (value instanceof List) {
			s.next();
			if (s.has(":")) {
				s.next();
				const endIndex = evalValue(s, closures);
				s.next();
				value = value.slice(0, endIndex);
			} else {
				const index = evalValue(s, closures);
				if (s.has(":")) {
					s.next();
					if (s.has(INDEX_CLOSE)) {
						s.next();
						value = value.slice(index);
					} else {
						const endIndex = evalValue(s, closures);
						s.next();
						value = value.slice(index, endIndex);
					}
				} else {
					s.next();
					value = value.at(index);
				}
			}
		} else throw new TypeError(`Type '${typeOf(value)}' cannot be indexed`);
	}

	if (s.has(",")) s.next();

	return value;
}

let lastExpressionEvaluated = null;
function evalExpression(s, closures = []) {
	let acc = evalValue(s, closures);

	if (acc instanceof Operator) { // first step is a function call
		const rhs = [];
		while (rhs.length < acc.operands.length && s.length && !s.has("|>"))
			rhs.push(evalValue(s, closures));
		if (rhs.length) acc = acc.operate(...rhs);
	} else if (s.length && !s.has("|>"))
		throw new SyntaxError(`Cannot call type '${typeOf(acc)}'`);

	while (s.has("|>")) {
		s.next();

		if (s.has("is")) {
			s.next();
			const name = s.get();
			s.next();
			currentScope[name] = acc;
			if (s.length && !s.has("|>"))
				throw new SyntaxError(`Labeling takes only one argument (labeling '${name}')`);
		} else if (s.has("to")) {
			s.next();
			acc = evalValue(s, closures);
		} else {
			const operator = evalValue(s, closures);
			const rhs = [];
			while (rhs.length < operator.operands.length - 1)
				rhs.push(evalValue(s, closures));
			if (acc === undefined)
				throw new SyntaxError("Must specify 'to' before post-void expression");
			else {
				if (operator instanceof Operator)
					acc = operator.operate(acc, ...rhs);
				else throw new TypeError(`Step cannot begin with type '${typeOf(operator)}'`);
			}
		}
	}

	return lastExpressionEvaluated = acc;
}

function evalLine(stream) {
	const s = stream.until(";");
	stream.next();
	if (s.has("=", 1) && !s.has(OPERATOR_OPEN)) currentScope[s.get(0)] = evalExpression(s.skip(2));
	else evalExpression(s);
}

const SINGLE_LINE_COMMENT_REGEX = /\/\/(.*?)(\n|$)/g;
const MULTILINE_COMMENT_REGEX = /\/\*((.|\n)*?)\*\//g;

function lowerStrings(command) {
	const lines = command.split("\n");
	let result = [];
	let commented = false;
	const stringTypes = new Set(`'"`);
	const escapeCharacterMapping = {
		"t": "\t",
		"n": "\n",
		"\\": "\\"
	};
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		let finalLine = "";
		let stringType = null;
		let escaped = false;
		let stringAcc = "";
		for (let j = 0; j < line.length; j++) {
			const char = line[j];
			const next = line[j + 1];
			if (commented && char + next === "*/") {
				commented = false;
				j++;
				continue;
			} else if (!commented && !stringType && char + next === "/*")
				commented = true;
			
			if (!commented) {
				if (!stringType && stringTypes.has(char))
					stringType = char;
				else if (!escaped && stringType === char) {
					if (stringType === "'") {
						if (stringAcc.length > 1)
							throw new SyntaxError("Character literal cannot contain multiple characters");
						finalLine += stringAcc.charCodeAt(0);
					} else 
						finalLine += `{ ${
							stringAcc
								.split("")
								.map(char => char.charCodeAt(0))
								.join(", ")
						} }`;
					stringType = null;
					stringAcc = "";
				} else if (stringType) {
					if (escaped && char in escapeCharacterMapping)
						stringAcc += escapeCharacterMapping[char];
					else if (char !== "\\")
						stringAcc += char;
				} else finalLine += char;
				
				if (stringType && !escaped && char === "\\") escaped = true;
				else escaped = false;
			}
		}

		if (stringAcc)
			throw new SyntaxError("Unterminated string");

		result.push(finalLine);
	}
	return result.join("\n");
}

function evalStat(command) {
	scopes = [];

	command = lowerStrings(command);

	command = command // remove comments
		.replace(SINGLE_LINE_COMMENT_REGEX, "$2") // single line
		.replace(MULTILINE_COMMENT_REGEX, ""); // multiline	

	const stream = tokenize(command);
	lastExpressionEvaluated = null;
	while (stream.length) evalLine(stream);
	return lastExpressionEvaluated;
}


// built-ins

const portedOperators = [
	"+", "-", "*", "/", "%", "**",
	"&&", "||", "==", "!=", "<=", ">=", "<", ">"
];
for (const op of portedOperators) {
	currentScope[op] = new Operator([
		[new Type("real"), "a"],
		[new Type("real"), "b"]
	], new Function("a", "b", `return +(a ${op} b)`));
}

for (const key of Object.getOwnPropertyNames(Math)) {
	const value = Math[key];
	if (typeof value === "function") {
		if (value.length > 0) {
			const operands = [[new Type("real"), "a"]];
			if (value.length === 2) operands.push([new Type("real"), "b"]);
			currentScope[key] = new Operator(operands, value);
		}
	} else currentScope[key] = value;
}

// required for turing-completeness (-ish)
currentScope["primitive"] = new Operator([
	[new Type(null), "value"]
], value => +!(value instanceof List));

currentScope["error"] = new Operator([
	[new Type("real", [null]), "message"]
], string => {
	throw new Error(String.fromCharCode(...string.elements));
});

currentScope["?"] = new Operator([
	[new Type("real"), "condition"],
	[new Type("operator"), "ifTrue"],
	[new Type("operator"), "ifFalse"],
], (cond, ifTrue, ifFalse) => cond ? ifTrue.operate() : ifFalse.operate());

currentScope["void"] = new Operator([
	[new Type(null), "terminal"]
], value => void value);

currentScope["reduce"] = new Operator([
	[new Type(null), "data"],
	[new Type(null), "base"],
	[new Type("operator"), "predicate"],
], (data, base, predicate) => {
	if (!(data instanceof List)) throw new TypeError("Cannot reduce non-list");
	const { operands } = predicate;
	if (operands.length !== 2) throw new TypeError("Reduce predicate must have two operands");
	const elType = operands[1][0];
	const opType = elType.ignore ? new Type(null) : new Type(elType.baseType, [...elType.dimensions, null]);
	const reducer = new Operator([
		[opType, "data"]
	], list => list.elements.reduce((acc, el) => {
		return predicate.operate(acc, el);
	}, base));
	reducer.localName = "reducer";
	return reducer.operate(data);
});

currentScope["filter"] = new Operator([
	[new Type(null), "data"],
	[new Type("operator"), "predicate"],
], (data, predicate) => {
	if (!(data instanceof List)) throw new TypeError("Cannot filter non-list");
	const { operands } = predicate;
	if (operands.length !== 1) throw new TypeError("Filter predicate must have one operand");
	const elType = operands[0][0];
	const opType = elType.ignore ? new Type(null) : new Type(elType.baseType, [...elType.dimensions, null]);
	const filterer = new Operator([
		[opType, "data"]
	], list => new List(list.elements.filter(el => {
		return !!predicate.operate(el);
	})));
	filterer.localName = "filterer";
	return filterer.operate(data);
});

currentScope["map"] = new Operator([
	[new Type(null), "data"],
	[new Type("operator"), "predicate"],
], (data, predicate) => {
	if (!(data instanceof List)) throw new TypeError("Cannot map non-list");
	const { operands } = predicate;
	if (operands.length > 1) throw new TypeError("Map predicate must have zero or one operands");
	if (operands.length) return new List(data.elements.map(el => predicate.operate(el)));
	return new List(data.elements.map(() => predicate.operate()));
});

currentScope["rangeTo"] = new Operator([
	[new Type("real"), "length"]
], length => new List(new Array(length).fill(0).map((_, i) => i)));

currentScope["zip"] = new Operator([
	[new Type(null), "sides"]
], sides => {
	const { dimensions } = typeOf(sides);
	if (dimensions < 2) throw new TypeError("Zip sides don't have enough dimensions");
	
	let result = [];
	for (let i = 0; i < sides.elements[0].length; i++)
		result.push(new List(sides.elements.map(side => side.at(i))));
	
	return new List(result);
});

currentScope["sort"] = new Operator([
	[new Type("real", [null]), "list"]
], list => new List([...list.elements].sort((a, b) => a - b)));

currentScope["keySort"] = new Operator([
	[new Type(null), "list"],
	[new Type("operator"), "key"]
], (list, key) => {
	if (list instanceof List)
		return new List(
			[...list.elements]
				.sort((a, b) => key.operate(a) - key.operate(b))
		);
	throw new TypeError("Cannot sort non-list");
});

currentScope["flat"] = new Operator([
	[new Type(null), "list"],
	[new Type("real"), "depth"]
], (data, depth) => {
	if (data instanceof List) return new List([...data.elements.map(element => element.elements)].flat(depth));
	throw new TypeError("Cannot flatten non-list");
});

currentScope["isFinite"] = new Operator([
	[new Type("real"), "number"]
], number => +isFinite(number));

currentScope["len"] = new Operator([
	[new Type(null), "list"]	
], list => {
	if (list instanceof List) return list.elements.length;
	throw new TypeError("Cannot find length of non-list");
});

currentScope["call"] = new Operator([
	[new Type(null), "args"],
	[new Type("operator"), "op"]
], (args, op) => {
	return op.operate(...args.elements);
});

currentScope["string"] = new Operator([
	[new Type(null), "value"]
], value => {
	const charCodes = value
		.toString()
		.split("")
		.map(char => char.charCodeAt(0));
	return new List(charCodes);
});

currentScope["buildString"] = new Operator([
	[new Type(null), "value"],
	[new Type("operator"), "str"]
], (value, str) => {
	return new List(
		value.elements.map(v => {
			return String.fromCharCode(...str.operate(v).elements);
		})
		.join("")
		.split("")
		.map(char => char.charCodeAt(0))
	);
});

currentScope["==="] = new Operator([
	[new Type(null), "a"],
	[new Type(null), "b"]
], (a, b) => {
	const recurseEqual = (list1, list2) => {
		return +list1.elements.every((v, i) => {
			const v2 = list2.elements[i];
			if (v instanceof List)
				return recurseEqual(v, v2);
			return v === v2;
		});
	};

	if (a.constructor !== b.constructor) return 0;
	if (a instanceof List) {
		if (a.length !== b.length) return 0;
		if (!a.length) return 1;
		if (!typeOf(a).equals(typeOf(b))) return 0;
		return +recurseEqual(a, b);
	} else return +(a === b);
});

currentScope["effect"] = new Operator([
	[new Type(null), "value"],
	[new Type("operator"), "sideEffect"]
], (value, sideEffect) => {
	sideEffect.operate(value);
	return value;
});

// APIs
currentScope["random"] = new Operator([], () => Math.random());

currentScope["currentTime"] = new Operator([], () => performance.now());

currentScope["time"] = new Operator([
	[new Type("operator"), "operation"]
], fn => {
	const start = performance.now();
	fn.operate();
	return performance.now() - start;
});