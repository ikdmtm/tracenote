# 開発ガイド（WSL + iOS実機）

## 環境
- 開発: WSL2 (Ubuntu) — コード編集・git管理
- 実機確認: iPhone + Expo Go or EAS Dev Client

## 実機確認の方法

### 方法A: Expo Go（M0〜M3で使用可能）
expo-sqlite, expo-router, 基本UIはExpo Goで動作する。
背景位置情報もExpo Goで制限付きで試せる（フォアグラウンド中心）。

```bash
npx expo start
# → QRコードをiPhoneのカメラで読み取り → Expo Goで開く
# → 同じWi-Fiに接続していること
```

注意: WSLのネットワークがホストと異なる場合は `--tunnel` を使う:
```bash
npx expo start --tunnel
```

### 方法B: EAS Dev Client（M1以降で必要）
背景位置(Always)はExpo Goの制限で完全には動かないため、
Dev Clientビルドを作る。

```bash
npx eas-cli login
npx eas build --profile development --platform ios
# → ビルド完了後にiPhoneにインストール
npx expo start --dev-client
```

### 方法C: Mac + Xcode（最速のネイティブ確認）
Macがある場合:
```bash
npx expo prebuild --clean --platform ios
npx expo run:ios
```

## マイルストーンごとの確認手順

### M0: Scaffold
1. `npx expo start` (or `--tunnel`) → Expo Goで開く
2. 確認:
   - 3タブ（ホーム/タイムライン/設定）切り替え
   - 設定画面で時刻変更（活動終了時刻、日記生成時刻）
   - 各プレースホルダー画面が表示される

### M1: Location capture
1. EAS Dev Client or Mac + Xcodeでビルド
2. 確認:
   - Always権限リクエストが表示される
   - 許可後、バックグラウンドでRawEventが保存される
   - タイムラインにRawEventが表示される

### M2: Stay detection
1. Dev Client or Mac + Xcodeでビルド
2. 確認:
   - 半日使ってStayが数件表示される
   - 20分滞在がStayになる

### M3-M7
（実装時に追記）

## WSL固有の注意
- `npx expo run:ios` はWSLでは不可（Xcode必須）
- `npx expo prebuild --platform ios` だけならWSLでも実行可能（iOS dir生成）
- 実機テストは Expo Go / EAS Build / Mac経由 のいずれかで行う
