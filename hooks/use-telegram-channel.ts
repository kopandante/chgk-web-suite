"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useEffectEvent } from "react";
import { api } from "@/convex/_generated/api";

export function useTelegramChannels() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const clerkUserId = user?.id;

  // Получить все привязанные каналы
  const channels = useQuery(api.telegram.getUserChannels, clerkUserId ? { clerkUserId } : "skip");

  // Получить статус привязки (real-time)
  const linkStatus = useQuery(api.telegram.getLinkStatus, clerkUserId ? { clerkUserId } : "skip");

  // Mutations
  const createLinkCodeMutation = useMutation(api.telegram.createLinkCode);
  const saveChannelMutation = useMutation(api.telegram.saveChannel);
  const unlinkChannelMutation = useMutation(api.telegram.unlinkChannel);
  const cancelLinkingMutation = useMutation(api.telegram.cancelLinking);

  // Начать привязку канала
  const startLinking = useCallback(async () => {
    if (!clerkUserId) throw new Error("User not authenticated");
    return await createLinkCodeMutation({ clerkUserId });
  }, [clerkUserId, createLinkCodeMutation]);

  // Сохранить канал после верификации
  const saveChannel = useCallback(async () => {
    if (!clerkUserId) throw new Error("User not authenticated");
    return await saveChannelMutation({ clerkUserId });
  }, [clerkUserId, saveChannelMutation]);

  // Отвязать конкретный канал
  const unlinkChannel = useCallback(
    async (channelId: string) => {
      if (!clerkUserId) throw new Error("User not authenticated");
      return await unlinkChannelMutation({ clerkUserId, channelId });
    },
    [clerkUserId, unlinkChannelMutation],
  );

  // Отменить привязку
  const cancelLinking = useCallback(async () => {
    if (!clerkUserId) throw new Error("User not authenticated");
    return await cancelLinkingMutation({ clerkUserId });
  }, [clerkUserId, cancelLinkingMutation]);

  // Автоматически сохранять канал при успешной верификации
  const onVerified = useEffectEvent(() => {
    if (clerkUserId) {
      saveChannelMutation({ clerkUserId });
    }
  });

  useEffect(() => {
    if (linkStatus?.status === "verified") {
      onVerified();
    }
  }, [linkStatus?.status]);

  return {
    isLoading: !isUserLoaded,
    isAuthenticated: !!clerkUserId,
    channels: channels ?? [],
    linkStatus,
    startLinking,
    saveChannel,
    unlinkChannel,
    cancelLinking,
  };
}
