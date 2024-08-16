Array.prototype.toString = function () {
	return `[${this.join(", ")}]`;
};

function log(message, color = "white") {
	const log = document.createElement("div");
	log.className = "log";
	log.innerText = message;
	log.style.color = color;
	log.innerHTML = log.innerHTML.replace(/\x1b\[(\d+)m/g, (_, num) => {
		num = +num;
		if (!num) return "</span>";

		const offset = Math.floor(num / 10);
		num -= offset * 10;

		const key = offset === 3 ? "color" : "background-color";

		const color = "#" + num
			.toString(2)
			.padStart(3, "0")
			.replaceAll("1", "f")
			.split("")
			.reverse()
			.join("");

		return `<span style="${key}: ${color}">`;
	});
	const container = document.getElementById("logs");
	container.appendChild(log);
}

function logHTML(message, prefix = "") {
	const log = document.createElement("div");
	log.className = "log";
	log.innerHTML = message;
	log.dataset.prefix = prefix;
	const container = document.getElementById("logs");
	container.appendChild(log);
}

function logElement(element) {
	const log = document.createElement("div");
	log.className = "log";
	log.appendChild(element);
	const container = document.getElementById("logs");
	container.appendChild(log);
}

const CODE_COLORS = {
	number: "#8fdca1",
	function: "#4665d2",
	symbol: "#BBCCEE",
	type: "#B464C8",
	comment: "#3C4B7F",
	string: "#E6E696",
	base: "#8eafd2"
};

const OUT_COLORS = {
	number: "#782da9",
	function: "#78A064",
	symbol: "#808080",
	type: "#943c1e",
	comment: "#3C4B7F",
	string: "#aeae0f",
	base: "#667a72"
};

const themeStyle = document.getElementById("themeStyle");

function updatePaletteStyle(style, name) {
	const palette = name === "output" ? OUT_COLORS : CODE_COLORS;
	for (const key in palette) {
		const rule = `.${name}.${key} { color: ${palette[key]}; }`;
		// style.sheet.insertRule(rule, 0);
		style.innerHTML += rule + "\n";
	}
}

function updateThemeStyle() {
	themeStyle.innerHTML = "";
	// while (themeStyle.sheet.cssRules.length)
	// 	themeStyle.sheet.deleteRule(0);
	updatePaletteStyle(themeStyle, "output");
	updatePaletteStyle(themeStyle, "code");
}

updateThemeStyle();

const themeChoosers = document.getElementsByClassName("theme-chooser");
for (const chooser of themeChoosers) {
	const header = document.createElement("h1");
	const { context } = chooser.dataset;
	header.innerText = context[0].toUpperCase() + context.slice(1);
	const COLORS = context === "output" ? OUT_COLORS : CODE_COLORS;
	const list = document.createElement("ul");

	for (const key in COLORS) {
		const li = document.createElement("li");
		const name = document.createElement("h2");
		const updateNameText = () => {
			name.innerText = key + " (" + COLORS[key] + ")" + ":";
		};
		updateNameText();
		const input = document.createElement("input");
		input.type = "color";
		input.value = COLORS[key];
		input.oninput = () => {
			COLORS[key] = input.value;
			updateNameText();
			updateThemeStyle();
		};

		li.appendChild(name);
		li.appendChild(input);
		
		list.appendChild(li);
	}

	chooser.appendChild(header);
	chooser.appendChild(list);
}

let statements = [""];
let selected = 0;

function exec(command) {
	const JS_EXECUTED_COMMAND = "rgba(200, 220, 255, 0.8)";
	const THROWN_ERROR = "rgba(255, 150, 150, 1)";

	try {
		const JS = command[0] === "#";
		if (JS) log(command, JS_EXECUTED_COMMAND);
		else logHTML(highlight(command, "code"));
		const result = JS ? window.eval(command.slice(1)) : evalStat(command);
		logHTML(highlight(result ?? "<void>", "output"), "» ");
		if (result !== undefined) currentScope["ans"] = result;
	} catch (err) {
		// throw err;
		log(err + "\n" + callStack.map(name => {
			return "\t at " + name;
		}).reverse().join("\n"), THROWN_ERROR);
	}
}

{
	const command = document.getElementById("command");
	const commandHighlight = document.getElementById("commandHighlight");

	command.addEventListener("scroll", () => { 
		commandHighlight.scrollLeft = command.scrollLeft;
	});

	function syncHighlight() {
		commandHighlight.innerHTML = highlight(command.value, "code");
		command.value.length;
	}

	command.onkeydown = ({ key }) => {
		if (key === "ArrowDown") {
			selected++;
			if (selected >= statements.length) selected = statements.length - 1;
			command.value = statements[selected];
			syncHighlight();
		}
		if (key === "ArrowUp") {
			selected--;
			if (selected < 0) selected = 0;
			command.value = statements[selected];
			syncHighlight();
		}
		if (key === "Enter" && command.value.length) {
			exec(command.value);
			statements.splice(statements.length - 1, 0, command.value);
			statements[statements.length - 1] = "";
			selected = statements.length - 1;
			command.value = "";
			command.scrollIntoView();
			syncHighlight();
		}
	};
	command.oninput = () => {
		if (selected === statements.length - 1)
			statements[statements.length - 1] = command.value;

		syncHighlight();
	}

	command.focus();

	onload = () => command.scrollIntoView();

};

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

currentScope["clear"] = new Operator([], () => {
	document.getElementById("logs").innerHTML = "";
	log("workspace cleared");
});