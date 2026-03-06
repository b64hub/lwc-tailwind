import { api } from 'lwc';
import TailwindElement from 'c/tailwindElement';
import { cn } from 'c/tailwindUtils';

export default class TailwindButton extends TailwindElement {
    @api label = 'Click me';
    @api variant = 'primary'; // primary | secondary | danger

    get buttonClass() {
        return cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            {
                'bg-brand text-white hover:bg-brand-dark focus:ring-brand': this.variant === 'primary',
                'border border-border text-text-default hover:bg-background-alt focus:ring-border': this.variant === 'secondary',
                'bg-error text-white hover:opacity-90 focus:ring-error': this.variant === 'danger'
            }
        );
    }
}
