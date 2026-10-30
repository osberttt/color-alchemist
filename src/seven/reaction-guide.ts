// The list of reactions with an example chain of qualities each (ANALYSIS §4.35).
// Shown in the how-to guide and from a reaction's briefing ("All reactions").

import { stamp } from '../ui/components';
import { h } from '../ui/dom';
import { reactionList } from './reaction';

function chain(example: string[], sep: string): HTMLElement {
  return h(
    'span',
    { class: 'rg-chain', 'aria-label': `For example: ${example.join(` ${sep} `)}` },
    ...example.flatMap((q, i) => (i === 0 ? [stamp(q, 'small')] : [h('span', { class: 'rg-sep', 'aria-hidden': 'true' }, sep), stamp(q, 'small')])),
  );
}

export function reactionGuide(): HTMLElement {
  return h('ul', { class: 'rg-list' }, ...reactionList().map((x) => h('li', null, h('h3', null, x.name), chain(x.example, x.sep), h('p', null, x.text))));
}
