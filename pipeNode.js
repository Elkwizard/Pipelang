const fs = require("fs");

Array.prototype.toString = function () {
	return `[${this.join(", ")}]`;
};

const run = (file, keys = []) => {
	return eval(fs.readFileSync(file, "utf-8") + `; ({ ${keys.join(", ")} })`)
};

const document = {
	createElement() {
		return {
			innerText: null,
			get innerHTML() {
				return this.innerText;
			}
		};
	}
};

const {
	scopes, currentScope, evalStat, Operator, Type, List,
	NUMBER_REGEX, SINGLE_LINE_COMMENT_REGEX,
	MULTILINE_COMMENT_REGEX
} = run(
	"./pipelang.js",
	[
		"scopes", "currentScope", "evalStat", "Operator", "Type",
		"NUMBER_REGEX", "SINGLE_LINE_COMMENT_REGEX", "MULTILINE_COMMENT_REGEX"
	]
);
const { highlight } = run("./highlightPL.js", ["highlight"]);
run("./stdlib.js");

Array.prototype.join = function (sep) {
	let result = "";
	for (let i = 0; i < this.length; i++) {
		result += this[i] + ((i === this.length - 1) ? "" : sep);
	}
	return result;
};

const { color } = require("./formatting");

function log(message, col = "white") {
	console.log(color(col, message));
}

function logHTML(message, prefix = "") {
	const usePalette = (name, palette) => {
	for (const key in palette) {
		message = message.replaceAll(new RegExp(
			String.raw`\<span class\=\"${name} ${key}\"\>([\w\W]*?)\<\/span\>`, "g"
			), color(palette[key], "$1"));
		}
	};
		
	usePalette("code", CODE_COLORS);
	usePalette("output", OUT_COLORS);
	
	console.log(prefix + message);
}

const CODE_COLORS = {
	number: "light green",
	function: "cyan",
	symbol: "white",
	type: "magenta",
	comment: "dark blue",
	string: "light yellow",
	base: "dark gray"
};

const OUT_COLORS = {
	number: "magenta",
	function: "green",
	symbol: "light gray",
	type: "red",
	comment: "blue",
	string: "yellow",
	base: "dark gray"
};

function exec(command) {
	const JS_EXECUTED_COMMAND = "light gray";
	const THROWN_ERROR = "red";

	try {
		const JS = command[0] === "#";
		if (JS) log(command, JS_EXECUTED_COMMAND);
		else logHTML(highlight(command, "code"));
		const result = JS ? window.eval(command.slice(1)) : evalStat(command);
		logHTML(highlight(result ?? "<void>", "output"), "» ");
		if (result !== undefined) currentScope["ans"] = result;
	} catch (err) {
		// throw err;
		log(err + "\n" + scopes.map(scope => {
			return "\t at " + scope.constructor.operator.localName;
		}).reverse().join("\n"), THROWN_ERROR);
	}
}

currentScope["print"] = new Operator([
	[new Type(null), "value"]
], value => logHTML(highlight(value, "output")));

currentScope["printString"] = new Operator([
	[new Type("real", [null]), "charCodes"]
], charCodes => log(String.fromCharCode(...charCodes.toArray())));

currentScope["printChar"] = new Operator([
	[new Type("real"), "charCode"]
], charCode => log(String.fromCharCode(charCode)));

currentScope["printMatrix"] = new Operator([
	[new Type("real", [null, null]), "matrix"]
], matrix => {
	matrix = currentScope.roundTo.operate(matrix, currentScope.PRINT_MATRIX_DIGITS);
	const strings = matrix.toArray().map(r => r.map(v => v.toString()));
	const columnWidths = new Array(strings[0].length).fill(0);
	for (let i = 0; i < strings.length; i++) {
		for (let j = 0; j < strings[0].length; j++) {
			columnWidths[j] = Math.max(columnWidths[j], strings[i][j].length);
		}
	}
	const sp = " ";
	const pad = (string, strLen, length) => {
		const empty = length - strLen;
		const left = Math.ceil(empty / 2);
		const right = empty - left;
		return sp.repeat(left) + string + sp.repeat(right);
	};
	const spacing = 1;
	const totalWidth = columnWidths.reduce((a, b) => a + b, 0) + (columnWidths.length + 1) * spacing;
	logHTML(`┌${sp.repeat(totalWidth)}┐\n` + strings.map(row => `│${sp.repeat(spacing)}${row.map((v, i) => pad(highlight(v, "output"), v.length, columnWidths[i])).join(sp.repeat(spacing))}${sp.repeat(spacing)}│`).join("\n") + `\n└${sp.repeat(totalWidth)}┘`);
});

currentScope["typeof"] = new Operator([
	[new Type(null), "value"]
], value => logHTML(highlight(typeOf(value), "output")));

currentScope["clear"] = new Operator([], () => {
	console.clear();
	log("workspace cleared");
});

module.exports = { exec, currentScope, Operator, Type, List };