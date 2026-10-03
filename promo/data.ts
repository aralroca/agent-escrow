import type { Spec } from '@agent-escrow/checks';

/** The deliverable of the promo job: eight product titles translated to Spanish. */
export const translations = [
  { id: 'sku-1', title: 'Zapatillas Acme Runner para correr' },
  { id: 'sku-2', title: 'Mochila Northwind de 20 litros' },
  { id: 'sku-3', title: 'Botella térmica Contoso de acero' },
  { id: 'sku-4', title: 'Auriculares inalámbricos Fabrikam' },
  { id: 'sku-5', title: 'Lámpara de escritorio Tailspin LED' },
  { id: 'sku-6', title: 'Chaqueta impermeable Wingtip' },
  { id: 'sku-7', title: 'Teclado mecánico Litware compacto' },
  { id: 'sku-8', title: 'Cafetera Proseware de émbolo' },
];

const BRANDS = [
  'Acme',
  'Northwind',
  'Contoso',
  'Fabrikam',
  'Tailspin',
  'Wingtip',
  'Litware',
  'Proseware',
];
const brandTerms = Object.fromEntries(BRANDS.map((brand, index) => [`sku-${index + 1}`, [brand]]));

/** The bar the buyer fixes before paying: eight items, well formed, brand names untouched. */
export const spec: Spec = {
  version: 1,
  title: 'Translate 8 product titles EN → ES',
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
    { type: 'count', equals: translations.length },
    { type: 'contains-all', key: 'id', field: 'title', terms: brandTerms },
  ],
};
