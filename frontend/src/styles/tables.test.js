import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceFiles = [
  '../components/DesktopExperience.jsx',
  '../components/PurchaseDetailModal.jsx',
  '../components/PurchaseHistoryTable.jsx',
  '../components/SaleCrudController.jsx',
  '../components/SaleHistoryTable.jsx',
  '../screens/AccessManagementScreen.jsx',
  '../screens/BillingScreen.jsx',
  '../screens/CustomersScreen.jsx',
  '../screens/CustomerPaymentsPage.jsx',
  '../screens/ExpensesScreen.jsx',
  '../screens/NewPurchaseScreen.jsx',
  '../screens/ProductsScreen.jsx',
  '../screens/PurchasesScreen.jsx',
  '../screens/SuppliersScreen.jsx',
  '../screens/SupplierPaymentsPage.jsx',
  '../screens/TransactionsScreen.jsx',
];

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('web and desktop table design contract', () => {
  it('keeps every interactive table under the shared Supplier-style standard', () => {
    const tableTagCount = sourceFiles.reduce(
      (total, path) => total + (source(path).match(/<table\b/g) || []).length,
      0,
    );

    // 29 source tags: 27 interactive app tables and two print-only statement tables.
    expect(tableTagCount).toBe(29);

    const tableStyles = source('./tables.css');
    [
      '.supplier-table',
      '.supplier-detail-table',
      '.product-data-table',
      '.product-stock-list-table',
      '.purchase-history-table',
      '.purchase-wizard-quantity-table',
      '.purchase-review-table',
      '.customer-table',
      '.customer-history-table table',
      '.expense-table',
      '.transaction-table',
      '.billing-table',
      '.access-table',
      '.desktop-sync-table',
      '.table-wrap.sheet-table table',
    ].forEach((selector) => expect(tableStyles).toContain(selector));

    const interactiveSources = sourceFiles.map(source).join('\n');
    expect((interactiveSources.match(/<TablePagination\b/g) || []).length).toBe(9);
    expect(interactiveSources).not.toMatch(/(?:Load More|Load more|No More|No more).*<\/button>/);
  });

  it('keeps all paginated table footers in the shared footer contract', () => {
    const tableStyles = source('./tables.css');
    [
      '.supplier-table-footer',
      '.supplier-history-footer',
      '.product-table-footer',
      '.purchase-history-footer',
      '.customer-table-footer',
      '.customer-history-list-footer',
      '.expense-table-footer',
      '.transaction-table-footer',
    ].forEach((selector) => expect(tableStyles).toContain(selector));
  });

  it('keeps action headers and cells fixed while directory tables scroll horizontally', () => {
    const tableStyles = source('./tables.css');

    expect(tableStyles).toContain('thead th:last-child');
    expect(tableStyles).toContain('tbody td:last-child');
    expect(tableStyles).toContain('position: sticky;');
    expect(tableStyles).toContain('right: 0;');
    expect(tableStyles).toContain('background: var(--theme-surface);');
    expect(tableStyles).toContain('table:has(> colgroup > col.table-action-column)');
    expect(tableStyles).toMatch(/table:has\(> colgroup > col\.table-action-column\) thead th:last-child \{[\s\S]*?background: transparent;/);
    expect(tableStyles).toContain('scrollbar-gutter: auto;');
    expect(source('../screens/ProductsScreen.jsx')).toContain('className="table-actions-cell"');
    expect(tableStyles).toContain('position: sticky !important;');
    expect(tableStyles).toContain('inset-inline-end: 0 !important;');
    expect(tableStyles).toContain('box-shadow: none !important;');
    expect(source('./myanmar.css')).toContain('table-layout: auto !important;');
    expect(source('./myanmar.css')).not.toContain('min-width: 1680px !important;');
  });

  it('lets customer account table wheel gestures continue scrolling the page', () => {
    const customerStyles = source('./customers.css');
    const accountTableRule = customerStyles.match(
      /\.customer-account-page \.customer-history-table \{([\s\S]*?)\n\}/,
    )?.[1] || '';

    expect(accountTableRule).toContain('overscroll-behavior-y: auto !important;');
  });

  it('uses document-level vertical scrolling for every large-screen module', () => {
    const workspaceStyles = source('./workspace-viewport.css');
    const customerScreen = source('../screens/CustomersScreen.jsx');

    expect(workspaceStyles).toContain('@media (min-width: 981px)');
    expect(workspaceStyles).toContain('overflow-y: auto !important;');
    expect(workspaceStyles).toContain('.module-view:not([hidden])');
    [
      '.sale-screen', '.products-layout', '.purchases-layout', '.suppliers-layout',
      '.customers-layout', '.expenses-layout', '.transactions-layout', '.reports-layout',
      '.billing-screen', '.settings-screen', '.access-screen',
    ].forEach((selector) => expect(workspaceStyles).toContain(selector));
    expect(workspaceStyles).toContain('overscroll-behavior-y: auto !important;');
    expect(customerScreen).not.toContain('customer-detail-scroll');
  });

  it('keeps the purchase modal bounded so only its product table body scrolls', () => {
    const workspaceStyles = source('./workspace-viewport.css');
    const purchaseStyles = source('./purchases.css');
    const modalLayoutRule = purchaseStyles.match(
      /\.purchase-modal-layout \{([\s\S]*?)\n\}/,
    )?.[1] || '';
    const modalHeightChainRule = purchaseStyles.match(
      /\.purchase-modal-layout \.purchase-main-panel,[\s\S]*?\.purchase-modal-layout \.purchase-wizard-section \{([\s\S]*?)\n\}/,
    )?.[1] || '';
    const modalPickerRule = purchaseStyles.match(
      /\.purchase-modal-layout \.purchase-product-picker \{([\s\S]*?)\n\}/,
    )?.[1] || '';

    expect(workspaceStyles).not.toContain('purchase-entry-mode');
    expect(source('../main.jsx')).not.toContain("'new-purchase'");
    expect(workspaceStyles).not.toMatch(/^\s*\.purchase-wizard-(?:page|body|section|table-wrap),?\s*$/m);
    expect(modalLayoutRule).toContain('height: 100%;');
    expect(modalHeightChainRule).toContain('height: 100%;');
    expect(modalPickerRule).toContain('flex: 1 1 0;');
    expect(modalPickerRule).toContain('overflow-y: scroll;');
    expect(modalPickerRule).toContain('overscroll-behavior: contain;');
  });

  it('uses one review-body scroll surface while keeping the purchase summary pinned', () => {
    const purchaseStyles = source('./purchases.css');
    const reviewScrollRule = purchaseStyles.match(
      /\.purchase-review-scroll \{([\s\S]*?)\n\}/,
    )?.[1] || '';
    const reviewTableWrapRule = purchaseStyles.match(
      /\.purchase-review-table-wrap \{([\s\S]*?)\n\}/,
    )?.[1] || '';

    expect(reviewScrollRule).toContain('overflow: auto;');
    expect(reviewScrollRule).toContain('overscroll-behavior: contain;');
    expect(reviewTableWrapRule).toContain('overflow: visible;');
    expect(source('../screens/NewPurchaseScreen.jsx')).toMatch(
      /purchase-review-scroll[\s\S]*purchase-review-table-wrap[\s\S]*purchase-review-total/,
    );
  });

  it('vertically centers purchase modal step connectors on their circle indicators', () => {
    const purchaseStyles = source('./purchases.css');
    const modalStepButtonRule = purchaseStyles.match(
      /\.purchase-create-modal \.purchase-wizard-header-tabs button \{([\s\S]*?)\n\}/,
    )?.[1] || '';
    const modalConnectorRule = purchaseStyles.match(
      /\.purchase-create-modal \.purchase-wizard-header-tabs button::after \{([\s\S]*?)\n\}/,
    )?.[1] || '';
    const modalCircleRule = purchaseStyles.match(
      /\.purchase-create-modal \.purchase-wizard-header-tabs button > span \{([\s\S]*?)\n\}/,
    )?.[1] || '';

    expect(modalStepButtonRule).toContain('justify-content: flex-start;');
    expect(modalStepButtonRule).toContain('padding-block: 0;');
    expect(modalConnectorRule).toContain('top: 9px;');
    expect(modalCircleRule).toContain('height: 20px;');
  });

  it('keeps the complete Sell sidebar scrollable while the POS canvas is viewport locked', () => {
    const workspaceStyles = source('./workspace-viewport.css');
    const desktopStyles = source('./desktop-design.css');
    const appShell = source('../main.jsx');
    const desktopShellRule = desktopStyles.match(
      /\.app-shell\.desktop-workspace \{([\s\S]*?)\n\}/,
    )?.[1] || '';
    const sidebarRule = workspaceStyles.match(
      /body\.pos-sell-active \.app-shell\.pos-mode > \.sidebar \{([\s\S]*?)\n\}/,
    )?.[1] || '';
    const navigationRule = workspaceStyles.match(
      /body\.pos-sell-active \.app-shell\.pos-mode > \.sidebar > nav \{([\s\S]*?)\n\}/,
    )?.[1] || '';

    expect(desktopShellRule).toContain('grid-template-columns: var(--mkpos-sidebar-width) minmax(0, 1fr);');
    expect(desktopStyles).not.toContain('.app-shell.desktop-workspace.pos-mode {');
    expect(desktopStyles).not.toContain('.desktop-workspace:not(.pos-mode)');
    expect(sidebarRule).toContain('height: 100dvh !important;');
    expect(sidebarRule).toContain('overflow-y: auto !important;');
    expect(sidebarRule).toContain('overscroll-behavior-y: contain;');
    expect(sidebarRule).toContain('touch-action: pan-y;');
    expect(navigationRule).toContain('flex: 0 0 auto;');
    expect(navigationRule).toContain('overflow: visible;');
    expect(appShell).not.toContain("activeModule.id !== 'sell' && <div className=\"sidebar-account\"");
  });

  it('uses one loading-state component for every asynchronous table viewport', () => {
    const interactiveSources = sourceFiles.map(source).join('\n');
    expect((interactiveSources.match(/<TableLoadingState\b/g) || []).length).toBe(13);
    expect(interactiveSources).toContain('product-movement-skeleton-row');
    [
      'supplier-table-loading',
      'supplier-history-loading',
      'product-table-loading',
      'purchase-history-loading',
      'table-loading-overlay',
    ].forEach((legacyClass) => expect(interactiveSources).not.toContain(legacyClass));

    const tableStyles = source('./tables.css');
    expect(tableStyles).toContain('.table-loading-state');
    expect(tableStyles).toContain('.table-loading-state-spinner');
  });

  it('keeps headers and body cells on one sizing model and status labels intact', () => {
    const tableStyles = source('./tables.css');
    expect((tableStyles.match(/box-sizing: border-box;/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(tableStyles).toContain('word-break: keep-all;');
    expect(tableStyles).toContain('white-space: nowrap;');

    const sharedHeaderRule = tableStyles.match(/body :is\([\s\S]*?\) thead th \{([\s\S]*?)\n\}/)?.[1] || '';
    expect(sharedHeaderRule).not.toContain('text-align:');

    const transactionStyles = source('./transactions.css');
    expect(transactionStyles).toContain('.transaction-table-payments th:nth-child(6)');
    expect(transactionStyles).toContain('.transaction-table-purchases th:nth-child(6)');
  });

  it('keeps all five purchase duration presets on one row', () => {
    const purchaseStyles = source('./purchases.css');
    expect(purchaseStyles).toContain('grid-template-columns: repeat(5, minmax(0, 1fr));');
    expect(purchaseStyles).toContain('white-space: nowrap;');
  });

  it('keeps the transaction drawer compact and its actions outside the scrolling fields', () => {
    const transactionStyles = source('./transactions.css');
    const transactionScreen = source('../screens/TransactionsScreen.jsx');

    expect(transactionStyles).toContain('.transaction-filter-drawer .mkpos-filter-drawer-body');
    expect(transactionStyles).toContain('grid-template-columns: repeat(5, minmax(0, 1fr));');
    expect(transactionStyles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(transactionStyles).toContain('overflow-y: auto;');
    expect(transactionStyles).toMatch(/\.mkpos-filter-drawer \.transaction-filter-actions \{[\s\S]*?position: static;/);

    const gridEnd = transactionScreen.indexOf('</div>\n            <div className="drawer-filter-actions transaction-filter-actions">');
    expect(gridEnd).toBeGreaterThan(transactionScreen.indexOf('<div className="transaction-filter-grid">'));
  });
});
