// src/pages/ResetPassword.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { resetPassword } from "@/lib/passwordRecovery";
import { cn } from "@/lib/utils";
import logoImg from "@/components/img/logo.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const resetToken = sessionStorage.getItem("resetToken");
    if (!resetToken) {
      setError("Sessão expirada. Solicite uma nova recuperação.");
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(resetToken, password);
      sessionStorage.removeItem("resetToken");
      sessionStorage.removeItem("resetEmail");
      setLocation("/login?resetSuccess=true");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4">
            <img src={logoImg} alt="MADM Brasil" className="w-full h-full object-cover rounded-2xl shadow-md" />
          </div>
          <h1 className="text-2xl font-black text-[#09175b]">MADM Brasil</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-xl font-bold text-gray-800">Redefinir senha</h2>
            <p className="text-sm text-gray-500 mt-1">Digite sua nova senha.</p>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-gray-600 mb-1">
                  Nova senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#09175b]/20"
                    placeholder="••••••••"
                    required
                    title="Digite sua nova senha (mínimo 6 caracteres)"
                    aria-label="Nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-600 mb-1">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#09175b]/20"
                    placeholder="••••••••"
                    required
                    title="Confirme sua nova senha"
                    aria-label="Confirmar nova senha"
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all",
                  isLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#09175b] hover:opacity-90"
                )}
                title={isLoading ? "Redefinindo senha..." : "Redefinir senha"}
                aria-label="Redefinir senha"
              >
                {isLoading ? "Redefinindo..." : "Redefinir senha"}
              </button>

              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="w-full text-center text-xs text-gray-500 hover:text-[#09175b] transition-colors flex items-center justify-center gap-1"
                title="Voltar para a página de login"
                aria-label="Voltar ao login"
              >
                <ArrowLeft className="w-3 h-3" />
                Voltar ao login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}