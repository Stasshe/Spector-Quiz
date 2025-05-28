import { useState } from 'react';
import { FaQuestionCircle, FaTimes, FaBook } from 'react-icons/fa';
import LatexRenderer from './LatexRenderer';

export default function LatexGuide() {
  const [isOpen, setIsOpen] = useState(false);

  const examples = [
    {
      category: '基本的な数式',
      items: [
        { latex: '$x^2$', description: '上付き文字（べき乗）' },
        { latex: '$x_1$', description: '下付き文字' },
        { latex: '$\\sqrt{x}$', description: '平方根' },
        { latex: '$\\sqrt[3]{x}$', description: '立方根' },
        { latex: '$\\frac{1}{2}$', description: '分数' },
      ]
    },
    {
      category: '数学記号',
      items: [
        { latex: '$\\alpha, \\beta, \\gamma$', description: 'ギリシャ文字' },
        { latex: '$\\pi, \\theta, \\phi$', description: 'よく使う記号' },
        { latex: '$\\sum_{i=1}^{n} x_i$', description: '総和記号' },
        { latex: '$\\int_0^1 f(x) dx$', description: '積分記号' },
        { latex: '$\\lim_{x \\to 0} f(x)$', description: '極限記号' },
      ]
    },
    {
      category: '複雑な式',
      items: [
        { latex: '$$E = mc^2$$', description: 'ブロック表示（独立した行）' },
        { latex: '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$', description: '二次方程式の解の公式' },
        { latex: '$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$', description: '行列' },
      ]
    },
    {
      category: '記法のルール',
      items: [
        { latex: '$...$', description: 'インライン数式（文中に埋め込み）' },
        { latex: '$$...$$', description: 'ブロック数式（独立した行に表示）' },
        { latex: '\\(...\\)', description: 'LaTeX標準のインライン記法' },
        { latex: '\\[...\\]', description: 'LaTeX標準のブロック記法' },
      ]
    }
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
        title="LaTeX記法ガイドを開く"
      >
        <FaQuestionCircle className="mr-1" />
        LaTeX記法ガイド
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <FaBook className="text-blue-600 mr-3 text-xl" />
            <h2 className="text-xl font-bold">LaTeX記法ガイド</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
              <p className="text-blue-800">
                <strong>LaTeX記法</strong>を使って数学的な表現を美しく表示できます。
                下記の例を参考に、問題文や解説に数式を含めてください。
              </p>
            </div>

            {examples.map((category, categoryIndex) => (
              <div key={categoryIndex} className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                  {category.category}
                </h3>
                
                <div className="grid gap-4">
                  {category.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="bg-gray-50 rounded-lg p-4">
                      <div className="grid md:grid-cols-3 gap-4 items-center">
                        <div className="font-mono text-sm bg-gray-200 p-2 rounded border">
                          {item.latex}
                        </div>
                        <div className="text-center bg-white p-2 rounded border min-h-[3rem] flex items-center justify-center">
                          <LatexRenderer text={item.latex} />
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-md">
              <h4 className="font-semibold text-yellow-800 mb-2">注意事項：</h4>
              <ul className="text-yellow-700 text-sm space-y-1">
                <li>• バックスラッシュ（\）は二重に書く必要があります（例：\\frac, \\sqrt）</li>
                <li>• 中括弧（{}）を使ってグループ化します</li>
                <li>• エラーが発生した場合は、元のテキストがそのまま表示されます</li>
                <li>• プレビュー機能を使って表示を確認してください</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
