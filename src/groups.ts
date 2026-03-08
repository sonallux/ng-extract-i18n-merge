import {TranslationUnit} from "./model/translationFileModels";
import {Options} from "./options";

export const COMMON_GROUP = 'common';

export function determineGroup(options: Options, unit: TranslationUnit) {
    if (unit.locations.length === 0) {
        return COMMON_GROUP;
    }

    for (const [group, prefixStringOrArray] of Object.entries(options.groups ?? {})) {
        const prefixArray = Array.isArray(prefixStringOrArray) ? prefixStringOrArray : [prefixStringOrArray];
        for (const prefix of prefixArray) {
            if (unit.locations.every(l => l.file.startsWith(prefix))) {
                return group;
            }
        }
    }
    return COMMON_GROUP
}