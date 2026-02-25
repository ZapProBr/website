"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      toast.success("Login realizado com sucesso!");
      router.replace("/conversas");
    }, 400);
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-end relative overflow-hidden">
        <Image src="/login-illustration.png" alt="Ilustração de automação de conversas" fill className="object-cover" priority />
        <div className="relative z-10 w-full px-12 pb-12 pt-8 bg-gradient-to-t from-black/50 to-transparent">
          <h2 className="text-lg font-bold text-white mb-1">Automatize suas conversas</h2>
          <p className="text-white/80 text-sm">Gerencie mensagens, contatos e campanhas em um só lugar.</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex w-full lg:w-[55%] items-center justify-center bg-card p-8 sm:p-16">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center gap-2.5 mb-12">
            <Image src="/logo.png" alt="ZapProBR" width={36} height={36} />
            <span className="text-lg font-bold text-foreground">Zap<span className="text-primary">Pro</span>BR</span>
          </div>
          <div className="mb-8">
            <h1 className="text-xl font-bold text-foreground mb-1">Bem-Vindo de volta</h1>
            <p className="text-muted-foreground text-sm">Entre com suas credenciais para acessar o painel.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-muted/40 border-0 text-sm rounded-lg" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-muted/40 border-0 pr-10 text-sm rounded-lg" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
                <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">Lembrar-me</Label>
              </div>
              <button type="button" onClick={() => toast.info("Funcionalidade em breve")} className="text-sm text-primary hover:underline">Esqueceu a senha?</button>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold rounded-lg" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
