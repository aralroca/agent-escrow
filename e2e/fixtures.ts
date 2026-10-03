import type { Spec } from '@agent-escrow/checks';

export const products = [
  { id: 'sku-1', title: 'Zapatillas Acme Runner para correr' },
  { id: 'sku-2', title: 'Mochila Northwind de 20 litros' },
  { id: 'sku-3', title: 'Botella térmica Contoso de acero' },
];

/** The acceptance test of the demo job: three translated products, brand names untouched. */
export const spec: Spec = {
  version: 1,
  title: 'Translate 3 product titles EN → ES',
  checks: [
    {
      type: 'json-schema',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'title'],
          properties: { id: { type: 'string' }, title: { type: 'string', minLength: 1 } },
        },
      },
    },
    { type: 'count', equals: 3 },
    {
      type: 'contains-all',
      key: 'id',
      field: 'title',
      terms: { 'sku-1': ['Acme'], 'sku-2': ['Northwind'], 'sku-3': ['Contoso'] },
    },
  ],
};
