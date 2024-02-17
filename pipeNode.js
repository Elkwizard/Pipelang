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
	scopes, currentScope, evalStat, Operator, Type,
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

Array.prototype.join = function(sep) {
	let result = "";
	for (let i = 0; i < this.length; i++) {
		result += this[i] + ((i === this.length - 1) ? "" : sep);
	}
	return result;
}

const escape = x => `\x1b[${x}m`;
const color = (name, text) => {
	const colorMap = {
		"black": 30,
		"red": 31,
		"green": 32,
		"yellow": 33,
		"blue": 34,
		"magenta": 35,
		"cyan": 36,
		"light gray": 37,
		"dark gray": 90,
		"light red": 91,
		"light green": 92,
		"light yellow": 93,
		"light blue": 94,
		"light magenta": 95,
		"light cyan": 96,
		"white": 97
	};
	if (!(name in colorMap)) return name;
	return escape(colorMap[name]) + text + escape(39);
};

const underline = text => escape(4) + text + escape(24);

const background = (name, text) => {
	const colorMap = {
		"black": 40,
		"red": 41,
		"green": 42,
		"yellow": 43,
		"blue": 44,
		"magenta": 45,
		"cyan": 46,
		"light gray": 47,
		"dark gray": 100,
		"light red": 101,
		"light green": 102,
		"light yellow": 103,
		"light blue": 104,
		"light magenta": 105,
		"light cyan": 106,
		"white": 107
	};
	if (!(name in colorMap)) return name;
	return escape(colorMap[name]) + text + escape(49);
};

const deformat = text => text.replace(/\x1b\[(\d+?)m/g, "");

module.exports = { color, underline, deformat, background };

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

function clear() {
	console.clear();
	return "workspace cleared";
}

const CODE_COLORS = {
	number: "light green",
	function: "light blue",
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
	const sp = "&nbsp;";
	const pad = (string, strLen, length) => {
		const empty = length - strLen;
		const left = Math.ceil(empty / 2);
		const right = empty - left;
		return sp.repeat(left) + string + sp.repeat(right);
	};
	const spacing = 1;
	const totalWidth = columnWidths.reduce((a, b) => a + b, 0) + (columnWidths.length + 1) * spacing;
	logHTML(`┌${sp.repeat(totalWidth)}┐<br>` + strings.map(row => `│${sp.repeat(spacing)}${row.map((v, i) => pad(highlight(v, "output"), v.length, columnWidths[i])).join(sp.repeat(spacing))}${sp.repeat(spacing)}│`).join("<br>") + `<br>└${sp.repeat(totalWidth)}┘`);
});

currentScope["typeof"] = new Operator([
	[new Type(null), "value"]
], value => logHTML(highlight(typeOf(value), "output")));

currentScope["clear"] = new Operator([], () => clear());

const [_node, _this, file] = process.argv;
const content = fs.readFileSync(file, "utf-8");

exec(content);
