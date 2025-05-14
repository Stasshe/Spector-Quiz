'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FaBolt, FaPlay, FaTrophy, FaUser, FaRocket, FaGamepad, FaGraduationCap, FaUsers } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { currentUser } = useAuth();

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* ヒーローセクション */}
      <section className="py-12 md:py-20">
        <div className="app-container">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <div className="inline-block bg-indigo-100 text-indigo-600 px-4 py-2 rounded-full text-sm font-medium mb-4 animate-pulse">
                NEW! オンライン早押しクイズ
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
                リアルタイムで<br />クイズ対戦！
              </h1>
              <p className="text-xl mb-8 text-gray-600 leading-relaxed">
                友達と一緒に知識を競い合い、ランキングを上げよう。
                早押しクイズで反射神経も試せる！
              </p>
              {currentUser ? (
                <Link
                  href="/quiz"
                  className="btn-primary inline-flex items-center"
                >
                  <FaPlay className="mr-2" /> クイズを始める
                </Link>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/auth/login"
                    className="btn-primary inline-flex items-center"
                  >
                    <FaUser className="mr-2" /> ログイン
                  </Link>
                  <Link
                    href="/auth/register"
                    className="btn-outline inline-flex items-center"
                  >
                    登録して始める
                  </Link>
                </div>
              )}
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="relative w-80 h-80 md:w-96 md:h-96">
                <div className="absolute inset-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl transform rotate-6 opacity-10"></div>
                <div className="absolute inset-0 bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-white">
                  <div className="absolute top-0 left-0 right-0 h-12 bg-gray-50 flex items-center px-4 border-b border-gray-100">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mx-auto">Zap! クイズアプリ</div>
                  </div>
                  <div className="pt-16 px-6 pb-6 flex flex-col items-center justify-center h-full">
                    <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                      <FaBolt className="text-indigo-600 w-12 h-12" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-bold mb-2">早押しクイズ!</h3>
                      <p className="text-gray-600 mb-8">誰が一番早く正解できるか?</p>
                      <div className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium inline-block">
                        参加する
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="py-16 bg-gray-50">
        <div className="app-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text inline-block">Zap!の特徴</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">知識と反射神経を競うオンラインクイズアプリ</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="card hover:scale-105 transition-transform duration-200">
              <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                <FaBolt className="text-indigo-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">リアルタイム対戦</h3>
              <p className="text-gray-600">
                友達や他のプレイヤーとリアルタイムで対戦！
                最も早く正確に答えた人が勝者に！
              </p>
            </div>
            
            <div className="card hover:scale-105 transition-transform duration-200">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <FaGamepad className="text-purple-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">多様なクイズ</h3>
              <p className="text-gray-600">
                様々なジャンルから出題されるクイズで
                幅広い知識を試そう！
              </p>
            </div>
            
            <div className="card hover:scale-105 transition-transform duration-200">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <FaTrophy className="text-green-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">ランキング</h3>
              <p className="text-gray-600">
                経験値を貯めてランクを上げよう！
                トッププレイヤーを目指せ！
              </p>
            </div>
            
            <div className="card hover:scale-105 transition-transform duration-200">
              <div className="w-16 h-16 bg-yellow-100 rounded-xl flex items-center justify-center mb-4">
                <FaUsers className="text-yellow-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">友達と遊ぼう</h3>
              <p className="text-gray-600">
                友達を誘って一緒にクイズに挑戦！
                盛り上がること間違いなし！
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTAセクション */}
      <section className="py-16">
        <div className="app-container">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 md:p-12 text-white text-center">
            <h2 className="text-3xl font-bold mb-4">今すぐクイズ対戦を始めよう！</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              アカウントを作成して、友達と一緒にクイズ対戦を楽しもう。
              毎日プレイして経験値を獲得しよう！
            </p>
            {currentUser ? (
              <Link
                href="/quiz"
                className="bg-white text-indigo-600 font-bold px-8 py-3 rounded-xl text-lg inline-flex items-center hover:bg-gray-100 transition-colors duration-200 shadow-lg"
              >
                <FaPlay className="mr-2" /> クイズを始める
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth/login"
                  className="bg-white text-indigo-600 font-bold px-8 py-3 rounded-xl text-lg inline-flex items-center justify-center hover:bg-gray-100 transition-colors duration-200 shadow-lg"
                >
                  ログイン
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl text-lg inline-flex items-center justify-center hover:bg-indigo-800 border-2 border-white transition-colors duration-200 shadow-lg"
                >
                  新規登録
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

