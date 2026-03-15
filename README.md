# TraceNote (iOS)

位置情報（Always）から「滞在点→行動推定→1日1回の日記生成」を行うローカル日記アプリ。
共有は画像カード、エクスポートはJSON/CSV。

## Monetization (MVP)
- Free: 広告あり
- Subscription: 広告オフ

※MVPでは「広告オフ」以外の差分は最小にし、後から拡張可能にする。

## Tech
- Expo (React Native) + TypeScript
- expo-location + expo-task-manager（背景位置）
- expo-sqlite（ローカルDB）
- expo-file-system + expo-sharing（エクスポート/共有）
- react-native-view-shot（共有画像生成）
- Places: Overpass API（OSM）をデフォ（キャッシュあり）

## Setup
```bash
npm i
npx expo prebuild --clean
npx expo run:ios