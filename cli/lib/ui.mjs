/**
 * Console output helpers with ANSI colors.
 * No dependencies — uses raw escape codes.
 */

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

export function success(msg) {
    console.log(`  ${GREEN}\u2713${RESET} ${msg}`);
}

export function warn(msg) {
    console.log(`  ${YELLOW}\u26A0${RESET} ${msg}`);
}

export function error(msg) {
    console.error(`  ${RED}\u2717${RESET} ${msg}`);
}

export function info(msg) {
    console.log(`  ${CYAN}\u2192${RESET} ${msg}`);
}

export function step(msg) {
    console.log(`  ${DIM}\u2022${RESET} ${msg}`);
}

export function heading(msg) {
    console.log('');
    console.log(`  ${BOLD}${msg}${RESET}`);
    console.log('');
}

export function banner() {
    console.log('');
    console.log(`  ${BOLD}\u26A1 lwc-tailwind${RESET}`);
    console.log(`  ${DIM}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${RESET}`);
    console.log('');
}
