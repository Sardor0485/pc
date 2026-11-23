# biznes_analitica

Sklad, zakaz, mijoz, nasiya, kassa va tahlil. Node.js (Express) + PostgreSQL.

## Lokal ishga tushirish
```bash
npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/biznes_analitica
npm start   # http://localhost:3000
```
Jadvallar `schema.sql` orqali birinchi ishga tushishda o‘zi yaratiladi.

## Render ga joylash
1. Papkani GitHub ga yuklang (repo nomi: `biznes_analitica`).
2. Render → **New → Blueprint** → shu repo. `render.yaml` baza va web servisni yaratadi.
3. Deploy tugagach havolani darhol oching: birinchi kirishda parol o‘rnatiladi.
4. Admin (⚙) → Telegram bot tokeni va parolni shu yerdan o‘zgartirasiz.
