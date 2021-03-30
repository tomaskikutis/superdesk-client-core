const fs = require('fs');
var path = require('path');
var css = require('css');
var debounce = require('lodash').debounce;
var selectorTokenizer = require('css-selector-tokenizer');
var getExtensionDirectoriesSync = require('./get-extension-directories-sync');
var getCssNameForExtension = require('../scripts/core/get-css-name-for-extension').getCssNameForExtension;

function handleToken(token, prefixFn) {
    if (token.type === 'selectors') {
        token.nodes.forEach((node) => {
            handleToken(node, prefixFn);
        });
    } else {
        token.nodes.forEach((node) => {
            if (node.type === 'id' | node.type === 'class') {
                node.name = prefixFn(node.name);
            }
        });
    }
}

function addPrefixes(cssString, prefixFn) {
    var ast = css.parse(cssString);

    ast.stylesheet.rules = ast.stylesheet.rules.map((rule) => Object.assign({}, rule, {
        selectors: Array.isArray(rule.selectors) // isn't present for CSS comments
            ? rule.selectors.map((selector) => {
                const tokens = selectorTokenizer.parse(selector);

                handleToken(tokens, prefixFn);

                return selectorTokenizer.stringify(tokens);
            })
            : rule.selectors,
    }));

    return css.stringify(ast);
}

function namespace() {
    const directories = getExtensionDirectoriesSync();

    let finalCss = '';

    directories.forEach(({extensionName, extensionCssFilePath}) => {
        if (fs.existsSync(extensionCssFilePath)) {
            const cssString = fs.readFileSync(extensionCssFilePath).toString();

            finalCss +=
`/* EXTENSION STYLES START FOR '${extensionName}' */


${addPrefixes(cssString, (originalName) => getCssNameForExtension(originalName, extensionName))}


/* EXTENSION STYLES END FOR '${extensionName}' */



`;
        }
    });

    fs.writeFileSync(path.resolve(`${__dirname}/../styles/extension-styles.generated.css`), finalCss);
}

if (process.argv[2] === '--watch') {
    const processDebouced = debounce(namespace, 100);
    const directories = getExtensionDirectoriesSync();

    directories.forEach(({extensionCssFilePath}) => {
        if (fs.existsSync(extensionCssFilePath)) {
            fs.watch(extensionCssFilePath, () => {
                processDebouced();
            });
        }
    });
} else {
    namespace();
}