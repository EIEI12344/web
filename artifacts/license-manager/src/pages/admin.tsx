import { useState } from "react";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useGetAdminStats, 
  useListMasterLicenses, 
  useGenerateMasterLicense,
  useListUsers,
  useBanUser,
  useUnbanUser,
  useListAlerts,
  getGetAdminStatsQueryKey,
  getListMasterLicensesQueryKey,
  getListUsersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Users, Key, Box, ShieldAlert, Check, Copy, UserX, UserCheck, AlertTriangle } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

export default function AdminDashboard() {
  const searchParams = new URLSearchParams(useSearch());
  const activeTab = searchParams.get('tab') || 'overview';
  
  return (
    <Layout title="Super Admin">
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none border-b border-white/10">
        {[
          { id: 'overview', label: 'Overview', icon: Box },
          { id: 'licenses', label: 'Master Keys', icon: Key },
          { id: 'users', label: 'Resellers', icon: Users },
          { id: 'alerts', label: 'Security', icon: ShieldAlert },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => window.history.pushState({}, '', `/admin?tab=${tab.id}`)}
            className={cn(
              "px-4 py-2.5 rounded-t-lg font-semibold flex items-center gap-2 transition-all relative border-b-2 whitespace-nowrap",
              activeTab === tab.id 
                ? "text-primary border-primary bg-primary/5" 
                : "text-muted-foreground border-transparent hover:text-white hover:bg-white/5"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && <AdminOverview />}
          {activeTab === 'licenses' && <MasterLicenses />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'alerts' && <SecurityAlerts />}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

function AdminOverview() {
  const { data: stats, isLoading } = useGetAdminStats();

  if (isLoading) return <div className="p-10 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard title="Total Resellers" value={stats?.totalUsers || 0} icon={Users} color="text-blue-500" bg="bg-blue-500/10" />
      <StatCard title="Total Apps" value={stats?.totalApps || 0} icon={Box} color="text-indigo-500" bg="bg-indigo-500/10" />
      <StatCard title="Active Client Licenses" value={stats?.activeLicenses || 0} sub={`${stats?.totalLicenses || 0} total created`} icon={Key} color="text-primary" bg="bg-primary/10" />
      <StatCard title="Used Master Keys" value={stats?.usedMasterLicenses || 0} sub={`${stats?.totalMasterLicenses || 0} total generated`} icon={ShieldAlert} color="text-accent" bg="bg-accent/10" />
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, color, bg }: any) {
  return (
    <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bg)}>
          <Icon className={cn("w-6 h-6", color)} />
        </div>
      </div>
      <p className="text-muted-foreground font-medium mb-1">{title}</p>
      <h2 className="text-4xl font-display font-bold text-white mb-1">{value}</h2>
      {sub && <p className="text-sm text-gray-500">{sub}</p>}
    </div>
  );
}

function MasterLicenses() {
  const { data: licenses, isLoading } = useListMasterLicenses();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const generateMutation = useGenerateMasterLicense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMasterLicensesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: "Generated", description: "New master key created." });
      }
    }
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    toast({ title: "Copied!" });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card/50 p-4 rounded-xl border border-white/5">
        <div>
          <h3 className="text-lg font-bold text-white">Master Registration Keys</h3>
          <p className="text-sm text-muted-foreground">Give these to users so they can register as resellers.</p>
        </div>
        <button 
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          {generateMutation.isPending ? <div className="w-4 h-4 animate-spin border-2 border-white/50 border-t-white rounded-full" /> : <Key className="w-4 h-4" />}
          Generate Key
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-black/40 border-b border-white/5 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-4 pl-6">Master Key</th>
              <th className="p-4">Status</th>
              <th className="p-4">Used By</th>
              <th className="p-4">Created Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? <tr><td colSpan={4} className="p-8 text-center">Loading...</td></tr> : 
              licenses?.map(lic => (
                <tr key={lic.id} className="hover:bg-white/[0.02]">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 text-primary">{lic.key}</span>
                      <button onClick={() => handleCopy(lic.key)} className="text-gray-500 hover:text-white transition-colors">
                        {copiedKey === lic.key ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="p-4">
                    {lic.used ? <span className="text-xs font-semibold px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">Used</span> : <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">Available</span>}
                  </td>
                  <td className="p-4 text-sm text-gray-300 font-medium">{lic.usedBy || '-'}</td>
                  <td className="p-4 text-sm text-gray-500">{formatDate(lic.createdAt)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserManagement() {
  const { data: users, isLoading } = useListUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const banMutation = useBanUser({ onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast({title:"User Banned"}); } });
  const unbanMutation = useUnbanUser({ onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast({title:"User Unbanned"}); } });

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-black/40 border-b border-white/5 text-xs uppercase tracking-wider text-muted-foreground">
            <th className="p-4 pl-6">User</th>
            <th className="p-4">Owner ID</th>
            <th className="p-4">Stats</th>
            <th className="p-4">Status</th>
            <th className="p-4 pr-6 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {isLoading ? <tr><td colSpan={5} className="p-8 text-center">Loading...</td></tr> : 
            users?.map(u => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className="p-4 pl-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-white border border-white/10">{u.username.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="font-semibold text-white">{u.username}</div>
                      <div className="text-xs text-muted-foreground uppercase">{u.role}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 font-mono text-sm text-gray-400">{u.ownerId}</td>
                <td className="p-4">
                  <div className="text-sm text-gray-300"><span className="text-primary font-bold">{u.appCount}</span> apps</div>
                  <div className="text-xs text-gray-500"><span className="text-accent font-bold">{u.licenseCount}</span> licenses</div>
                </td>
                <td className="p-4">
                  {u.banned ? <span className="text-xs font-semibold px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">Banned</span> : <span className="text-xs font-semibold px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>}
                </td>
                <td className="p-4 pr-6 text-right">
                  {u.role !== 'admin' && (
                    <button 
                      onClick={() => u.banned ? unbanMutation.mutate({userId: u.id}) : banMutation.mutate({userId: u.id})}
                      disabled={banMutation.isPending || unbanMutation.isPending}
                      className={cn(
                        "p-2 rounded-lg border transition-all",
                        u.banned ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" : "text-red-400 border-red-500/30 hover:bg-red-500/20"
                      )}
                    >
                      {u.banned ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                    </button>
                  )}
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

function SecurityAlerts() {
  const { data: alerts, isLoading } = useListAlerts();
  
  return (
    <div className="glass-card rounded-2xl p-2">
      {isLoading ? <div className="p-10 text-center">Loading...</div> : alerts?.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground flex flex-col items-center">
          <ShieldAlert className="w-12 h-12 text-gray-600 mb-3" />
          No security alerts found. All systems normal.
        </div>
      ) : (
        <div className="space-y-2">
          {alerts?.map(alert => (
            <div key={alert.id} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start gap-4">
              <div className="mt-1 p-2 rounded-full bg-red-500/20 text-red-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-red-400">{alert.type}</h4>
                  <span className="text-xs text-gray-500">{formatDate(alert.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{alert.message}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-black/40 rounded border border-white/5 font-mono text-gray-400">App: {alert.appId}</span>
                  {alert.licenseKey && <span className="text-xs px-2 py-1 bg-black/40 rounded border border-white/5 font-mono text-gray-400">Key: {alert.licenseKey}</span>}
                  {alert.hwid && <span className="text-xs px-2 py-1 bg-black/40 rounded border border-white/5 font-mono text-gray-400">HWID: {alert.hwid}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
