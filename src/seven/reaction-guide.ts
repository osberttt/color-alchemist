// The full list of reactions with an example chain of qualities each (ANALYSIS §4.28).
// Shown in the how-to guide and from a reaction's briefing ("All reactions").

import { stamp } from '../ui/components';
import { h } from '../ui/dom';
import { NO_REACTION_EXAMPLES, reactionList } from './reaction';

function chain(example: string[], sep: string): HTMLElement {
  return h(
    'span',
    { class: 'rg-chain', 'aria-label': `For example: ${example.join(` ${sep} `)}` },
    ...example.flatMap((q, i) => (i === 0 ? [stamp(q, 'small')] : [h('span', { class: 'rg-sep', 'aria-hidden': 'true' }, sep), stamp(q, 'small')])),
  );
}

export function reactionGuide(): HTMLElement {
  return h(
    'div',
    { class: 'rx-guide' },
    h(
      'p',
      { class: 'muted small' },
      'After every color, the qualities of your latest extracts may set off a reaction. Rising means getting better, one quality at a time. Three in a row beats two.',
    ),
    h(
      'ul',
      { class: 'rg-list' },
      ...reactionList().map((x) => h('li', null, h('h3', null, x.name), chain(x.example, x.sep), h('p', null, `${x.when} ${x.what}`))),
      h(
        'li',
        { class: 'rg-none' },
        h('h3', null, 'No reaction'),
        ...NO_REACTION_EXAMPLES.map((x) => h('span', { class: 'rg-none-row' }, chain(x.example, x.sep), h('span', { class: 'muted small' }, x.why))),
      ),
    ),
    h('p', { class: 'muted small' }, 'A reaction shows you what happened first; the clock starts when you tap Start, and the ingredients are a surprise.'),
  );
}
