import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  text: string;
  inline?: boolean;
}

/**
 * LaTeX記法のテキストを解析し、LaTeX部分をレンダリングするコンポーネント
 * 
 * 対応記法:
 * - インライン: $数式$ または \(数式\)
 * - ブロック: $$数式$$ または \[数式\]
 */
export default function LatexRenderer({ text, inline = false }: LatexRendererProps) {
  if (!text) return null;

  // インライン表示の場合、単純にLaTeX数式として扱う
  if (inline) {
    try {
      return <InlineMath math={text} />;
    } catch (error) {
      console.warn('LaTeX parsing error (inline):', error);
      return <span>{text}</span>;
    }
  }

  // テキストをLaTeX部分とプレーンテキスト部分に分割
  const renderMixedContent = (content: string): React.ReactElement[] => {
    const parts: React.ReactElement[] = [];
    let currentIndex = 0;
    let partKey = 0;

    // ブロック数式の検出 ($$...$$)
    const blockRegex = /\$\$([\s\S]*?)\$\$/g;
    // インライン数式の検出 ($...$)
    const inlineRegex = /\$([^$\n]+?)\$/g;
    // LaTeX式の検出 (\[...\] と \(...\))
    const latexBlockRegex = /\\\[([\s\S]*?)\\\]/g;
    const latexInlineRegex = /\\\((.*?)\\\)/g;

    // すべてのマッチを取得してソート
    const allMatches: Array<{
      match: RegExpExecArray;
      type: 'block' | 'inline' | 'latexBlock' | 'latexInline';
    }> = [];

    let match;
    
    // ブロック数式のマッチ
    while ((match = blockRegex.exec(content)) !== null) {
      allMatches.push({ match, type: 'block' });
    }
    
    // インライン数式のマッチ
    while ((match = inlineRegex.exec(content)) !== null) {
      allMatches.push({ match, type: 'inline' });
    }
    
    // LaTeXブロック数式のマッチ
    while ((match = latexBlockRegex.exec(content)) !== null) {
      allMatches.push({ match, type: 'latexBlock' });
    }
    
    // LaTeXインライン数式のマッチ
    while ((match = latexInlineRegex.exec(content)) !== null) {
      allMatches.push({ match, type: 'latexInline' });
    }

    // インデックスでソート
    allMatches.sort((a, b) => a.match.index! - b.match.index!);

    // 重複を除去（長いマッチを優先）
    const filteredMatches: Array<{
      match: RegExpExecArray;
      type: 'block' | 'inline' | 'latexBlock' | 'latexInline';
    }> = [];
    for (const current of allMatches) {
      const overlaps = filteredMatches.some(existing => {
        const currentStart = current.match.index!;
        const currentEnd = currentStart + current.match[0].length;
        const existingStart = existing.match.index!;
        const existingEnd = existingStart + existing.match[0].length;
        
        return (currentStart < existingEnd && currentEnd > existingStart);
      });
      
      if (!overlaps) {
        filteredMatches.push(current);
      }
    }

    // テキストを構築
    for (const { match, type } of filteredMatches) {
      const matchStart = match.index!;
      const matchEnd = matchStart + match[0].length;

      // マッチ前のプレーンテキスト
      if (currentIndex < matchStart) {
        const plainText = content.slice(currentIndex, matchStart);
        if (plainText) {
          parts.push(<span key={partKey++}>{plainText}</span>);
        }
      }

      // LaTeX部分
      const mathContent = match[1];
      try {
        if (type === 'block' || type === 'latexBlock') {
          parts.push(
            <div key={partKey++} className="my-4 text-center">
              <BlockMath math={mathContent} />
            </div>
          );
        } else {
          parts.push(<InlineMath key={partKey++} math={mathContent} />);
        }
      } catch (error) {
        console.warn('LaTeX parsing error:', error, 'Content:', mathContent);
        parts.push(<span key={partKey++}>{match[0]}</span>);
      }

      currentIndex = matchEnd;
    }

    // 残りのプレーンテキスト
    if (currentIndex < content.length) {
      const plainText = content.slice(currentIndex);
      if (plainText) {
        parts.push(<span key={partKey++}>{plainText}</span>);
      }
    }

    return parts.length > 0 ? parts : [<span key={0}>{content}</span>];
  };

  const renderedContent = renderMixedContent(text);

  return <div className="latex-content">{renderedContent}</div>;
}
