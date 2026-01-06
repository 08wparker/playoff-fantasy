import { ReactNode } from 'react';
import { Header } from './Header';
import { TabNav } from './TabNav';

interface LayoutProps {
  children: ReactNode;
  currentWeek: number;
  weekName: string;
  activeTab: 'roster' | 'scores' | 'admin';
  onTabChange: (tab: 'roster' | 'scores' | 'admin') => void;
  showAdmin?: boolean;
}

export function Layout({
  children,
  currentWeek,
  weekName,
  activeTab,
  onTabChange,
  showAdmin = false,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header currentWeek={currentWeek} weekName={weekName} />
      <TabNav activeTab={activeTab} onTabChange={onTabChange} showAdmin={showAdmin} />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
