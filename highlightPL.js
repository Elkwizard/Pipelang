function highlight(source, paletteName) {
	source += "";
	const colors = new Array(source.length).fill(paletteName + " base");
	function color(regex, col) {
		const matches = source.matchAll(regex);
		for (const match of matches) {
			const { index } = match;
			const [text] = match;
			for (let i = 0; i < text.length; i++) colors[index + i] = col;
		}
	}
	
	color(/(\b|\s|^)(\W+)(\b|\s|$)/g, "symbol");
	color(/\b[^\W](\w*)\b/g, "base");
	color(/(?<=([^<>!=]=\s*)|^)(\w+)\b(?!\s*(\|\>|=|$))/g, "function");
	color(/\b[^\W](\w*)\s*(?=\(|=\s*\[)/g, "function");
	color(/(?<=\|>\s*)[^\W](\w*)\b/g, "function");
	color(NUMBER_REGEX, "number");
	color(/\b(real|operator|any|false|true|NaN|Infinity|void|filter|reduce|typeof|is|to|primitive|string)\b/g, "type");
	color(/(['"])((.*?)(\\\\)?(((.*?)[^\\])*?))*?(\1|$)/g, "string");
	color(SINGLE_LINE_COMMENT_REGEX, "comment");
	color(MULTILINE_COMMENT_REGEX, "comment");

	const span = document.createElement("span");
	function htmlEscape(text) {
		span.innerText = text;
		return span.innerHTML;
	}

	let result = "";
	let last = null;
	for (let i = 0; i < source.length; i++) {
		const color = colors[i];
		const char = source[i];
		if (char.trim() && color !== last) {
			if (last !== null) result += "</span>";
			result += `<span class="${paletteName} ${color}">`;
			last = color;
		}
		result += htmlEscape(char);
	}

	result += "</span>";

	// result = result.replace(/\t/g, "@@@@");

	return result;
}