/**
 * Simple stdin prompts using readline.
 */

import { createInterface } from 'readline';

export function ask(question, defaultValue = '') {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    return new Promise((resolve) => {
        rl.question(`  ? ${question}${suffix}: `, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue);
        });
    });
}

export async function confirm(question, defaultYes = true) {
    const hint = defaultYes ? 'Y/n' : 'y/N';
    const answer = await ask(`${question} (${hint})`, defaultYes ? 'y' : 'n');
    return answer.toLowerCase().startsWith('y');
}
