class Type {
	constructor(baseType, dimensions = []) {
		if (baseType === null) this.ignore = true;
		else {
			this.ignore = false;
			this.baseType = baseType;
			this.dimensions = dimensions;
		}
	}
	get simplified() {
		const element = currentScope[this.baseType];
		if (element.baseType === this.baseType) return null;
		return new Type(
			element.baseType,
			this.dimensions.concat(element.dimensions)
		);
	}
	get fullySimplified() {
		let type = this;
		while (true) {
			const { simplified } = type;
			if (!simplified) return type;
			type = simplified;
		}
	}
	get elementType() {
		if (!this.dimensions.length) return null;
		return new Type(this.baseType, this.dimensions.slice(1));
	}
	*[Symbol.iterator]() {
		for (let i = 0; i < this.dimensions.length; i++)
			yield new Type(this.baseType, this.dimensions.slice(0, i));
	}
	compatibleWith(other) {
		if (other.ignore)
			return this;

		let type = this;
		while (type) {
			if (
				type.baseType === other.baseType ||
				(
					other.baseType === "any" &&
					type.dimensions.length >= other.dimensions.length
				)
			) return type;
			type = type.simplified;
		}
		
		throw new TypeError(`Type '${this}' is not compatible with '${other}'`);
	}
	convertibleTo(other) {
		return this.fullySimplified.equals(other.fullySimplified);
	}
	withDimension(dim) {
		return new Type(this.baseType, [dim, ...this.dimensions]);
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
			
				if (thisDim !== typeDim && typeDim !== null)
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
			
			if (thisDim !== typeDim && typeDim !== null)
				return false;
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
					if (thisDim !== typeDim && typeDim !== null)
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
			
			if (thisDim !== typeDim && typeDim !== null)
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
	constructor(elements, type) {
		// validate
		// if (!elements.length)
		// 	throw new RangeError("No elements provided");
		const types = elements.map(typeOf);
		for (let i = 1; i < types.length; i++) {
			if (!types[i - 1].equals(types[i]))
				throw new TypeError("Not all elements are the same type");
		}
		
		if (types.length > 0 && types[0].baseType === "void")
			throw new TypeError("List elements cannot be of type void");

		this.elements = elements;
		this.length = elements.length;
		this.type = type ?? typeOf(this);
	}
	compatibleWith(type) {
		return this.withType(this.type.compatibleWith(type));
	}
	withType(type) {
		if (type !== this.type) {
			if (!this.type.convertibleTo(type))
				throw new TypeError(`Cannot convert from '${this.type}' to '${type}'`);
			let { elements } = this;
			const { elementType } = type;
			if (elementType)
				elements = elements.map(element => tryCast(element, elementType));
			const result = new List(elements, type);
			return result;
		}
		return this;
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
			if (this.type.dimensions.length === 0 && this.type.baseType === "string")
				return JSON.stringify(String.fromCharCode(...this.elements));
			// if (this.elements[0] instanceof List) return `${LIST_OPEN}\n${this.elements.map(el => "\t" + el).join(",\n")}\n${LIST_CLOSE}`;
			return `{ ${this.elements.join(", ")} } as ${this.type}`;
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
	constructor(operands, method, tailCall = false) {
		this.operands = operands;
		this.operandTypes = operands.map(op => op[0]);
		this.operandNames = operands.map(op => op[1]);
		this.method = method;
		this.tailCall = tailCall;
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
		const result = new Operator(this.operands, this.method, this.tailCall);
		result.sourceCode = this.sourceCode;
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

		if (args.length !== operandTypes.length)
			throw new TypeError(`No operator '${this.localName}' exists with ${args.length} operand${args.length === 1 ? "" : "s"}`);

		args = args.map((arg, i) => {
			if (arg instanceof List)
				return arg.compatibleWith(operandTypes[i]);
			return arg;
		});

		const actualTypes = args.map(typeOf);

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
		let normalized = `[${this.operands.map(([type, name]) => {
			let result = type.ignore ? "" : type + " ";
			result += typeof name === "string" ? name : name.textContent;
			return result;
		}).join(", ")} = ${this.sourceCode}]`
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
		case Type:
			return new Type("type");
		case List:
			if (value.type) return value.type;
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

function cannotUse(value, message) {
	throw new TypeError(`Cannot use type '${typeOf(value)}' ${message}`);
}

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
		} else if (operator instanceof Type && args.length <= 1) {
			if (!args.length) {
				return operator.withDimension(null);
			} else if (typeof args[0] === "number") {
				return operator.withDimension(args[0]);
			} else {
				cannotUse(args[0], "as a type dimension");
			}
		} else if (operator instanceof List && args.length === 1) {
			if (typeof args[0] === "number") {
				return operator.at(args[0]);
			} else {
				cannotUse(args[0], "as an index");
			}
		} else {
			cannotUse(operator, "as an operator");
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

function alias(binding, value) {
	if (binding instanceof AST.WrappedName) {
		alias(binding.name, tryOperate(value, []));
	} else if (binding instanceof AST.ObjectDestructure) {
		const { read } = currentScope;
		for (const { key, name } of binding.fields)
			alias(name, tryOperate(read, [value, key]));
	} else if (binding instanceof AST.ListDestructure) {
		if (!(value instanceof List))
			cannotUse(value, "as a list");

		for (let i = 0; i < binding.names.length; i++)
			alias(binding.names[i], value.at(i))
	} else {
		currentScope[binding] = value;
	}
}

function tryCast(base, type) {
	if (!(base instanceof List)) {
		const baseType = typeOf(base);
		if (baseType.equals(type)) return base;
		throw new TypeError(`Cannot cast primitive type '${baseType}'`);
	}
	if (!(type instanceof Type))
		cannotUse(type, "as a cast target");
	return base.withType(type);
}

function evalExpression(expr) {
	if (expr instanceof AST.FullExpression) {
		const { base, step } = expr;
		let init = evalExpression(base);
		
		if (step instanceof AST.Alias) {
			alias(step.name, init);
		} else if (step instanceof AST.Reset) {
			init = evalExpression(step.value);
		} else if (step instanceof AST.Cast) {
			init = tryCast(init, evalExpression(step.type));
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

	if (expr instanceof AST.Reference) {
		const value = currentScope[expr.name];
		if (value instanceof Type) return new Type(expr.name);
		return value;
	}

	if (expr instanceof AST.List)
		return new List(evalList(expr.elements));

	if (expr instanceof AST.Expression) {
		const base = evalExpression(expr.base);
		const { step } = expr;

		if (step instanceof AST.Arguments)
			return tryOperate(base, evalList(step.arguments));
		
		if (step instanceof AST.Overload)
			return base.withOverload(evalExpression(step.overload));

		if (step instanceof AST.Cast) {
			return tryCast(base, evalExpression(step.type))
		}

		if (!(base instanceof List))
			cannotUse(base, "as a list");

		let { start, end } = step;
		if (start) start = evalExpression(start);
		if (end) end = evalExpression(end);
		return base.slice(start, end);
	}

	if (expr instanceof AST.Operator) {
		let parameters;
		if (expr.templateNames) {
			parameters = expr.templateNames
				.filter(name => !(name in currentScope))
				.map(name => [new Type(null), name]);
		} else {
			parameters = (expr.parameters ?? []).map(parameter => {
				let type;
				if (parameter.type) {
					type = evalExpression(parameter.type);
					if (!(type instanceof Type))
						cannotUse(type, "as a operand type");
				} else type = new Type(null);
				return [type, parameter.name];
			});
		}

		const closure = [...scopes];

		const { tailCall } = expr;

		const operator = new Operator(parameters, (...args) => {
			const oldScopes = scopes;
			
			const scope = new Map();
			scope.set(Operator, operator);
			scopes = [...closure, scope];
			
			for (let i = 0; i < args.length; i++)
				alias(parameters[i][1], args[i]);
			
			const returnValue = evalBody(expr.body);
			
			const result = tailCall ? [
				evalExpression(tailCall.operator),
				[returnValue, ...evalList(tailCall.arguments)]
			] : returnValue;

			scopes = oldScopes;

			return result;
		}, !!tailCall);

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
			const body = make.Body([value]).from(value);
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
	ast.transform([AST.Prefix, AST.Exponential, AST.Product, AST.Sum, AST.Compare, AST.Logic], node => {
		const { op, ...rest } = node;
		const args = Object.values(rest);
		return make.Expression(
			make.Reference(op),
			make.Arguments(args)
		).from(node);
	});
	ast.transform(AST.Conditional, node => {
		const { condition, ifTrue, ifFalse } = node;
		return make.Expression(
			make.Reference("?"),
			make.Arguments([
				condition,
				make.Operator(undefined, make.Body([ifTrue])),
				make.Operator(undefined, make.Body([ifFalse]))
			])
		).from(node);
	});
	ast.transform(AST.Operator, op => {
		if (!(op.body instanceof AST.Body)) {
			op.templateNames = new Set();
			op.body.forEach([AST.Operator, AST.Reference], node => {
				if (node instanceof AST.Operator) return false;
				op.templateNames.add(node.name)
			});
			op.templateNames = [...op.templateNames];
			op.body = make.Body([op.body]).from(op.body);
		}
		return op;
	});
	ast.transform(AST.Operator, op => {
		op.body.statements = op.body.statements.map(stmt => {
			if (!(stmt.step instanceof AST.Call)) return stmt;
			op.tailCall = stmt.step;
			return stmt.base;
		});
		return op;
	});
	ast.forEach(AST.DestructureField, field => {
		if (!field.name) field.name = field.key;
		field.key = evalExpression(make.StringValue(JSON.stringify(field.key)));
	});
	ast.transform(AST.StringValue, str => {
		return make.Expression(
			str, make.Cast(make.Reference("string"))
		).from(str);
	});

	return evalBody(ast);
}

// types
currentScope["operator"] = new Type("operator");
currentScope["real"] = new Type("real");
currentScope["type"] = new Type("type");
currentScope["any"] = new Type("any");
currentScope["primitive"] = new Type("primitive");

currentScope["convertibleTo"] = new Operator([
	[new Type("type"), "src"],
	[new Type("type"), "dst"]
], (a, b) => +a.convertibleTo(b));

currentScope["in"] = new Operator([
	[new Type("any"), "value"],
	[new Type("type"), "class"]
], (value, type) => +typeOf(value).convertibleTo(type));

currentScope["typeof"] = new Operator([
	[new Type("any"), "value"]
], value => typeOf(value));

currentScope["simplify"] = new Operator([
	[new Type("type"), "class"]
], type => type.fullySimplified);

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
currentScope["error"] = new Operator([
	[new Type("real", [null]), "message"]
], string => {
	throw new Error(String.fromCharCode(...string.elements));
});

currentScope["?"] = new Operator([
	[new Type("real"), "condition"],
	[new Type("operator"), "ifTrue"],
	[new Type("operator"), "ifFalse"],
], (cond, ifTrue, ifFalse) => [cond ? ifTrue : ifFalse, []], true);

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
], list => list.elements.length);

currentScope["arity"] = new Operator([
	[new Type("operator"), "op"]
], op => op.operands.length);

currentScope["call"] = new Operator([
	[new Type("any", [null]), "args"],
	[new Type("operator"), "op"]
], (args, op) => {
	return op.operate(...args.elements);
});

currentScope["toString"] = new Operator([
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