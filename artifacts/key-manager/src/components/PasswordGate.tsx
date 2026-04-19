import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CORRECT_PASSWORD = import.meta.env.VITE_APP_PASSWORD ?? "vcspeeper";
const SESSION_KEY = "app_auth";

export function useAuth() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");

  const login = (pw: string) => {
    if (pw === CORRECT_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
      return true;
    }
    return false;
  };

  return { authed, login };
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const { authed, login } = useAuth();
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  if (authed) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(pw)) {
      setError(true);
      setPw("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-xl border border-border bg-card">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">API Key Manager</h1>
          <p className="text-sm text-muted-foreground">请输入访问密码</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(false); }}
              placeholder="请输入密码"
              autoFocus
              data-testid="input-password"
            />
            {error && (
              <p className="text-sm text-destructive">密码错误，请重试</p>
            )}
          </div>
          <Button type="submit" className="w-full" data-testid="button-login">
            进入
          </Button>
        </form>
      </div>
    </div>
  );
}
