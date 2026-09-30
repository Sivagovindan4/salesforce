# API overview

Admin endpoints require a signed, HTTP-only session cookie. JSON validation errors return 400, missing sessions return 401, and denied permissions return 403.

| Method | Path | Purpose |
|---|---|---|
| GET,POST | `/api/restaurants` | Search, paginate, create restaurants |
| GET,PATCH,DELETE | `/api/restaurants/:id` | Read, update, soft-delete |
| POST | `/api/restaurants/:id/suspend` or `/activate` | Change restaurant status |
| GET,POST | `/api/restaurants/:id/menu` | Search and create menu items |
| GET,PATCH,DELETE | `/api/menu/:id` | Read, update, soft-delete menu items |
| GET,POST | `/api/restaurants/:id/tables` | List/create tables and QR tokens |
| GET | `/api/public/menu/:token` | Public QR menu |
| POST | `/api/public/orders` | Create an order from a QR token |
| GET,PATCH | `/api/orders` | List orders / update status |
| GET,POST | `/api/reviews` | List admin reviews / accept customer review |
| POST | `/api/integrations/salesforce/restaurants` | Idempotent restaurant upsert |
| POST | `/api/integrations/salesforce/menu` | Idempotent menu item upsert |
| GET | `/api/health` | App and database readiness |
