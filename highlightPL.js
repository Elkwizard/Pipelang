function highlight(source, palette) {
	source += "";
	const colors = new Array(source.length).fill("base");
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
	color(/\-?\b(\d+\.?\d*|\.\d+)([eE][\+\-]?\d+)?\b/g, "number");
	color(/\b(real|operator|any|false|true|NaN|Infinity|void|filter|reduce|typeof|is|to|primitive|string|this|as|type|in)\b/g, "type");
	color(/(['"])((.*?)(\\\\)?(((.*?)[^\\])*?))*?(\1|$)/g, "string");
	color(/\/\/.*/g, "comment");
	color(/\/\*.\*\//gs, "comment");

	for (let i = 1; i < colors.length; i++)
		if (!source[i].trim())
			colors[i] = colors[i - 1];

	const matched = source
		.split("")
		.map((ch, i) => ({ content: ch, color: colors[i] }));
		
	for (let i = 1; i < matched.length; i++) {
		const last = matched[i - 1];
		const current = matched[i];
		if (current.color === last.color) {
			last.content += current.content;
			matched[i] = last;
			matched[i - 1] = null;
		}
	}

	return matched
		.filter(Boolean)
		.map(({ content, color }) => addColor(palette[color], content))
		.join("");
}