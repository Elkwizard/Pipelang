const fs = require("fs");
const path = require("path");

const oldWD = process.cwd();

process.chdir(path.dirname(process.argv[1]));

const importFile = file => {
	const source = fs.readFileSync(file, "utf-8");
	const keys = [...source.matchAll(/^(let|const|class|function)\s+(\w+)/gm)]
		.map(match => match[2]);
	const fnSource = `${source};\n({ ${keys.map(key => {
		return `${key}: typeof ${key} === "undefined" ? undefined : ${key}`
	}).join(", ")} })`;
	
	return eval(fnSource);
};

const log = msg => console.log(msg);
const clear = () => console.clear();

const { AST, parse } = importFile("./grammar/parse.js");
importFile("./format.js");
const {
	currentScope, callStack, evalStat,
	Operator, List, Type, VOID
} = importFile("./pipelang.js");
const { highlight } = importFile("./highlightPL.js");
const { exec, addColor } = importFile("./index.js");
importFile("./stdlib.js");
importFile("./nodeStdlib.js");

process.chdir(oldWD);

module.exports = { exec, currentScope, Operator, List, Type };