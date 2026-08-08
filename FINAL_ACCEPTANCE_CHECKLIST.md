# Labb v1.0 final acceptance checklist

## Auth / RLS
- Admin and Member sign in.
- Deactivated profile signs in to Auth but cannot read lab rows because `current_lab_id()` returns no active lab.
- Member cannot mutate Admin-only tables.
- Second lab cannot read/change first lab data or Storage.

## Inventory
- Add inventory, receive lots, consume FEFO, adjust stock, verify aggregate stock.
- Low stock and expiry notifications appear and acknowledgement persists per user.

## Procurement
- Member creates Requested request.
- Member cannot approve/order/receive.
- Admin approves → status Approved.
- Admin orders only after approval → Ordered.
- Partial/full receipt creates containers and updates stock.
- Invoice and Close work after delivery.

## Equipment
- Admin creates equipment.
- Member can book AVAILABLE equipment.
- Admin logs calibration/maintenance and next due date.
- Due equipment appears in notifications.

## Samples
- Admin creates freezer/rack/box locations.
- Member registers sample owned by self.
- Sample location/slot persists and expiry notification appears.

## Team
- Admin invites a user using Edge Function.
- Admin changes Member/Admin role.
- Admin deactivates/reactivates another user.

## Browser
- Camera scan works on a supporting HTTPS browser.
- Unsupported browser shows fallback and manual/USB scanner entry still works.
- No console errors, missing assets, or GitHub Pages path errors.
- Realtime updates another active session.
