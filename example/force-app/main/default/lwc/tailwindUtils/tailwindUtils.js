/**
 * Utility for composing Tailwind CSS class names in LWC.
 * Works like clsx/classnames from the React ecosystem.
 *
 * @example
 * import { cn } from 'c/tailwindUtils';
 *
 * // Strings
 * cn('px-4 py-2', 'text-white')  // → 'px-4 py-2 text-white'
 *
 * // Conditionals
 * cn('base', isActive && 'bg-brand', !isActive && 'bg-gray-200')
 *
 * // Objects
 * cn('base', { 'bg-brand': isActive, 'opacity-50': isDisabled })
 *
 * // Arrays
 * cn(['px-4', 'py-2'], 'text-white')
 *
 * // Mixed
 * cn('px-4', condition && 'font-bold', { 'text-error': hasError }, ['rounded-md'])
 */
export function cn(...args) {
    const classes = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg) continue;

        if (typeof arg === 'string') {
            classes.push(arg);
        } else if (Array.isArray(arg)) {
            const inner = cn(...arg);
            if (inner) classes.push(inner);
        } else if (typeof arg === 'object') {
            const keys = Object.keys(arg);
            for (let k = 0; k < keys.length; k++) {
                if (arg[keys[k]]) {
                    classes.push(keys[k]);
                }
            }
        }
    }

    return classes.join(' ');
}
