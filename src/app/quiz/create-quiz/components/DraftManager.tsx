'use client';

import { FC, useState, useEffect } from 'react';
import { FaCheckCircle, FaSave, FaSpinner, FaTrash } from 'react-icons/fa';
import { Quiz } from '@/types/quiz';

// IndexedDB用の定数
const DB_NAME = 'quiz-units-db';
const STORE_NAME = 'quiz-units';
const DB_VERSION = 1;

interface DraftUnit {
  draftId: string;
  title: string;
  description: string;
  genre: string;
  quizzes: Quiz[];
  isPublic: boolean;
  createdBy: string;
  updatedAt: Date;
}

interface DraftManagerProps {
  currentUserId: string;
  title: string;
  description: string;
  genre: string;
  quizzes: Quiz[];
  isPublic: boolean;
  draftId: string | null;
  onSaveDraft: () => void;
  onLoadDraft: (draft: DraftUnit) => void;
  onSetDraftId: (id: string) => void;
}

const DraftManager: FC<DraftManagerProps> = ({
  currentUserId,
  title,
  description,
  genre,
  quizzes,
  isPublic,
  draftId,
  onSaveDraft,
  onLoadDraft,
  onSetDraftId
}) => {
  const [drafts, setDrafts] = useState<DraftUnit[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // IndexedDBの初期化と下書き読み込み
  useEffect(() => {
    initIndexedDB();
    loadDrafts();
  }, [currentUserId]);

  // IndexedDBの初期化関数
  const initIndexedDB = () => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'draftId' });
        store.createIndex('userId', 'createdBy', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      setErrorMessage('下書きの保存に問題が発生しました。');
    };
  };

  // 下書き一覧を読み込む
  const loadDrafts = () => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const userIndex = store.index('userId');
      
      const query = userIndex.getAll(currentUserId);
      
      query.onsuccess = () => {
        const userDrafts = query.result as DraftUnit[];
        // 更新日時で降順にソート
        userDrafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setDrafts(userDrafts);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    };
  };

  // 下書きを保存
  const saveDraft = (showMessage = true) => {
    if (!currentUserId) return;
    
    setSaving(true);
    
    const now = new Date();
    const draftUnit: DraftUnit = {
      draftId: draftId || `draft_unit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      genre,
      quizzes,
      isPublic,
      createdBy: currentUserId,
      updatedAt: now
    };
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const saveRequest = store.put(draftUnit);
      
      saveRequest.onsuccess = () => {
        onSetDraftId(draftUnit.draftId);
        if (showMessage) {
          setSuccessMessage('下書きを保存しました');
          setTimeout(() => setSuccessMessage(''), 3000);
        }
        loadDrafts(); // 下書き一覧を更新
      };
      
      saveRequest.onerror = () => {
        setErrorMessage('下書きの保存に失敗しました');
        setTimeout(() => setErrorMessage(''), 3000);
      };
      
      transaction.oncomplete = () => {
        db.close();
        setSaving(false);
      };
    };
    
    request.onerror = () => {
      setErrorMessage('データベースへの接続に失敗しました');
      setSaving(false);
    };
  };

  // 下書きを削除
  const deleteDraft = (draftToDeleteId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const deleteRequest = store.delete(draftToDeleteId);
      
      deleteRequest.onsuccess = () => {
        loadDrafts(); // 下書き一覧を更新
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    };
  };

  // フォーマットされた日時を返す
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div>
      <div className="flex items-center space-x-2 mb-6 justify-end">
        {saving && (
          <div className="flex items-center text-gray-500">
            <FaSpinner className="animate-spin mr-2" /> 保存中...
          </div>
        )}
        {successMessage && (
          <div className="flex items-center text-green-600">
            <FaCheckCircle className="mr-2" /> {successMessage}
          </div>
        )}
        <button
          onClick={() => {
            onSaveDraft();
            saveDraft();
          }}
          className="btn-outline flex items-center"
          disabled={saving}
        >
          <FaSave className="mr-2" /> 下書き保存
        </button>
        <button
          onClick={() => setShowDrafts(!showDrafts)}
          className="btn-outline flex items-center"
        >
          {showDrafts ? '下書きを閉じる' : '下書き一覧'}
        </button>
      </div>

      {/* エラーメッセージ表示 */}
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
          <div className="flex">
            <div className="ml-3">
              <p>{errorMessage}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* 下書き一覧 */}
      {showDrafts && (
        <div className="mb-8 border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4">下書き一覧</h2>
          
          {drafts.length === 0 ? (
            <p className="text-gray-500">保存された下書きはありません</p>
          ) : (
            <div className="space-y-3">
              {drafts.map(draft => (
                <div
                  key={draft.draftId}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                  onClick={() => onLoadDraft(draft)}
                >
                  <div>
                    <h3 className="font-medium">{draft.title || '無題のクイズ'}</h3>
                    <p className="text-sm text-gray-500">
                      {draft.genre} 
                      更新: {formatDate(new Date(draft.updatedAt))}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteDraft(draft.draftId, e)}
                    className="text-red-500 hover:text-red-700 p-2"
                    title="削除"
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DraftManager;
