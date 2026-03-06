import TailwindElement from 'c/tailwindElement';

export default class TailwindDemo extends TailwindElement {
    get cards() {
        return [
            {
                id: '1',
                title: 'Shadow DOM Isolation',
                description: 'Tailwind classes loaded via loadStyle are injected into the component shadow root. Each component loads the full CSS independently.',
            },
            {
                id: '2',
                title: 'No @apply Support',
                description: 'LWC component .css files are not processed by PostCSS. You cannot use @apply, @tailwind directives, or theme() functions.',
            },
            {
                id: '3',
                title: 'Manual Build Pipeline',
                description: 'Must run PostCSS externally, upload to Static Resource, and keep everything in sync manually. No hot reload.',
            }
        ];
    }
}
