import './globals.css';

export const metadata = {
  title: '城市骑行赛事管理平台',
  description: '报名分组 · 赛道补给 · 检录发车 · 成绩档案 · 统一时间轴',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
