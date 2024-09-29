class Void {
	toString() {
		return "no";
	}
}

const VOID = new Void();

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
	withDimension(dim) {
		if (dim !== null) {
			if (typeof dim !== "number")
				cannotUse(dim, "as a dimension");
			if (!Number.isInteger(dim))
				throw new TypeError(`Cannot use non-integer dimension '${dim}'`);
		}
		return new Type(this.baseType, [...this.dimensions, dim]);
	}
	slice(base) {
		return base.ignore ? this.dimensions : this.dimensions.slice(base.dimensions.length);
	}
	commonWith(other) {
		if (other.baseType === "primitive")
			return this.dimensions.length === 1 ? this : null;
		
		if (this.baseType === "primitive")
			return other.dimensions.length === 1 ? other : null;

		if (this.dimensions.length !== other.dimensions.length)
			return null;

		if (this.baseType !== other.baseType)
			return null;

		return new Type(
			this.baseType,
			this.dimensions.map((d, i) => d !== other.dimensions[i] ? null : d)
		);
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
				.join("")
		}`;
	}
}

class List {
	constructor(elements) {
		if (elements.length) {
			let commonType = typeOf(elements[0]);
			for (let i = 1; i < elements.length; i++) {
				commonType = commonType.commonWith(typeOf(elements[i]));
				if (!commonType)
					throw new TypeError("List elements must share a common type");
			}

			this.type = commonType.withDimension(elements.length);
		} else {
			this.type = new Type("primitive", [0]);
		}

		this.elements = elements;
		this.length = elements.length;
	}
	decay() {
		return new List(this.elements);
	}
	withType(type) {
		if (!(type instanceof Type))
			cannotUse(type, "as an object type");

		if (
			type.ignore ||
			type.dimensions.length ||
			primitiveTypes.has(type.baseType)
		) throw new TypeError(`Cannot use '${type.toString()}' as an object type`);

		const result = this.decay();
		result.type = type;
		result.exotic = true;
		return result;
	}
	invalidIndex(index) {
		return index < 0 || index >= this.length;
	}
	wrapIndex(index) {
		return index < 0 ? index + this.length : index;
	}
	slice(start = 0, end = this.length) {
		start = this.wrapIndex(start);
		end = this.wrapIndex(end);
		if (start === end) {
			if (start < 0 || start > this.length) throw new RangeError(`Range ${start}:${end} is out of bounds for type '${typeOf(this)}'`);
			return new List([]);
		}
		if (this.invalidIndex(start) || this.invalidIndex(end - 1)) throw new RangeError(`Range ${start}:${end} is out of bounds for type '${typeOf(this)}'`);
		return new List(this.elements.slice(start, end));
	}
	at(index) {
		index = this.wrapIndex(index);
		if (this.invalidIndex(index)) throw new RangeError(`Index '${index}' is out of bounds for type '${typeOf(this)}'`);
		return this.elements[index];
	}
	toArray() {
		if (this.elements.length) {
			if (this.elements[0] instanceof List)
				return this.elements.map(element => element.toArray());
			else return [...this.elements];
		} else return [];
	}
	asString() {
		return String.fromCharCode(...this.elements);
	}
	toString() {
		const prefix = this.exotic ? this.type.toString() : "";
		if (this.elements.length) {
			const fields = this.elements.map(field => this.parseField(field));
			if (fields.every(Boolean))
				return prefix + `{ ${fields.join(", ")} }`;
			return prefix + `{ ${this.elements.join(", ")} }`;
		}
		return prefix + `{ }`;
	}
	parseField(field) {
		if (field.length !== 2) return null;
		try {
			const [key, value] = field.elements;
			return `${Operator.unwrap(key).asString()}: ${value.operate(this)}`;
		} catch (err) {
			return null;
		}
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
		this.operandDefaults = operands.map(op => op[2]);
		this.minOperands = 0;
		for (let i = 0; i < this.operandDefaults.length; i++)
			if (!this.operandDefaults[i])
				this.minOperands = i + 1;
		if (this.operandDefaults.slice(0, this.minOperands).some(Boolean))
			throw new TypeError("Optional operands must be consecutive");
		this.maxOperands = this.operands.length;
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
	get overloads() {
		const result = [this.copyAlone()];
		if (this.overload) result.push(...this.overload.overloads);
		return result;
	}
	copyAlone() {
		const result = new Operator(this.operands, this.method, this.tailCall);
		result.sourceCode = this.sourceCode;
		return result;
	}
	copy() {
		const result = this.copyAlone();
		if (this.overload)
			result.overload = this.overload.copy();
		return result;
	}
	withOverload(overload) {
		if (!(overload instanceof Operator))
			cannotUse(overload, "as an overload");
		return this.copy().addOverload(overload);
	}
	addOverload(overload) {
		if (this.overload) this.overload = this.overload.withOverload(overload);
		else this.overload = overload;
		return this;
	}
	fail(Error, ...args) {
		const error = new Error(...args);
		error.operator = this;
		throw error;
	}
	operate(...args) {
		return tryOperate(this, args);
	}
	arrayOperate(args) {
		if (this.overload) {
			const { length } = callStack;
			try {
				return this.baseOperate(args, true);
			} catch (err) {
				if (err.operator !== this)
					throw err;
				callStack.length = length;
			}
			return this.overload.arrayOperate(args);
		}

		return this.baseOperate(args, true);
	}
	baseOperate(args, topLevel = false) {
		const { operandTypes } = this;

		if (args.length < this.minOperands || args.length > this.maxOperands)
			this.fail(TypeError, `No operator '${this.localName}' exists with ${args.length} operand${args.length === 1 ? "" : "s"}`);

		while (args.length < this.maxOperands) {
			const value = this.operandDefaults[args.length];
			args.push(evalExpression(value));
		}

		const actualTypes = args.map(typeOf);

		const correctTypes = actualTypes.every((type, i) => type.hasElementsOfType(operandTypes[i]));
		if (!correctTypes)
			this.fail(OperandError, this.localName, actualTypes);

		const exactTypes = actualTypes.every((type, i) => type.equals(operandTypes[i]));
		if (exactTypes) {
			const result = this.method.apply(null, args) ?? VOID;
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
			this.fail(TypeError, "Cannot operate over an empty list");

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
		let { sourceCode } = this;
		if (sourceCode instanceof AST) {
			sourceCode = format(sourceCode.textContent.replace(/\s+/g, " "));
			// sourceCode = this.sourceCode.toString();
		}

		let normalized = `[${this.operands.map(([type, name, value]) => {
			let result = type.ignore ? "" : type + " ";
			result += typeof name === "string" ? name : name.textContent;
			if (value) result += ": " + value.textContent;
			return result;
		}).join(", ")} = ${sourceCode}]`;
		if (this.overload) normalized += " & " + this.overload;
		return normalized;
	}
	static unwrap(value) {
		return tryOperate(value, []);
	}
	static wrap(value) {
		return new Operator([], () => value);
	}
}

function typeOf(value) {
	switch (value.constructor) {
		case Number:
			return new Type("real");
		case Operator:
			return new Type("operator");
		case Type:
			return new Type("type");
		case Void:
			return new Type("void");
		case List:
			return value.type;
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

function evalExpression(expr) {
	if (expr instanceof AST.OverloadAssignment) {
		const { target, value } = expr;
		
		evalExpression(value);
	}
	
	if (expr instanceof AST.FullExpression) {
		const { base, step } = expr;
		let init = evalExpression(base);
		
		if (step instanceof AST.Alias) {
			const { name } = step;
			if (step.overload && name in currentScope) {
				const value = currentScope[name];
				if (!(value instanceof Operator))
					cannotUse(value, "as an overload target");
				return currentScope[name] = value.withOverload(init);
			}
			
			alias(name, init);
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

	if (expr instanceof AST.Expression) {
		const base = evalExpression(expr.base);
		const { step } = expr;

		if (step instanceof AST.Arguments)
			return tryOperate(base, evalList(step.arguments));
		
		if (step instanceof AST.Overload)
			return base.withOverload(evalExpression(step.overload));

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
				return [type, parameter.name, parameter.value];
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

		operator.sourceCode = expr.body;

		return operator;
	}

	return "failure";
}

function evalStat(command) {
	resetScopes();

	const ast = parse(command);
	const { make } = AST;
	ast.transform(AST.Class, ({ name, body }) => {
		return make.Assignment(
			name, make.Expression(
				make.Reference("createClass"),
				make.Arguments([
					make.StringValue(JSON.stringify(name)),
					body
				])
			)
		);
	});
	ast.transform(AST.OverloadAssignment, ({ target, value }) => {
		return make.FullExpression(value, make.Alias("&", target));
	});
	ast.transform(AST.Assignment, ({ target, value }) => {
		return make.FullExpression(value, make.Alias(undefined, target));
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
	ast.transform([AST.Prefix, AST.Composition, AST.Exponential, AST.Product, AST.Sum, AST.Compare, AST.Logic], node => {
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
				make.Operator(undefined, make.Body([ifTrue]).from(ifTrue)),
				make.Operator(undefined, make.Body([ifFalse]).from(ifTrue))
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
		const { statements } = op.body;
		op.body.statements = statements.map((stmt, i) => {
			if (!(stmt.step instanceof AST.Call) || i < statements.length - 1) return stmt;
			op.tailCall = stmt.step;
			return stmt.base;
		});
		return op;
	});
	ast.forEach(AST.DestructureField, field => {
		if (!field.name) field.name = field.key;
		field.key = evalExpression(make.StringValue(JSON.stringify(field.key)));
	});

	return evalBody(ast);
}

// types
currentScope["ignore"] = new Type(null);
const primitiveTypes = new Set(["operator", "real", "type", "void", "any", "primitive"]);
for (const type of primitiveTypes)
	currentScope[type] = new Type(type);

currentScope["convertibleTo"] = new Operator([
	[new Type("type"), "src"],
	[new Type("type"), "dst"]
], (src, dst) => +src.equals(dst));

currentScope["commonWith"] = new Operator([
	[new Type("type"), "a"],
	[new Type("type"), "b"]
], (a, b) => {
	if (
		a.ignore || b.ignore ||
		a.baseType === "any" ||
		b.baseType === "any"
	) throw new TypeError("Cannot find commonality between non-concrete types");
	return a.commonWith(b);
});

currentScope["typeOf"] = new Operator([
	[new Type("any"), "value"]
], value => typeOf(value));

currentScope["dimensions"] = new Operator([
	[new Type("type"), "class"]
], type => new List(type.dimensions.map(dim => dim === null ? -1 : dim)));

currentScope["baseOf"] = new Operator([
	[new Type("type"), "class"]
], type => new Type(type.baseType));

currentScope["decay"] = new Operator([
	[new Type(null), "object"]
], object => object.decay?.() ?? object);

currentScope["as"] = new Operator([
	[new Type("operator", [2, null]), "object"],
	[new Type("type"), "newType"]
], (object, name) => object.withType(name));

currentScope["createBaseType"] = new Operator([
	[new Type("real", [null]), "name"]
], name => {
	name = name.asString();
	return new Type(name);
});

currentScope["operands"] = new Operator([
	[new Type("operator"), "op"]
], op => new List(op.operandTypes));

currentScope["overloads"] = new Operator([
	[new Type("operator"), "op"]
], op => new List(op.overloads));

currentScope["createOperator"] = new Operator([
	[new Type("type", [null]), "operandTypes"],
	[new Type("operator"), "body"]
], (args, body) => {
	return new Operator(
		args.elements.map((type, i) => [type, `_${i + 1}`]),
		(...args) => body.operate(new List(args.map(Operator.wrap)))
	);
});

// built-ins
currentScope["true"] = 1;
currentScope["false"] = 0;
currentScope["NaN"] = NaN;
currentScope["Infinity"] = Infinity;
for (const name of ["no", "null", "nil", "nada", "zilch", "NA", "nullptr"])
	currentScope[name] = VOID;

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
	throw new Error(string.asString());
});

currentScope["?"] = new Operator([
	[new Type("real"), "condition"],
	[new Type("operator"), "ifTrue"],
	[new Type("operator"), "ifFalse"],
], (cond, ifTrue, ifFalse) => [cond ? ifTrue : ifFalse, []], true);

currentScope["filter"] = new Operator([
	[new Type("any", [null]), "data"],
	[new Type("operator"), "predicate"],
], (data, predicate) => new List(
	data.elements.filter(el => !!predicate.operate(el))
));

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

currentScope["unwrapCall"] = new Operator([
	[new Type("operator", [null]), "args"],
	[new Type("operator"), "op"]
], (args, op) => op.operate(...args.elements.map(Operator.unwrap)));

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
	if (a instanceof Type) {
		if (a.ignore || b.ignore) return +(a.ignore === b.ignore);
		if (a.baseType !== b.baseType) return 0;
		if (a.dimensions.length !== b.dimensions.length) return 0;
		return +a.dimensions.every((v, i) => v === b.dimensions[i]);
	}
	if (a instanceof List) {
		if (a.length !== b.length) return 0;
		if (!a.length) return 1;
		if (!typeOf(a).equals(typeOf(b))) return 0;
		return +recurseEqual(a, b);
	}
	return +(a === b);
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