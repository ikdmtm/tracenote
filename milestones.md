# Milestones (Real-device gate)

## M0: Scaffold ✅
- Expo TS scaffold / navigation / SQLite接続
- Settings: 活動終了時刻(デフォ24:00), 日記生成時刻(デフォ07:00)
Done:
- iOS実機起動、画面遷移OK

## M1: Location capture (background)
- Always権限導線
- BG taskでRawEvent保存（低頻度）
- TimelineでRawEvent表示
Done:
- 実機で画面OFF/バックグラウンドでもイベントが入る（少なくてもOK）

## M2: Stay detection
- stays.ts（滞在推定）実装
- Stay一覧表示、20分滞在が取れる
Done:
- 半日使ってStayが数件できる

## M3: Places + activity inference + needs_review
- Overpassでカテゴリ推定（キャッシュ）
- 食事/トレの初期ルール
- 要確認チップ + 1タップ修正
Done:
- 飲食/ジムで概ね当たる、外れても修正が快適

## M4: Photo matching
- expo-media-library でカメラロールアクセス
- 写真アクセスパーミッション導線（位置情報の後に別途リクエスト）
- Stayの時間帯 ± 5分 + GPS 500m以内で自動マッチ
- Stayカードに写真サムネイル表示（最大3枚）
- EditStayで写真の追加/除外
- stay_photos テーブル追加
Done:
- 滞在中に撮った写真がStayカードに自動表示される
- 手動で写真を追加/除外できる
- 写真アクセス拒否でもクラッシュしない

## M5: Diary generation (LLM) + token safety
- 日ごとにまとめて入力を作る（Stay/Moveのみ、座標なし、写真枚数あり）
- サーバープロキシ経由でGPT-4o-mini呼び出し
- トークン見積もり（estimate）を実装
- safe threshold（80%）超なら自動分割（時間帯→チャンク要約→結合）
- max_output_tokensは「余裕確保のため」動的計算
- 自動生成（翌日07:00デフォ）+ 手動生成ボタン
- Diary画面に写真をStayごとに表示
Done:
- 普段は1発生成、忙しい日は自動分割しても破綻しない
- 上限ギリギリ運用にならない（reserve確保）
- 日記に写真が表示される

## M6: Share (image) + Home masking
- ShareCard画像化（9:16, 1080x1920）→共有
- 代表写真があればカード背景に使用
- Homeは必ずマスク（データ蓄積後に判定開始）
Done:
- SNS共有しても特定情報が出にくい
- 写真付きShareCardが映える

## M7: Export JSON/CSV
- 期間選択→JSON/CSV生成→ファイル共有
Done:
- PCに保存して開ける

## M8: Ads + Subscription (ad-off)
- react-native-google-mobile-ads (AdMob) 広告表示
- react-native-purchases (RevenueCat) サブスク
- サブスク状態で広告OFF
Done:
- 広告ON/OFFが安定して切り替わる（購入状態の復元含む）
