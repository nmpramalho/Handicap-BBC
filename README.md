# Handicap BBC

React + Vite + Supabase.

## Local
1. `copy .env.example .env`
2. Preencher URL e publishable key.
3. `npm install`
4. `npm run dev`

## Segurança
Executar `supabase/rls.sql` apenas depois de confirmar um perfil `admin` ativo.

## Vercel
Importar o repositório, definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, e fazer deploy.
