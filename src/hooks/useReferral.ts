import { useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ApiService from '../services/api';
import { useAuthStatus } from './useAuthStatus';

export const useReferral = () => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStatus();

  // Register referral mutation
  const registerReferralMutation = useMutation({
    mutationFn: (referralCode: string) => ApiService.registerReferral(referralCode),
    onSuccess: (data) => {
      if (data.success) {
        console.log('✅ Referral registered successfully');
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['referral-stats'] });
      }
    },
  });

  // Check for referral code in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    
    if (referralCode) {
      // Store referral code in localStorage for later registration
      localStorage.setItem('pendingReferralCode', referralCode);
      
      // Clean URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      console.log(`📝 Referral code detected: ${referralCode}`);
    }
  }, []);

  // Function to register pending referral after user authentication
  const registerPendingReferral = useCallback(async () => {
    const pendingCode = localStorage.getItem('pendingReferralCode');
    
    if (!pendingCode) {
      return false;
    }

    if (!ApiService.isAuthenticated()) {
      console.log('⏳ Waiting for authentication before registering referral');
      return false;
    }

    try {
      await registerReferralMutation.mutateAsync(pendingCode);
      localStorage.removeItem('pendingReferralCode');
      console.log('✅ Pending referral registered');
      return true;
    } catch (error) {
      console.error('❌ Error registering referral:', error);
      return false;
    }
  }, [registerReferralMutation]);

  useEffect(() => {
    if (isAuthenticated) {
      registerPendingReferral();
    }
  }, [isAuthenticated, registerPendingReferral]);

  // Function to validate referral code
  const validateReferralCode = async (code: string) => {
    try {
      return await ApiService.validateReferralCode(code);
    } catch (error) {
      console.error('Error validating referral code:', error);
      return { valid: false };
    }
  };

  return {
    registerPendingReferral,
    validateReferralCode,
  };
};
