# TTM · פלטפורמת גיוס תרומות ומאצ'ינג
Node/Express + SQLite. `npm start`.
Env: `PORT`, `DATA_DIR` (persistent volume, e.g. /data), `BASE_URL`, `ADMIN_EMAIL` (becomes super-admin on signup; the first user is admin too), `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` (AI guide), `AMUTOT_RESOURCE` (data.gov.il resource id for רשם העמותות).
Payment callbacks: `/pay/nedarim/callback`, `/pay/meshulam/webhook`, `/pay/paypal/capture`.
