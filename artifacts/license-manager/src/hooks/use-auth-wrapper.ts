import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useLogin, 
  useRegister, 
  useGetMe, 
  useLogout,
  getGetMeQueryKey
} from "@workspace/api-client-react";
import type { LoginRequest, RegisterRequest } from "@workspace/api-client-react/src/generated/api.schemas";

export function useAuthWrapper() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Get current user query
  const { data: user, isLoading: isUserLoading, error: userError } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (res) => {
        localStorage.setItem('license_token', res.token);
        queryClient.setQueryData(getGetMeQueryKey(), res.user);
        
        // Redirect based on role
        if (res.user.role === 'admin') {
          setLocation('/admin');
        } else {
          setLocation('/dashboard');
        }
      }
    }
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (res) => {
        localStorage.setItem('license_token', res.token);
        queryClient.setQueryData(getGetMeQueryKey(), res.user);
        setLocation('/dashboard');
      }
    }
  });

  const logoutMutation = useLogout({
    mutation: {
      onSettled: () => {
        localStorage.removeItem('license_token');
        queryClient.clear();
        setLocation('/login');
      }
    }
  });

  const login = async (data: LoginRequest) => {
    return loginMutation.mutateAsync({ data });
  };

  const register = async (data: RegisterRequest) => {
    return registerMutation.mutateAsync({ data });
  };

  const logout = async () => {
    return logoutMutation.mutateAsync();
  };

  return {
    user,
    isLoading: isUserLoading,
    isAuthenticated: !!user && !userError,
    login,
    isLoggingIn: loginMutation.isPending,
    register,
    isRegistering: registerMutation.isPending,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
