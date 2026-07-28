**Coffix App Manager Log List:**

Admin triggered actions:

| Action | Email | Action | Category | Severity | Page | Notes | Implemeted in Logs? |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Product \> \+New Product | Admin email | Product | Admin? | 5 | Products | Admin added Burger product | Yes |
| Products \> Edit Product | Admin email | Product | Admin | 5 | Products | Admin edited Burger details (price, cost, order) | Yes |
| Products \> Delete Product | Admin email | Product | Admin | 5 | Products | Admin deleted a product Burger | Yes |
| Products \> Toggle Availability | Admin email | Product | Admin | 5 | Products | Admin enabled/disabled Burger (overall or per store) | Yes |
| Products \> Modifier Groups | Admin email | Product | Admin | 5 | Products | Admin added/removed a modifier group Size on Burger | Yes |
| Products \> Bulk Actions | Admin email | Product | Admin | 5 | Products | Admin bulk enabled/disabled or updated stores for selected products | Yes |
| Categories \> \+New Category | Admin email | Categories | Admin | 5 | Categories | Admin added new category Frozen Food | Yes |
| Stores \> \+New Store | Admin email | Stores | Admin | 5 | Stores | Admin added new store Test Marikina | Yes |
| Categories \> Edit | Admin email | Categories | Admin? | 5 | Categories | Admin edited category Coffee | Yes |
| Categories \> Delete | Admin email | Categories | Admin? | 5 | Categories | Admin deleted Coffee category | Yes |
| Stores \> Edit Store | Admin email | Stores | Admin | 5 | Stores | Admin edited store Test Marikina contact/address/GST info | Yes |
| Stores \> Delete Store | Admin email | Stores | Admin | 5 | Stores | Admin deleted a store Test Marikina | Yes |
| Stores \> Disable Store | Admin email | Stores | Admin | 5 | Stores | Admin disabled a store Test Marikina | Yes |
| Stores \> Holiday Hours | Admin email | Stores | Admin | 5 | Stores | Admin added/deleted special operating hours for Test Marikina | Yes |
| Modifier Groups \> Create/Edit/Delete Group | Admin email | Modifier Groups | Admin | 5 | Modifier Groups | Admin created, edited, or deleted a modifier group Size | Yes |
| Modifier Groups \> Add/Delete Modifier | Admin email | Modifier Groups | Admin | 5 | Modifier Groups | Admin added or deleted a modifier within group Size | Yes |
| Customers \> Edit Customer | Admin email | Customers | Admin | 5 | Customers | Admin edited customer customer\_email info, credit, or preferences | Yes |
| Customers \> Disable Customer | Admin email | Customers | Admin | 5 | Customers | Admin disabled a customer account customer\_email | Yes |
| Transactions \> Add Transaction (Order/Gift/Topup) | Admin email | Manual transaction created | transaction | 5 | Transactions | Admin manually created an order/gift/topup transaction | Yes |
| Transactions \> Add Transaction (Refund) | Admin email | Refund processed | refund | 3 | Transactions | Admin processed a refund | Yes |
| Users \> Create/Edit/Delete User | Admin email | Users | Admin | 5 | Users | Admin created, edited, or deleted a staff user\_email (role/store assignment) | Yes |
| Global Settings \> Save | Admin email | Global Settings | Admin | 5 | Global Settings | Admin changed app-wide settings (fees, discounts, top-up tiers, etc.) | Yes |
| Email Templates \> Create/Edit/Delete Template | Admin email | Email Templates | Admin | 5 | Email Templates | Admin created, edited, or deleted an email template | Yes |
| Coupons \> New Coupon | Admin email | coupon | API | 5 | Coupons | Admin issued a coupon to a customer | Yes |
| Coupons \> Bulk Actions | Admin email | Coupons | Admin | 5 | Coupons | Admin bulk deleted or updated expiry/amount for selected coupons | Yes |
| Logs \> Settings | Admin email | Logs | Admin | 5 | Logs | Admin changed log auto-deletion/retention settings | Yes |
| Import \> Bulk Import | Admin email | Import | Admin | 5 | Import | Admin bulk imported/updated records via CSV (all entities) | Yes |

**Store Manager triggered actions:**

| Action | Email | Action | Category | Severity | Page | Notes | Implemeted in Logs? |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Stores \> Edit Hours | Store manager email | Stores | Store Manager? | 5 | Stores | Store manager edited Opening hours | Yes |
| Stores \> Holiday Hours | Store manager email | Stores | Store Manager | 5 | Stores | Store manager added/deleted special operating hours for their store | Yes |
| Stores \> Disable Store | Store manager email | Stores | Store Manager | 5 | Stores | Store manager disabled their assigned store | No |
| Products \> Toggle Store Availability | Store manager email | Product | Store Manager | 5 | Products | Store manager enabled/disabled a product for their assigned store | Yes |

