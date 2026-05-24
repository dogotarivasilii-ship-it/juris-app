'use client';
import Image from "next/image";
import UploadForm from '../components/UploadForm';

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-start justify-start py-10 px-8 bg-white dark:bg-black">
        <h1 className="text-3xl font-bold mb-4">Juris App - Upload act normativ</h1>
        <UploadForm />
      </main>
    </div>
  );
}
