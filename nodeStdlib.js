currentScope["readTextFile"] = new Operator([
	[new Type("real", [null]), "fileName"]
], fileName => {
	try {
		const text = fs.readFileSync(fileName.asString(), "utf-8").replace(/\r\n|\n|\r/g, "\n");
		return List.fromString(text);
	} catch (err) {
		return VOID;
	}
});

currentScope["readCSV"] = new Operator([
	[new Type("real", [null]), "fileName"],
	[new Type("type", [null]), "columnTypes", AST.make.Reference("no")]
], (fileName, columnTypes) => {
	const file = currentScope.readTextFile.operate(fileName);
	if (file === VOID) return VOID;
	const text = file.asString();
	const [header, ...lines] = text.split("\n");
	let failed = false;
	const parseValue = (str, index) => {
		const columnType = columnTypes?.[index];
		if (columnType) { // known type
			if (columnType.dimensions?.length > 0) return List.fromString(str);
			if (columnType.baseType === "void") return VOID;
			return +str;
		}

		if (str === "") return VOID;
		if (!isNaN(+str)) return +str;
		return List.fromString(str);
	};
	const parseLine = line => {
		const values = [];
		while (line.length) {
			if (line.startsWith("\"")) {
				const match = line.match(/"(\\?.)*?"/);
				if (!match) {
					failed = true;
					break;
				}
				const text = match[0];
				line = line.slice(text.length);
				values.push(parseValue(JSON.parse(text), values.length));
			} else if (!line.startsWith(",")) {
				let index = line.indexOf(",");
				if (index === -1) index = line.length;
				const text = line.slice(0, index);
				line = line.slice(index);
				values.push(parseValue(text, values.length));
			}
			
			if (line.startsWith(",")) {
				line = line.slice(1);
			} else if (line.length) {
				failed = true;
			}
		}

		return values;
	};
	const headerValues = parseLine(header);
	const result = lines.map(line => {
		const values = parseLine(line);
		const fields = values.map((v, i) => currentScope.field.operate(headerValues[i], v));
		return new List(fields);
	});
	if (failed) return VOID;
	return new List(result);
});