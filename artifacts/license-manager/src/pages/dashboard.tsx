import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Box, Plus, Settings, BarChart3, Key, ArrowRight, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuthWrapper } from "@/hooks/use-auth-wrapper";
import { useListApps, useCreateApp, getListAppsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export default function Dashboard() {
  const { user } = useAuthWrapper();
  const { data: apps, isLoading } = useListApps();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [appName, setAppName] = useState("");

  const createAppMutation = useCreateApp({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppsQueryKey() });
        toast({ title: "Success", description: "App created successfully" });
        setIsCreateOpen(false);
        setAppName("");
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to create app", variant: "destructive" });
      }
    }
  });

  const handleCreateApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;
    createAppMutation.mutate({ data: { name: appName.trim() } });
  };

  const totalLicenses = apps?.reduce((acc, app) => acc + app.licenseCount, 0) || 0;

  return (
    <Layout title="Dashboard">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Box className="w-16 h-16 text-primary" />
          </div>
          <p className="text-muted-foreground font-medium mb-2">Total Apps</p>
          <h2 className="text-4xl font-display font-bold text-white">{apps?.length || 0}</h2>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Key className="w-16 h-16 text-accent" />
          </div>
          <p className="text-muted-foreground font-medium mb-2">Active Licenses</p>
          <h2 className="text-4xl font-display font-bold text-white">{totalLicenses}</h2>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Settings className="w-16 h-16 text-blue-500" />
          </div>
          <p className="text-muted-foreground font-medium mb-2">Your Owner ID</p>
          <h2 className="text-lg font-mono font-bold text-white bg-black/30 px-3 py-2 rounded-lg mt-2 inline-block border border-white/5">{user?.ownerId || 'Loading...'}</h2>
        </motion.div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <Box className="w-5 h-5 text-primary" /> Your Applications
        </h2>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary hover:text-white transition-all font-medium">
              <Plus className="w-4 h-4" /> New App
            </button>
          </DialogTrigger>
          <DialogContent className="bg-card border border-white/10 sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-white text-xl font-display">Create New Application</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateApp} className="space-y-6 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">App Name</label>
                <input 
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="e.g. Premium Bot v2"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <button 
                  type="button" 
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-muted-foreground hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createAppMutation.isPending || !appName.trim()}
                  className="px-6 py-2 bg-primary text-white font-medium rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {createAppMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create App
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : apps?.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center border-dashed">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Box className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-display font-bold text-white mb-2">No Applications Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">You haven't created any applications yet. Create an application to start generating license keys for your users.</p>
          <button onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
            <Plus className="w-5 h-5" /> Create First App
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {apps?.map((app, i) => (
            <motion.div 
              key={app.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/apps/${app.appId}`} className="block glass-panel p-6 rounded-2xl hover:bg-white/[0.03] hover:border-primary/30 transition-all duration-300 group cursor-pointer border border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:border-primary/30 transition-all">
                    <Box className="w-6 h-6 text-gray-300 group-hover:text-primary transition-colors" />
                  </div>
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-black/40 border border-white/5 rounded-full text-xs font-medium text-gray-300">
                    <Key className="w-3.5 h-3.5 text-primary" /> {app.licenseCount} Keys
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-1 relative z-10">{app.name}</h3>
                <p className="text-sm font-mono text-muted-foreground truncate relative z-10">{app.appId}</p>
                <div className="mt-6 flex items-center text-sm font-medium text-primary opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 relative z-10">
                  Manage Application <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </Layout>
  );
}
