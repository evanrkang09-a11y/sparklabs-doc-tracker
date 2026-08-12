import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, allowedDomain } from "@/auth";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  // Already signed in? Nothing to do here.
  if (await auth()) redirect("/");

  const { error, next } = await searchParams;

  return <LoginForm domain={allowedDomain()} error={error} next={next} />;
}
