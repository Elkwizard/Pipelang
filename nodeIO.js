const log = msg => console.log(msg);
const clear = () => console.clear();

currentScope["readTextFile"] = new Operator([
	[new Type("real", [null]), "fileName"]
], fileName => {
	try {
		const text = fs.readFileSync(fileName.asString(), "utf-8")
			.replace(/\r\n|\n|\r/g, "\n");
		return List.fromString(text);
	} catch (err) {
		return VOID;
	}
});