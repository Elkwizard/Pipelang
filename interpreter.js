const fs = require("fs");
const { exec } = require("./pipeNode");

const [,, file] = process.argv;
const content = fs.readFileSync(file, "utf-8").replace(/\r/g, "");

exec(content);