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

## M5: 画面役割分離 + 移動推定 ✅
- Home = 整理済み滞在ビュー（日付ナビ + 統計 + 移動インジケータ + 写真 + シェア）
  - 日付ナビで過去日も閲覧可能
  - Stay間に移動手段推定（徒歩/自転車/電車・車、速度ベース）を表示
  - 統計ヘッダー（滞在数、合計時間、移動回数、写真枚数）
  - パーミッション導線は「常に許可」後に最小化
- Timeline = RawEvent生ログフィード
  - 3分ごとの位置記録を時系列表示（時刻 + 座標 + 場所推定 + 精度）
  - Stay内のイベントは場所名表示、Stay外は「移動中」表示
  - 1時間ごとのセクション区切り
  - 日付ナビで過去日も閲覧可能
- LLMコードは残置（将来のオプション機能として有効化可能）
Done:
- HomeとTimelineで明確に役割が分かれている
- 移動手段がアイコンで表示される
- 過去日も両画面から閲覧可能

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

---

## Future: LLM日記生成（オプション機能）
- サーバープロキシ経由でGPT-4o-mini呼び出し
- 日別サマリーをベースにLLMで文章化
- トークン見積もり + 自動分割
- コードは `src/core/diary/` に残置済み
