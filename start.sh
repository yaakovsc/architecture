#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 מפת מערכות ארגוניות - הפעלה"

# 1. Start PostgreSQL via Docker
echo "▶ מפעיל PostgreSQL..."
docker compose up -d
echo "  ממתין לבסיס הנתונים..."
sleep 4

# 2. Install server deps
if [ ! -d "$ROOT/server/node_modules" ]; then
  echo "▶ מתקין חבילות שרת..."
  cd "$ROOT/server" && npm install
fi

# 3. Seed DB
echo "▶ מאתחל בסיס נתונים..."
cd "$ROOT/server" && node src/seed.js

# 4. Install client deps
if [ ! -d "$ROOT/client/node_modules" ]; then
  echo "▶ מתקין חבילות לקוח..."
  cd "$ROOT/client" && npm install
fi

echo ""
echo "✅ מוכן! עכשיו הפעל בשני טרמינלים:"
echo "   טרמינל 1:  cd server && npm run dev"
echo "   טרמינל 2:  cd client && npm run dev"
echo ""
echo "   פתח: http://localhost:5173"
echo "   Admin: admin / Admin@1234"
echo "   User:  user  / User@1234"
