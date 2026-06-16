import { Link } from "wouter";
import { LogIn } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "#09175b" }}
        >
          <span className="text-[#ffcc00] text-3xl font-black">404</span>
        </div>
        <h1 className="text-2xl font-black text-[#09175b] mb-2">Página não encontrada</h1>
        <p className="text-gray-500 text-sm mb-8">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link href="/">
          <button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: "#09175b", color: "white" }}
          >
            <LogIn className="w-4 h-4" />
            Voltar
          </button>
        </Link>
      </div>
    </div>
  );
}