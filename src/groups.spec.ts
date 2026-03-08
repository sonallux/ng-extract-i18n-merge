import {Architect, createBuilder} from '@angular-devkit/architect';
import {TestingArchitectHost} from '@angular-devkit/architect/testing';
import {schema} from '@angular-devkit/core';
import {promises as fs} from 'fs';
import builder from './builder';
import {rmSafe} from './rmSafe';
import {Options} from './options';
import Mock = jest.Mock;

const MESSAGES_XLF_PATH = 'builder-test/messages.xlf';
const MESSAGES_FR_XLF_PATH = 'builder-test/messages.fr.xlf';

describe('Builder with groups', () => {
    let architect: Architect;
    let architectHost: TestingArchitectHost;
    let extractI18nBuilderMock: Mock;

    beforeEach(async () => {
        const registry = new schema.CoreSchemaRegistry();
        registry.addPostTransform(schema.transforms.addUndefinedDefaults);

        // TestingArchitectHost() takes workspace and current directories.
        // Since we don't use those, both are the same in this case.
        architectHost = new TestingArchitectHost(__dirname, __dirname);
        architect = new Architect(architectHost, registry);

        // This will either take a Node package name, or a path to the directory
        // for the package.json file.
        // await architectHost.addBuilderFromPackage('..');
        await architectHost.addBuilder('ng-extract-i18n-merge:ng-extract-i18n-merge', builder);
        await architectHost.addTarget({
            project: 'builder-test',
            target: 'extract-i18n-merge'
        }, 'ng-extract-i18n-merge:ng-extract-i18n-merge');
        extractI18nBuilderMock = jest.fn(() => ({success: true}));
        await architectHost.addBuilder('@angular/build:extract-i18n', createBuilder(extractI18nBuilderMock)); // dummy builder
    });

    async function runTest(p: {
        messagesBefore?: string;
        messagesFrBefore?: string;
        options: Partial<Options>;
        filesToAssert: string[];
        [key: string]: unknown;
    }) {
        try {
            if (p.messagesBefore !== undefined) {
                await fs.writeFile(MESSAGES_XLF_PATH, p.messagesBefore, 'utf8');
            } else {
                try {
                    await rmSafe(MESSAGES_XLF_PATH);
                } catch (e) {
                    // ignore error - file might have not existed
                }
            }
            if (p.messagesFrBefore !== undefined) {
                await fs.writeFile(MESSAGES_FR_XLF_PATH, p.messagesFrBefore, 'utf8');
            }

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
                ...p.options
            });

            // The "result" member (of type BuilderOutput) is the next output.
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();

            for (const file of p.filesToAssert) {
                const targetContent = await fs.readFile(`builder-test/${file}`, 'utf8');
                expect(targetContent).toEqual(p[file]);
            }

        } finally {
            await rmSafe(MESSAGES_XLF_PATH);
            await rmSafe(MESSAGES_FR_XLF_PATH);
        }
    }

    test('group', async () => {
        await runTest({
            messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <notes>\n' +
                '        <note category="location">path1/some-file.ts:281,286</note>\n' +
                '        <note category="location">path2/some-other-file.ts:281</note>\n' +
                '      </notes>\n' +
                '      <segment>\n' +
                '        <source>source common</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '    <unit id="ID2">\n' +
                '      <notes>\n' +
                '        <note category="location">path2/some-file.ts:123,125</note>\n' +
                '      </notes>\n' +
                '      <segment>\n' +
                '        <source>source group2</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '    <unit id="ID3">\n' +
                '      <notes>\n' +
                '        <note category="location">path1/some-file.ts:123,125</note>\n' +
                '        <note category="location">path1/some-other-file.ts:123,125</note>\n' +
                '      </notes>\n' +
                '      <segment>\n' +
                '        <source>source group1</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf2',
                targetFiles: ['messages-[group].fr.xlf'],
                groups: {
                    group1: 'path1',
                    group2: ['path2', 'path3']
                }
            },
            filesToAssert: [
                'common-messages.xlf', 'group1-messages.xlf', 'group2-messages.xlf',
                'messages-common.fr.xlf', 'messages-group1.fr.xlf', 'messages-group1.fr.xlf'
            ],
            'common-messages.xlf': '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment>\n' +
                '        <source>source common</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            'group1-messages.xlf': '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID3">\n' +
                '      <segment>\n' +
                '        <source>source group1</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            'group2-messages.xlf': '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID2">\n' +
                '      <segment>\n' +
                '        <source>source group2</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            'messages-common.fr.xlf': '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment state="initial">\n' +
                '        <source>source common</source>\n' +
                '        <target>source common</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            'messages-group1.fr.xlf': '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID3">\n' +
                '      <segment state="initial">\n' +
                '        <source>source group1</source>\n' +
                '        <target>source group1</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            'messages-group2.fr.xlf': '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID2">\n' +
                '      <segment state="initial">\n' +
                '        <source>source group2</source>\n' +
                '        <target>source group2</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
        })

    });
});
