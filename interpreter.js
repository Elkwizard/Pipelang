const fs = require("fs");

const [,, file] = process.argv;
const content = fs.readFileSync(file, "utf-8").replace(/\r/g, "");

const { exec } = require("./pipeNode");

exec(content);