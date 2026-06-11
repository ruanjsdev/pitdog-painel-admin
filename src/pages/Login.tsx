import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { loginAdmin } from "../services/admin-api";

const logoUrl = `${import.meta.env.BASE_URL}LogoPitis.png`;

type LoginProps = {
  onLogin: () => void;
  sessionMessage?: string;
};

export default function Login({ onLogin, sessionMessage }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email || !password) {
      setError("Preencha o e-mail e a senha para entrar.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await loginAdmin(email.trim().toLowerCase(), password);
      onLogin();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar no painel.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-screen relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8 text-white sm:px-6">
      <div className="login-noise absolute inset-0" />
      <div className="login-dots absolute inset-0" aria-hidden="true" />

      <section className="relative z-10 w-full max-w-[420px]">
        <div className="mb-7 flex justify-center">
          <div className="login-logo-glow flex h-32 w-32 items-center justify-center p-2">
            <img
              src={logoUrl}
              alt="Pits Dog"
              className="login-logo-img drop-shadow-[0_18px_34px_rgba(255,106,0,0.2)]"
            />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0d0a07]/75 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.46)] backdrop-blur-2xl sm:p-7">
          <div className="mb-7 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-300">
              Painel administrativo
            </p>

            <h1 className="mt-3 text-3xl font-black text-white">
              Entrar no Pits Dog
            </h1>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Gerencie pedidos e acompanhe a operação em tempo real.
            </p>

            {sessionMessage && (
              <p className="mt-3 rounded-lg border border-orange-300/25 bg-orange-400/10 px-3 py-2 text-xs font-bold text-orange-100">
                {sessionMessage}
              </p>
            )}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-zinc-200"
              >
                E-mail
              </label>

              <div className="flex h-[52px] items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-4 transition focus-within:border-orange-300/70 focus-within:bg-black/40 focus-within:ring-2 focus-within:ring-orange-500/15">
                <Mail className="shrink-0 text-orange-300" size={18} />

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin-teste@pitsdog.local"
                  autoComplete="email"
                  className="h-[52px] w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-zinc-200"
              >
                Senha
              </label>

              <div className="flex h-[52px] items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-4 transition focus-within:border-orange-300/70 focus-within:bg-black/40 focus-within:ring-2 focus-within:ring-orange-500/15">
                <Lock className="shrink-0 text-orange-300" size={18} />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="h-[52px] w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 h-[52px] w-full rounded-lg bg-pits-orange px-5 text-sm font-black uppercase tracking-[0.16em] text-black shadow-[0_18px_38px_rgba(255,106,0,0.24)] transition hover:-translate-y-0.5 hover:bg-orange-300 hover:shadow-[0_22px_46px_rgba(255,106,0,0.32)] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-pits-dark"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Sistema inteligente de pedidos - Pits Dog
        </p>
      </section>
    </main>
  );
}
