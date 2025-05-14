'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FaBolt, FaPlay, FaTrophy, FaUser } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { currentUser } = useAuth();

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* ヒーローセクション */}
      <section className="bg-indigo-700 text-white py-20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-10 md:mb-0">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              オンラインでリアルタイムにクイズ対戦！
            </h1>
            <p className="text-xl mb-8">
              友達と一緒に知識を競い合い、ランキングを上げよう。
              早押しクイズで反射神経も試せる！
            </p>
            {currentUser ? (
              <Link
                href="/quiz"
                className="bg-yellow-400 text-indigo-900 font-bold px-8 py-3 rounded-full text-lg inline-flex items-center"
              >
                <FaPlay className="mr-2" /> クイズを始める
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="bg-yellow-400 text-indigo-900 font-bold px-8 py-3 rounded-full text-lg inline-flex items-center"
              >
                <FaUser className="mr-2" /> ログインしてプレイ
              </Link>
            )}
          </div>
          <div className="md:w-1/2 flex justify-center">
            <div className="relative w-64 h-64 md:w-96 md:h-96">
              <div className="absolute inset-0 bg-yellow-300 rounded-full opacity-30 animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FaBolt className="text-yellow-400 w-32 h-32 md:w-48 md:h-48" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Zap!の特徴</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <FaBolt className="text-indigo-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-2">リアルタイム対戦</h3>
              <p className="text-gray-600 text-center">
                友達や他のプレイヤーとリアルタイムで対戦！
                誰が最も早く正確に答えられるかを競おう。
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <FaPlay className="text-indigo-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-2">多様なクイズ</h3>
              <p className="text-gray-600 text-center">
                様々なジャンルから出題されるクイズで
                幅広い知識を試そう！
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <FaTrophy className="text-indigo-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-2">ランキングシステム</h3>
              <p className="text-gray-600 text-center">
                経験値を貯めてランクを上げよう！
                トッププレイヤーを目指せ！
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTAセクション */}
      <section className="py-16 bg-indigo-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">今すぐクイズ対戦を始めよう！</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            アカウントを作成して、友達と一緒にクイズ対戦を楽しもう。
            毎日プレイして経験値を獲得！
          </p>
          {currentUser ? (
            <Link
              href="/quiz"
              className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-full text-lg inline-flex items-center"
            >
              <FaPlay className="mr-2" /> クイズを始める
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/login"
                className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-full text-lg inline-flex items-center justify-center"
              >
                ログイン
              </Link>
              <Link
                href="/auth/register"
                className="bg-yellow-400 text-indigo-900 font-bold px-8 py-3 rounded-full text-lg inline-flex items-center justify-center"
              >
                新規登録
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
