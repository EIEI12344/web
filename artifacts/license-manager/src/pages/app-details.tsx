import { useState } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useGetApp,
  useListAppLicenses,
  useGenerateAppLicense,
  useBanLicense,
  useUnbanLicense,
  getListAppLicensesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Key, Plus, Copy, Check, ShieldBan, ShieldCheck, Clock,
  Monitor, RefreshCw, Trash2, Search, ChevronLeft, Loader2,
  BookOpen, ChevronDown, ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function timeUntil(iso: string | null | undefined) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `in ${days} day${days > 1 ? "s" : ""}`;
  const hours = Math.floor(diff / 3600000);
  return `in ${hours}h`;
}

const DURATION_PRESETS = [
  { label: "1 Day", value: "1day" as const },
  { label: "7 Days", value: "custom" as const, days: 7 },
  { label: "30 Days", value: "30days" as const },
  { label: "90 Days", value: "custom" as const, days: 90 },
  { label: "365 Days", value: "custom" as const, days: 365 },
  { label: "Lifetime", value: "lifetime" as const },
];

export default function AppDetails() {
  const { appId } = useParams<{ appId: string }>();
  const { data: app, isLoading: isAppLoading } = useGetApp(appId || "");
  const { data: licenses, isLoading: isLicensesLoading } = useListAppLicenses(appId || "");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<typeof DURATION_PRESETS[0]>(DURATION_PRESETS[2]);
  const [customDays, setCustomDays] = useState<string>("30");
  const [isCustom, setIsCustom] = useState(false);
  const [keyFormat, setKeyFormat] = useState<string>("");

  const [testKey, setTestKey] = useState("");
  const [testResult, setTestResult] = useState<null | { status: string; message: string }>(null);
  const [isTesting, setIsTesting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);

  const generateMutation = useGenerateAppLicense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppLicensesQueryKey(appId || "") });
        toast({ title: "License key generated successfully" });
        setIsGenerateOpen(false);
      },
      onError: (err: any) => {
        toast({ title: "Failed to generate license", description: err.message, variant: "destructive" });
      }
    }
  });

  const banMutation = useBanLicense({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAppLicensesQueryKey(appId || "") }); toast({ title: "License banned" }); }
    }
  });

  const unbanMutation = useUnbanLicense({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAppLicensesQueryKey(appId || "") }); toast({ title: "License unbanned" }); }
    }
  });

  const handleGenerateSubmit = () => {
    if (!app) return;
    const fmt = keyFormat.trim() || undefined;
    if (isCustom) {
      const d = parseInt(customDays);
      if (!d || d < 1) { toast({ title: "Please enter a valid number of days", variant: "destructive" }); return; }
      generateMutation.mutate({ appId: app.appId, data: { duration: "custom" as any, days: d, keyFormat: fmt } as any });
    } else {
      if (selectedPreset.value === "custom" && selectedPreset.days) {
        generateMutation.mutate({ appId: app.appId, data: { duration: "custom" as any, days: selectedPreset.days, keyFormat: fmt } as any });
      } else {
        generateMutation.mutate({ appId: app.appId, data: { duration: selectedPreset.value as any, keyFormat: fmt } as any });
      }
    }
  };

  const keyFormatPreview = (() => {
    const fmt = keyFormat.trim();
    if (!fmt) {
      const prefix = app?.name.split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, "").substring(0, 6) || "KEY";
      return `${prefix}-xxxx-xxxx-xxxx`;
    }
    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return fmt.replace(/\*/g, () => CHARS[Math.floor(Math.random() * CHARS.length)]);
  })();

  const handleCopyCheckUrl = (license: any) => {
    if (!app) return;
    const base = window.location.origin;
    const url = `${base}/api/check?ownerid=${encodeURIComponent(app.ownerId)}&username=USERNAME&license=${encodeURIComponent(license.licenseKey)}&hwid=HWID&appid=${encodeURIComponent(app.appId)}`;
    navigator.clipboard.writeText(url);
    setCopiedKey(license.id + "-url");
    toast({ title: "Check URL copied to clipboard" });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyKey = (licenseKey: string, id: string) => {
    navigator.clipboard.writeText(licenseKey);
    setCopiedKey(id + "-key");
    toast({ title: "License key copied" });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestKey = async () => {
    if (!testKey.trim() || !app) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/check?ownerid=${encodeURIComponent(app.ownerId)}&username=tester&license=${encodeURIComponent(testKey.trim())}&hwid=TEST-HWID&appid=${encodeURIComponent(app.appId)}`);
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ status: "invalid", message: "Request failed — check server connection" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleExtend = async (licenseId: string) => {
    if (!app) return;
    setExtending(licenseId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/apps/${app.appId}/licenses/${licenseId}/extend`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListAppLicensesQueryKey(appId || "") });
        toast({ title: "License extended by 30 days" });
      } else {
        toast({ title: "Failed to extend", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to extend", variant: "destructive" });
    } finally {
      setExtending(null);
    }
  };

  const handleDelete = async (licenseId: string) => {
    if (!app) return;
    setDeleting(licenseId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/apps/${app.appId}/licenses/${licenseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListAppLicensesQueryKey(appId || "") });
        toast({ title: "License deleted" });
        setDeleteConfirmId(null);
      } else {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  if (isAppLoading) return (
    <Layout title="Loading...">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    </Layout>
  );

  if (!app) return (
    <Layout title="Not Found">
      <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
        <p className="text-muted-foreground">App not found.</p>
        <Link href="/dashboard" className="text-primary hover:underline flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    </Layout>
  );

  const totalKeys = licenses?.length || 0;
  const activeKeys = licenses?.filter(l => !l.banned && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length || 0;
  const expiredKeys = licenses?.filter(l => !l.banned && l.expiresAt && new Date(l.expiresAt) <= new Date()).length || 0;
  const bannedKeys = licenses?.filter(l => l.banned).length || 0;

  const baseCheckUrl = `${window.location.origin}/api/check`;

  return (
    <Layout title={app.name}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{app.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage and monitor all your API license keys.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: getListAppLicensesQueryKey(appId || "") })}
            className="flex items-center gap-2 px-4 py-2 bg-secondary/60 border border-white/10 text-sm font-medium text-gray-300 hover:text-white rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setIsGenerateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" /> New License
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Licenses", value: totalKeys, icon: Key, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
          { label: "Active Keys", value: activeKeys, icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
          { label: "Expired Keys", value: expiredKeys, icon: Clock, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
          { label: "Banned Keys", value: bannedKeys, icon: ShieldBan, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass-panel p-5 rounded-2xl flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", bg)}>
              <Icon className={cn("w-5 h-5", color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Test License Key */}
      <div className="glass-card rounded-2xl p-6 mb-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-primary" /> Test License Key
        </h2>
        <div className="flex gap-3">
          <input
            value={testKey}
            onChange={e => { setTestKey(e.target.value); setTestResult(null); }}
            onKeyDown={e => e.key === "Enter" && handleTestKey()}
            placeholder="Enter license key to verify..."
            className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleTestKey}
            disabled={isTesting || !testKey.trim()}
            className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Verify Key
          </button>
        </div>
        {testResult && (
          <div className={cn("mt-3 px-4 py-3 rounded-xl text-sm font-mono border", testResult.status === "valid" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300")}>
            {JSON.stringify(testResult, null, 2)}
          </div>
        )}
      </div>

      {/* API Documentation */}
      <div className="glass-card rounded-2xl mb-6 overflow-hidden">
        <button
          onClick={() => setShowDocs(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> API Documentation
            <span className="text-xs font-normal text-muted-foreground ml-2">— How to use the license check endpoint</span>
          </h2>
          {showDocs ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showDocs && (
          <div className="px-6 pb-6 space-y-5 border-t border-white/5 pt-5">
            {/* Endpoint */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Endpoint</p>
              <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm">
                <span className="text-emerald-400 font-bold">GET</span>
                <span className="text-gray-200">/api/check</span>
              </div>
            </div>

            {/* Parameters */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Query Parameters</p>
              <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-semibold">Parameter</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Value</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      { param: "ownerid", value: app.ownerId, desc: "Your owner ID (fixed)" },
                      { param: "username", value: "USERNAME", desc: "The end-user's username" },
                      { param: "license", value: "LICENSE_KEY", desc: "The license key to validate" },
                      { param: "hwid", value: "HWID", desc: "Hardware ID of the client machine" },
                      { param: "appid", value: app.appId, desc: "Your app's unique ID (fixed)" },
                    ].map(({ param, value, desc }) => (
                      <tr key={param}>
                        <td className="px-4 py-2.5 font-mono text-primary text-xs">{param}</td>
                        <td className="px-4 py-2.5 font-mono text-yellow-300 text-xs">{value}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Example URL */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Example Request URL</p>
              <div className="relative group bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-xs text-gray-300 break-all">
                {baseCheckUrl}?ownerid=<span className="text-yellow-300">{app.ownerId}</span>&amp;username=<span className="text-blue-300">USERNAME</span>&amp;license=<span className="text-green-300">YOUR_LICENSE_KEY</span>&amp;hwid=<span className="text-purple-300">MACHINE_HWID</span>&amp;appid=<span className="text-yellow-300">{app.appId}</span>
              </div>
            </div>

            {/* Responses */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Response Examples</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    label: "Valid",
                    color: "border-emerald-500/30 bg-emerald-500/5",
                    labelColor: "text-emerald-400",
                    code: `{\n  "status": "valid",\n  "message": "License valid",\n  "username": "john",\n  "expiresAt": "2026-04-17T10:00:00.000Z"\n}`
                  },
                  {
                    label: "HWID Mismatch",
                    color: "border-red-500/30 bg-red-500/5",
                    labelColor: "text-red-400",
                    code: `{\n  "status": "invalid",\n  "message": "HWID mismatch — license is bound to a different machine"\n}`
                  },
                  {
                    label: "Expired",
                    color: "border-orange-500/30 bg-orange-500/5",
                    labelColor: "text-orange-400",
                    code: `{\n  "status": "invalid",\n  "message": "License has expired"\n}`
                  },
                  {
                    label: "Banned",
                    color: "border-red-500/30 bg-red-500/5",
                    labelColor: "text-red-400",
                    code: `{\n  "status": "invalid",\n  "message": "License is banned"\n}`
                  },
                ].map(({ label, color, labelColor, code }) => (
                  <div key={label} className={cn("rounded-xl border p-3", color)}>
                    <p className={cn("text-xs font-bold mb-2", labelColor)}>{label}</p>
                    <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap">{code}</pre>
                  </div>
                ))}
              </div>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
              <Key className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-200 leading-relaxed">
                <strong className="text-blue-300">HWID Locking:</strong> The first time a license key is used, the client's HWID is bound to it. After that, any attempt to use the same key from a different machine will return an "invalid" status with a HWID mismatch message.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* License Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="text-base font-bold text-white">License Keys</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click <Monitor className="w-3 h-3 inline-block" /> to copy the check URL · Click <Copy className="w-3 h-3 inline-block" /> to copy the raw key
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <th className="px-6 py-3">License Key</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">HWID</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLicensesLoading ? (
                <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" /></td></tr>
              ) : totalKeys === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Key className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-muted-foreground text-sm">No license keys yet.</p>
                      <button onClick={() => setIsGenerateOpen(true)} className="text-primary text-sm hover:underline flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Generate your first key
                      </button>
                    </div>
                  </td>
                </tr>
              ) : licenses?.map((license) => {
                const expired = license.expiresAt && new Date(license.expiresAt) <= new Date();
                const isActive = !license.banned && !expired && !!license.hwid;
                const isUnused = !license.banned && !license.hwid;
                const statusLabel = license.banned ? "Banned" : expired ? "Expired" : isActive ? "Active" : "Unused";
                const statusColor = license.banned
                  ? "text-red-400 bg-red-400/10 border-red-400/20"
                  : expired
                  ? "text-orange-400 bg-orange-400/10 border-orange-400/20"
                  : isActive
                  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                  : "text-gray-400 bg-white/5 border-white/10";
                const dot = license.banned ? "bg-red-400" : expired ? "bg-orange-400" : isActive ? "bg-emerald-400" : "bg-gray-500";

                return (
                  <tr key={license.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-sm text-primary font-semibold">
                          {license.username || "—"}
                        </span>
                        <button
                          onClick={() => handleCopyKey(license.licenseKey, license.id)}
                          className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-all"
                          title="Copy license key"
                        >
                          {copiedKey === license.id + "-key" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopyCheckUrl(license)}
                          className="p-1 text-gray-500 hover:text-primary hover:bg-primary/10 rounded transition-all"
                          title="Copy check URL"
                        >
                          {copiedKey === license.id + "-url" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Monitor className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground max-w-[220px] truncate">{license.licenseKey}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 w-fit", statusColor)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {license.hwid ? (
                        <span className="font-mono text-xs text-gray-400 bg-black/30 px-2 py-1 rounded border border-white/5">
                          {license.hwid.length > 16 ? license.hwid.substring(0, 16) + "..." : license.hwid}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not bound</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">{formatDate(license.createdAt)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {license.duration === "lifetime" ? (
                        <span className="text-purple-400 font-semibold text-xs bg-purple-400/10 border border-purple-400/20 px-2 py-1 rounded-full">Lifetime</span>
                      ) : license.expiresAt ? (
                        <div>
                          <p className="text-gray-300 text-xs">{formatDate(license.expiresAt)}</p>
                          <p className={cn("text-xs mt-0.5", expired ? "text-orange-400" : "text-muted-foreground")}>{timeUntil(license.expiresAt)}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 justify-end">
                        {license.duration !== "lifetime" && (
                          <button
                            onClick={() => handleExtend(license.id)}
                            disabled={extending === license.id}
                            title="Extend 30 days"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-400 bg-blue-400/10 border border-blue-400/20 hover:bg-blue-400/20 rounded-lg transition-all disabled:opacity-50"
                          >
                            {extending === license.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Extend
                          </button>
                        )}
                        {license.banned ? (
                          <button
                            onClick={() => unbanMutation.mutate({ appId: app.appId, licenseId: license.id })}
                            disabled={unbanMutation.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400/20 rounded-lg transition-all"
                          >
                            <ShieldCheck className="w-3 h-3" /> Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => banMutation.mutate({ appId: app.appId, licenseId: license.id })}
                            disabled={banMutation.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20 hover:bg-orange-400/20 rounded-lg transition-all"
                          >
                            <ShieldBan className="w-3 h-3" /> Ban
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirmId(license.id)}
                          className="flex items-center justify-center p-1.5 text-red-400 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Key Dialog */}
      <Dialog open={isGenerateOpen} onOpenChange={(open) => { setIsGenerateOpen(open); if (!open) setKeyFormat(""); }}>
        <DialogContent className="bg-card border border-white/10 sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" /> Generate License Key
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-3 block">Duration</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {DURATION_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedPreset(preset); setIsCustom(false); }}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1",
                      !isCustom && selectedPreset === preset
                        ? "bg-primary/20 border-primary text-white shadow-lg shadow-primary/10"
                        : "bg-black/30 border-white/5 text-muted-foreground hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {preset.value === "lifetime" ? <Key className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom days input */}
              <button
                onClick={() => setIsCustom(v => !v)}
                className={cn(
                  "w-full py-2.5 px-4 rounded-xl border text-sm font-medium transition-all flex items-center justify-between",
                  isCustom
                    ? "bg-primary/20 border-primary text-white"
                    : "bg-black/30 border-white/5 text-muted-foreground hover:bg-white/5"
                )}
              >
                <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Custom Days</span>
                {isCustom ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isCustom && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={36500}
                    value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                    placeholder="e.g. 14"
                    className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  />
                  <span className="text-muted-foreground text-sm">days</span>
                </div>
              )}
            </div>

            {/* Key Format */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Key Format <span className="text-muted-foreground font-normal">(optional)</span></label>
                <span className="text-xs text-muted-foreground">use <code className="bg-white/10 px-1 rounded text-primary">*</code> for random char</span>
              </div>
              <input
                value={keyFormat}
                onChange={e => setKeyFormat(e.target.value)}
                placeholder={`e.g. s-****-****  or  GOD-********`}
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-600 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex items-center gap-2 px-3 py-2 bg-black/30 border border-white/5 rounded-lg">
                <span className="text-xs text-muted-foreground">Preview:</span>
                <span className="font-mono text-xs text-primary">{keyFormatPreview}</span>
              </div>
            </div>

            <DialogFooter>
              <button onClick={() => setIsGenerateOpen(false)} className="px-4 py-2 text-muted-foreground hover:text-white text-sm transition-colors">Cancel</button>
              <button
                onClick={handleGenerateSubmit}
                disabled={generateMutation.isPending}
                className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center gap-2"
              >
                {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Generate
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="bg-card border border-white/10 sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" /> Delete License Key
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm py-2">This will permanently delete the license key. Users who have it will lose access immediately. This action cannot be undone.</p>
          <DialogFooter>
            <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-muted-foreground hover:text-white text-sm transition-colors">Cancel</button>
            <button
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={!!deleting}
              className="px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-red-600 transition-all flex items-center gap-2"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete Permanently
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
