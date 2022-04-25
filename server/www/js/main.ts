import hyperscript from "hyperscript.org";
import "htmx.org";
import ejs from "ejs";
import applyHyperscriptEventsource from "../../../node_modules/hyperscript.org/dist/lib/plugin/eventsource.js";

applyHyperscriptEventsource(hyperscript);

declare global {
    interface Window {
        hyperscript: typeof hyperscript;
    }
}
window.hyperscript = hyperscript;
const EJS_OPTIONS = {}

/**
 * EJS template rendering hyperscript extension
 *
 * Adds command `render <expr> [with <namedArgumentList>] [into <expr>]`
 *
 * Expression may be an element or a pre-compiled EJS template (via `precompile template`)
 *
 * ex:
 * `<template id="tmpl-my-template">Hello, {{ hello  }}</template>`
 * `render #tmpl-my-template with (hello: 'world') into <body />`
 *
 * ex:
 *
 * `<template _="init precompile me into $myTemplate">Hello, {{ hello  }}</template>`
 * `render $myTemplate with (hello: 'world')`
 * `put the result at the start of <body />`
 *
 * Adds command `precompile <expr> #tmpl-my-template [into $myTemplate]`
 *
 * @param {HyperscriptObject} _hyperscript
 */
const hyperscriptEJSExtension = _hyperscript => {
    _hyperscript.addCommand("render", function(parser, runtime, tokens) {
        if (!tokens.matchToken("render")) return;
        var template_ = parser.requireElement("expression", tokens);

        var templateArgs = {};
        if (tokens.matchToken("with")) {
            templateArgs = parser.parseElement("namedArgumentList", tokens);
        }

        if (tokens.matchToken("into")) {
            var target_ = parser.requireElement("expression", tokens);
        }

        return {
            args: [template_, templateArgs, target_],
            op: function(ctx, template, templateArgs, target) {
                if (typeof template === "string") {
                    ctx.result = ejs.compile(template, EJS_OPTIONS)(templateArgs);
                } else if (template.__ejs_precompiled && typeof template === "function") {
                    ctx.result = template(templateArgs);
                } else if (template instanceof Element) {
                    ctx.result = ejs.renderString(template.innerHTML, templateArgs);
                } else {
                    throw new Error(template_.sourceFor() + " is not an element, string, or precompiled template");
                }

                if (target) {
                    if (Array.isArray(target)) target = target[0]
                    if (!(target instanceof Element)) throw new Error(target_.sourceFor() + " is not an element or string");
                    target.innerHTML = ctx.result;
                    _hyperscript.processNode(target);
                }

                return runtime.findNext(this, ctx);
            },
        };
    });
    _hyperscript.addCommand("precompile", function(parser, runtime, tokens) {
        if (!tokens.matchToken("precompile")) return;

        var template_ = parser.requireElement("expression", tokens);

        if (tokens.matchToken("into")) {
            var target = parser.requireElement("symbol", tokens);
        }

        return {
            args: [template_],
            op: function(ctx, template) {
                if (typeof template === "string") {
                    ctx.result = ejs.compile(template, EJS_OPTIONS);
                    ctx.result.__ejs_precompiled = true;
                } else if (template instanceof Element) {
                    ctx.result = ejs.compile(template.innerHTML, EJS_OPTIONS);
                    ctx.result.__ejs_precompiled = true;
                } else {
                    throw new Error(template_.sourceFor() + " is not an element or string");
                }

                if (target) {
                    runtime.setSymbol(target.name, ctx, target.scope, ctx.result);
                }

                return runtime.findNext(this, ctx);
            },
        };
    });
}

// Apply this extension
hyperscriptEJSExtension(hyperscript);
