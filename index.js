// themes
const CODE_COLORS = {
	number: "#8FDCA1",
	function: "#4665D2",
	symbol: "#BBCCEE",
	type: "#B464C8",
	comment: "#3C4B7F",
	string: "#E6E696",
	base: "#8EAFD2",
	constant: "#DB3959"
};

const OUT_COLORS = {
	number: "#782DA9",
	function: "#78A064",
	symbol: "#808080",
	type: "#943C1E",
	comment: "#3C4B7F",
	string: "#AEAE0F",
	base: "#667A72",
	constant: "#A8371B"
};

function addColor(hex, text) {
	if (!hex) return text;
	const rgb = hex
		.slice(1)
		.split(/(.{2})/g)
		.filter(Boolean)
		.map(n => Number.parseInt(n, 16));
	const begin = `\x1b[38;2;${rgb.join(";")}m`;
	const end = "\x1b[0m";
	return begin + text.replace(/(\x1b\[0m)/g, "$1" + begin) + end;
}

currentScope["print"] = new Operator([
	[new Type(null), "value"]
], value => log(highlight(value, OUT_COLORS)));

currentScope["printString"] = new Operator([
	[new Type("real", [null]), "charCodes"]
], charCodes => log(charCodes.asString()));

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
	log(`┌${sp.repeat(totalWidth)}┐<br>` + strings.map(row => `│${sp.repeat(spacing)}${row.map((v, i) => pad(highlight(v, OUT_COLORS), v.length, columnWidths[i])).join(sp.repeat(spacing))}${sp.repeat(spacing)}│`).join("<br>") + `<br>└${sp.repeat(totalWidth)}┘`);
});

currentScope["clear"] = new Operator([], () => {
	clear();
	log("workspace cleared");
});

function exec(command) {
	const THROWN_ERROR = "#FF9696";

	try {
		log(highlight(command, CODE_COLORS));
		const result = evalStat(command);
		log("» " + highlight(result, OUT_COLORS));
		if (result !== undefined) currentScope["ans"] = result;
	} catch (err) {
		const message = `${err}\n${
			callStack
				.map(name => `\t at ${name}`)
				.reverse()
				.join("\n")
		}`;
		log(addColor(THROWN_ERROR, message));
	}
}