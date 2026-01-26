"use client";

import { useQuery as useConvexQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { decryptPackage, decryptQuestions, decryptTours } from "@/lib/db/encrypted-client";
import { useEncryptionStore } from "@/stores/encryption";
import { usePackageStore } from "@/stores/package";

/**
 * Hook for syncing package data from Convex to Zustand store.
 *
 * This is the single source of truth for package data synchronization.
 * All pages that need package data should use this hook.
 *
 * Flow:
 * 1. Convex (encrypted) → useConvexQuery (real-time subscription)
 * 2. Decrypt on client
 * 3. Update Zustand store
 *
 * When Convex data changes (from any client), this hook automatically
 * updates the Zustand store with fresh decrypted data.
 */
export function usePackageSync(packageId: Id<"packages">) {
  const masterKey = useEncryptionStore((state) => state.masterKey);
  const { setPackage, setLoading, packageId: storePackageId } = usePackageStore();

  // Track if we're currently decrypting to avoid race conditions
  const decryptingRef = useRef(false);
  // Track the last processed data to avoid unnecessary updates
  const lastProcessedRef = useRef<string | null>(null);

  // Convex queries - these automatically update when data changes
  const encryptedPkg = useConvexQuery(api.packages.get, { id: packageId });
  const encryptedQuestions = useConvexQuery(api.questions.listByPackage, { packageId });
  const encryptedTours = useConvexQuery(api.tours.listByPackage, { packageId });

  // Compute a simple hash to detect changes
  const dataHash =
    encryptedPkg && encryptedQuestions && encryptedTours
      ? `${encryptedPkg._creationTime}-${encryptedQuestions.length}-${encryptedTours.length}-${
          encryptedQuestions[0]?._creationTime ?? 0
        }`
      : null;

  useEffect(() => {
    // Skip if no master key or data not loaded yet
    if (!masterKey || !encryptedPkg || !encryptedQuestions || !encryptedTours) {
      return;
    }

    // Skip if already processing or data hasn't changed
    if (decryptingRef.current || lastProcessedRef.current === dataHash) {
      return;
    }

    decryptingRef.current = true;
    setLoading(true);

    Promise.all([
      decryptPackage(masterKey, encryptedPkg),
      decryptQuestions(masterKey, encryptedQuestions),
      decryptTours(masterKey, encryptedTours),
    ])
      .then(([pkg, questions, tours]) => {
        // Sort questions by order_num
        const sortedQuestions = [...questions].sort((a, b) => a.order_num - b.order_num);

        setPackage(packageId, pkg, tours, sortedQuestions);
        lastProcessedRef.current = dataHash;
      })
      .catch((err) => {
        console.error("Failed to decrypt package data:", err);
      })
      .finally(() => {
        decryptingRef.current = false;
      });
  }, [
    masterKey,
    encryptedPkg,
    encryptedQuestions,
    encryptedTours,
    dataHash,
    packageId,
    setPackage,
    setLoading,
  ]);

  // Clear store when unmounting if viewing different package
  useEffect(() => {
    return () => {
      // Don't clear - other components might still need the data
    };
  }, []);

  return {
    isLoading: encryptedPkg === undefined || storePackageId !== packageId,
    notFound: encryptedPkg === null,
  };
}
