# TraceNote (iOS)

位置情報（Always）から「滞在点→行動推定→1日1回の日記生成」を行うローカル日記アプリ。
共有は画像カード、エクスポートはJSON/CSV。

## Monetization (MVP)
- Free: 広告あり
- Subscription: 広告オフ

※MVPでは「広告オフ」以外の差分は最小にし、後から拡張可能にする。

## Tech
- Expo SDK 54 (React Native 0.81) + TypeScript strict
- expo-router v6（file-based routing）
- expo-sqlite（ローカルDB）
- expo-location + expo-task-manager（背景位置）
- react-native-view-shot（共有画像生成）
- Places: Overpass API（OSM）をデフォ（キャッシュあり）

## Setup
```bash
npm install
npx expo prebuild --clean
npx expo run:ios
```

## Project Structure
```
app/                  # expo-router screens
  (tabs)/             # BottomTab: Home, Timeline, Settings
  diary.tsx           # Stack: 日記表示
  edit-stay.tsx       # Stack: 滞在編集
  share.tsx           # Stack: 共有
  export.tsx          # Stack: エクスポート
src/
  core/
    constants.ts      # magic numbers集約
    storage/
      schema.ts       # SQLite DDL
      db.ts           # DB初期化
      settingsRepo.ts # settings CRUD
docs/
  spec.md             # MVP仕様
decisions.md          # 技術・仕様決定ログ
milestones.md         # M0-M7 マイルストーン
qa-checklist.md       # QA項目
prompts/
  cursor-single-agent.md  # エージェントプロトコル
```
