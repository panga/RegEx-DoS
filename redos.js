#!/usr/bin/env node
"use strict";

const fs = require("fs");
const chalk = require("chalk");
const espree = require("espree");
const safeReg = require("safe-regex");

function RegexNodes() {
  const nodes = [];

  this.add = node => nodes.push(node);

  this.printAll = () => {
    nodes.map(n => console.log(n.format()));
  };

  this.getNodes = () => nodes;
};

function Node(node) {
  const safe = safeReg(node.regex.pattern);
  const color = safe ? chalk.green : chalk.red;
  const pattern = node.regex.pattern;
  const flags = node.regex.flags;
  const loc = node.loc;

  this.getData = () => ({ safe, pattern, flags, loc });

  this.formatLine = () => {
    const start = loc.start;
    const end = loc.end;
    return "Line[" + start.line + ":" + start.column + "->" + end.line + ":" + end.column + "]";
  };

  this.toString = () => {
    return chalk.gray(this.formatLine()) + "  " + color(pattern);
  };

  this.format = () => {
    return " ".repeat(8) + this.toString();
  }
};

const traverse = (node, work) => {
  work(node);
  for (let key in node) {
    if (node.hasOwnProperty(key)) {
      let child = node[key];
      if (typeof child === "object" && child !== null) {
        if (Array.isArray(child))
          child.forEach(node => traverse(node, work));
        else
          traverse(child, work);
      }
    }
  }
}

const parse = ({ content, sourceType = "script", ecmaVersion = 2020 }, cb) => {
  const regexNodes = new RegexNodes();

  const ast = espree.parse(content, {
    loc: true,
    sourceType,
    ecmaVersion,
    ecmaFeatures: {
      globalReturn: true
    }
  });

  traverse(ast, (node) => {
    if (node && node.regex && node.regex.pattern)
      regexNodes.add(new Node(node));
  });

  cb(regexNodes);
};

const trimShebang = (text) => {
  return text.toString().replace(/^#!([^\r\n]+)/, (_, captured) => {
    return "/* #!" + captured + " */";
  });
};

if (require.main === module) {
  if (process.argv.length !== 3) {
    console.error("ReDoS CLI command requires a JavaScript filename as the only parameter.");
    process.exit(1);
  }

  const file = process.argv[2];
  let content;

  try {
    content = trimShebang(fs.readFileSync(file));
  }
  catch (e) {
    console.error("ReDoS encountered an error when trying to read from file: " + file);
    console.error(e);
    process.exit(1);
  }

  parse({ content }, (regNodes) => {
    if (regNodes.getNodes().length > 0) {
      console.log(chalk.blue("Processed:"), chalk.white(file));
      regNodes.printAll();
    }
  });
}

module.exports = parse;
