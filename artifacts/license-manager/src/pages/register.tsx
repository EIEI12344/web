import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, ArrowRight, Loader2, Key } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthWrapper } from "@/hooks/use-auth-wrapper";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  password: z.string().min(6, "Password must be at least 6 characters"),
  masterLicenseKey: z.string().min(10, "Valid Master License required"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: registerUser, isRegistering } = useAuthWrapper();
  const { toast } = useToast();
  
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(data);
      toast({
        title: "Account Created",
        description: "Welcome to KeyForge!",
      });
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.response?.data?.message || error.message || "Invalid master key or username taken",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background relative overflow-hidden">
      <img 
        src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
        alt="Background" 
        className="absolute inset-0 object-cover w-full h-full opacity-40 mix-blend-screen pointer-events-none" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />

      <div className="flex-1 flex items-center justify-center z-10 p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="glass-card p-8 sm:p-10 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
            
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent to-blue-500 flex items-center justify-center shadow-lg shadow-accent/30 relative">
                <div className="absolute inset-0 bg-white/20 rounded-2xl mix-blend-overlay" />
                <Key className="w-8 h-8 text-white relative z-10" />
              </div>
            </div>
            
            <div className="text-center mb-8">
              <h1 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Create Account</h1>
              <p className="text-muted-foreground">Register as a reseller with your Master Key</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300 ml-1">Username</label>
                <input 
                  {...register("username")}
                  type="text" 
                  placeholder="Choose a username"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
                />
                {errors.username && <p className="text-xs text-red-400 ml-1">{errors.username.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
                <input 
                  {...register("password")}
                  type="password" 
                  placeholder="Create a strong password"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
                />
                {errors.password && <p className="text-xs text-red-400 ml-1">{errors.password.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300 ml-1">Master License Key</label>
                <input 
                  {...register("masterLicenseKey")}
                  type="text" 
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-primary font-mono placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 uppercase"
                />
                {errors.masterLicenseKey && <p className="text-xs text-red-400 ml-1">{errors.masterLicenseKey.message}</p>}
              </div>

              <button 
                type="submit" 
                disabled={isRegistering}
                className="w-full py-3.5 px-4 mt-6 bg-gradient-to-r from-accent to-blue-500 hover:from-accent/90 hover:to-blue-500/90 text-white font-semibold rounded-xl shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isRegistering ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Register Account
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-400">
                Already have an account?{" "}
                <Link href="/login" className="text-accent hover:text-blue-400 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
