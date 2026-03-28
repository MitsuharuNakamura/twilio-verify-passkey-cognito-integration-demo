# Passkey Auth - Twilio Verify Passkey x AWS Cognito

パスキー（WebAuthn）のみでアカウント作成・ログインを行う Next.js アプリケーションです。
パスワード認証は一切使用しません。

## アーキテクチャ

- **Twilio Verify Passkeys API** がパスキーの登録・認証（WebAuthn サーバー側処理）を担当
- **AWS Cognito** がアカウント管理と JWT セッショントークンの発行を担当（Custom Auth Flow）
- **Next.js API Routes** が両者の橋渡しを行い、HMAC 証明トークンで「パスキー検証済み」を Cognito に伝達
- **middleware.ts** が Cognito の JWT を検証し、保護ページへのアクセスを制御

## 技術スタック

| 用途                         | 採用技術                                 |
| ---------------------------- | ---------------------------------------- |
| フロントエンド / API         | Next.js 14 (App Router)                  |
| ホスティング                 | AWS App Runner                           |
| パスキー認証                 | Twilio Verify Passkeys (REST API)        |
| アカウント管理・トークン発行 | AWS Cognito User Pool (Custom Auth Flow) |
| シークレット管理             | AWS Secrets Manager                      |
| WebAuthn クライアント        | @simplewebauthn/browser                  |
| JWT 検証                     | jose                                     |
| 言語                         | TypeScript                               |

## セットアップ

詳細な構築手順は [SETUP.md](./SETUP.md) を参照してください。

### クイックスタート

```bash
# 依存パッケージのインストール
npm install

# 環境変数ファイルの作成
cp .env.local.example .env.local
# .env.local を編集して各値を設定

# 開発サーバーの起動
npm run dev
```

### 前提条件

- Node.js 20+
- AWS CLI（設定済み）
- Twilio アカウント（Verify サービス + Passkeys RP 設定済み）
- AWS Cognito ユーザープール（Custom Auth + Lambda トリガー設定済み）

### 環境変数

| 変数名                      | 説明                                    |
| --------------------------- | --------------------------------------- |
| `TWILIO_ACCOUNT_SID`        | Twilio アカウント SID                   |
| `TWILIO_AUTH_TOKEN`         | Twilio Auth Token                       |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify サービス SID              |
| `COGNITO_USER_POOL_ID`      | Cognito ユーザープール ID               |
| `COGNITO_CLIENT_ID`         | Cognito アプリクライアント ID           |
| `PASSKEY_PROOF_SECRET`      | HMAC 証明トークン用シークレット         |
| `AWS_REGION`                | AWS リージョン                          |
| `NEXT_PUBLIC_RP_ID`         | WebAuthn RP ID（ローカル: `localhost`） |

## ディレクトリ構成

```
passkey-cognito/
├── app/
│   ├── (auth)/
│   │   ├── register/page.tsx          # パスキー登録画面
│   │   └── login/page.tsx             # パスキーログイン画面
│   ├── dashboard/page.tsx             # 認証後ダッシュボード
│   └── api/auth/
│       ├── register/start/route.ts    # 登録開始 API
│       ├── register/complete/route.ts # 登録完了 API
│       ├── login/start/route.ts       # ログイン開始 API
│       ├── login/complete/route.ts    # ログイン完了 API
│       └── logout/route.ts           # ログアウト API
├── lib/
│   ├── twilio.ts                      # Twilio Passkeys API クライアント
│   ├── cognito.ts                     # Cognito 操作
│   ├── passkey-proof.ts               # HMAC 証明トークン生成・検証
│   ├── secrets.ts                     # シークレット管理
│   └── cookies.ts                     # Cookie ヘルパー
├── lambda/
│   ├── define-auth-challenge.ts       # Cognito トリガー: フロー制御
│   ├── create-auth-challenge.ts       # Cognito トリガー: nonce 生成
│   └── verify-auth-challenge.ts       # Cognito トリガー: 証明トークン検証
├── middleware.ts                      # JWT 検証ミドルウェア
├── Dockerfile                         # マルチステージビルド
└── apprunner.yaml                     # App Runner デプロイ設定
```

## 認証フロー概要

### 登録（アカウント作成）

1. ユーザーがメールアドレスを入力
2. Twilio Passkeys API でパスキー登録オプションを取得
3. ブラウザの WebAuthn API でパスキーを作成（指紋/顔認証）
4. Twilio で attestation を検証
5. Cognito にユーザーを作成
6. HMAC 証明トークンを生成し、Cognito Custom Auth でセッショントークンを取得
7. Cookie にセッショントークンを保存 → ダッシュボードに遷移

### ログイン

1. ユーザーがメールアドレスを入力
2. Twilio Passkeys API で認証チャレンジを取得
3. ブラウザの WebAuthn API でパスキー認証（指紋/顔認証）
4. Twilio で assertion を検証
5. HMAC 証明トークンを生成し、Cognito Custom Auth でセッショントークンを取得
6. Cookie にセッショントークンを保存 → ダッシュボードに遷移

## デプロイ

### Docker ビルド

```bash
docker build -t passkey-cognito .
```

### App Runner

`apprunner.yaml` を使用してデプロイします。
本番環境では Secrets Manager から `TWILIO_AUTH_TOKEN` と `PASSKEY_PROOF_SECRET` を取得します。

詳細は [SETUP.md](./SETUP.md) のセクション 7 を参照してください。

## Lambda のビルドとデプロイ

```bash
cd lambda
npm init -y
npm install @types/aws-lambda typescript
npx tsc

cd dist
zip define-auth-challenge.zip define-auth-challenge.js
zip create-auth-challenge.zip create-auth-challenge.js
zip verify-auth-challenge.zip verify-auth-challenge.js
```

詳細は [SETUP.md](./SETUP.md) のセクション 3 を参照してください。

## ライセンス

ISC
