# 依存関係をインストール
yarn install

# prisma/schema.prisma の内容をデータベースに反映
npx prisma db push

# Prisma クライアントを作成
npx prisma generate

# app/entry.js のビルド
npx webpack

# 環境変数 PORT を指定してアプリケーションを起動
PORT=$PORT yarn start
