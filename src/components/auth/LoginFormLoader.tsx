'use client';

import dynamic from 'next/dynamic';

const LoginForm = dynamic(
  () => import('@/components/auth/LoginForm').then(m => m.LoginForm),
  { ssr: false }
);

export function LoginFormLoader() {
  return <LoginForm />;
}
