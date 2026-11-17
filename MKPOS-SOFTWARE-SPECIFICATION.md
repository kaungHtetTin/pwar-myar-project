# PwarMyar Software Specification and Marketing Guide

> **Document purpose:** A detailed, marketing-ready description of PwarMyar for sales presentations, proposals, websites, social media, demonstrations, onboarding, and customer discussions.
>
> **Product scope reviewed:** The PwarMyar web, Windows desktop, mobile/PWA, Android, Laravel API, and PwarMyar Office implementation as of 2 September 2026. Office administration, financial-book preservation and shared branding sections were updated on 24 October 2026.

---

## 1. Product Overview

### 1.1 What is PwarMyar?

PwarMyar is a practical point-of-sale and business operations system designed for small and medium-sized retail, wholesale, and distribution businesses in Myanmar. It brings everyday shop activities into one organized workspace: selling, stock control, purchasing, supplier accounts, customer credit, expenses, transactions, reporting, staff access, receipt printing, and data backup.

Instead of keeping sales in one notebook, customer debts in another, stock quantities in staff members' memory, and expenses in scattered messages, PwarMyar connects these records. When a sale is completed, stock is reduced. When a purchase is received, stock is increased and product cost can be refreshed. When a customer leaves an unpaid balance, the amount is added to that customer's account. When supplier credit is used, the payable amount is tracked. Reports then use these connected records to give the owner a clearer view of the business.

PwarMyar is designed to feel approachable to everyday shop users while still providing the controls and records that business owners need.

### 1.2 Product promise

**Run sales faster, know your stock, control credit, and understand your business from one connected system.**

### 1.3 Core value proposition

PwarMyar helps a business:

- replace fragmented paper records and informal spreadsheets;
- speed up checkout with product search and barcode workflows;
- keep stock quantities connected to sales and purchases;
- support retail, wholesale, and other configurable selling prices;
- track money owed by customers and money owed to suppliers;
- record operating expenses and payment methods;
- review sales, estimated profit, cash movement, debts, and inventory value;
- give staff only the modules required for their jobs;
- continue making eligible fully paid sales during temporary internet interruptions;
- produce professional, configurable receipts;
- protect each business's information inside its own tenant scope;
- access the same business from desktop, browser, or mobile clients.

### 1.4 Positioning statement

For Myanmar shop owners who need more control than notebooks but do not want an unnecessarily complicated enterprise system, PwarMyar is a bilingual, multi-device POS and operations platform that connects checkout, inventory, purchasing, credit accounts, expenses, staff access, and reports in one straightforward workflow.

---

## 2. Who PwarMyar Is For

PwarMyar is suitable for businesses that buy products, hold stock, sell those products, and need better visibility over money and inventory.

### 2.1 Suitable business types

- Mini marts and convenience stores
- Grocery and general stores
- Phone and mobile-accessory shops
- Computer and electronics shops
- Cosmetics and beauty-product stores
- Clothing, footwear, and fashion shops
- Stationery and book shops
- Hardware and household-goods shops
- Pharmacies or health-product retailers whose workflow does not require regulated pharmacy features
- Spare-parts and automotive-accessory stores
- Wholesale shops
- Retail-and-wholesale businesses
- Small warehouses and product distributors
- Family-owned businesses
- Growing shops with owners, cashiers, purchasing staff, and managers

### 2.2 Best-fit operating profile

PwarMyar is a strong fit when a business:

- manages physical products and changing stock quantities;
- uses barcodes, SKUs, categories, or product names to identify items;
- buys in cartons or packs but sells in smaller units;
- uses different retail and wholesale prices;
- gives free-of-charge, bonus, or promotional quantities;
- sells to both walk-in and account customers;
- sometimes allows customers to pay later;
- purchases with full, partial, or delayed payment;
- wants owner-level reports without employing a dedicated analyst;
- needs several staff accounts with different responsibilities;
- wants desktop and mobile access to the same business data.

### 2.3 Businesses that may need customization

PwarMyar can form a strong operational base, but the current product does not claim specialized workflows for restaurants and table service, manufacturing and bill of materials, hotel reservations, payroll, full double-entry accounting, regulated pharmacy controls, e-commerce, or multi-branch stock transfer. Those use cases should be evaluated separately before they are marketed as supported.

---

## 3. Business Problems PwarMyar Solves

| Common business problem | How PwarMyar addresses it | Expected business benefit |
| --- | --- | --- |
| Checkout is slow because prices must be remembered or found manually. | Search by product name, SKU, barcode, or category; scan exact barcodes; choose the appropriate price type. | Faster service and fewer price-entry mistakes. |
| The owner does not know the current stock quantity. | Sales reduce stock, purchases increase stock, adjustments are recorded, and stock status can be filtered. | Better replenishment decisions and fewer lost sales. |
| Low-stock products are noticed only after they run out. | Each product can have a low-stock threshold; low-stock and out-of-stock summaries are visible. | Earlier purchasing and fewer stockouts. |
| Products are bought by carton but sold by piece. | Configure a base/selling unit, purchase unit, and conversion factor. | Correct stock increases without manual conversion calculations. |
| Retail and wholesale customers need different prices. | Configure multiple price types and choose a price during selling. | Consistent pricing for different customer groups. |
| Selling prices fall behind when supplier costs increase. | Optional automatic price rules can apply markup, minimum profit, and rounding after costs change. | Faster price maintenance and better margin protection. |
| Free goods and promotional quantities are forgotten. | Record FOC quantities in both sales and purchases. | More accurate stock and cost information. |
| Customer debt is scattered across notebooks and messages. | Credit sales, customer collections, shop payouts, balances, and statements are connected to each customer. | Clearer receivables and better collection follow-up. |
| Supplier balances are difficult to reconcile. | Credit purchases, payments to suppliers, supplier refunds, balances, and statements are tracked. | Better control over payables and supplier relationships. |
| Daily expenses are not included when judging profit. | Record expense title, category, date, payment method, amount, and note; include expenses in reports. | A more realistic operating-performance view. |
| The owner cannot tell where money moved. | Reports summarize sales receipts, collections, payouts, purchase payments, supplier payments/refunds, and expenses. | Improved cash control and daily review. |
| All staff can see or change everything. | Owners create named roles and assign access to specific operational modules. | Reduced unnecessary access and clearer responsibility. |
| A connection interruption can stop checkout. | Supported desktop and mobile clients can queue eligible fully paid walk-in sales locally and synchronize later. | Greater selling continuity during temporary outages. |
| Corrections damage stock accuracy. | Editing or deleting sales and purchases applies reversal logic and records related stock movements. | Historical corrections remain connected to inventory. |
| Receipts do not match the shop's identity or printer. | Configure shop details, visible receipt fields, paper size, alignment, margins, font sizes, and footer. | More professional customer documents. |
| Business data is mixed with another customer's data. | Server-side tenant scoping isolates operational records by business. | A safer multi-business platform design. |
| The owner has no portable copy of operational records. | Eligible paid plans can export a signed, compressed business backup and restore it to the same business. | Better recovery preparation and data portability. |

---

## 4. Product Editions and Access Channels

PwarMyar uses one central business account and supports several client experiences. Available packaging may depend on the commercial plan and deployment selected by the provider.

### 4.1 Business Web Application

The browser application provides the complete day-to-day business workspace. Users can sign in from a supported modern browser and work with the modules their role allows.

Best suited for:

- shop computers;
- office computers;
- owners who want access without installing a desktop executable;
- centrally hosted deployments.

The web client uses online server data. Browser receipt preview and printing use the browser's print dialog.

### 4.2 Windows Desktop Application

The portable Windows desktop application packages the PwarMyar business interface in a familiar desktop shell. It connects to the configured PwarMyar server for normal online operation and stores a controlled local product cache and offline-sale queue for business continuity.

Desktop-specific benefits include:

- a normal Windows application experience;
- bundled interface assets rather than loading the business website for every launch;
- automatic connection checks;
- automatic entry into Offline POS when the server cannot be reached;
- a manual Online/Offline POS mode switch while connected;
- local offline invoice history;
- user-controlled **Go online & sync** workflow;
- native desktop printing support;
- idempotent synchronization that prevents the same queued invoice from deducting stock twice.

### 4.3 Mobile Web App and Installable PWA

The mobile-first application is designed for phones and smaller screens. It provides touch-friendly navigation, separate full-page forms, swipe-to-refresh on authenticated pages, and endless-scroll business lists.

When served securely, the mobile web app can be installed from a supported browser as a Progressive Web App. Its application shell and static assets can be cached, while business records use the PwarMyar API and controlled local offline storage.

### 4.4 Android Application

The same mobile-first experience can be packaged as an Android application. The Android client uses its local renderer and secure API communication with the production service. File selection for payment proof uses the system picker without requesting broad photo or storage access.

### 4.5 PwarMyar Office

PwarMyar Office is a separate platform-administration console for the PwarMyar service operator. It is not part of the shop staff workspace. It manages:

- registered businesses and business detail;
- subscription plans, pricing, duration, features, visibility, and ordering;
- active, expired, cancelled, trial, and paid access;
- direct plan assignment and renewal;
- controlled trial extension;
- customer subscription requests;
- payment methods shown to business owners;
- uploaded payment-proof review;
- approval and rejection of subscription requests;
- subscription revenue and financial reporting;
- a per-currency platform cash book with expenses, other income, capital contributions, founder payouts, opening adjustments and internal transfers;
- multiple administrator accounts, admin/super-admin access and account deactivation;
- activity history identifying the administrator responsible for successful changes;
- variable founder membership and profit percentages, preserving earlier allocation snapshots;
- bank-book CRUD/archive and configurable subscription receiving books;
- shared theme color, logo, web icon and favicon settings;
- owner password reset;
- published Windows and Android releases, version details, checksums, release notes, and download counts.

#### Office administrator access and traceability

Ordinary administrators manage platform operations, subscriptions and finance.
Super administrators additionally manage administrator accounts and system
branding. Existing pre-upgrade administrators retain access as super admins.
New accounts default to ordinary admin access unless a super admin explicitly
assigns the higher level. Account deactivation preserves historical identity;
password changes and deactivation revoke tokens, and sessions are checked on use.
Self-deactivation/self-demotion and removal of the last active super admin are
blocked.

Successful Office mutations and sign-ins enter a read-only activity history
from this update onward. It records the acting admin ID, name/email snapshot,
time, method, target and selected action fields. Passwords, tokens and uploaded
image contents are excluded. Support-tool payment approvals/rejections also
enter this history. Historical actions are not retrospectively reconstructed.

#### Platform financial book and existing-data preservation

Book balances and reports remain separate for each currency. The initial books
are Kaung Htet Tin (1), Min Htet Kyaw (2), and VISA (3), with additional books
managed through CRUD/archive. Referenced books cannot be deleted; archived
books remain included in balances and history. The default subscription book
must be active and must be changed before that book can be archived/deleted.

Existing subscription receipts remain assigned to book 2. Each new receipt
stores the selected book, or the configured default at recording time. Changing
the default never moves historical receipts. Customer-facing payment
instructions and the internal receiving balance book are separate settings.

Active founder shares total 100%, with two decimal places. Removal archives the
founder. Existing founder names, percentages and stable IDs are migrated from
current settings; prior allocation snapshots remain unchanged. New allocations
record payment from a selected funded bank book. Legacy unpaid allocations
remain entitlements that can be settled separately. The last participating
founder receives any minor-unit rounding remainder.

Profit is receipts plus other income minus expenses. Cash also includes
opening adjustments and capital contributions, less payouts and paid
allocations. Transfers change only the source/destination books. Opening
adjustments add to the existing balance and do not reset history or create
income. A migration must not create duplicate receipts or opening entries.

The additive upgrade preserves financial rows, dates and allocation snapshots;
a follow-up backfill changes only NULL receipt-book assignments to legacy book
2. Save a full database backup and a private financial snapshot before the
upgrade, stop writers, run migrations, and verify original rows and financial
totals before reopening writes. Rollback is refused when it would discard newer
receipt routing or founder settings. See the [financial-book guide](office/docs/financial-book.md)
and [deployment procedure](README.md#upgrading-an-existing-office-financial-book).

#### Shared branding

A super administrator can set the shared primary theme color and upload or
restore the logo, web icon and favicon. Updated Office, Business desktop web,
mobile web and Shop clients load the settings on opening/refresh; the last
fetched settings are cached for offline use with packaged image fallbacks.
PNG, JPEG and WebP uploads support up to 2 MB and 4096 pixels per dimension.
Packaged Windows/Android launcher icons and installed home-screen icons require
an application release or reinstall.

---

## 5. Detailed Functional Specification

## 5.1 Registration, Authentication, and Account Setup

### Business registration

A new owner can create an PwarMyar business by entering:

- business name;
- owner name;
- email address;
- password and confirmation.

Registration creates a separate business record, the first owner account, initial shop settings, a default Retail price type, and—when enabled by the platform—a one-month free trial. The owner is signed in after successful registration.

### Sign-in and session behavior

- Active owners and staff sign in with email and password.
- Same-origin web deployments use HTTP-only session cookies and CSRF protection.
- Portable web, desktop, and Android delivery modes can use Laravel Sanctum bearer tokens.
- Disabled users and inactive businesses cannot sign in.
- Sign-out invalidates the active session or token.
- Users can update their profile name and email after confirming the current password.
- Password changes require confirmation and a minimum of eight characters.

### Subscription enforcement

Business APIs require authentication, an active business, and a currently valid subscription. Enforcement occurs on the server, not only by hiding screens in the user interface. When access expires, business operations are blocked and the owner is directed to billing or renewal. Staff see a subscription-blocked state and are directed to contact the owner.

## 5.2 Sell and Checkout

The Sell module supports fast everyday checkout.

### Product selection

- Search active products by name, SKU, barcode, or category.
- Scan or enter an exact barcode to find a product.
- Filter or browse by category.
- Add one or more products to the cart.
- Change quantities using decimal precision where needed.
- Record FOC quantity separately from paid quantity.
- Select a configured price type for each line, such as Retail or Wholesale.
- Use the price stored for the selected product and price type.

### Cart and totals

- Calculate line totals from quantity and unit price.
- Calculate subtotal across all sale lines.
- Apply an order-level discount up to the subtotal.
- Calculate the final total.
- Record the amount paid.
- Calculate any remaining credit amount automatically.
- Prevent an unpaid balance without a saved customer.

### Payment handling

PwarMyar supports configurable payment-method labels. Default choices include Cash, Wallet Pay, Banking Pay, KPay, Wave Pay, and Credit. These labels classify transactions for records and reports; they do not automatically process a bank, wallet, or card payment.

The sale may be:

- fully paid;
- partially paid with the balance assigned to a customer;
- fully credited to a customer.

### Completion behavior

On successful checkout, PwarMyar:

1. creates a unique dated receipt number;
2. stores the sale header and item details;
3. records paid and credit amounts;
4. records the selected payment method;
5. saves product cost on sale lines for later profit estimation;
6. reduces stock by paid quantity plus FOC quantity;
7. creates stock-movement records;
8. updates customer receivables when credit is used;
9. makes the receipt available for preview and printing.

### Sale history and correction

- Search and filter sales by text, date, status, payment method, payment type, or customer.
- Open a sale to review its complete item detail.
- Reopen and print a current or historical receipt.
- Edit eligible completed sales with owner-controlled administrative PIN protection when configured.
- Delete/void through the controlled transaction workflow.
- When a sale is corrected, existing stock is restored before the revised sale is applied.
- When a sale is deleted, its product quantities are returned to stock and reversal movements are recorded.

## 5.3 Offline Selling Continuity

Supported Windows desktop and mobile clients provide a limited Offline POS workflow for temporary connection loss. This feature is designed to keep straightforward counter sales moving; it is not a complete offline copy of every PwarMyar module.

### Before offline use

The user must first sign in online with:

- an active subscription;
- permission to use the Sell module;
- a successfully downloaded cache of active products, prices, categories, and sale settings.

### What can be done offline

- Search cached products.
- Use cached categories and current cached prices.
- Add items and FOC quantities to a cart.
- Record a fully paid walk-in sale.
- Generate a local invoice number.
- Preview and print the local receipt.
- View pending or failed offline invoices.
- Automatically or manually synchronize invoices after reconnecting, depending on the client workflow.

### Offline safeguards and restrictions

- Offline sales must be fully paid.
- Offline customer credit is not allowed.
- A saved customer cannot be attached to an offline sale.
- Offline invoices are stored on the current device until synchronization.
- Server stock is checked when the invoice synchronizes.
- Current server product identity and price are checked at synchronization.
- A deleted product, changed product name, changed price, or insufficient server stock can cause that invoice to require attention.
- One failed invoice does not discard other queued invoices.
- Retrying an invoice already received by the server does not create a duplicate stock deduction because synchronization is keyed by a unique offline-sale identifier.
- During an expired trial, only qualifying invoices created before expiration may synchronize within the configured grace period.

### Correct marketing language

Use: **“PwarMyar supports offline continuity for eligible fully paid sales on supported desktop and mobile clients.”**

Do not use: **“Every PwarMyar feature works permanently without internet.”**

## 5.4 Product and Inventory Management

### Product master data

Each product can include:

- product name;
- SKU;
- unique active barcode within the business;
- category;
- base or selling unit;
- optional purchase unit;
- units-per-purchase-unit conversion factor;
- current cost;
- opening/current stock;
- low-stock threshold;
- one or more selling prices;
- active or archived status.

### Product search and organization

- Search by name, SKU, barcode, or category.
- Filter by category.
- Filter by in-stock, low-stock, or out-of-stock status.
- Use an exact barcode/SKU filter.
- Scan a barcode from the product workspace.
- Display total active products and total stock units.
- Open low-stock and out-of-stock product lists from inventory summary cards.
- Archive products rather than immediately destroying historical references.

### Multiple prices

A business can create its own price types. Examples include:

- Retail;
- Wholesale;
- VIP;
- Dealer;
- Online;
- Cash price;
- any other business-defined name that meets validation rules.

At least one price type must remain. A price type already used by active products cannot be removed until the active usage is resolved.

### Automatic price rules

For each price type, the owner can choose manual or automatic pricing. An automatic rule can define:

- markup percentage over product cost;
- minimum profit amount;
- rounding interval;
- whether the rule should be applied to existing products.

For automatic product prices, PwarMyar calculates at least the cost plus the required percentage or the configured minimum profit—whichever is higher—and then rounds upward to the selected interval. When purchasing changes the current product cost, eligible automatic prices are recalculated.

### Units and conversion

A product may be sold in a base unit and bought in a larger purchase unit. Example:

```text
Base/selling unit: Piece
Purchase unit: Carton
Conversion: 1 Carton = 24 Pieces
```

Receiving 3 cartons adds 72 pieces to stock. This reduces manual conversion errors and supports common distributor and wholesale workflows.

### Stock control and movement history

Stock can change through:

- opening stock;
- purchases;
- sales;
- sale edits and reversals;
- purchase edits and reversals;
- manual adjustments.

The stock-adjustment workflow accepts a positive or negative quantity and an optional reason. Product movement history records product, movement type, quantity change, reference type, reference ID, note, and time.

### Product CSV tools

The desktop/web product workspace supports CSV export and row-by-row import for fields such as:

- name;
- SKU;
- barcode;
- category;
- base unit;
- purchase unit;
- conversion factor;
- cost;
- stock;
- low-stock threshold;
- configured selling-price columns.

Import feedback reports added, skipped, and failed rows. CSV export uses a UTF-8-compatible format suitable for spreadsheet applications.

### Barcode output

PwarMyar can open a printable list of products that have barcodes. This is useful as a barcode reference list. Specialized label-sheet design, barcode-image generation, or direct label-printer integration should not be promised without separate confirmation or customization.

## 5.5 Purchasing and Goods Receiving

The Purchases module records incoming stock and supplier obligations.

### Purchase entry

A purchase can include:

- saved supplier or supplier name;
- one or more products;
- purchase unit for each product;
- paid quantity;
- FOC quantity;
- unit cost;
- payment method;
- paid amount;
- automatically calculated credit amount;
- note.

### Unit-aware receiving

The user can receive a product in its base unit or configured purchase unit. PwarMyar converts paid and FOC purchase quantities into base-stock quantities before increasing inventory.

### Cost behavior

For each line, PwarMyar:

- calculates the purchase line value from paid quantity and unit cost;
- includes FOC received quantity in total units received;
- calculates an effective cost per base unit;
- updates the product's current cost from the effective cost of the purchase;
- recalculates eligible automatic selling prices;
- returns any price changes to the user interface for visibility.

The current-cost approach uses the latest eligible completed purchase line; it is not represented as weighted-average, FIFO, or full inventory-accounting valuation.

### Purchase credit

- Record full payment, partial payment, or supplier credit.
- An unpaid purchase requires a saved supplier.
- The unpaid amount becomes part of that supplier's balance.
- Payment-method labels classify how the paid portion was settled.

### Purchase history and corrections

- List and search purchase records.
- Review products, quantities, units, cost, supplier, payment, credit, and notes.
- Edit an eligible purchase.
- Delete/void an eligible purchase.
- Restore previously received quantities before applying an edited purchase.
- Reverse received stock when a purchase is deleted.
- Refresh current product cost and automatic prices after relevant reversals.

## 5.6 Supplier Management and Payables

### Supplier directory

Store and search:

- supplier name;
- phone;
- address;
- contact person;
- notes;
- active status.

Supplier cards and detail views can include purchase count, total purchases, last purchase, credit-purchase total, paid total, refund total, and current balance.

### Supplier account transactions

PwarMyar supports both directions of supplier money movement:

- **Shop to supplier:** a payment that reduces the amount the shop owes.
- **Supplier to shop:** a refund or credit movement in the opposite direction.

Each transaction can store amount, payment method, note, status, and date/time. Users can search, filter, edit, and delete supplier-payment records according to their permitted modules.

### Supplier statement

A date-filtered supplier statement combines credit purchases and supplier payments with the supplier summary. This helps answer:

- How much was purchased on credit?
- How much has already been paid?
- Were any refunds received?
- What is the current balance?
- Which purchases and payments created that balance?

## 5.7 Customer Management and Receivables

### Customer directory

Store and search:

- customer name;
- phone;
- address;
- note;
- active status.

Customers are archived rather than casually removed from business history.

### Credit-sale behavior

When the checkout paid amount is lower than the sale total, PwarMyar requires a saved customer. The remaining amount becomes customer credit. This creates a direct connection between the receipt and the customer's balance.

### Customer account transactions

PwarMyar supports:

- **Customer to shop:** collection of customer debt.
- **Shop to customer:** payout, refund, advance, or other reverse-direction account movement.

Each record includes amount, payment method, and optional note. Transactions can be reviewed and corrected.

### Customer detail and statement

The customer workspace can show:

- total credit sales;
- total customer payments;
- total shop payouts;
- current balance;
- credit-sale history;
- payment history;
- date-filtered account statement.

This gives the owner a more reliable answer to “Who owes us, how much, and why?”

## 5.8 Expense Management

Expenses can be recorded with:

- title;
- category;
- amount;
- payment method;
- expense date;
- note;
- transaction status.

The workspace supports listing, filtering, summary totals, editing, and controlled deletion/voiding. Useful summary values include today's total, current-month total, total for the active filter, matching record count, and the top expense category.

Example categories include rent, electricity, transport, wages, maintenance, packaging, delivery, marketing, and miscellaneous shop costs.

## 5.9 Transactions Workspace

The Transactions module provides a centralized operational history across supported transaction types, including:

- sales;
- purchases;
- expenses;
- customer payments and payouts;
- supplier payments and refunds.

Depending on transaction type, users can search, filter by date/status/direction/payment method, open details, edit records, print sale receipts, and delete or reverse records. This workspace helps staff find a specific historical event without moving through every master-data module.

## 5.10 Reports and Business Intelligence

Reports can be run for a selected start and end date, for today, for the current month by default, or for all available time.

### Sales performance

- Receipt count
- Total sales
- Amount paid during sales
- Credit sales
- Top ten products by sales value
- Paid quantity
- FOC quantity
- Total issued quantity
- Sales grouped by payment method

### Purchasing and supplier position

- Purchase count
- Total purchase value
- Amount paid during purchases
- Credit purchases
- Purchase FOC quantity
- Estimated value of purchase FOC quantity
- Supplier payables
- Suppliers currently owed
- Supplier credit/refund position

### Expense and profit view

- Total expenses
- Expenses grouped by category
- Estimated profit

The current estimated-profit formula is:

```text
Sales total - recorded cost of paid sale quantities - expenses
```

It is an operational estimate, not audited accounting profit. FOC cost, tax, depreciation, payroll accruals, historical cost corrections, and accounting adjustments may require separate interpretation.

### Cash-movement view

PwarMyar combines:

- sales money received;
- customer debt collected;
- supplier refunds received;
- shop payouts to customers;
- amounts paid during purchases;
- later supplier payments;
- expenses.

From these values it calculates an expected net cash movement for the selected period. This is a management indicator, not bank reconciliation or a full cash-register counting function.

### Customer and supplier accounts

- Total customer receivables
- Number of customers owing money
- Customer payable/credit position
- Supplier payables
- Number of suppliers owed
- Total open accounts

### Inventory valuation

- Count of active products currently in stock
- Total current stock units
- Current stock investment value based on recorded cost
- Potential sales value based on the primary selling price
- Potential gross profit difference
- Valuation “as of” date

### Export

The report summary can be exported to a UTF-8 CSV file containing headline totals, inventory valuation, and top-product information for further use in spreadsheet tools or owner reporting.

## 5.11 Staff, Roles, and Permissions

Only the business owner manages access.

### Custom roles

The owner can create named roles such as:

- Cashier;
- Storekeeper;
- Purchasing Officer;
- Supervisor;
- Manager.

Each custom role receives one or more module permissions from:

- Sell;
- Products;
- Purchases;
- Suppliers;
- Customers;
- Expenses;
- Transactions;
- Reports.

The owner always receives the enabled owner modules and the Access workspace. A role cannot be deleted while staff are assigned to it.

### Staff accounts

The owner can:

- create a staff member with name, email, password, and role;
- activate or deactivate the account;
- reassign its access role;
- reset its password;
- delete the staff account.

Permissions are enforced at the API route level as well as used to shape the visible application navigation.

## 5.12 Settings, Localization, and Receipts

### Business and receipt identity

Configure:

- shop name;
- optional shop title;
- address;
- phone number;
- currency label, with `Ks` as the default;
- receipt footer.

### Payment methods

Configure the comma-separated payment-method choices used for operational transaction classification. Defaults support common Myanmar shop terminology such as Cash, KPay, Wave Pay, wallet payment, banking payment, and Credit.

### Receipt content and layout

- Show or hide customer name.
- Show or hide payment method.
- Show or hide price type.
- Select 50 mm, 58 mm, 80 mm, 85 mm, or A4 paper.
- Align the header left, center, or right.
- Configure left and right margins.
- Configure header and body font sizes.
- Configure line height.
- Preview a sample receipt before use.
- Print through the browser print dialog in web mode or the desktop print workflow in the Windows app.

### Language

The business interface supports English and Myanmar language selection. This reduces training barriers for local teams and allows the owner to choose the language that staff use most comfortably.

### Administrative PIN

The owner can configure an administrative PIN used to protect sensitive correction workflows such as sale editing/deletion and data restoration where applicable.

## 5.13 Data Backup and Restore

Backup and restore are owner-only capabilities available on an eligible valid paid subscription.

### Export

- Downloads a signed, compressed `.mkpos-backup` file.
- Includes operational POS data for the authenticated business.
- Uses a filename containing the business slug and export time.
- Is delivered as a private, non-cacheable download.

### Restore

- Accepts a valid PwarMyar backup up to the configured upload limit.
- Requires the explicit confirmation word `RESTORE`.
- Can require the configured administrative PIN.
- Verifies the backup and restricts restoration to the same authenticated business.
- Replaces operational POS data inside a database transaction.
- Creates a server-side safety backup before replacement.

Accounts, login credentials, staff roles, and subscription records are intentionally excluded from the operational restore scope.

### Recommended operating policy

Owners should download backups regularly, especially before large imports or major product changes, and store more than one copy in secure locations controlled by the business.

## 5.14 Subscription and Billing

### Free trial

When trial mode is enabled, a newly registered business receives a system-managed one-month trial. The trial includes normal operational modules but restricts backup download and restore. The interface shows the trial state and reminders as expiration approaches.

### Paid plan purchase request

1. The owner opens Billing.
2. The owner reviews published plans, descriptions, features, price, currency, and duration.
3. The owner selects a plan and one of the payment destinations configured by PwarMyar Office.
4. The owner uploads a payment screenshot and may add a message.
5. The request appears in PwarMyar Office as pending.
6. A platform administrator reviews the details and proof.
7. The administrator chooses an active receiving book or uses the configured default. Approval activates paid access and records the payment with its administrator and bank book; rejection updates the request status and reviewing administrator.

### Billing history

The business owner can review subscription payments and plan history. Office administrators can assign, renew, extend trial access, replace, suspend/reactivate, or cancel a subscription. Assignment and renewal support a receiving-book override. Payment records retain the recording administrator; Office billing history also identifies the administrator who last changed subscription access. Gift assignments grant access without a payment or revenue record.

### Current payment model

Subscription payment confirmation is currently manual. PwarMyar records payment destinations and payment proof, but it does not automatically charge a card, transfer wallet funds, or independently verify a bank transaction.

---

## 6. End-to-End Operating Workflows

## 6.1 First-Time Setup

1. Register the business owner account.
2. Confirm the automatically granted trial or activated paid plan.
3. Open Settings and enter shop identity, currency, language, payment methods, and receipt layout.
4. Create required price types, such as Retail and Wholesale.
5. Add products manually or import them from CSV.
6. Configure product units, barcodes, prices, opening stock, and low-stock thresholds.
7. Add suppliers and customers as required.
8. Create staff roles and accounts.
9. Test a sample sale and receipt.
10. On an eligible paid plan, download the first backup.

## 6.2 Daily Counter Sale

1. Open Sell.
2. Search or scan a product.
3. Select the correct price type.
4. Enter paid and FOC quantities.
5. Repeat for other products.
6. Apply a discount if authorized by the business process.
7. Choose the payment method.
8. Enter the amount received.
9. If money remains unpaid, select a saved customer.
10. Complete checkout and print the receipt.

Result: the sale is recorded, stock is reduced, and any unpaid amount updates the customer account.

## 6.3 Receiving a Supplier Delivery

1. Open Purchases and create a new purchase.
2. Select the supplier.
3. Add received products.
4. Choose base or purchase units.
5. Enter paid and FOC quantities and unit cost.
6. Enter the amount paid and payment method.
7. Save the purchase.

Result: stock increases in base units, current cost is refreshed, supplier credit is calculated, and automatic prices can be updated.

## 6.4 Collecting Customer Debt

1. Open the customer account.
2. Review the balance and statement.
3. Record a customer-to-shop payment.
4. Select the payment method and add a note if required.
5. Confirm the new balance.

## 6.5 Paying a Supplier

1. Open the supplier account.
2. Review credit purchases and the current balance.
3. Record a shop-to-supplier payment.
4. Choose the payment method and add a note.
5. Confirm the updated payable balance.

## 6.6 Working During a Connection Interruption

1. Use Offline POS on a supported, previously prepared device.
2. Sell cached products only to a walk-in customer.
3. Take full payment and issue the local receipt.
4. Continue viewing the queue of offline invoices.
5. Reconnect and synchronize.
6. Review any invoice marked failed because its product, price, or stock changed on the server.

## 6.7 Owner's Daily Review

1. Open Reports and select today.
2. Compare sales received by payment method.
3. Review customer collections, supplier payments, purchases, and expenses.
4. Check expected cash movement.
5. Review top-selling products.
6. Check low-stock and out-of-stock products.
7. Follow up customer and supplier open accounts.

---

## 7. Practical Business Scenarios

### 7.1 Mini Mart

A cashier scans products, accepts Cash or KPay, and prints an 80 mm receipt. Every sale reduces stock. The owner checks low-stock items and today's payment-method totals before closing.

**Problems addressed:** slow checkout, incorrect prices, missing stock, unclear daily sales.

### 7.2 Wholesale and Retail Shop

The owner creates Retail and Wholesale price types. Products are purchased in cartons and sold by piece. Automatic pricing applies the required margin and rounding when supplier costs change.

**Problems addressed:** inconsistent customer pricing, unit-conversion mistakes, margin erosion.

### 7.3 Phone Accessories Store

Staff search by product name, SKU, or barcode. The owner tracks different categories, adjusts damaged-item stock with a reason, and reviews movement history when quantities do not match.

**Problems addressed:** many similar products, stock discrepancy, weak traceability.

### 7.4 Family-Owned Credit Business

Regular customers can take goods with partial payment. PwarMyar records each credit sale and later collection in the customer statement. The owner sees total receivables without adding notebook pages manually.

**Problems addressed:** forgotten debts, disputed balances, unclear collections.

### 7.5 Small Distributor

The business records goods from several suppliers, including free cartons and partially paid purchases. Supplier statements show credit purchases, payments, refunds, and outstanding balances.

**Problems addressed:** supplier payable confusion, missed FOC stock, inaccurate purchase cost.

### 7.6 Growing Shop with Several Employees

Cashiers receive Sell access, the storekeeper receives Products and Purchases, and the owner keeps Reports, Access, Settings, and Billing. Each person signs in with an individual account.

**Problems addressed:** shared passwords, excessive access, unclear job responsibility.

---

## 8. Data, Security, and Reliability

### 8.1 Business isolation

PwarMyar uses a shared database with enforced `business_id` tenant scoping. Tenant-aware database queries apply the signed-in user's business context to operational reads, inserts, updates, deletes, and validation lookups. One business should not be able to access another business's POS records through normal business APIs.

### 8.2 Authentication controls

- Passwords are hashed by the server.
- Email addresses are unique across the platform.
- Login and sensitive password/profile endpoints are rate-limited.
- Same-origin sessions use HTTP-only cookies and CSRF protection.
- Portable clients use revocable bearer tokens.
- Business and user active status are checked at sign-in.
- Logout invalidates the active credential.

### 8.3 Authorization controls

- Subscription validity is checked on protected operational APIs.
- Module permission is checked on server routes.
- Owner-only administration protects roles, staff, settings, billing requests, and backup operations.
- Backup capabilities can be restricted by subscription class.
- Administrative PIN checks can protect sensitive data-correction operations.

### 8.4 Transactional integrity

Stock-affecting sale, purchase, edit, deletion, offline synchronization, and restore workflows use server-side database transactions and row locking where appropriate. This reduces the risk of a partial operation leaving business totals and stock in inconsistent states.

### 8.5 Deployment security expectations

An internet-facing PwarMyar deployment should use HTTPS, secure session-cookie settings, approved CORS origins, a supported PHP/Laravel environment, database backups, server monitoring, and restricted server/file access. The current repository uses Laravel 9 for compatibility with its original PHP 8.0/XAMPP environment; a public deployment should be maintained on supported runtime versions as part of normal security operations.

---

## 9. Technical Specification

### 9.1 Architecture

| Layer | Technology and role |
| --- | --- |
| Business web client | React 18 single-page application built with Vite |
| Mobile client | Separate React 18 mobile-first SPA/PWA; Android packaging supported through Capacitor |
| Windows client | Electron desktop shell with bundled React renderer and local SQLite offline-sale queue |
| Platform console | Separate React 18 PwarMyar Office SPA |
| Application API | Laravel 9 REST-style JSON API |
| Authentication | Laravel Sanctum sessions and bearer tokens, depending on client mode |
| Primary database | MySQL or MariaDB |
| Tenancy | Shared database with server-enforced business context |
| Receipt output | HTML/text receipt payloads; browser or native desktop print workflow |
| Data exchange | JSON APIs, CSV product/report files, signed compressed PwarMyar backups |

### 9.2 Supported deployment patterns

- Centrally hosted Laravel API with web, mobile, Android, and Windows clients.
- Same-origin Laravel-hosted business and Office web applications.
- Portable static web build connected to the configured HTTPS API.
- Portable Windows x64 executable connected to the configured API.
- Installable mobile PWA served over HTTPS.
- Android package connected to the configured API.

### 9.3 Recommended customer equipment

Actual requirements depend on deployment and transaction volume, but a typical shop should use:

- a Windows 10/11 x64 computer for the portable desktop app or a current browser;
- a reliable phone or Android device for the mobile client;
- a stable network for full online functions;
- a keyboard and mouse or touch interface;
- a USB barcode scanner that behaves like keyboard input, if barcode checkout is desired;
- a printer supported by Windows or the browser, using one of the configured paper sizes;
- secure local or external storage for downloaded backups.

Hardware compatibility should be tested before promising support for a specific scanner or printer model.

### 9.4 Scale and pagination behavior

Operational list APIs use paginated responses with bounded page sizes. The desktop UI provides paged tables, while the mobile UI uses endless-scroll lists. Exact supported transaction volume depends on hosting resources, database configuration, indexes, backup policy, and operational usage; no fixed “unlimited” volume should be advertised without load testing the target deployment.

---

## 10. Important Scope Boundaries

Clear expectations build customer trust. The current PwarMyar product should be marketed with these boundaries:

- PwarMyar is a POS and operational-management system, not a complete double-entry accounting package.
- Estimated profit and expected cash movement are management indicators, not audited financial statements.
- Tax filing, statutory accounting, payroll, bank reconciliation, and general ledger are not included in the current scope.
- Full application use normally requires the central PwarMyar service to be reachable.
- Offline mode covers eligible fully paid walk-in sales only; customer credit and other modules remain online workflows.
- Offline invoices may need review if stock, products, or prices changed before synchronization.
- Payment-method choices record how money was paid; they do not execute or confirm customer payments.
- Subscription payments use manual proof review; no automatic payment gateway is included.
- Web printing uses the browser print dialog. Printer-specific direct commands are not universally supported.
- The current product is business-scoped, not a multi-branch inventory-transfer system.
- Product cost follows the current/latest effective purchase cost approach, not FIFO, LIFO, or weighted-average inventory accounting.
- Barcode scanning assumes compatible keyboard-style scanner input; specialized hardware should be tested.
- Features listed in a subscription plan are descriptive plan information; plan-level module feature gating is not currently represented as a separate per-feature entitlement engine.

---

## 11. Customer Benefits by Role

### Business owner

- See connected sales, cost, expenses, credit, and stock information.
- Reduce dependence on verbal reports from staff.
- Review business activity from different supported devices.
- Control roles, staff accounts, receipt identity, and backup operations.
- Make purchasing and collection decisions from recorded data.

### Cashier

- Find products quickly.
- Use the correct selling price.
- calculate discount, paid amount, and balance automatically.
- print a clear receipt.
- continue eligible cash-equivalent sales during a temporary outage.

### Inventory or purchasing staff

- Record deliveries with unit conversion.
- Include FOC goods correctly.
- see low-stock and out-of-stock products.
- track purchase history and supplier balances.
- maintain stock-adjustment reasons and movement history.

### Manager

- Review transactions and operational exceptions.
- Check daily and date-range reports.
- Monitor payment-method totals, expenses, and open accounts.
- Investigate stock changes and transaction corrections.

### Customer of the shop

- Receive a professional receipt.
- Have credit sales and later payments recorded in one statement.
- Experience quicker, more consistent checkout.

---

## 12. Marketing Message Library

### 12.1 One-line description

**PwarMyar connects sales, stock, purchasing, customer credit, supplier balances, expenses, staff access, and business reports in one easy system for Myanmar shops.**

### 12.2 Short description

PwarMyar is a bilingual point-of-sale and shop-management system for Myanmar retail, wholesale, and distribution businesses. Sell with barcode support, control inventory, receive stock in cartons or pieces, manage retail and wholesale prices, track customer and supplier credit, record expenses, print receipts, and review business reports from desktop or mobile.

### 12.3 Medium website description

Still managing sales, stock, credit, and expenses in separate notebooks? PwarMyar brings them together. Every completed sale updates inventory. Every received purchase adds stock and can update product cost. Customer debts and supplier balances stay connected to their transactions, while owner reports show sales, expenses, estimated profit, cash movement, top products, and inventory value. With bilingual screens, role-based staff access, configurable receipts, Windows and mobile clients, and controlled offline-sale continuity, PwarMyar helps growing Myanmar businesses work with greater speed and control.

### 12.4 Sales headline options

- Sell Faster. Know Your Stock. Control Your Business.
- Your Shop, Organized in One System.
- From Counter Sale to Owner Report—PwarMyar Keeps It Connected.
- Stop Guessing About Stock and Credit.
- Practical POS Software Built for Myanmar Business Workflows.
- Retail, Wholesale, Stock, Credit, and Reports—Together.

### 12.5 Benefit-led feature bullets

- Fast product search and barcode checkout
- Retail, wholesale, and custom price types
- Automatic stock updates from sales and purchases
- Carton-to-piece purchase conversion
- FOC quantity tracking
- Low-stock and out-of-stock visibility
- Customer credit, collections, and statements
- Supplier credit, payments, refunds, and statements
- Expense tracking by date, category, and payment method
- Sales, estimated profit, cash movement, and inventory reports
- English and Myanmar interface
- Custom staff roles and module permissions
- Configurable receipts for 50/58/80/85 mm and A4 paper
- Windows desktop, web, mobile PWA, and Android delivery options
- Offline continuity for eligible fully paid sales
- Owner-controlled backup and restore on eligible paid plans

### 12.6 Problem-led advertisement copy

**Are stock shortages, customer debt, and scattered records making your shop harder to control?**

PwarMyar connects daily checkout with products, stock, purchases, customers, suppliers, expenses, and reports. Search or scan products, use retail or wholesale prices, print receipts, track unpaid balances, and see what is happening in your business—all from one organized system.

Made for practical Myanmar shop workflows, with English and Myanmar language support, desktop and mobile access, and offline continuity for eligible fully paid sales.

### 12.7 Thirty-second sales pitch

PwarMyar is more than a cash-register screen. It connects everything that happens around a sale. Stock goes down when you sell and up when you purchase. Customer and supplier credit stays attached to the correct account. Expenses are included in reports, and the owner can review sales, estimated profit, cash movement, top products, and inventory value. It supports retail and wholesale pricing, carton-to-piece conversion, receipts, staff permissions, English and Myanmar, desktop and mobile use, plus controlled offline sales when the connection is temporarily unavailable.

### 12.8 Recommended call to action

**Book an PwarMyar demonstration using your own shop examples. See how to add a product, make a sale, receive stock, track credit, and review today's report in one connected workflow.**

### 12.9 Contact information

- Phone: 09688683805, 09792104209
- Viber: 09688683805, 09792104209
- Telegram: `@moekaungdev`

---

## 13. Demonstration Script for Sales and Marketing

A strong product demonstration should show a complete business story rather than opening unrelated screens.

### Demo preparation

Create:

- one retail product sold by piece;
- one wholesale product bought by carton and sold by piece;
- Retail and Wholesale price types;
- one supplier;
- one regular customer;
- one cashier role;
- realistic Cash, KPay, and Credit payment methods;
- shop name, phone, address, and receipt footer.

### Recommended 12-minute demonstration

1. **Start with the problem:** explain that the shop currently separates sales, stock, credit, and expenses.
2. **Show Products:** scan/search a product, show two price types, unit conversion, and low-stock threshold.
3. **Show Purchasing:** receive one carton plus FOC units and explain the resulting piece quantity and updated cost.
4. **Show Selling:** scan the product, choose a price type, add quantity, take payment, and print the receipt.
5. **Show Customer Credit:** create a partially paid sale for the regular customer.
6. **Show Customer Account:** open the new debt and record a later collection.
7. **Show Supplier Account:** demonstrate the purchase payable and record a payment.
8. **Show Expenses:** add a realistic delivery or electricity expense.
9. **Show Reports:** display today's sales, estimated profit, payment methods, cash movement, debt, and inventory value.
10. **Show Access:** demonstrate how the cashier sees only assigned modules.
11. **Show Mobile:** open the same business in the mobile-first interface.
12. **Explain Offline POS:** clearly demonstrate its fully paid walk-in restrictions and later synchronization.

### Proof points to emphasize

- One action updates several connected records.
- The owner does not need to total separate notebooks.
- The system supports both simple shops and growing teams.
- Myanmar language and local payment labels reduce training friction.
- Honest offline and reporting boundaries make the product dependable rather than overpromised.

---

## 14. Customer Onboarding Checklist

### Before setup

- Confirm the business type and whether PwarMyar fits its workflow.
- Count approximate products, customers, suppliers, daily sales, and users.
- Identify base units, purchase units, price types, and payment methods.
- Confirm barcode-scanner and printer models for testing.
- Prepare existing product data in a clean spreadsheet.
- Decide which staff roles are needed.
- Confirm internet reliability and which device will use offline continuity.

### Configuration

- Register and verify owner access.
- Activate trial or paid plan.
- Configure shop identity, currency, language, and receipt.
- Create price types and automatic price rules where appropriate.
- Import or enter products.
- Verify barcodes and units.
- Enter opening stock carefully.
- Add customers and suppliers.
- Create roles and staff.
- Test sale, purchase, customer credit, supplier credit, and expense workflows.
- Test receipt printing on the actual printer.
- Prepare the offline cache on supported devices.
- Download and securely store a backup when eligible.

### Staff training

- Train cashiers on search, scanning, cart changes, payment, credit restrictions, and receipts.
- Train purchasing staff on units, FOC, cost, supplier credit, and correction effects.
- Train managers on transactions, statements, reports, and stock movement history.
- Train the owner on access, settings, subscription, administrative PIN, and backup policy.

### Go-live review

- Reconcile opening stock for a sample of important products.
- Complete and reverse a test sale.
- Complete and reverse a test purchase.
- Confirm customer and supplier balances.
- Compare cash/payment totals at the end of the first day.
- Review low-stock warnings.
- Schedule routine backup and report checks.

---

## 15. Frequently Asked Questions

### Does PwarMyar support Myanmar language?

Yes. The business applications support English and Myanmar language selection.

### Can we use barcodes?

Yes. Products can store barcodes, and users can search or scan them. A standard scanner that sends barcode characters like a keyboard is the expected setup; test the intended hardware before rollout.

### Can we sell wholesale and retail from the same product?

Yes. Create multiple price types and select the appropriate price during a sale.

### Can we buy by carton and sell by piece?

Yes. Configure the base/selling unit, purchase unit, and conversion factor for the product.

### Does stock update automatically?

Yes. Completed sales reduce stock, completed purchases increase stock, and correction workflows reverse and reapply quantities. Manual adjustments are also recorded.

### Can we track free goods?

Yes. Separate FOC quantities are supported in both sales and purchases.

### Can a customer buy on credit?

Yes. A saved customer is required whenever the sale has an unpaid amount. The balance appears in the customer's account and statement.

### Can we track money owed to suppliers?

Yes. Partially paid or unpaid purchases create supplier credit, and later payments or refunds update the supplier balance.

### Can different staff have different access?

Yes. The owner creates custom roles and assigns operational modules to each role.

### Does PwarMyar work without internet?

Normal full-feature use requires the PwarMyar service. Supported desktop and mobile clients can continue eligible fully paid walk-in sales using prepared cached product data and synchronize them later. Other modules and customer-credit sales require online access.

### Can we print receipts?

Yes. PwarMyar produces configurable receipts and supports browser printing or the Windows desktop print workflow. Available paper sizes include 50 mm, 58 mm, 80 mm, 85 mm, and A4.

### Does PwarMyar process KPay, Wave Pay, or bank payments automatically?

No. These can be recorded as payment methods for transaction classification and reports, but the current product does not transfer funds or verify those payments automatically.

### Can we back up our data?

Yes, on an eligible active paid plan. The owner can export a signed, compressed business backup and restore it to the same business with confirmation safeguards.

### Is PwarMyar an accounting system?

PwarMyar provides operational sales, cost, expense, cash-movement, credit, and inventory reports. It is not a full general-ledger or statutory accounting system.

### Can PwarMyar manage several branches?

The current implementation isolates data by business account but does not provide branch-level warehouses, inter-branch transfers, or consolidated branch reporting. Discuss customization before selling it as a multi-branch solution.

### Is there a free trial?

The platform can automatically grant a one-month free trial to a newly registered business. Trial availability is controlled by the PwarMyar service configuration.

---

## 16. Sales Qualification Questions

Use these questions before proposing PwarMyar:

1. What kind of products do you sell?
2. How many products and daily transactions do you have?
3. Do products have barcodes or SKUs?
4. Do you buy and sell in different units?
5. Do you use retail, wholesale, or customer-specific price levels?
6. Do you give or receive FOC quantities?
7. Do customers buy on credit?
8. Do you purchase on supplier credit?
9. Which payment methods do you accept?
10. How do you record expenses today?
11. How many owners and staff need access?
12. Which information should cashiers not see?
13. Which printer and barcode scanner will be used?
14. How reliable is the shop's internet connection?
15. Is a single business inventory scope sufficient, or are true branches required?
16. Do you need operational reports or full statutory accounting?
17. Who will maintain products, stock, prices, and backups?

These questions identify product fit, required training, hardware testing, data migration effort, and any customization before a commitment is made.

---

## 17. Recommended Marketing Claims and Claims to Avoid

### Recommended accurate claims

- “Built for practical Myanmar retail and wholesale workflows.”
- “Connect sales, stock, purchases, customer credit, supplier balances, expenses, and reports.”
- “Use English or Myanmar language.”
- “Access PwarMyar from supported desktop, web, and mobile clients.”
- “Continue eligible fully paid sales during temporary connection interruptions.”
- “Control staff access by business module.”
- “Buy by carton and sell by piece with automatic conversion.”
- “Use retail, wholesale, or custom prices.”
- “Track FOC quantities in sales and purchases.”
- “Export operational reports and eligible paid-plan backups.”

### Claims to avoid without additional implementation or verification

- “Works completely offline forever.”
- “Guaranteed to work with every printer or scanner.”
- “Full accounting, tax, or audit system.”
- “Automatic KPay/Wave Pay/bank integration.”
- “Real-time bank verification.”
- “Multi-branch inventory and transfers.”
- “Unlimited users, products, or transactions.”
- “Prevents every possible data loss.”
- “Automatically calculates legally compliant tax.”
- “Guaranteed profit figure.”
- “Military-grade” or other undefined security superlatives.

---

## 18. Glossary

| Term | Meaning in PwarMyar |
| --- | --- |
| POS | Point of sale: the checkout and sale-recording workflow. |
| SKU | A business-defined stock-keeping code used to identify a product. |
| Barcode | A unique active product code that can be scanned or entered. |
| Base unit | The unit used for stock and normal selling, such as Piece. |
| Purchase unit | An optional larger receiving unit, such as Carton. |
| Conversion factor | Number of base units contained in one purchase unit. |
| FOC | Free of charge quantity received or issued without adding to the paid line value. |
| Price type | A named selling-price level, such as Retail or Wholesale. |
| Receivable | Money a customer owes the business. |
| Payable | Money the business owes a supplier or other account party. |
| Stock movement | A recorded increase or decrease connected to a sale, purchase, reversal, opening stock, or adjustment. |
| Tenant | One business's isolated data scope within the PwarMyar platform. |
| PWA | An installable web application with locally cached application assets and supported offline behavior. |
| Offline invoice | A fully paid walk-in sale saved locally for later server synchronization. |
| Estimated profit | Sales minus recorded product cost for paid sale quantities and expenses for the selected period. |
| Expected cash movement | Recorded cash-like inflows minus recorded outflows for the selected period. |

---

## 19. Final Marketing Summary

PwarMyar helps a shop move from scattered records and guesswork to a connected daily operating system. The cashier can sell quickly, the storekeeper can understand stock, the purchasing team can record deliveries and supplier credit, and the owner can see sales, expenses, estimated profit, cash movement, customer debt, supplier payables, and inventory value.

Its strongest marketing story is not a long list of screens. It is the connection between them:

```text
Purchase received
      ↓
Stock and cost updated
      ↓
Automatic selling price can be refreshed
      ↓
Product sold and receipt printed
      ↓
Stock reduced and customer credit recorded
      ↓
Payment, expense, profit, cash, debt, and inventory reports updated
```

That connected workflow gives small and medium businesses a clearer way to operate, train staff, serve customers, and make everyday decisions.

**PwarMyar — Sell faster. Know your stock. Control your business.**
