import { LoginForm } from "@/app/login/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Sign in to JobTracker
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your job search, organized — private to your account. (CD Demo - Build
          1)
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <LoginForm />
      </div>
    </div>
  );
}
