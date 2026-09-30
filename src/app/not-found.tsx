import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Not found
      </h1>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        The page you&apos;re looking for doesn&apos;t exist or was deleted.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
