import { useState } from "react";
import { useListKeys, useUpdateKey, useDeleteKey, getListKeysQueryKey, getGetKeyStatsQueryKey, type ApiKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Edit2, Eye, EyeOff, KeyRound, Zap, CheckCircle2, XCircle, AlertCircle, Loader2, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EditKeyDialog } from "./EditKeyDialog";
import { Empty } from "@/components/ui/empty";

type ValidateStatus = "valid" | "no_balance" | "invalid" | "unreachable";

type ApiKeyExtended = ApiKey & {
  validationStatus?: string | null;
  validationMessage?: string | null;
  validatedAt?: string | null;
};

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api/";

async function validateSingleKey(id: number) {
  const resp = await fetch(`${BASE_URL}keys/${id}/validate`, { method: "POST" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function StatusBadge({ status, message, validatedAt }: { status: string; message?: string | null; validatedAt?: string | null }) {
  const timeAgo = validatedAt
    ? formatDistanceToNow(new Date(validatedAt), { addSuffix: true })
    : null;

  const inner = (() => {
    if (status === "valid") return <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="h-3 w-3" />有效</span>;
    if (status === "no_balance") return <span className="inline-flex items-center gap-1 text-xs text-yellow-600 font-medium"><AlertCircle className="h-3 w-3" />余额不足</span>;
    if (status === "invalid") return <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium"><XCircle className="h-3 w-3" />无效</span>;
    if (status === "unreachable") return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium"><AlertCircle className="h-3 w-3" />不可达</span>;
    return null;
  })();

  if (!inner) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default">{inner}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs space-y-1">
        {message && <p>{message}</p>}
        {timeAgo && <p className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />检测于 {timeAgo}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function KeysTable() {
  const { data: keys, isLoading, refetch } = useListKeys();
  const updateKey = useUpdateKey();
  const deleteKey = useDeleteKey();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [validating, setValidating] = useState<Set<number>>(new Set());

  const toggleVisibility = (id: number) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCopy = async (keyText: string) => {
    await navigator.clipboard.writeText(keyText);
    toast({ title: "已复制", description: "API key 已复制到剪贴板。" });
  };

  const handleValidate = async (key: ApiKeyExtended) => {
    setValidating((prev) => new Set(prev).add(key.id));
    try {
      const result = await validateSingleKey(key.id);
      await refetch();
      queryClient.invalidateQueries({ queryKey: getGetKeyStatsQueryKey() });
      const labels: Record<string, string> = { valid: "Key 有效", no_balance: "Key 有效但余额不足", invalid: "Key 无效", unreachable: "Sapiom API 不可达" };
      toast({
        title: labels[result.status] ?? result.status,
        description: result.message,
        variant: result.status === "valid" || result.status === "no_balance" ? "default" : "destructive",
      });
    } catch (e) {
      toast({ title: "检测失败", description: String(e), variant: "destructive" });
    } finally {
      setValidating((prev) => { const n = new Set(prev); n.delete(key.id); return n; });
    }
  };

  const handleToggleActive = (key: ApiKey, isActive: boolean) => {
    updateKey.mutate(
      { id: key.id, data: { isActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKeysQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetKeyStatsQueryKey() });
          toast({ title: `Key 已${isActive ? "启用" : "禁用"}`, description: `${key.name} 现在${isActive ? "启用" : "禁用"}中。` });
        },
        onError: () => toast({ title: "错误", description: "更新状态失败。", variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    deleteKey.mutate(
      { id: deleteConfirmId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKeysQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetKeyStatsQueryKey() });
          setDeleteConfirmId(null);
          toast({ title: "Key 已删除", description: "API key 已移除。" });
        },
        onError: () => toast({ title: "错误", description: "删除失败。", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!keys?.length) {
    return (
      <Empty
        icon={KeyRound}
        title="暂无 API Key"
        description="点击右上角添加或导入 API key。"
        className="py-12"
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[200px]">名称</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="w-[130px]">状态</TableHead>
            <TableHead className="text-right w-[160px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(keys as ApiKeyExtended[]).map((key) => {
            const isVisible = visibleKeys.has(key.id);
            const maskedKey = key.key.substring(0, 6) + "****************";
            const isValidating = validating.has(key.id);

            return (
              <TableRow key={key.id} className="group">
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-0.5">
                    <span data-testid={`text-key-name-${key.id}`}>{key.name}</span>
                    {key.note && (
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={key.note}>
                        {key.note}
                      </span>
                    )}
                    {key.validationStatus && (
                      <StatusBadge
                        status={key.validationStatus}
                        message={key.validationMessage}
                        validatedAt={key.validatedAt}
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <span data-testid={`text-key-value-${key.id}`}>
                      {isVisible ? key.key : maskedKey}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => toggleVisibility(key.id)} data-testid={`button-toggle-visibility-${key.id}`}>
                      {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopy(key.key)} data-testid={`button-copy-key-${key.id}`}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {key.provider ? (
                    <Badge variant="secondary" className="font-normal" data-testid={`badge-provider-${key.id}`}>{key.provider}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(key.createdAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={key.isActive}
                    onCheckedChange={(checked) => handleToggleActive(key, checked)}
                    data-testid={`switch-active-${key.id}`}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-yellow-500" onClick={() => handleValidate(key)} disabled={isValidating} data-testid={`button-validate-${key.id}`}>
                          {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>检测 key 有效性</TooltipContent>
                    </Tooltip>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setEditingKey(key)} data-testid={`button-edit-${key.id}`}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmId(key.id)} data-testid={`button-delete-${key.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销，API key 将被永久删除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" data-testid="button-confirm-delete">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingKey && (
        <EditKeyDialog
          key={editingKey.id}
          apiKey={editingKey}
          open={!!editingKey}
          onOpenChange={(open) => !open && setEditingKey(null)}
        />
      )}
    </>
  );
}
