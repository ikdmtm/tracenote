# Decisions

- アプリ名：TraceNote（仮）
- iOS優先、Expo + EASで進める
- 位置情報はAlways（価値提示後に要求）
- “Visits相当”はExpo標準の背景位置 + 端末内滞在推定でMVP実装
- Home判定：0-6時の最頻出滞在クラスタ
- 共有は画像（座標/住所は表示しない、Homeは強制マスク）
- 日記生成は1日1回まとめてLLM解析
- 取れなかった日は記録なし（テンプレは出さない）
- 修正UIは「行動ラベル」「場所名」に限定
- PlacesはOverpass（OSM）をデフォ、キャッシュ必須

## Monetization (MVP)
- Free: 広告あり
- Subscription: 広告オフ
（MVPは広告ON/OFFの切替を中心に実装し、後で差分拡張できる形にする）

## Token / Context policy
- 入出力を短く縛らない
- ただしコンテキスト上限ギリギリは精度劣化・失敗が増えるため、
  送信前にトークン見積もりを行い、reserveを確保する
- 入力が safe threshold（80%）超なら自動分割（時間帯分割→チャンク要約→結合）