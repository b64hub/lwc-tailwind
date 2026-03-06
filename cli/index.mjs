#!/usr/bin/env node

/**
 * lwc-tailwind CLI
 *
 * Commands:
 *   create [name]     Create a new Salesforce project with Tailwind CSS
 *   init              Add Tailwind CSS to an existing Salesforce project
 *   component <name>  Scaffold a new Tailwind-enabled LWC component
 */

import { banner, error, info } from './lib/ui.mjs';

const HELP = `
  Usage: npx lwc-tailwind <command> [options]

  Commands:
    create [name]      Create a new Salesforce project with Tailwind CSS
    init               Add Tailwind CSS to an existing Salesforce project
    component <name>   Scaffold a new Tailwind-enabled LWC component

  Examples:
    npx lwc-tailwind create my-project
    npx lwc-tailwind init
    npx lwc-tailwind component myButton
`;

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const commandArgs = args.slice(1);

    if (!command || command === '--help' || command === '-h') {
        banner();
        console.log(HELP);
        return;
    }

    banner();

    switch (command) {
        case 'init': {
            const { init } = await import('./commands/init.mjs');
            await init();
            break;
        }
        case 'create': {
            const { create } = await import('./commands/create.mjs');
            await create(commandArgs);
            break;
        }
        case 'component': {
            const { component } = await import('./commands/component.mjs');
            await component(commandArgs);
            break;
        }
        default:
            error(`Unknown command: ${command}`);
            console.log(HELP);
            process.exit(1);
    }
}

main().catch((err) => {
    error(err.message);
    process.exit(1);
});
