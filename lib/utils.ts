import type { CoreAssistantMessage, CoreToolMessage, Message } from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { YourToolInvocation } from '@/lib/ai/tools/tools';

import type { Document } from '@/lib/db/schema';
import type { YourUIMessage } from '@/lib/types/ui';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export function findLastArtifact(
  messages: Array<YourUIMessage>,
): { messageIndex: number; toolCallId: string } | null {
  const allArtifacts: Array<{ messageIndex: number; toolCallId: string }> = [];

  messages.forEach((msg, messageIndex) => {
    msg.parts?.forEach((part) => {
      if (part.type === 'tool-invocation') {
        const toolInvocation = part.toolInvocation as YourToolInvocation;
        if (
          toolInvocation.state === 'result' &&
          toolInvocation.toolName === 'createDocument'
          // ||
          // toolInvocation.toolName === 'deepResearch'
        ) {
          allArtifacts.push({
            messageIndex,
            toolCallId: toolInvocation.toolCallId,
          });
        }
      }
    });
  });

  return allArtifacts[allArtifacts.length - 1] || null;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      'An error occurred while fetching the data.',
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function addToolMessageToChat({
  toolMessage,
  messages,
}: {
  toolMessage: CoreToolMessage;
  messages: Array<Message>;
}): Array<Message> {
  return messages.map((message) => {
    if (message.toolInvocations) {
      return {
        ...message,
        toolInvocations: message.toolInvocations.map((toolInvocation) => {
          const toolResult = toolMessage.content.find(
            (tool) => tool.toolCallId === toolInvocation.toolCallId,
          );

          if (toolResult) {
            return {
              ...toolInvocation,
              state: 'result',
              result: toolResult.result,
            };
          }

          return toolInvocation;
        }),
      };
    }

    return message;
  });
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function sanitizeResponseMessages({
  messages,
  reasoning,
}: {
  messages: Array<ResponseMessage>;
  reasoning: string | undefined;
}) {
  const toolResultIds: Array<string> = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      for (const content of message.content) {
        if (content.type === 'tool-result') {
          toolResultIds.push(content.toolCallId);
        }
      }
    }
  }

  const messagesBySanitizedContent = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (typeof message.content === 'string') return message;

    const sanitizedContent = message.content.filter((content) =>
      content.type === 'tool-call'
        ? toolResultIds.includes(content.toolCallId)
        : content.type === 'text'
          ? content.text.length > 0
          : true,
    );

    if (reasoning) {
      // @ts-expect-error: reasoning message parts in sdk is wip
      sanitizedContent.push({ type: 'reasoning', reasoning });
    }

    return {
      ...message,
      content: sanitizedContent,
    };
  });

  return messagesBySanitizedContent.filter(
    (message) => message.content.length > 0,
  );
}

export function getMostRecentUserMessage(messages: Array<YourUIMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number,
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: Array<ResponseMessage>;
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) return null;

  return trailingMessage.id;
}

export function cloneMessages<
  T extends { id: string; chatId: string; parentMessageId?: string | null },
>(sourceMessages: T[], newChatId: string): T[] {
  // First pass: Create mapping from old IDs to new IDs
  const idMap = new Map<string, string>();
  for (const message of sourceMessages) {
    idMap.set(message.id, generateUUID());
  }

  // Second pass: Clone messages using the ID mapping
  const clonedMessages: T[] = [];
  for (const message of sourceMessages) {
    const newId = idMap.get(message.id);
    if (!newId) {
      throw new Error(`Message ID ${message.id} not found in mapping`);
    }

    let newParentId: string | null = null;
    if (message.parentMessageId) {
      newParentId = idMap.get(message.parentMessageId) || null;
      if (!newParentId) {
        throw new Error(
          `Parent message ID ${message.parentMessageId} not found in mapping`,
        );
      }
    }

    const clonedMessage: T = {
      ...message,
      id: newId,
      chatId: newChatId,
      parentMessageId: newParentId,
    };
    clonedMessages.push(clonedMessage);
  }

  return clonedMessages;
}
