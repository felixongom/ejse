// src/index.js
var fs = require("fs");
var path = require("path");
var globalHelpers = {};
var cache = /* @__PURE__ */ new Map();
function registerHelper(name, fn) {
  globalHelpers[name] = fn;
}
function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function resolveInclude(file2, viewsDir2, baseExt2) {
  let tryPaths = [];
  if (path.extname(file2)) {
    tryPaths.push(path.join(viewsDir2, file2));
  } else {
    tryPaths.push(path.join(viewsDir2, file2 + baseExt2));
    const exts = [".html", ".tpl", ".tmpl", ".ejs"];
    for (const ext of exts) {
      tryPaths.push(path.join(viewsDir2, file2 + ext));
    }
  }
  for (const p of tryPaths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Include not found: " + file2);
}
function preprocessIncludes(template, viewsDir, baseExt) {
  const includeRegex = /<%-\s*include\(["'](.+?)["'](?:\s*,\s*({[\s\S]*?}))?\)\s*%>/g;
  return template.replace(includeRegex, (match, file, props) => {
    const filePath = resolveInclude(file, viewsDir, baseExt);
    let includedTemplate = fs.readFileSync(filePath, "utf8");
    let data = {};
    if (props) {
      try {
        data = eval("(" + props + ")");
      } catch (e) {
        throw new Error("Invalid include props: " + props);
      }
    }
    includedTemplate = preprocessIncludes(includedTemplate, path.dirname(filePath), path.extname(filePath));
    return renderString(includedTemplate, data, path.dirname(filePath));
  });
}
function compile(template2, viewsDir2 = "", baseExt2 = "") {
  template2 = preprocessIncludes(template2, viewsDir2, baseExt2);
  let code = `let output = "";
`;
  let cursor = 0;
  const regex = /<%([=-]?)([\s\S]+?)%>/g;
  function addText(text) {
    if (!text) return;
    code += `output += ${JSON.stringify(text)};
`;
  }
  let match2;
  while (match2 = regex.exec(template2)) {
    addText(template2.slice(cursor, match2.index));
    const flag = match2[1];
    const content = match2[2].trim();
    if (flag === "=") {
      code += `output += escapeHtml(${content});
`;
    } else if (flag === "-") {
      code += `output += (${content});
`;
    } else {
      code += `${content};
`;
    }
    cursor = match2.index + match2[0].length;
  }
  addText(template2.slice(cursor));
  code += `return output;`;
  return new Function(
    "data",
    "helpers",
    "escapeHtml",
    `
with ({ ...helpers, ...data }) {
${code}
}
`
  );
}
function getCompiled(template2, viewsDir2 = "", baseExt2 = "") {
  const key = viewsDir2 + "::" + template2;
  if (cache.has(key)) {
    return cache.get(key);
  }
  const fn = compile(template2, viewsDir2, baseExt2);
  cache.set(key, fn);
  return fn;
}
function renderString(template2, data2 = {}, viewsDir2 = "", baseExt2 = "") {
  const helpers = {
    ...globalHelpers,
    ...data2.helpers || {}
  };
  const compiled = getCompiled(template2, viewsDir2, baseExt2);
  return compiled(data2, helpers, escapeHtml);
}
function renderFile(filePath2, options, callback) {
  try {
    const viewsDir2 = path.dirname(filePath2);
    const baseExt2 = path.extname(filePath2);
    const template2 = fs.readFileSync(filePath2, "utf8");
    let html = renderString(template2, options, viewsDir2, baseExt2);
    if (options.layout) {
      const layoutPath = resolveInclude(
        options.layout,
        viewsDir2,
        baseExt2
      );
      const layoutTemplate = fs.readFileSync(layoutPath, "utf8");
      html = renderString(layoutTemplate, {
        ...options,
        body: html
      }, path.dirname(layoutPath), path.extname(layoutPath));
    }
    callback(null, html);
  } catch (err) {
    callback(err);
  }
}
module.exports = {
  renderFile,
  renderString,
  compile,
  registerHelper
};
