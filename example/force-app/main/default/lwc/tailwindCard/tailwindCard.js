import { api } from 'lwc';
import TailwindElement from 'c/tailwindElement';

export default class TailwindCard extends TailwindElement {
    @api title = 'Card Title';
    @api description = 'Card description goes here.';
    @api imageUrl;
}
