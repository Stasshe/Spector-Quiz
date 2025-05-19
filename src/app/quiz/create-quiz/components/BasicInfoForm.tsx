'use client';

import { FC } from 'react';
import { genreClasses } from '@/constants/genres';

interface BasicInfoFormProps {
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
  genre: string;
  setGenre: (genre: string) => void;
  isPublic: boolean;
  setIsPublic: (isPublic: boolean) => void;
}

const BasicInfoForm: FC<BasicInfoFormProps> = ({
  title,
  setTitle,
  description,
  setDescription,
  genre,
  setGenre,
  isPublic,
  setIsPublic
}) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">基本情報</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="genre" className="form-label">ジャンル</label>
          <select
            id="genre"
            className="form-select"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            required
          >
            <option value="">ジャンルを選択</option>
            {genreClasses
              .find(c => c.name === 'すべて')?.genres
              .map(g => (
                <option key={g.name} value={g.name}>{g.name}</option>
              ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="isPublic" className="form-label">公開設定</label>
          <div className="mt-2">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="form-checkbox"
              />
              <span className="ml-2">公開する</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="title" className="form-label">単元タイトル</label>
        <input
          type="text"
          id="title"
          className="form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="単元のタイトルを入力（例：定期テスト対策6月）"
          required
        />
      </div>
      
      <div className="mb-6">
        <label htmlFor="description" className="form-label">説明 (省略可)</label>
        <textarea
          id="description"
          className="form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="この単元についての説明"
          rows={3}
        ></textarea>
      </div>
    </div>
  );
};

export default BasicInfoForm;
