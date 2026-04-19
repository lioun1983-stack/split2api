import { useGetKeyStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Key, CheckCircle2, XCircle, ShieldAlert, ShieldCheck, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsCards() {
  const { data: stats, isLoading } = useGetKeyStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const extStats = stats as typeof stats & { invalid?: number; valid?: number; noBalance?: number };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">总 Key 数</CardTitle>
          <Key className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-keys">{stats.total}</div>
          <p className="text-xs text-muted-foreground mt-1">启用 {stats.active} / 禁用 {stats.inactive}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">检测有效</CardTitle>
          <ShieldCheck className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600" data-testid="text-valid-keys">{extStats.valid ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">余额不足 {extStats.noBalance ?? 0} 个</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">检测无效</CardTitle>
          <ShieldAlert className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive" data-testid="text-invalid-keys">{extStats.invalid ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">已在数据库标记</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">活跃 Key</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary" data-testid="text-active-keys">{stats.active}</div>
          <p className="text-xs text-muted-foreground mt-1">当前可用于代理</p>
        </CardContent>
      </Card>
    </div>
  );
}
