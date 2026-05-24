# TAVO 本番デプロイ手順（AWS）

このドキュメントは TAVO（Player Development System）を AWS 上で本番稼働させるための手順書です。

## 1. 構成図

```
            ┌──────────────┐
   Route53  │  ta-vo.jp    │
   (DNS)    │ app.ta-vo.jp │
            └──────┬───────┘
                   │ HTTPS
            ┌──────▼────────┐
            │ ALB / Nginx   │  TLS 終端（ACM または Let's Encrypt）
            └──────┬────────┘
                   │ HTTP (127.0.0.1:5000)
            ┌──────▼────────┐
            │ EC2 (t3.small)│  Node.js + PM2/systemd
            │  TAVO アプリ    │
            └──┬─────────┬──┘
               │         │
        ┌──────▼──┐   ┌──▼──────┐
        │ RDS     │   │ S3      │
        │ Postgres│   │ Bucket  │
        └─────────┘   └─────────┘
               │
        ┌──────▼──────┐
        │ CloudWatch  │
        │ Logs        │
        └─────────────┘
```

| レイヤ           | サービス                              |
|------------------|---------------------------------------|
| ドメイン         | Route53（`ta-vo.jp`, `app.ta-vo.jp`） |
| TLS 証明書       | ACM（ALB を使う場合）/ Let's Encrypt（nginx 直の場合） |
| アプリサーバー   | EC2（Amazon Linux 2023 or Ubuntu 22.04） |
| プロセス管理     | PM2（推奨）または systemd            |
| データベース     | RDS for PostgreSQL 16                |
| ファイル保存     | S3（バケット: `tavo-prod-uploads`）   |
| ログ収集         | CloudWatch Logs（`/tavo/app`）        |
| バックアップ     | RDS 自動バックアップ + S3 バージョニング |

---

## 2. AWS リソース作成

### 2.1 VPC / セキュリティグループ

- VPC: デフォルト VPC でも可。本番は専用 VPC を推奨。
- **SG-app**（EC2 用）
  - インバウンド: 22(SSH, 自分のIPのみ), 80, 443(0.0.0.0/0)
  - アウトバウンド: すべて許可
- **SG-db**（RDS 用）
  - インバウンド: 5432 を `SG-app` からのみ許可

### 2.2 RDS PostgreSQL

1. エンジン: PostgreSQL 16
2. インスタンス: `db.t4g.micro` から開始
3. ストレージ: gp3 20GB（オートスケール有効）
4. **自動バックアップ: 7 日以上、保持**
5. **Multi-AZ**: 本番は推奨
6. パブリックアクセス: なし、SG は `SG-db`
7. 作成後、エンドポイントをメモ → `DATABASE_URL` に設定

### 2.3 S3 バケット

```
バケット名: tavo-prod-uploads
リージョン: ap-northeast-1
パブリックアクセス: ブロック（推奨）
バージョニング: 有効（誤削除対策）
暗号化: SSE-S3 または SSE-KMS
ライフサイクル: 必要に応じて旧バージョン90日で削除
```

CORS（フロントから直アップロードする場合）:
```json
[
  {
    "AllowedOrigins": ["https://app.ta-vo.jp"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 2.4 IAM ロール（EC2 に付与）

EC2 用 IAM ロール `tavo-ec2-role` を作成し、以下のポリシーをアタッチ：

- `AmazonS3FullAccess`（または対象バケットに絞ったカスタムポリシー）
- `CloudWatchAgentServerPolicy`

これにより EC2 上では `AWS_ACCESS_KEY_ID` を環境変数で渡す必要がなくなります。

### 2.5 CloudWatch Logs

ロググループを事前に作成：
- `/tavo/app`
- `/tavo/nginx`

保持期間: 30 日（コスト次第で調整）

### 2.6 Route53

- ホストゾーン `ta-vo.jp` を作成（ネームサーバーをドメインレジストラに設定）
- A レコード（ALIAS）`app.ta-vo.jp` → EC2 の Elastic IP（または ALB）

---

## 3. EC2 セットアップ手順（Ubuntu 22.04 例）

```bash
# 1. 必要パッケージ
sudo apt update && sudo apt install -y curl git nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 2. アプリ配置
sudo mkdir -p /var/www/tavo /var/log/tavo
sudo chown -R ubuntu:ubuntu /var/www/tavo /var/log/tavo
cd /var/www/tavo
git clone <YOUR_REPO_URL> .
npm ci --omit=dev
npx prisma generate
npm run build

# 3. 環境変数
cp .env.example .env
nano .env   # DATABASE_URL, JWT_SECRET, S3_BUCKET 等を設定

# 4. DB マイグレーション
npx prisma db push

# 5. PM2 で起動
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd   # 表示されたコマンドを実行（自動起動設定）

# 6. nginx
sudo cp deploy/nginx/app.ta-vo.jp.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/app.ta-vo.jp.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 7. HTTPS（Let's Encrypt）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.ta-vo.jp -d ta-vo.jp
# 自動更新は systemd timer で有効化済み

# 8. CloudWatch Logs エージェント
sudo apt install -y amazon-cloudwatch-agent
sudo cp deploy/cloudwatch/awslogs.conf /opt/aws/amazon-cloudwatch-agent/etc/
sudo systemctl enable --now amazon-cloudwatch-agent
```

### systemd を使う場合（PM2 の代わり）

```bash
sudo cp deploy/systemd/tavo-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tavo-app
sudo systemctl status tavo-app
journalctl -u tavo-app -f   # ログ確認
```

---

## 4. 環境変数（必須）

`.env.example` を参照。最低限以下を設定：

| 変数                 | 説明 |
|----------------------|------|
| `NODE_ENV`           | `production` |
| `PORT`               | `5000` |
| `APP_URL`            | `https://app.ta-vo.jp` |
| `JWT_SECRET`         | ランダムな長い文字列 |
| `DATABASE_URL`       | RDS PostgreSQL の接続文字列（`sslmode=require` 推奨） |
| `AWS_REGION`         | `ap-northeast-1` |
| `S3_BUCKET`          | `tavo-prod-uploads` |
| `LOG_FORMAT`         | `json`（CloudWatch 用構造化ログ） |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push 通知用 |

EC2 に IAM ロールを付与していれば `AWS_ACCESS_KEY_ID/SECRET` は不要です。

---

## 5. ファイル保存の動作

- `server/lib/storage.js` が S3 を抽象化しています。
- `S3_BUCKET` と `AWS_REGION` が設定されていれば AWS S3 を利用。
- DB には S3 の **key（パス）** のみを保存し、配信時はサーバー側で署名付きURL または公開URL を発行します。
- ローカルディスクには本番では書きません（`uploads/` は開発専用）。

> 既存の `uploads/` への書き込みコード（teams.js, players.js）は段階的に S3 へ移行予定です。現状でも S3 が設定されていれば videos モジュールは S3 を利用します。

---

## 6. ログ

- アプリログは `process.stdout` / `process.stderr` に **JSON 行** で出力されます。
- PM2 を使う場合: `/var/log/tavo/out.log`, `error.log` を CloudWatch Agent で `/tavo/app` に転送。
- systemd を使う場合: `journalctl` → CloudWatch Agent で転送。
- 構造化ログのキー: `ts, level, service, msg, ...meta`

CloudWatch Logs Insights クエリ例:
```
fields @timestamp, level, msg
| filter level = "error"
| sort @timestamp desc
| limit 100
```

---

## 7. バックアップと復元

### DB（RDS）

- 自動バックアップ（7日以上）+ 手動スナップショット
- 復元: AWS コンソールから「スナップショットから復元」→ 新しい RDS インスタンスが起動

### S3

- バージョニング有効 → 誤削除しても復元可能
- 別リージョンへのクロスリージョンレプリケーション設定を推奨

### アプリ

- ソースコードは Git で管理
- `.env` は AWS Secrets Manager または手動で別途バックアップ

---

## 8. デプロイ更新フロー

```bash
ssh ubuntu@app.ta-vo.jp
cd /var/www/tavo
git pull
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy   # マイグレーションがある場合
npm run build
pm2 reload tavo-app          # ゼロダウンタイム再起動
```

将来的には GitHub Actions による CI/CD（S3 へのアーティファクト配置 + CodeDeploy）を検討。

---

## 9. ヘルスチェック

- アプリ: `GET /healthz` → `{ ok: true, ts: ... }`
- nginx 経由: `https://app.ta-vo.jp/healthz`
- ALB を使う場合はターゲットグループのヘルスチェックパスに `/healthz` を設定。
