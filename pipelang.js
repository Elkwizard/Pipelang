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
		return this.ignore ? "ignore" : `${this.baseType}${
			this.dimensions
				.map(dim => `(${dim ?? ""})`)
				.reverse()
				.join("")
		}`;
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
	slice(start = 0, end = this.length) {
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
			return `{ ${this.elements.join(", ")} }`;
		}
		return `{ }`;
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
	set localName(name) {
		if (this.overload)
			this.overload.localName = name;
		this._localName = name;
	}
	get localName() {
		return this._localName;
	}
	copy() {
		const result = new Operator(this.operands, this.method);
		result.sourceCode = this.sourceCode;
		result.tailCall = this.tailCall;
		if (result.overload) result.overload = result.overload.copy();
		return result;
	}
	withOverload(overload) {
		return this.copy().addOverload(overload);
	}
	addOverload(overload) {
		if (this.overload) this.overload = this.overload.withOverload(overload);
		else this.overload = overload;
		return this;
	}
	operate(...args) {
		return tryOperate(this, args);
	}
	arrayOperate(args) {
		if (this.overload) {
			try {
				return this.baseOperate(args, true);
			} catch (err) { }
			return this.overload.arrayOperate(args);
		}

		return this.baseOperate(args, true);
	}
	baseOperate(args, topLevel = false) {
		const { operandTypes } = this;
		const actualTypes = args.map(typeOf);

		if (actualTypes.length !== operandTypes.length)
			throw new OperandError(this.localName, actualTypes);

		const correctTypes = actualTypes.every((type, i) => type.hasElementsOfType(operandTypes[i]));
		if (!correctTypes)
			throw new OperandError(this.localName, actualTypes);

		const exactTypes = actualTypes.every((type, i) => type.equals(operandTypes[i]));
		if (exactTypes) {
			const result = this.method.apply(null, args);
			if (!topLevel && this.tailCall)
				return tryOperateStackless(result[0], result[1]);
			return result;
		}

		const structs = actualTypes.map((type, i) => type.slice(operandTypes[i]));
		const maxDims = Math.max(
			...structs
				.filter((_, i) => !operandTypes[i].ignore)
				.map(struct => struct.length)
		);
		const baseIndex = structs.findIndex(
			(struct, i) => !operandTypes[i].ignore && struct.length === maxDims
		);
		const baseStruct = structs[baseIndex];
		const base = args[baseIndex];

		if (!base.length)
			throw new TypeError("Cannot operate over an empty list");

		const elements = [];
		for (let i = 0; i < base.length; i++) {
			const subValue = this.baseOperate(args.map((arg, argInx) => {
				return (
					structs[argInx].length === baseStruct.length &&
					!operandTypes[argInx].ignore
				) ? arg.at(i) : arg;
			}));
			elements.push(subValue);
		}

		return new List(elements);
	}
	toString() {
		let normalized = `[${this.operands.map(([type, name]) => type.ignore ? name : type + " " + name).join(", ")} = ${this.sourceCode}]`
		if (this.overload) normalized += " & " + this.overload;
		return normalized;
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

// scope & built-ins
const variables = new Map();
let scopes = [];
const callStack = [];
const currentScope = new Proxy({}, {
	get(_, key) {
		for (let i = scopes.length - 1; i >= 0; i--)
			if (scopes[i].has(key)) {
				const value = scopes[i].get(key);
				if (value !== undefined) {
					if (value instanceof Operator)
						value.localName = key;
					return value;
				}
			}
		throw new ReferenceError(`No variable exists with name '${key}'`);
	},
	has(_, key) {
		return scopes.some(scope => scope.has(key));
	},
	set(_, key, value) {
		if (value === undefined)
			throw new TypeError(`Cannot assign void to a variable (assigning '${key}')`);

		scopes.at(-1).set(key, value);
	}
});

function resetScopes() {
	callStack.length = 0;
	scopes = [variables];
}

resetScopes();

function tryOperate(operator, args) {
	const { length } = callStack;
	const result = tryOperateStackless(operator, args);
	callStack.length = length;
	return result;
}

function tryOperateStackless(operator, args) {
	while (true) {
		if (operator instanceof Operator) {
			callStack.push(operator.localName);
			operator = operator.arrayOperate(args);
			if (!Array.isArray(operator)) return operator;
			[operator, args] = operator;
		} else if (operator instanceof List && args.length === 1) {
			return operator.at(args[0]);
		} else {
			throw new TypeError(`Cannot use type '${typeOf(operator)}' as an operator`);
		}
	}
}

function evalList(list) {
	return (list ?? []).map(evalExpression);
}

function evalBody({ statements }) {
	let result;

	for (const stmt of statements)
		result = evalExpression(stmt);

	return result;
}

function evalExpression(expr) {
	if (expr instanceof AST.FullExpression) {
		const { base, step } = expr;
		let init = evalExpression(base);
		
		if (step instanceof AST.Alias) {
			currentScope[step.name] = init;
		} else if (step instanceof AST.Reset) {
			init = evalExpression(step.value);
		} else {
			const args = evalList(step.arguments);
			if (init !== undefined) args.unshift(init);
			init = tryOperate(evalExpression(step.operator), args);
		}
		
		return init;
	}

	if (expr instanceof AST.InitialCall)
		return tryOperate(evalExpression(expr.operator), evalList(expr.arguments));

	if (expr instanceof AST.StringValue)
		return new List(JSON.parse(expr.value).split("").map(ch => ch.charCodeAt()));

	if (expr instanceof AST.NumberValue)
		return +expr.value;

	if (expr instanceof AST.CharValue)
		return JSON.parse(`"${
			expr.value
				.slice(1, -1)
				.replace(/\\'/, "'")
				.replace(/"/, "\\\"")
		}"`).charCodeAt();

	if (expr instanceof AST.Reference)
		return currentScope[expr.name];

	if (expr instanceof AST.List)
		return new List(evalList(expr.elements));

	if (expr instanceof AST.Prefix)
		return tryOperate(currentScope[expr.op], [evalExpression(expr.target)]);

	if (expr instanceof AST.Sum || expr instanceof AST.Product)
		return tryOperate(currentScope[expr.op], [
			evalExpression(expr.left),
			evalExpression(expr.right)
		]);

	if (expr instanceof AST.Expression) {
		const base = evalExpression(expr.base);
		const { step } = expr;

		if (step instanceof AST.Arguments)
			return tryOperate(base, evalList(step.arguments));
		
		if (step instanceof AST.Overload)
			return base.withOverload(evalExpression(step.overload));

		if (!(base instanceof List))
			throw new TypeError(`Cannot index into type '${typeOf(base)}'`);

		let { start, end } = step;
		if (start) start = evalExpression(start);
		if (end) end = evalExpression(end);
		return base.slice(start, end);
	}

	if (expr instanceof AST.Operator) {
		const parameters = (expr.parameters ?? []).map(parameter => {
			let type;
			if ("type" in parameter) {
				const base = parameter.type.base;
				const dimensions = (parameter.type.dimensions ?? [])
					.map(dim => "length" in dim ? +dim.length : null)
					.reverse();
				type = new Type(base, dimensions);
			} else type = new Type(null);
			return [type, parameter.name];
		});

		const closure = [...scopes];

		const { tailCall } = expr;

		const operator = new Operator(parameters, (...args) => {
			const scope = new Map();
			scope.set(Operator, operator);
			for (let i = 0; i < args.length; i++)
				scope.set(parameters[i][1], args[i]);
			const oldScopes = scopes;
			scopes = [...closure, scope];
			const returnValue = evalBody(expr.body);
			
			const result = tailCall ? [
					evalExpression(tailCall.operator),
					[returnValue, ...evalList(tailCall.arguments)]
			] : returnValue;

			scopes = oldScopes;

			return result;
		});

		if (tailCall) operator.tailCall = true;

		operator.sourceCode = format(expr.body.textContent.replace(/\s+/g, " "));

		return operator;
	}

	return "failure";
}

function evalStat(command) {
	resetScopes();

	const ast = parse(command);
	const { make } = AST;
	ast.transform(AST.Assignment, ({ target, value }) => {
		return make.FullExpression(value, make.Alias(target));
	});
	ast.transform(AST.Expression, expr => {
		if (expr.step instanceof AST.Property)
			return make.Expression(
				make.Reference("read"),
				make.Arguments([
					expr.base,
					make.StringValue(JSON.stringify(expr.step.key))
				])
			);
		
		return expr;
	});
	ast.transform(AST.Field, ({ key, value }) => {
		const method = value instanceof AST.Operator || (value instanceof AST.Expression && value.step instanceof AST.Overload);
		
		if (method) {
			const body = make.Body([value]);
			body.textContent = value.textContent;
			value = make.Operator(
				[make.Parameter(undefined, "this")],
				body
			);
		}

		return make.Expression(
			make.Reference(method ? "method" : "field"),
			make.Arguments([
				make.StringValue(JSON.stringify(key)),
				value
			])
		);
	});
	ast.transform(AST.InitialCall, ({ operator, arguments: [first, ...rest] }) => {
		return make.FullExpression(
			first, make.Call(operator, rest)
		);
	});
	ast.transform(AST.Operator, op => {
		op.body.statements = op.body.statements.map(stmt => {
			if (!(stmt.step instanceof AST.Call)) return stmt;
			op.tailCall = stmt.step;
			return stmt.base;
		});
		return op;
	});

	return evalBody(ast);
}

// built-ins
currentScope["true"] = 1;
currentScope["false"] = 0;
currentScope["NaN"] = NaN;
currentScope["Infinity"] = Infinity;

for (const op of [
	"+", "-", "*", "/", "%", "**",
	"&&", "||", "==", "!=", "<=", ">=", "<", ">"
]) {
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
	[new Type("any"), "value"]
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
	[new Type("any"), "terminal"]
], value => void value);

currentScope["filter"] = new Operator([
	[new Type("any", [null]), "data"],
	[new Type("operator"), "predicate"],
], (data, predicate) => new List(data.elements.filter(el => {
	return !!predicate.operate(el);
})));

currentScope["rangeTo"] = new Operator([
	[new Type("real"), "length"]
], length => new List(new Array(length).fill(0).map((_, i) => i)));

currentScope["sort"] = new Operator([
	[new Type("real", [null]), "list"]
], list => new List([...list.elements].sort((a, b) => a - b)));

currentScope["keySort"] = new Operator([
	[new Type("any", [null]), "list"],
	[new Type("operator"), "key"]
], (list, key) => new List(
	[...list.elements]
		.sort((a, b) => key.operate(a) - key.operate(b))
));

currentScope["isFinite"] = new Operator([
	[new Type("real"), "number"]
], number => +isFinite(number));

currentScope["len"] = new Operator([
	[new Type("any", [null]), "list"]	
], list => {
	if (list instanceof List) return list.elements.length;
	throw new TypeError("Cannot find length of non-list");
});

currentScope["call"] = new Operator([
	[new Type("any", [null]), "args"],
	[new Type("operator"), "op"]
], (args, op) => {
	return op.operate(...args.elements);
});

currentScope["string"] = new Operator([
	[new Type("any"), "value"]
], value => {
	const charCodes = value
		.toString()
		.split("")
		.map(char => char.charCodeAt(0));
	return new List(charCodes);
});

currentScope["==="] = new Operator([
	[new Type("any"), "a"],
	[new Type("any"), "b"]
], (a, b) => {
	const recurseEqual = (list1, list2) => {
		return list1.elements.every((v, i) => {
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

currentScope["timeout"] = new Operator([
	[new Type("operator"), "action"],
	[new Type("real"), "delay"]
], (action, delay) => void setTimeout(() => action.operate(), delay));