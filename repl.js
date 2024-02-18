const { exec, currentScope, Operator, Type, List } = require("./pipeNode");

currentScope["exit"] = new Operator([], () => process.exit(0));

function prompt() {
	process.stdout.write("> ");
}

process.stdin.on("data", data => {
	data = data.toString("utf-8").replace(/[\r\n]/g, " ");
	process.stdout.write("\x1b[1A");
	prompt();
	exec(data);
	prompt();
});

prompt();