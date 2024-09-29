function applyFormat(text) {
	text = text.replace(/.*?/gs, line => {
		log.escaper.innerText = line;
		return log.escaper.innerHTML;
	});

	let level = 0;

	return text.replace(/\x1b\[(.*?)m/g, (_, escape) => {
		if (escape === "0") {
			const result = "</span>".repeat(level);
			level = 0;
			return result;
		}

		level++;

		const pieces = escape.split(";");
		let key = "color";
		let color;
		if (pieces.length === 1) {
			let value = +pieces[0];
			const offset = Math.floor(value / 10);
			value -= offset * 10;
			if (offset === 4) key = "background-color";

			const r = ((value) & 1) * 255;
			const g = ((value >> 1) & 1) * 255;
			const b = ((value >> 2) & 1) * 255;

			color = `rgb(${r}, ${g}, ${b})`;
		} else {
			const [,, r, g, b] = pieces;
			color = `rgb(${r}, ${g}, ${b})`;
		}

		return `<span style="${key}: ${color}">`;
	}).replace(/\n/g, "<br>");
}

function log(text) {
	const element = document.createElement("div");
	element.innerHTML = applyFormat(text);
	element.className = "log";
	document.getElementById("logs").appendChild(element);
}
log.escaper = document.createElement("span");

function clear() {
	document.getElementById("logs").innerHTML = "";
}

function logElement(element) {
	document.getElementById("logs").appendChild(element);
}

const CLOSE = {
	"[": "]"
};

{ // command bar
	const statements = [""];
	let selected = 0;

	const command = document.getElementById("command");
	const commandHighlight = document.getElementById("commandHighlight");

	command.addEventListener("scroll", () => { 
		commandHighlight.scrollLeft = command.scrollLeft;
	});

	const syncHighlight = () => {
		commandHighlight.innerHTML = applyFormat(highlight(command.value, CODE_COLORS));
		command.style.height = getComputedStyle(commandHighlight).height;
		command.scrollIntoView();
	};

	const insertAtSelection = (str, remove = 0, after = "") => {
		const start = command.selectionStart;
		const end = command.selectionEnd;
		const { value } = command;
		command.value = value.slice(0, start - remove) + str + after + value.slice(end);
		command.selectionStart = command.selectionEnd = end + str.length;
	};

	command.addEventListener("keydown", event => {
		const { key, ctrlKey, shiftKey } = event;

		const before = command.value.slice(0, command.selectionStart);
		const lineIndex = before.match(/\n/g)?.length ?? 0;
		const lines = command.value.split("\n");
		const char = command.value[command.selectionStart] ?? "";

		if (ctrlKey && key === "l") {
			event.preventDefault();
			navigator.clipboard.readText().then(text => {
				const toString = list => list.length === 1 ? String(list[0]) : `{ ${list.join(" ")} }`;
				const lines = toString(text.trim().	split(/\r?\n/g).map(line => toString(line.split("\t"))));
				insertAtSelection(lines);
				syncHighlight();
			});
		}

		if (key === "ArrowDown" && lineIndex === lines.length - 1) {
			event.preventDefault();
			selected = Math.max(selected - 1, 0);
			command.value = statements[selected];
			syncHighlight();
		}
		if (key === "ArrowUp" && !lineIndex) {
			event.preventDefault();
			selected = Math.min(selected + 1, statements.length - 1);
			command.value = statements[selected];
			syncHighlight();
		}
		if (key === "Tab") {
			event.preventDefault();
			insertAtSelection("\t");
			syncHighlight();
		}

		if (key in CLOSE)
			insertAtSelection("", 0, CLOSE[key]);

		if (key === "]") {
			if (before.endsWith("\t\t"))
				insertAtSelection("", 2);
		}
		
		if (key === "Enter") event.preventDefault();

		if (key === "Enter" && command.value.length && !shiftKey) {
			let stop = false;

			try {
				parse(command.value);
			} catch (err) {
				if (err.message.includes("Unexpected end of input"))
					stop = true;
			}

			if (!stop) {
				exec(command.value);	
				statements.splice(1, 0, command.value);
				command.value = statements[0] = "";
				selected = 0;
				syncHighlight();
				return;
			}
		}

		if (key === "Enter") {
			const lastLine = before.match(/.*$/)[0];
			let tabs = lastLine.match(/^\t*/)[0];
			if (lastLine.endsWith("["))
				tabs += "\t";
			insertAtSelection("\n" + tabs, 0, char === "]" ? "\n" : "");
			syncHighlight();
		}
	});

	command.addEventListener("input", () => {
		statements[0] = command.value;
		selected = 0;
		
		syncHighlight();
	});

	command.focus();

	addEventListener("load", syncHighlight);
}