'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { FaTimes, FaExchangeAlt } from 'react-icons/fa';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { useQuiz } from '@/context/QuizContext';

export default function RoomSwitchConfirmModal() {
  const { 
    confirmRoomSwitch,
    roomToJoin,
    switchRoom,
    cancelRoomSwitch,
    setRoomToJoin,
    setConfirmRoomSwitch
  } = useQuizRoom();
  
  const { waitingRoom } = useQuiz();
  
  // documentから直接情報を取得する機能を追加
  const [forcedVisible, setForcedVisible] = React.useState(false);
  // 型定義を拡張して_requestDataプロパティを含める
  const [forcedRoomInfo, setForcedRoomInfo] = React.useState<{
    roomId: string; 
    roomName: string; 
    _requestData?: any;
  } | null>(null);
  
  // ドキュメント属性からモーダル表示状態を監視
  React.useEffect(() => {
    // 定期チェック開始
    const checkInterval = setInterval(() => {
      const isPending = document.documentElement.getAttribute('data-room-switch-pending') === 'true';
      if (isPending) {
        try {
          const roomInfoStr = document.documentElement.getAttribute('data-room-info');
          if (roomInfoStr) {
            const roomInfo = JSON.parse(roomInfoStr);
            setForcedRoomInfo(roomInfo);
            setForcedVisible(true);
            
            // React状態にも反映
            setRoomToJoin(roomInfo);
            setConfirmRoomSwitch(true);
            
            console.log('[RoomSwitchConfirmModal] ドキュメント属性から強制表示:', roomInfo);
            
            // 使用したフラグはクリア
            document.documentElement.removeAttribute('data-room-switch-pending');
          }
        } catch (e) {
          console.error('[RoomSwitchConfirmModal] ルーム情報の解析エラー:', e);
        }
      }
    }, 100);
    
    return () => clearInterval(checkInterval);
  }, [setRoomToJoin, setConfirmRoomSwitch]);
  
  // レンダリング頻度を減らすため、開発モードではコメントアウト
  // console.log('[RoomSwitchConfirmModal] レンダリング:', {
  //   confirmRoomSwitch,
  //   roomToJoin,
  //   waitingRoomName: waitingRoom?.name
  // });
  
  // 重要なイベントのみログ出力
  React.useEffect(() => {
    if (confirmRoomSwitch && roomToJoin) {
      console.log('[RoomSwitchConfirmModal] モーダル表示条件が満たされました:', {
        roomToJoinId: roomToJoin.roomId,
        roomToJoinName: roomToJoin.roomName
      });
    }
  }, [confirmRoomSwitch, roomToJoin]);
  
  React.useEffect(() => {
    // モーダルの表示・非表示を強制的にチェックし、ログ出力
    console.log('[RoomSwitchConfirmModal] 状態確認:', {
      confirmRoomSwitch,
      roomToJoinExists: !!roomToJoin,
      forcedVisible,
      forcedRoomInfoExists: !!forcedRoomInfo,
      shouldShow: (confirmRoomSwitch && !!roomToJoin) || (forcedVisible && !!forcedRoomInfo)
    });
  }, [confirmRoomSwitch, roomToJoin, forcedVisible, forcedRoomInfo]);

  // 通常の条件かforcedVisibleのどちらかがtrueならモーダルを表示
  if ((!confirmRoomSwitch || !roomToJoin) && (!forcedVisible || !forcedRoomInfo)) {
    return null;
  }
  
  // 表示に使用するroomInfoを決定
  const displayRoomInfo = roomToJoin || forcedRoomInfo;
  
  console.log('[RoomSwitchConfirmModal] モーダルを表示します:', {
    roomToJoinId: displayRoomInfo?.roomId,
    roomToJoinName: displayRoomInfo?.roomName
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            別のルームに参加しますか？
          </h2>
          <button
            onClick={() => {
              // 強制表示フラグもクリア
              setForcedVisible(false);
              setForcedRoomInfo(null);
              // documentの属性もクリア
              document.documentElement.removeAttribute('data-room-switch-pending');
              document.documentElement.removeAttribute('data-room-info');
              // 通常のキャンセル処理も実行
              cancelRoomSwitch();
            }}
            className="text-gray-500 hover:text-gray-800"
          >
            <FaTimes size={20} />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            あなたは現在「{waitingRoom?.name || "待機中ルーム"}」に参加中です。
            {displayRoomInfo?.roomId === 'pending-creation' ? (
              <>新しいルームを作成するには、現在のルームから退出する必要があります。</>
            ) : (
              <>新しいルーム「{displayRoomInfo?.roomName || "別のルーム"}」に参加するには、
              現在のルームから退出する必要があります。</>
            )}
          </p>
          <p className="text-yellow-600 font-medium">
            注意: 現在のルームで得た情報やスコアは失われます。
          </p>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => {
              console.log('[RoomSwitchConfirmModal] キャンセルボタンがクリックされました');
              // 強制表示フラグもクリア
              setForcedVisible(false);
              setForcedRoomInfo(null);
              // documentの属性もクリア
              document.documentElement.removeAttribute('data-room-switch-pending');
              document.documentElement.removeAttribute('data-room-info');
              // 通常のキャンセル処理も実行
              cancelRoomSwitch();
            }}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => {
              const roomInfoToUse = roomToJoin || forcedRoomInfo;
              console.log('[RoomSwitchConfirmModal] ルーム切り替えボタンがクリックされました', roomInfoToUse);
              
              if (!roomInfoToUse) {
                console.error('[RoomSwitchConfirmModal] 切り替え先ルーム情報が存在しません');
                alert('ルームの切り替え処理に必要な情報がありません。ページを再読み込みして再試行してください。');
                return;
              }
              
              // ボタン連打防止のため無効化（スタイルは変更なし）
              const button = document.activeElement as HTMLButtonElement;
              if (button) {
                button.disabled = true;
              }
              
              // UI状態をクリアして、二重クリックを防止
              setForcedVisible(false);
              setForcedRoomInfo(null);
              document.documentElement.removeAttribute('data-room-switch-pending');
              document.documentElement.removeAttribute('data-room-info');
              
              // 必ず使用するルーム情報をローカル変数に保存して処理の一貫性を保つ
              const targetRoomInfo: {
                roomId: string;
                roomName: string;
                _requestData?: any;
              } = { ...roomInfoToUse };
              console.log('[RoomSwitchConfirmModal] 処理するルーム情報:', targetRoomInfo);
              
              // 状態を早めにクリアして、ユーザーの操作性向上
              setConfirmRoomSwitch(false);
              
              // 状態を先にクリアして確実にモーダルを閉じる
              setConfirmRoomSwitch(false);
              
              // エラーハンドリング用にtry-catchで囲む
              try {
                // 強制モードの場合は、まずReact状態にセット（ただし非表示にはしない）
                if (!roomToJoin && forcedRoomInfo) {
                  console.log('[RoomSwitchConfirmModal] 強制モードでルーム情報をセットします');
                  setRoomToJoin(targetRoomInfo);
                }
                
                // 作成オペレーション情報を保持して確認
                const isPendingCreation = targetRoomInfo.roomId === 'pending-creation';
                console.log(`[RoomSwitchConfirmModal] 処理タイプ: ${isPendingCreation ? '新規ルーム作成' : '既存ルーム参加'}`);
                
                // 新規作成モードなら、クイズ選択画面に戻った時のために情報を保存
                if (isPendingCreation) {
                  console.log('[RoomSwitchConfirmModal] 新規ルーム作成モードのルーム切り替え処理を開始');
                  // セッションストレージに情報を保存（ページ遷移後にも利用可能）
                  try {
                    sessionStorage.setItem('pendingRoomCreation', 'true');
                    // _requestDataプロパティがあれば保存する（型チェック付き）
                    const requestData = targetRoomInfo._requestData;
                    if (requestData && typeof requestData === 'object') {
                      sessionStorage.setItem('pendingRoomData', JSON.stringify(requestData));
                      console.log('[RoomSwitchConfirmModal] 新規作成情報を保存しました:', requestData);
                    } else {
                      console.log('[RoomSwitchConfirmModal] リクエストデータがないため、基本情報のみ保存します');
                    }
                  } catch (storageErr) {
                    console.error('[RoomSwitchConfirmModal] セッションストレージへの保存エラー:', storageErr);
                  }
                }
                
                // 安全のため遅延処理
                setTimeout(() => {
                  console.log('[RoomSwitchConfirmModal] switchRoom()を呼び出します');
                  
                  // 非同期処理を開始
                  switchRoom()
                    .then(() => {
                      console.log('[RoomSwitchConfirmModal] ルーム切り替え成功!');
                      // 成功時の処理はswitchRoom内で自動的にページ遷移
                    })
                    .catch(switchErr => {
                      console.error('[RoomSwitchConfirmModal] ルーム切り替え中にエラー:', switchErr);
                      alert('ルームの切り替え中にエラーが発生しました。もう一度お試しください。');
                      
                      // エラー時はボタンを再度有効化
                      if (button) {
                        button.disabled = false;
                      }
                    })
                    .finally(() => {
                      // 処理完了後に状態を確実にクリア
                      setRoomToJoin(null);
                      console.log('[RoomSwitchConfirmModal] 状態をクリアしました');
                    });
                }, 200);
              } catch (err) {
                console.error('[RoomSwitchConfirmModal] ルーム切り替え処理でエラー:', err);
                alert('ルームの切り替え処理中にエラーが発生しました。もう一度お試しください。');
                
                // エラー時はボタンを再度有効化
                if (button) {
                  button.disabled = false;
                }
              }
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors flex items-center"
          >
            <FaExchangeAlt className="mr-2" />
            ルームを切り替え
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
