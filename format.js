(() => {
	const indent = (str, n = 1) => str
		.split("\n")
		.map(line => "\t".repeat(n) + line)
		.join("\n");

	const prec = ["Composition", "Exponential", "Product", "Sum", "Type", "Compare", "Logic"].map(name => AST[name]);
	const assoc = ["right", "right", "left", "left", "left", "left"];
	
	for (const type of prec)
		type.prototype.toString = function (parent) {
			if (this.replace) return this.replace.toString(parent);
			
			const result = `${this.left.toString(this)} ${this.op} ${this.right.toString(this)}`; 
			let parens = false;
			if (parent) {
				const parentInx = prec.indexOf(parent.constructor);
				const thisInx = prec.indexOf(this.constructor);
				parens = parentInx < thisInx || (parentInx === thisInx && parent[assoc[thisInx]] !== this);
			}
			return parens ? `(${result})` : result;
		};

	const join = (list, delim) => (list ?? []).join(delim);

	AST.Prefix.prototype.toString = function () {
		return `${this.op}${this.target}`;
	};

	AST.Overload.prototype.toString = function () {
		return ` & ${this.overload}`;
	};

	AST.Arguments.prototype.toString = function () {
		return `(${join(this.arguments, ", ")})`;
	};

	AST.Index.prototype.toString = function () {
		return `(${this.start ?? ""}:${this.end ?? ""})`;
	};

	AST.Property.prototype.toString = function () {
		return `.${this.key}`;
	};

	AST.Expression.prototype.toString = function () {
		if (this.replace) return this.replace.toString();
		return `${this.base}${this.step}`; 
	};

	const parens = expr => {
		return (
			expr.op ||
			expr instanceof AST.Conditional ||
			expr instanceof AST.Pipe ||
			expr instanceof AST.Assignment
		) ? `$(${expr})` : expr;
	};

	AST.Call.prototype.toString = function () {
		return `${[this.operator, ...(this.arguments ?? [])].map(parens).join(" ")}`;
	};

	let inline = false;

	AST.Parameter.prototype.toString = function () {
		inline = true;

		let result = "";
		if (this.type) result += parens(this.type) + " ";
		result += this.name;
		if (this.value) result += ": " + this.value;
		if (this.guard) result += " where " + this.guard;

		inline = false;

		return result;
	};

	AST.Operator.prototype.toString = function () {
		if (!(this.body instanceof AST.Body)) return `[${this.body}]`;
		const block = this.body.statements?.length > 1;
		const params = !!this.parameters;
		let content = `${join(this.parameters, ", ")}${params ? " " : ""}= ${block ? "\n" : ""}${this.body.toString(false)}`;
		
		const lines = content.split("\n").length;
		const multi = lines > 1;
		if (multi && params) content = block ? indent(content, 2).slice(1) : indent(content);
		return multi ? `[${params ? "\n" : ""}${content}\n]` : `[${content}]`;
	};

	AST.Pipe.prototype.toString = function () {
		if (this.replace) return this.replace.toString();
		if (inline) return `${this.source} |> ${this.step}`;
		return `${this.source}\n${indent(`|> ${this.step}`)}`;
	};

	AST.Field.prototype.toString = AST.DestructureField.prototype.toString = function () {
		return `${this.key}:${this.value ? " " + this.value : ""}`;
	};

	const braced = (ast, key) => {
		const elements = ast[key];
		if (!elements) return "{ }";
		const strings = elements.map(String);
		const simple = strings.join(", ");
		const longestLine = Math.max(...simple.split("\n").map(line => line.length));
		if (longestLine > 40 || (elements.length > 1 && elements[0] instanceof ast.constructor))
			return `{\n${indent(strings.join(",\n"))}\n}`;
		return `{ ${simple} }`;
	};

	AST.List.prototype.toString = function () {
		return braced(this, "elements");
	};

	AST.ListDestructure.prototype.toString = function () {
		return braced(this, "names");
	};

	AST.ObjectDestructure.prototype.toString = function () {
		return braced(this, "fields");
	};

	AST.Body.prototype.toString = function (global = true) {
		return this.statements.join(";\n") + (global ? ";" : "");
	};
})();