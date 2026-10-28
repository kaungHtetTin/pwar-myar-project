export const defaultCatalogFilters = { sort: 'default', in_stock: false, on_sale: false, min_price: '', max_price: '', min_rating: '' };
export function catalogFilterQuery(filters) {
  return new URLSearchParams(Object.entries(filters).filter(([key, value]) => value !== '' && value !== false && value !== 'default').map(([key, value]) => [key, value === true ? '1' : value])).toString();
}
