const fs = require("fs");
const path = require("path");

const globalHelpers = {};
const cache = new Map();

/**
 * =========================
 * HELPERS
 * =========================
 */
function registerHelper(name, fn) {
    globalHelpers[name] = fn;
}

/**
 * Escape HTML
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * =========================
 * INCLUDE RESOLVER
 * =========================
 */
function resolveInclude(file, viewsDir, baseExt) {

    let tryPaths = [];

    // If extension provided
    if (path.extname(file)) {
        tryPaths.push(path.join(viewsDir, file));
    } else {
        // try same extension as parent first
        tryPaths.push(path.join(viewsDir, file + baseExt));

        // fallback extensions
        const exts = [".html", ".tpl", ".tmpl", ".ejs"];

        for (const ext of exts) {
            tryPaths.push(path.join(viewsDir, file + ext));
        }
    }

    for (const p of tryPaths) {
        if (fs.existsSync(p)) return p;
    }

    throw new Error("Include not found: " + file);
}

/**
 * =========================
 * INLINE INCLUDES (compile-time)
 * =========================
 */
function preprocessIncludes(template, viewsDir, baseExt) {

    const includeRegex =
        /<%-\s*include\(["'](.+?)["'](?:\s*,\s*({[\s\S]*?}))?\)\s*%>/g;

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

        // recursive include processing
        includedTemplate = preprocessIncludes(includedTemplate, path.dirname(filePath), path.extname(filePath));

        // render immediately (INLINE)
        return renderString(includedTemplate, data, path.dirname(filePath));
    });
}

/**
 * =========================
 * COMPILER
 * =========================
 */
function compile(template, viewsDir = "", baseExt = "") {

    template = preprocessIncludes(template, viewsDir, baseExt);

    let code = `let output = "";\n`;
    let cursor = 0;

    const regex = /<%([=-]?)([\s\S]+?)%>/g;

    function addText(text) {
        if (!text) return;
        code += `output += ${JSON.stringify(text)};\n`;
    }

    let match;

    while ((match = regex.exec(template))) {

        addText(template.slice(cursor, match.index));

        const flag = match[1];
        const content = match[2].trim();

        if (flag === "=") {

            code += `output += escapeHtml(${content});\n`;

        } else if (flag === "-") {

            code += `output += (${content});\n`;

        } else {

            code += `${content};\n`;
        }

        cursor = match.index + match[0].length;
    }

    addText(template.slice(cursor));

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

/**
 * =========================
 * CACHE
 * =========================
 */
function getCompiled(template, viewsDir = "", baseExt = "") {

    const key = viewsDir + "::" + template;

    if (cache.has(key)) {
        return cache.get(key);
    }

    const fn = compile(template, viewsDir, baseExt);

    cache.set(key, fn);

    return fn;
}

/**
 * =========================
 * RENDER STRING
 * =========================
 */
function renderString(template, data = {}, viewsDir = "", baseExt = "") {

    const helpers = {
        ...globalHelpers,
        ...(data.helpers || {})
    };

    const compiled = getCompiled(template, viewsDir, baseExt);

    return compiled(data, helpers, escapeHtml);
}

/**
 * =========================
 * EXPRESS ENGINE
 * =========================
 */
function renderFile(filePath, options, callback) {

    try {

        const viewsDir = path.dirname(filePath);
        const baseExt = path.extname(filePath);

        const template = fs.readFileSync(filePath, "utf8");

        let html = renderString(template, options, viewsDir, baseExt);

        /**
         * Layout support
         */
        if (options.layout) {

            const layoutPath = resolveInclude(
                options.layout,
                viewsDir,
                baseExt
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

/**
 * =========================
 * EXPORTS
 * =========================
 */
module.exports = {
    renderFile,
    renderString,
    compile,
    registerHelper
};