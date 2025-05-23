// グローバル変数の型定義拡張

interface Window {
  /**
   * クイズルームページにいるかどうかを示すフラグ
   * `/quiz/room` ページでtrueに設定され、離れるとfalseになる
   * QuizRoomRedirectManagerとActiveQuizAlertModalで使用される
   */
  inQuizRoomPage: boolean;
}
