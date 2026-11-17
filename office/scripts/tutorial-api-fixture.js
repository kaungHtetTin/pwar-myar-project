export async function api() {
  return { items: [
    { id: 1, title: 'Getting started: set up your shop and make your first sale', description: 'Prepare business details, create your first product, add opening stock and complete a cash sale.', youtube_url: 'https://www.youtube.com/watch?v=abcdefghijk', is_published: true, sort_order: 1 },
    { id: 2, title: 'Receipt printing and device setup', description: 'A draft tutorial for Windows, web and Android users.', youtube_url: 'https://www.youtube.com/watch?v=abcdefghijk', is_published: false, sort_order: 2 },
  ], page: 1, total: 2, last_page: 1 };
}
export async function apiBlob() { throw new Error('No custom thumbnail in fixture'); }
