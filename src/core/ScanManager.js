import * as TreeSitter from "tree-sitter";
import Violation from "./Violation";
export default class ScanManager {
    constructor(parser, language, sourcePath, sourceCode, rules) {
        parser.setLanguage(language);
        this._sourcePath = sourcePath;
        this._sourceCode = sourceCode;
        this._rules = rules;
        this._language = language;
        this._parser = parser;
        this._nodeTree = parser.parse(this._sourceCode);
    }
    /**
     * Dump is here as a way to quickly test out new rules without having to create them. It's basically
     * a mini playground.
     * @param queryString A tree sitter query. Can be as simple or as complex as you want.
     */
    dump(queryString) {
        // Use dump as a mechanism to allow for ad-hoc ts queries?
        const result = [];
        if (queryString === "") {
            queryString = `(class_declaration @decl)`;
        }
        const query = new TreeSitter.Query(this._language, queryString);
        const matches = query.matches(this._nodeTree.rootNode);
        for (let match of matches) {
            for (let capture of match.captures) {
                const dumpResult = new DumpResult(capture.node, this._sourceCode);
                result.push(dumpResult);
            }
        }
        console.log(JSON.stringify(result));
    }
    /**
     * Scan is the scanner scannerific scantaculous main method for inspecting code for violations of given rules.
     * Rules are provided to the ScanManager from elsewhere.
     * @returns A map of cateogries->list of violations
     */
    scan() {
        return this._scan("scan");
    }
    /**
     * Common scan method used by both scan and measure. Both were consolidated here as both essentially
     * did the same thing, just reported the results differently. Realizing that how the report is formatted
     * should be the purview of something other than the scanner, I moved that stuff out.
     * @param context What operational contecxt we are using. Scan or measure are currently supported.
     * @returns `Map<string,Array<Violation>>` A map of category->array of violations. Allows for some
     * custom organization
     */
    _scan(context) {
        const tree = this._nodeTree;
        if (this._rules === null || this._rules.length === 0) {
        }
        const resultMap = new Map();
        for (let rule of this._rules) {
            if (!resultMap.has(rule.Category)) {
                resultMap.set(rule.Category, []);
            }
            // First the tree sitter query. :everage the built-in regex
            if (!rule.Context.includes(context)) {
                continue;
            }
            let queryText = rule.Query;
            if (rule.RegEx != null) {
                // Note that tree-sitter is persnickity about regular expressions.
                // It's not that great about giving you feedback if the regex is gibbed.
                // Including this here fragment because I know it works...it's just for reference
                // (#match? @exp "^[a-zA-Z]{0,3}$")
                const regExInsert = rule.RegEx == null ? "" : `(#match? @exp "${rule.RegEx}")`;
                queryText += regExInsert;
            }
            try {
                const query = new TreeSitter.Query(this._language, queryText);
                const matches = query.matches(this._nodeTree.rootNode);
                matches.forEach(match => {
                    match.captures.forEach(capture => {
                        let isValid = false;
                        isValid = rule.validate(capture.node);
                        if (!isValid) {
                            const newViolation = new Violation(capture.node, rule, this._sourcePath);
                            resultMap[rule.Context].push(newViolation);
                        }
                    });
                });
            }
            catch (treeSitterError) {
                console.error(`A tree-sitter query error occurred: ${treeSitterError}`);
            }
        }
        return resultMap;
    }
    measure(parser, language) {
        return this._scan("measure");
    }
}
/**
 * Simple object for containing information returned from a dump operation. Dump accepts
 * a  tree sitter query and spits back the requested source fragment to the console.
 */
export class DumpResult {
    constructor(node, source) {
        this.SourceFragment = source.substring(node.startIndex, node.endIndex);
        this.StartIndex = node.startIndex;
        this.EndIndex = node.endIndex;
    }
}
const RULE_REGISTRY = {
    "rules": [
        {
            "name": "Variables",
            "queries": [{
                    "name": "Total",
                    "context": "measure",
                    "message": "This is the total number of variable declarations, not counting method arguments.",
                    "query": '(variable_declarator (identifier) @exp)',
                },
                {
                    "name": "Length < 3",
                    "context": "scan,measure",
                    "message": "Variables should be descriptive, clear, and concise with names over three characters long.",
                    "query": '(variable_declarator (identifier) @exp)',
                    "function": function (node) { return node.text.length > 3; }
                },
                {
                    "name": "Trivial RegEx",
                    "context": "scan,measure",
                    "message": "A trivial RegEx (for testing) has produced some matches.",
                    "query": '(variable_declarator (identifier) @exp)',
                    "pattern": "foo_[a-zA-Z0-9]*",
                }
            ]
        }
    ]
};
//# sourceMappingURL=ScanManager.js.map