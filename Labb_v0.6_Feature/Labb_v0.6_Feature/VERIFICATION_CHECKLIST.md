# Live Supabase verification checklist

Run these tests against your actual Supabase project before production use.

## Unauthenticated
- Opening the site shows Sign in.
- Direct REST queries with no user session cannot read Labb application tables.
- Private Storage objects cannot be downloaded anonymously.

## Member
- Can sign in and read lab inventory/containers/vendors/procurement.
- Can create a new procurement request for self.
- Cannot add an inventory item directly.
- Cannot create/edit a vendor.
- Cannot place an order or receive goods.
- Can record valid usage through `consume_inventory`.
- Cannot consume more stock than is available.
- Can upload a document under own lab path.
- Cannot access another lab's rows or Storage path.

## Admin
- Can add inventory/vendors.
- Can place a Requested order.
- Receive operation creates a new container and updates aggregate stock.
- Partial receipt sets `Partial`; complete receipt sets `Delivered`.
- Stock adjustment updates the container ledger and aggregate stock.
- Invoice fields update and request can be closed after delivery.
- Lab settings update.
- If `invite-user` is deployed, Admin can invite Member/Admin users.

## Realtime
- Open the app in two browsers with users from the same lab.
- Change inventory/procurement in browser A.
- Browser B refreshes the shared data without a manual reload.

## Audit
- Inventory/vendor/request/container changes appear in `audit_logs`.
- A Member cannot insert/update/delete audit rows through the client API.

## Cross-lab isolation
Create a second lab and user. Verify neither lab can read or change the other lab's rows/files.
