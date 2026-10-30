# Jev の設定方法

X Post Filter PlusでJevのAI判定を使うには、TypeSafe AIのAPIキーを用意します。

## 1. TypeSafe AIにログインする

[TypeSafe AIのAPIキー画面](https://console.typesafe.ai/keys)を開き、Googleアカウントまたはメールアドレスでログインします。アカウントがなければ作成してください。

## 2. APIキーを取得する

APIキー画面でキーを作成し、表示されたキーをコピーします。既存の有効なAPIキーを保存している場合は、そのキーを使用できます。

APIの利用料金はTypeSafe AIとの契約に従います。コンソールで利用プランと請求設定を確認してください。

## 3. 拡張に入力する

1. X Post Filter Plusの設定を開き、「AIによる除外判定」の「AI判定を利用」をオンにします。
2. 「利用するAI」の接続先に **Jev** を選びます。
3. 「Jev APIキー」欄に取得したキーを入力します。
4. 「この接続先への通信を許可」を押し、Chromeの確認画面で許可します。
5. 「興味のないキーワード」を1行に1つずつ入力します。
6. Xを開きます。

設定は自動保存されます。Xのポスト本文を順次判定します。

## うまく動かない場合

- **未設定の注意が表示される**：Jev APIキー欄にキーを入力してください。
- **HTTP 401／403**：APIキーが有効か、TypeSafe AIのアカウントでAPIを利用できるか確認してください。
- **残高・請求に関するエラー**：TypeSafe AIのコンソールで請求設定と利用状況を確認してください。
- **通信待機中**：通信障害や利用制限で待機している場合は、時間を置いて自動再試行します。
- **原因を解消しても停止中**：「停止・待機を解除して再判定」を押してください。

## 送信内容と保存

ポスト本文と判定条件をTypeSafe AIへ送信します。APIキーは端末内に保存されます。

- [TypeSafe公式：Quick start](https://docs.typesafe.ai/introduction/quickstart)
- [TypeSafe公式：エラーと利用制限](https://docs.typesafe.ai/api/errors)
- [本拡張のプライバシーポリシー](PRIVACY_POLICY.ja.md)

Y!News Filter Plusの実機確認済み設定手順を、X Post Filter Plusの入力欄に合わせて記載しています。
