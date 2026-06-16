// src/pages/ForgotPassword.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { Mail, Shield, ArrowLeft, Send, RefreshCw } from "lucide-react";
import { requestPasswordReset, verifyResetCode } from "@/lib/passwordRecovery";
import { cn } from "@/lib/utils";
import logoImg from "@/components/img/logo.png";

type Step = "email" | "code";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      sessionStorage.setItem("resetEmail", email);
      setStep("code");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const storedEmail = sessionStorage.getItem("resetEmail");
    if (!storedEmail) {
      setError("Sessão expirada. Solicite um novo código.");
      setStep("email");
      setIsLoading(false);
      return;
    }

    try {
      const response = await verifyResetCode(storedEmail, code);
      sessionStorage.setItem("resetToken", response.resetToken!);
      setLocation("/reset-password");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    const storedEmail = sessionStorage.getItem("resetEmail");
    if (!storedEmail) {
      setError("E-mail não encontrado. Solicite novamente.");
      setStep("email");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await requestPasswordReset(storedEmail);
      alert("Novo código enviado para seu e-mail.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => setLocation("/login");

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4">
            <img src={logoImg} alt="MADM Brasil" className="w-full h-full object-cover rounded-2xl shadow-md" />
          </div>
          <h1 className="text-2xl font-black text-[#09175b]">MADM Brasil</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-xl font-bold text-gray-800">
              {step === "email" ? "Recuperar senha" : "Código de verificação"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === "email"
                ? "Informe seu e-mail para receber um código de verificação."
                : `Digite o código de 6 dígitos enviado para ${email}.`}
            </p>
          </div>

          <div className="p-6">
            {step === "email" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-600 mb-1">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#09175b]/20"
                      placeholder="seu@madmbrasil.com"
                      required
                      title="Digite seu e-mail cadastrado"
                      aria-label="Endereço de e-mail"
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
                  title="Enviar código de recuperação para o e-mail"
                  aria-label="Enviar código"
                >
                  {isLoading ? "Enviando..." : "Enviar código"}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full text-center text-xs text-gray-500 hover:text-[#09175b] transition-colors flex items-center justify-center gap-1"
                  title="Voltar para a tela de login"
                  aria-label="Voltar ao login"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Voltar ao login
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label htmlFor="code" className="block text-xs font-semibold text-gray-600 mb-1">
                    Código
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#09175b]/20"
                      placeholder="000000"
                      required
                      title="Código de 6 dígitos enviado por e-mail"
                      aria-label="Código de verificação"
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
                  title="Validar código e prosseguir"
                  aria-label="Verificar código"
                >
                  {isLoading ? "Verificando..." : "Verificar código"}
                </button>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="text-center text-xs text-gray-500 hover:text-[#09175b] transition-colors"
                    title="Usar outro endereço de e-mail"
                    aria-label="Usar outro e-mail"
                  >
                    ← Usar outro e-mail
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="text-center text-xs text-[#09175b] hover:underline transition-colors flex items-center justify-center gap-1"
                    title="Reenviar código de verificação"
                    aria-label="Reenviar código"
                  >
                    <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                    {isLoading ? "Enviando..." : "Reenviar código"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-center text-xs text-gray-500 hover:text-[#09175b] transition-colors"
                    title="Voltar para a tela de login"
                    aria-label="Voltar ao login"
                  >
                    Voltar ao login
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-[10px] text-gray-400">
              {step === "email"
                ? "Enviaremos um código de verificação para seu e-mail."
                : "Não recebeu o código? Verifique sua caixa de spam ou use o botão Reenviar código."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}