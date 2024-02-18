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