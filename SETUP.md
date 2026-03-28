# SETUP.md — 構築手順

## 前提条件

- Node.js 20+
- AWS CLI（設定済み）
- Twilio アカウント（Verify サービス作成済み）
- AWS アカウント（Cognito, App Runner, Secrets Manager 利用可能）

---

## 1. ローカル環境セットアップ

```bash
# 依存パッケージのインストール
npm install

# 環境変数ファイルの作成
cp .env.local.example .env.local
```

`.env.local` を編集し、以下の値を設定してください：

| 変数名                      | 説明                                       |
| --------------------------- | ------------------------------------------ |
| `TWILIO_ACCOUNT_SID`        | Twilio のアカウント SID                    |
| `TWILIO_AUTH_TOKEN`         | Twilio の Auth Token                       |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify サービスの SID               |
| `COGNITO_USER_POOL_ID`      | Cognito ユーザープール ID                  |
| `COGNITO_CLIENT_ID`         | Cognito アプリクライアント ID              |
| `PASSKEY_PROOF_SECRET`      | HMAC 署名用シークレット（下記で生成）      |
| `AWS_REGION`                | AWS リージョン（例: `ap-northeast-1`）     |
| `NEXT_PUBLIC_RP_ID`         | WebAuthn の RP ID（ローカル: `localhost`） |

### PASSKEY_PROOF_SECRET の生成

自分で生成するランダムな文字列です。以下のコマンドで生成できます：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**重要**: この値は Lambda の環境変数にも**同じもの**を設定する必要があります（後述のステップ 3-3）。

---

## 2. AWS Cognito ユーザープールの作成

### 2-1. ユーザープール作成

```bash
aws cognito-idp create-user-pool \
  --pool-name passkey-auth-pool \
  --schema '[{"Name":"email","Required":true,"Mutable":true}]' \
  --auto-verified-attributes email \
  --username-attributes email \
  --region ap-northeast-1
```

返却される `UserPool.Id` を控えてください。

**注意**: `username-attributes email` を指定すると、Cognito の内部 `userName` は UUID になります（メールではない）。HMAC 証明トークンにはこの UUID を使用します。

### 2-2. アプリクライアント作成

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id <USER_POOL_ID> \
  --client-name passkey-auth-client \
  --explicit-auth-flows ALLOW_CUSTOM_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --no-generate-secret \
  --region ap-northeast-1
```

返却される `UserPoolClient.ClientId` を控えてください。

**重要**: `ALLOW_CUSTOM_AUTH` と `ALLOW_REFRESH_TOKEN_AUTH` のみを許可してください。SRP やパスワード認証フローは追加しないでください。

---

## 3. Lambda トリガーのデプロイ

### 3-1. Lambda 用ビルド

```bash
cd lambda
npm init -y
npm install @types/aws-lambda typescript
npx tsc
```

### 3-2. Lambda 関数の作成

3つの Lambda 関数を作成してください：

| 関数名                  | ファイル                               | トリガータイプ                 |
| ----------------------- | -------------------------------------- | ------------------------------ |
| `define-auth-challenge` | `lambda/dist/define-auth-challenge.js` | Define Auth Challenge          |
| `create-auth-challenge` | `lambda/dist/create-auth-challenge.js` | Create Auth Challenge          |
| `verify-auth-challenge` | `lambda/dist/verify-auth-challenge.js` | Verify Auth Challenge Response |

```bash
# ZIP パッケージの作成
cd lambda/dist
zip define-auth-challenge.zip define-auth-challenge.js
zip create-auth-challenge.zip create-auth-challenge.js
zip verify-auth-challenge.zip verify-auth-challenge.js
```

```bash
# Lambda 関数の作成（各関数ごとに実行）
aws lambda create-function \
  --function-name define-auth-challenge \
  --runtime nodejs20.x \
  --handler define-auth-challenge.handler \
  --zip-file fileb://define-auth-challenge.zip \
  --role <LAMBDA_EXECUTION_ROLE_ARN> \
  --region ap-northeast-1
```

（`create-auth-challenge`, `verify-auth-challenge` も同様に作成）

### 3-3. verify-auth-challenge の環境変数

ステップ 1 で生成した `PASSKEY_PROOF_SECRET` と**同じ値**を設定してください：

```bash
aws lambda update-function-configuration \
  --function-name verify-auth-challenge \
  --environment "Variables={PASSKEY_PROOF_SECRET=<YOUR_SECRET>}" \
  --region ap-northeast-1
```

### 3-4. Cognito トリガーの設定

Lambda の ARN を確認：

```bash
aws lambda get-function --function-name define-auth-challenge --query 'Configuration.FunctionArn' --output text
aws lambda get-function --function-name create-auth-challenge --query 'Configuration.FunctionArn' --output text
aws lambda get-function --function-name verify-auth-challenge --query 'Configuration.FunctionArn' --output text
```

Cognito にトリガーを設定（`--lambda-config` は JSON 形式）：

```bash
aws cognito-idp update-user-pool \
  --user-pool-id <USER_POOL_ID> \
  --lambda-config '{
    "DefineAuthChallenge": "<DEFINE_LAMBDA_ARN>",
    "CreateAuthChallenge": "<CREATE_LAMBDA_ARN>",
    "VerifyAuthChallengeResponse": "<VERIFY_LAMBDA_ARN>"
  }' \
  --region ap-northeast-1
```

### 3-5. Lambda に Cognito からの呼び出し権限を付与

3つの関数すべてに実行してください：

```bash
aws lambda add-permission \
  --function-name define-auth-challenge \
  --statement-id cognito-trigger \
  --action lambda:InvokeFunction \
  --principal cognito-idp.amazonaws.com \
  --source-arn arn:aws:cognito-idp:ap-northeast-1:<ACCOUNT_ID>:userpool/<USER_POOL_ID>

aws lambda add-permission \
  --function-name create-auth-challenge \
  --statement-id cognito-trigger \
  --action lambda:InvokeFunction \
  --principal cognito-idp.amazonaws.com \
  --source-arn arn:aws:cognito-idp:ap-northeast-1:<ACCOUNT_ID>:userpool/<USER_POOL_ID>

aws lambda add-permission \
  --function-name verify-auth-challenge \
  --statement-id cognito-trigger \
  --action lambda:InvokeFunction \
  --principal cognito-idp.amazonaws.com \
  --source-arn arn:aws:cognito-idp:ap-northeast-1:<ACCOUNT_ID>:userpool/<USER_POOL_ID>
```

`<ACCOUNT_ID>` は AWS アカウント ID（12桁の数字）です。以下で確認できます：

```bash
aws sts get-caller-identity --query 'Account' --output text
```

---

## 4. Twilio Verify サービスの設定

### 4-1. サービスの作成（Passkeys 設定付き）

Passkeys を使うには、サービス作成時または更新時に **Relying Party 設定が必須**です。
この設定がないと Twilio API が 500 エラーを返します。

**新規作成の場合：**

```bash
curl -X POST 'https://verify.twilio.com/v2/Services' \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'FriendlyName=Passkey Auth' \
  --data-urlencode 'Passkeys.RelyingParty.Id=localhost' \
  --data-urlencode 'Passkeys.RelyingParty.Name=Passkey Auth' \
  --data-urlencode 'Passkeys.RelyingParty.Origins=http://localhost:3000' \
  --data-urlencode 'Passkeys.AuthenticatorAttachment=platform' \
  --data-urlencode 'Passkeys.DiscoverableCredentials=preferred' \
  --data-urlencode 'Passkeys.UserVerification=preferred'
```

**既存サービスを更新する場合：**

```bash
curl -X POST "https://verify.twilio.com/v2/Services/<SERVICE_SID>" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'Passkeys.RelyingParty.Id=localhost' \
  --data-urlencode 'Passkeys.RelyingParty.Name=Passkey Auth' \
  --data-urlencode 'Passkeys.RelyingParty.Origins=http://localhost:3000' \
  --data-urlencode 'Passkeys.AuthenticatorAttachment=platform' \
  --data-urlencode 'Passkeys.DiscoverableCredentials=preferred' \
  --data-urlencode 'Passkeys.UserVerification=preferred'
```

返却される SID（`VA...`）を `.env.local` の `TWILIO_VERIFY_SERVICE_SID` に設定してください。

**本番デプロイ時**は以下を変更：

- `Passkeys.RelyingParty.Id` → 本番ドメイン（例: `example.com`）
- `Passkeys.RelyingParty.Origins` → 本番 URL（例: `https://example.com`）

### 4-2. 認証情報の確認

1. [Twilio Console](https://console.twilio.com/) にログイン
2. **Account SID** と **Auth Token** を確認

### 4-3. Passkeys API について

本アプリは Twilio Node.js SDK ではなく、REST API を直接呼び出しています。
Passkeys API のエンドポイント：

| 用途           | エンドポイント                                      | Content-Type     |
| -------------- | --------------------------------------------------- | ---------------- |
| Factor 作成    | `POST /v2/Services/{SID}/Passkeys/Factors`          | application/json |
| Factor 検証    | `POST /v2/Services/{SID}/Passkeys/VerifyFactor`     | application/json |
| Challenge 作成 | `POST /v2/Services/{SID}/Passkeys/Challenges`       | application/json |
| Challenge 検証 | `POST /v2/Services/{SID}/Passkeys/ApproveChallenge` | application/json |

**注意**: identity は英数字とハイフンのみ許可。メールアドレスは SHA256 ハッシュに変換して使用します。

---

## 5. Secrets Manager の設定（本番用）

```bash
# Twilio Auth Token
aws secretsmanager create-secret \
  --name myapp/twilio \
  --secret-string '{"TWILIO_AUTH_TOKEN":"<YOUR_TOKEN>"}' \
  --region ap-northeast-1

# Passkey Proof Secret
aws secretsmanager create-secret \
  --name myapp/passkey \
  --secret-string '{"PASSKEY_PROOF_SECRET":"<YOUR_SECRET>"}' \
  --region ap-northeast-1
```

---

## 6. ローカル開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

- `NEXT_PUBLIC_RP_ID=localhost` であることを確認
- ローカルでは Cookie の `Secure` フラグが自動的に外れます
- Twilio Verify サービスの RP 設定が `localhost` / `http://localhost:3000` であることを確認

---

## 7. 本番デプロイ（App Runner）

### 7-1. Docker イメージのビルド

```bash
docker build -t passkey-cognito .
```

### 7-2. ECR にプッシュ

```bash
# ECR リポジトリ作成
aws ecr create-repository --repository-name passkey-cognito --region ap-northeast-1

# ログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com

# タグ付け & プッシュ
docker tag passkey-cognito:latest <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/passkey-cognito:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/passkey-cognito:latest
```

### 7-3. App Runner サービス作成

AWS コンソールまたは CLI で App Runner サービスを作成してください。

環境変数として以下を設定：

| 変数名                      | 値                        |
| --------------------------- | ------------------------- |
| `AWS_REGION`                | `ap-northeast-1`          |
| `TWILIO_ACCOUNT_SID`        | Twilio Account SID        |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify Service SID |
| `COGNITO_USER_POOL_ID`      | Cognito User Pool ID      |
| `COGNITO_CLIENT_ID`         | Cognito Client ID         |
| `NEXT_PUBLIC_RP_ID`         | 本番ドメイン名            |
| `USE_SECRETS_MANAGER`       | `true`                    |

**注意**: `TWILIO_AUTH_TOKEN` と `PASSKEY_PROOF_SECRET` は Secrets Manager から取得されるため、環境変数には設定不要です。

### 7-4. App Runner の IAM ロール

App Runner のインスタンスロールに以下のポリシーを付与：

- `secretsmanager:GetSecretValue`（`myapp/twilio`, `myapp/passkey`）
- `cognito-idp:AdminCreateUser`
- `cognito-idp:AdminSetUserPassword`
- `cognito-idp:AdminInitiateAuth`
- `cognito-idp:AdminRespondToAuthChallenge`

---

## 8. トラブルシューティング

### Twilio API が 500 を返す

Verify サービスに Passkeys の Relying Party 設定がされていません。ステップ 4-1 を実行してください。

### Twilio identity エラー（英数字のみ）

メールアドレスをそのまま identity に渡しています。`toTwilioIdentity()` で SHA256 ハッシュに変換してください。

### Cognito `NotAuthorizedException: Incorrect username or password`

以下を確認：

1. `AdminRespondToAuthChallengeCommand`（Admin 版）を使っているか
2. proof token の userId が Cognito の内部 userName（UUID）と一致しているか
3. Lambda と `.env.local` の `PASSKEY_PROOF_SECRET` が同じ値か

Lambda の CloudWatch ログで確認：

```bash
aws logs tail /aws/lambda/verify-auth-challenge --since 5m --region ap-northeast-1
```

### Cognito `UsernameExistsException`

同じメールで再登録しようとしています。`createCognitoUser` で `UsernameExistsException` をキャッチしてスキップする処理が必要です。

---

## 9. セキュリティチェックリスト

デプロイ前に以下を確認してください：

- [ ] `PASSKEY_PROOF_SECRET` がコードにハードコードされていない
- [ ] `.env.local` と Lambda の `PASSKEY_PROOF_SECRET` が同じ値
- [ ] proofToken の有効期限が 30 秒以内
- [ ] proofToken の userId に Cognito の内部 userName（UUID）を使用
- [ ] Cognito アプリクライアントで `ALLOW_CUSTOM_AUTH` 以外のフローが無効
- [ ] すべての Cookie が `HttpOnly; Secure; SameSite=Lax` 付き
- [ ] `/dashboard` 以下に認証なしでアクセスできないことを確認
- [ ] Twilio 検証失敗時のレスポンスに詳細情報が含まれていないことを確認
- [ ] Lambda の `VerifyAuthChallengeResponse` が userId の一致チェックをしている
- [ ] Secrets Manager に `myapp/twilio`, `myapp/passkey` が格納されている
- [ ] App Runner インスタンスロールに必要な IAM 権限がある
- [ ] Twilio Verify サービスに Passkeys RP 設定がされている
