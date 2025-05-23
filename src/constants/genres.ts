// ジャンルと単元の定義

export interface GenreInfo {
  name: string;
  units: {
    [key: string]: string[];
  };
}

export interface GenreClass {
  name: string;
  genres: GenreInfo[];
}

// ジャンルクラスの定義
export const genreClasses: GenreClass[] = [
  {
    name: 'すべて',
    genres: [
      {
        name: '日本史',
        units: {
          '古代': ['縄文時代', '弥生時代', '古墳時代', '飛鳥時代', '奈良時代', '平安時代'],
          '中世': ['鎌倉時代', '室町時代', '戦国時代'],
          '近世': ['安土桃山時代', '江戸時代'],
          '近代': ['明治時代', '大正時代', '昭和前期'],
          '現代': ['昭和後期', '平成', '令和']
        }
      },
      {
        name: '世界史',
        units: {
          '古代': ['エジプト文明', 'メソポタミア文明', 'ギリシャ', 'ローマ'],
          '中世': ['ビザンツ帝国', '十字軍', 'イスラーム世界'],
          '近世': ['ルネサンス', '大航海時代', '宗教改革'],
          '近代': ['市民革命', '産業革命', '帝国主義', '世界大戦'],
          '現代': ['冷戦', 'グローバル化']
        }
      },
      {
        name: '数学',
        units: {
          '代数': ['1次方程式', '2次方程式', '因数分解', '三角関数'],
          '幾何': ['平面図形', '空間図形', '座標幾何'],
          '解析': ['微分', '積分', '数列'],
          '統計': ['確率', 'データ分析']
        }
      }
    ]
  }
];

// ジャンルのアイコン定義（ジャンル名をキーとするマッピング）
export const genreIcons: { [key: string]: string } = {
  '日本史': 'FaBookOpen',
  '世界史': 'FaGlobe',
  '数学': 'FaCalculator'
};
