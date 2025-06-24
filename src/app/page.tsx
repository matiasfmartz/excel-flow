import { ExcelFlowClient } from '@/components/excel-flow-client';

export default function Home() {
  return (
    <main className="flex w-full min-h-screen flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <ExcelFlowClient />
    </main>
  );
}
