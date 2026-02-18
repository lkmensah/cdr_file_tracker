
'use client';

import { useUser } from "@/firebase";
import { useCallback, useState, useTransition } from "react";

type Action<T extends any[], U> = (clientToken: string, ...args: T) => Promise<U>;

type UseAuthActionOptions<U> = {
  onSuccess?: (result: U) => void;
  onError?: (error: any) => void;
};

export function useAuthAction<T extends any[], U>(
  action: Action<T, U>,
  options?: UseAuthActionOptions<U>
) {
  const { user } = useUser();
  const [isPending, startTransition] = useTransition();

  const exec = useCallback(
    async (...args: T): Promise<U> => {
      if (!user) {
        const authError = new Error("useAuthAction: User not authenticated.");
        console.error(authError);
        options?.onError?.(authError);
        throw authError;
      }
      
      const idToken = await user.getIdToken();

      return new Promise<U>((resolve, reject) => {
        startTransition(async () => {
          try {
            // The first argument to the action is always the ID token.
            const result = await action(idToken, ...args);
            options?.onSuccess?.(result);
            resolve(result);
          } catch (error) {
            console.error("Error executing authenticated action:", error);
            options?.onError?.(error);
            reject(error);
          }
        });
      });
    },
    [user, action, options]
  );

  return { exec, isLoading: isPending };
}
