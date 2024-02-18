const fs = require("fs");
const { exec } = require("./pipeNode");

const [_node, _this, file] = process.argv;
const content = fs.readFileSync(file, "utf-8").replace(/\r/g, "");

exec(content);