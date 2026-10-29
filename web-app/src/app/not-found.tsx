import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-4">
      <h1 className="text-4xl font-extrabold text-white">404 - Transfer Room Not Found</h1>
      <p className="text-sm text-slate-400 max-w-md">
        The transfer session may have expired or the host has closed the session.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition"
      >
        Return to Home
      </Link>
    </div>
  );
}

