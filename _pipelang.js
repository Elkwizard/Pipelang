Array.prototype.toString = function () {
	return `(${this.join(" ")})`;
};

class Value {
	constructor(elements) {
		if (!elements.length) throw new RangeError("No elements provided");
		const types = elements.map(Value.type);
		for (let i = 0; i < types.length - 1; i++)
			if (types[i] !== types[i + 1])
				throw new TypeError("Elements are not all the same type");
		this.elements = elements;
		this.length = this.elements.length;
	}
	get(i) {
		if (i < 0 || i >= this.length)
			throw new RangeError("Index out of bounds");
		return this.elements[i];
	}
	toString() {
		return `{ ${this.elements.join(", ")} }`;
	}
	static dimensions(v) {
		if (typeof v === "number") return 0;
		return Value.dimensions(v.elements[0]) + 1;
	}
	static type(v) {
		if (typeof v === "number") return "";
		if (v instanceof OperatorReference) return "operator";
		return `${Value.type(v.elements[0])}[${v.length}]`;
	}
	static displayType(v) {
		return Value.typeToDisplayType(Value.type(v));
	}
	static typeToDisplayType(type) {
		if (type === "operator") return type;
		return "real" + type;
	}
	static typeToDimensions(type) {
		return type
			.split("")
			.filter(char => char === "[")
			.length;
	}
	static operate(a, b, operator) {
		let { method, opTypeA, opArgTypes, typeless } = operator;
		if (typeless) return method(a, b);

		const typeToDims = struct => struct ? struct
			.slice(1, -1)
			.split("][")
			.map(d => d ? parseInt(d) : null) : [];

		opTypeA = typeToDims(opTypeA);
		opArgTypes = opArgTypes.map(typeToDims);

		const aType = typeToDims(Value.type(a));
		const argTypes = b.map(v => typeToDims(Value.type(v)));

		const equals = (a, b) => {
			if (a.length !== b.length) return false;
			for (let i = 0; i < a.length; i++) if (b[i] !== null && a[i] !== b[i]) return false;
			return true;
		};

		if (
			equals(aType, opTypeA) && 
			!argTypes.map((type, i) => {
				return operator.opArgTypes[i] === "operator" || equals(type, opArgTypes[i]);
			}).includes(false)
		)
			return method(a, b);

		const dimsA = aType.slice(opTypeA.length);
		const dimsB = argTypes.map((type, i) => type.slice(opArgTypes[i].length));

		const elements = [];
		for (let i = 0; i < a.length; i++) {
			const first = a.get(i);
			const args = b.map((op, j) => (operator.opArgTypes[j] === "operator" || dimsA.length > dimsB[j].length) ? op : op.get(i));
			const subvalue = Value.operate(first, args, operator);
			elements.push(subvalue);
		}

		return new Value(elements);
	}
	static create(arrays) {
		if (typeof arrays === "number") return arrays;
		else return new Value(
			arrays.map(array => Value.create(array))
		);
	}
}

// const a = Value.create([
// 	[1, 2, 3, 12],
// 	[3, 5, 6, 1],
// 	[1, 5, 8, 9]
// ]);
// const b = Value.create([
// 	[
// 		[1, 2, 3, 6],
// 		[3, 5, 6, 1],
// 		[1, 5, 8, 9]
// 	],
// 	[
// 		[1, 2, 3, 6],
// 		[3, 5, 6, 1],
// 		[1, 5, 8, 9]
// 	],
// 	[
// 		[1, 2, 3, 6],
// 		[3, 5, 6, 1],
// 		[1, 5, 8, 9]
// 	],
// 	[
// 		[1, 2, 3, 6],
// 		[3, 5, 6, 1],
// 		[1, 5, 8, 9]
// 	],
// 	[
// 		[1, 2, 3, 6],
// 		[3, 5, 6, 1],
// 		[1, 5, 8, 9]
// 	]
// ]);

class Operator {
	constructor(
		name,
		method = new Function("a", "b", `return +(a ${name} b[0])`),
		opTypeA = "",
		opArgTypes = [""],
		opNames = ["a", ...new Array(opArgTypes.length).fill(0).map((_, i) => String.fromCharCode(98 + i))]
	) {
		this.name = name;
		this.method = method;
		this.opTypeA = opTypeA;
		this.opArgTypes = opArgTypes;
		this.opNames = opNames;
		this.typeless = this.opTypeA === null;
	}
	checkOperands(a, b) {
		let { opTypeA, opArgTypes, typeless } = this;
		if (typeless) return opArgTypes.length === b.length;

		const typeToDims = struct => struct ? struct
			.slice(1, -1)
			.split("][")
			.map(d => d ? parseInt(d) : null) : [];

		opTypeA = typeToDims(opTypeA);
		opArgTypes = opArgTypes.map(typeToDims);
		const aType = typeToDims(Value.type(a));
		const argTypes = b.map(v => typeToDims(Value.type(v)));

		if (argTypes.length !== opArgTypes.length) return false;

		function startsWith(type, innerType) {
			for (let i = 0; i < innerType.length; i++) {
				if (i >= type.length) return false;
				if (innerType[i] !== null && type[i] !== innerType[i]) return false;
			}
			return true;
		}

		if (
			!startsWith(aType, opTypeA) ||
			b
				.map(Value.type)
				.map((type, i) => (type === "operator") ? type === "operator" : startsWith(argTypes[i], opArgTypes[i]))
				.includes(false)
		) return false;

		const dimsA = aType.slice(opTypeA.length);
		const dimsB = argTypes.map((type, i) => type.slice(opArgTypes[i].length));

		const numericDimsB = dimsB.filter((dim, i) => this.opArgTypes[i] !== "operator");
		const minDims = Math.min(dimsA.length, numericDimsB);
		const maxDims = Math.max(dimsA.length, numericDimsB);
		if (minDims === dimsA.length && maxDims !== dimsA.length)
			throw new TypeError(`Right operands have more dimensions than the left operand`);

		for (let i = 0; i < minDims; i++) {
			if (this.opArgTypes[i] === "operator") {
				if (Value.type(b[i]) === "operator") continue;
				else return false;
			}
			for (let j = 0; j < dimsB.length; j++)
				if (dimsB[j][i] !== dimsA[i]) return false;
		}

		return true;
	}
}

const operatorNames = new Set();
const variables = {};
const operators = [];
function operator(name, method, opA, opB, operandNames) {
	operatorNames.add(name);
	operators.push(new Operator(name, method, opA, opB, operandNames));
}
function fnToOperator(fn, ...parameters) {
	if (fn.length === 0) Object.defineProperty(variables, fn.name, { get: () => fn() });
	else operator(
		fn.name,
		(a, b) => fn(a, ...b),
		parameters[0][1],
		parameters.slice(1).map(([name, type]) => type),
		parameters.map(([name, type]) => name)
	);
}
const portedOperators = [
	"+", "-", "*", "/", "%", "**",
	"&&", "||", "==", "<=", ">=", "<", ">"
];
portedOperators.forEach(op => operator(op));
operator("-", a => -a, "", []); // unary negation
operator("!", a => +!a, "", []); // unary inversion
operator("?", (a, [t, f]) => a ? t : f, "", ["", ""], ["if_true", "if_false"]);

for (const key of Object.getOwnPropertyNames(Math)) {
	const value = Math[key];
	if (typeof value === "function") {
		if (value.length === 1) operator(key, v => Math[key](v), "", []);
		else if (value.length === 2) operator(key, (a, [b]) => Math[key](a, b), "", [""]);
	}
}

fnToOperator(function min(list) { return Math.min(...list.elements); },
	["list", "[]"]
);
fnToOperator(function max(list) { return Math.max(...list.elements); },
	["list", "[]"]
);
fnToOperator(function nth(list, n) { return list.elements[n]; },
	["list", "[]"],
	["index", ""]
);
fnToOperator(
	function filter(list, operator) {
		const keep = operator.operate(list);
		console.log(keep);
	},
	["list", "[]"],
	["method", "operator"]
);
fnToOperator(
	function reduce(list, operator) {

	},
	["list", "[]"],
	["method", "operator"],
);
fnToOperator(
	function reduce(list, operator, initial) {

	},
	["list", "[]"],
	["method", "operator"],
	["initial", ""]
);

function getAllOperatorsWithName(name) {
	const ops = operators.filter(op => op.name === name);
	if (name in variables && variables[name] instanceof OperatorReference) ops.push(...variables[name].overloads);
	if (name in operands && operands[name] instanceof OperatorReference) ops.push(...operands[name].overloads);
	return Array.from(new Set(ops));
}

class OperatorReference {
	constructor(name) {
		this.name = name;
		this.overloads = getAllOperatorsWithName(this.name);
	}
	toString() {
		const one = this.overloads.length === 1;
		const newline = one ? "" : "\n";
		const tab = one ? "" : "\t";
		return `${this.name}(${newline}${this.overloads.map(op => {
			if (op.typeless) return tab + op.opNames.map(name => "any " + name).join(", ");
			return tab + op.opNames.map((name, i) => {
				if (i) return `${Value.typeToDisplayType(op.opArgTypes[i - 1])} ${name}`;
				return `${Value.typeToDisplayType(op.opTypeA)} ${name}`;
			}).join(", ");
		}).join(" |\n")}${newline}) = ...`;
	}
	operate(a, ...b) {
		const possibleOverloads = this.overloads.filter(op => op.checkOperands(a, b));
		if (possibleOverloads.length === 1) return Value.operate(a, b, possibleOverloads[0]);

		let operands = `a left operand of type '${Value.displayType(a)}' and right operands of types '${b.map(Value.displayType)}'`;
		if (b.length === 0) operands = `just a left operand of type '${Value.displayType(a)}'`;
		else if (b.length === 1) operands = `a left operand of type '${Value.displayType(a)}' and a right operand of type '${Value.displayType(b[0])}'`;

		if (possibleOverloads.length > 1)
			throw new ReferenceError(`Multiple overloads exist for operator '${this.name}'' with ${operands}`);
		throw new TypeError(`No operator '${this.name}' has ${operands}`);
	}
}

function type(tok) {
	const matchedNumber = tok.match(/(\d+(\.\d*)?)|(\.\d+)/g);
	if (matchedNumber && matchedNumber[0] === tok) return "number";
	if (tok.match(/\w/g)) return "identifier";
	if (tok) return "operator";
	return null;
}

function split(tokens, sep) {
	const inx = tokens.indexOf(sep);
	if (inx > -1) return [
		...split(tokens.slice(0, inx), sep),
		...split(tokens.slice(inx + 1), sep)
	];
	return [tokens];
}

function tokenize(string) {
	const operatorNames = new Set([
		...operators.map(op => op.name),
		",", ".", "=", "//",
		"(", ")", "[", "]", "{", "}", "|>"
	]);

	const tokens = string
		.split(/(\b| )/g)
		.map(str => str.trim())
		.filter(str => !!str)
		.flatMap(tok => {
			if (tok.match(/\w/g)) return [tok];

			const toks = [];
			let acc = "";
			for (let i = 0; i < tok.length; i++) {
				const char = tok[i];
				if (operatorNames.has(acc) && !operatorNames.has(acc + char)) {
					toks.push(acc);
					acc = "";
				}
				acc += char;
			}
			if (operatorNames.has(acc)) toks.push(acc);
			return toks;
		});

	const finalTokens = [];

	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		if (type(tok) === "number") {
			const next = tokens[i + 1];
			if (next && next === ".") {
				const last = tokens[i + 2];
				if (last && type(last) === "number") {
					finalTokens.push(`${tok}.${last}`);
					i += 2;
					continue;
				}
			}
		}
		if (tok === ".") {
			const next = tokens[i + 1];
			if (next && type(next) === "number") {
				finalTokens.push(`0.${next}`);
				i++;
				continue;
			}
		}

		finalTokens.push(tok);
	}

	return finalTokens;
}

let lastExpressionEvaluated = null;

const callstack = [];
Object.defineProperty(window, "operands", {
	get: () => callstack[callstack.length - 1] ?? {}
});
function getVariable(name) {
	if (name in operands) return lastExpressionEvaluated = operands[name];
	if (name in variables) return lastExpressionEvaluated = variables[name];
	if (operatorNames.has(name)) return lastExpressionEvaluated = new OperatorReference(name);
	throw new ReferenceError(`No variable exists with name '${name}'`);
}

function setVariable(name, value) {
	variables[name] = value;
}

function parseList(line) {
	line.shift();
	const elements = [];
	while (line.length) {
		elements.push(evalValue(line));
		if (line[0] === ",") line.shift();
		if (line[0] === "}") {
			line.shift();
			break;
		}
	}
	return new Value(elements);
}

function evalValue(line) {
	if (type(line[0]) === "number") return parseFloat(line.shift());
	if (type(line[0]) === "identifier") return getVariable(line.shift());
	if (line[0] === "{") return parseList(line);
	if (line[0] === "(") {
		line.shift();
		const operator = new OperatorReference(line.shift());
		line.shift();
		return operator;
	}

	// unary ops
	const ops = [];
	while (line[0] && line[0] !== "{" && line[0] !== "(" && type(line[0]) === "operator") ops.unshift(line.shift());
	let acc = evalValue(line);
	for (let i = 0; i < ops.length; i++) {
		const operator = new OperatorReference(ops[i]);
		acc = operator.operate(acc);
	}
	return acc;
}

function parseOperands(line) {
	const operands = [];
	while (line[0] !== ")") {
		let type = null;
		if (line[0] === "real" || line[0] === "operator") { // has type annotation
			if (line[0] === "operator") type = line.shift();
			else {
				line.shift();
				type = "";
				while (line[0] === "[") {
					line.shift();
					if (line[0] === "]") type += "[]";
					else type += `[${line.shift()}]`;
					line.shift();
				}
			}
		}
		const name = line.shift();
		operands.push({ name, type });
		if (line[0] === ",") line.shift();
	}
	return operands;
}

function evalExpression(line) {
	const [accToks, ...steps] = split(line, "|>");

	let acc = evalValue(accToks);

	if (accToks.length) {
		const operands = [];
		while (accToks.length) operands.push(evalValue(accToks));
		return lastExpressionEvaluated = acc.operate(...operands);
	}

	for (const [operatorName, ...operandTokens] of steps) {
		const rhs = [];
		while (operandTokens.length) rhs.push(evalValue(operandTokens));
		const operator = new OperatorReference(operatorName);
		acc = operator.operate(acc, ...rhs);
	}
	return lastExpressionEvaluated = acc;
}

function evalLine(line) {
	[line] = split(line, "//"); // comments
	if (!line.length) return;

	const subject = line[0];
	const action = line[1];
	if (action === "=") { // variable declaration
		line.shift(); // subject <variable-name>
		line.shift(); // action =
		setVariable(subject, evalExpression(line));
		return getVariable(subject);
	} else if (action === "(" && line.indexOf("=") > -1) { // operator declaration
		line.shift(); // subject <operator-name>
		line.shift(); // action (
		const ops = parseOperands(line);
		line.shift(); // )
		line.shift(); // =
		operator(subject, (a, b) => {
			callstack.push({});
			operands[ops[0].name] = a;
			for (let i = 0; i < ops.length - 1; i++)
				operands[ops[i + 1].name] = b[i];
			const result = evalExpression(line);
			callstack.pop();
			return result;
		}, ops[0].type, ops.slice(1).map(op => op.type), ops.map(op => op.name));
		return getVariable(subject);
	} else return evalExpression(line);
}

function evalStat(command) {
	lastExpressionEvaluated = "";

	command
		.split("\n")
		.map(tokenize)
		.forEach(evalLine);

	return lastExpressionEvaluated;
}