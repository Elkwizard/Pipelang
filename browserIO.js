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
	});
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
	}

	command.addEventListener("keydown", ({ key }) => {
		if (key === "ArrowDown") {
			selected = Math.max(selected - 1, 0);
			command.value = statements[selected];
			syncHighlight();
		}
		if (key === "ArrowUp") {
			selected = Math.min(selected + 1, statements.length - 1);
			command.value = statements[selected];
			syncHighlight();
		}
		if (key === "Enter" && command.value.length) {
			exec(command.value);
			statements.splice(1, 0, command.value);
			command.value = statements[0] = "";
			selected = 0;
			command.scrollIntoView();
			syncHighlight();
		}
	});

	command.addEventListener("input", () => {
		statements[0] = command.value;
		selected = 0;
		
		syncHighlight();
	});

	command.focus();

	addEventListener("load", () => command.scrollIntoView());
}