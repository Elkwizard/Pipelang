const fs = require("fs");

const importFile = file => {
	const source = fs.readFileSync(file, "utf-8");
	const keys = [...source.matchAll(/^(let|const|class|function)\s+(\w+)/gm)]
		.map(match => match[2]);
	const fnSource = `${source};\n({ ${keys.join(", ")} })`;
	
	return eval(fnSource);
};

const log = msg => console.log(msg);
const clear = () => console.clear();

const { AST, parse } = importFile("./grammar/parse.js");
const {
	currentScope, callStack, evalStat,
	Operator, List, Type
} = importFile("./pipelang.js");
const { highlight } = importFile("./highlightPL.js");
const { exec, addColor } = importFile("./index.js");
importFile("./stdlib.js");

module.exports = { exec, currentScope, Operator, List, Type };