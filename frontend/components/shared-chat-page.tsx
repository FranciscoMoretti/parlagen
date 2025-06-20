'use client';
import { useParams } from 'react-router-dom';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { getDefaultThread } from '@/lib/thread-utils';
import { useDefaultModel } from '@/providers/default-model-provider';
import { useMemo } from 'react';
import { WithSkeleton } from '@/components/ui/skeleton';
import { usePublicChat, usePublicChatMessages } from '@/hooks/use-shared-chat';
import { notFound } from 'next/navigation';

export function SharedChatPage() {
  const { id } = useParams<{ id: string }>();
  const defaultModel = useDefaultModel();

  const {
    data: chat,
    isLoading: isChatLoading,
    error: chatError,
  } = usePublicChat(id as string);
  const {
    data: messages,
    isLoading: isMessagesLoading,
    error: messagesError,
  } = usePublicChatMessages(id as string);

  const initialThreadMessages = useMemo(() => {
    if (!messages) return [];
    return getDefaultThread(
      messages.map((msg) => ({ ...msg, id: msg.id.toString() })),
    );
  }, [messages]);

  if (!id) {
    return notFound();
  }

  if (chatError || messagesError) {
    // TODO: Replace for error page
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="text-muted-foreground">
          This chat is not available or has been set to private
        </div>
      </div>
    );
  }

  if (!isChatLoading && !chat) {
    return notFound();
  }

  return (
    <>
      <WithSkeleton
        isLoading={isChatLoading || isMessagesLoading}
        className="w-full"
      >
        <Chat
          id={id}
          initialMessages={initialThreadMessages}
          selectedChatModel={defaultModel}
          isReadonly={true}
        />
      </WithSkeleton>
      <DataStreamHandler id={id} />
    </>
  );
}
