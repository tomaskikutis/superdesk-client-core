import ng from 'core/services/ng';
import {ISpellchecker, ISpellcheckerAction, ISpellcheckWarning} from "./interfaces";

const actions: {[key: string]: ISpellcheckerAction} = {
    addToDictionary: {
        label: gettext('Add to dictionary'),
        perform: (warning: ISpellcheckWarning) => {
            return ng.getService('spellcheck').then((spellcheck) => {
                spellcheck.addWord(warning.text, false);
            });
        },
    },
    ignoreWord: {
        label: gettext('Ignore word'),
        perform: (warning: ISpellcheckWarning) => {
            return ng.getService('spellcheck').then((spellcheck) => {
                spellcheck.addWord(warning.text, false);
            });
        },
    },
};

function getSuggestions(text: string): Promise<Array<string>> {
    return ng.getService('spellcheck')
        .then((spellcheck) => spellcheck.suggest(text))
        .then((result) => result.map(({value}) => value));
}

function check(str: string): Promise<Array<ISpellcheckWarning>> {
    const spellcheck = ng.get('spellcheck');

    return spellcheck.getDict()
        .then(() => {
            const info: Array<ISpellcheckWarning> = [];
            const WORD_REGEXP = /[0-9a-zA-Z\u00C0-\u1FFF\u2C00-\uD7FF]+/g;
            const regex = WORD_REGEXP;

            let lastOffset = 0;

            str.split('\n').forEach((paragraph) => {
                let matchArr;
                let start;

                // tslint:disable-next-line no-conditional-assignment
                while ((matchArr = regex.exec(paragraph)) !== null) {
                    start = matchArr.index;
                    if (!spellcheck.isCorrectWord(matchArr[0])) {
                        info.push({
                            startOffset: lastOffset + start,
                            text: matchArr[0],
                            suggestions: null,
                        });
                    }
                }

                lastOffset += paragraph.length;
            });

            return info;
        });
}

export function getSpellchecker(): ISpellchecker {
    return {check, getSuggestions, actions};
}
