import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/office/app/api-client'
import type { Message, Session } from '@/lib/office/types'

export const chatQueryKeys = {
  all: ['chats'] as const,
  lists: () => ['chats', 'list'] as const,
  detail: (id: string) => ['chats', id] as const,
  messages: (sessionId: string) => ['chats', sessionId, 'messages'] as const,
}

export function useChatListQuery() {
  return useQuery<Session[]>({
    queryKey: chatQueryKeys.lists(),
    queryFn: () => api<Session[]>('GET', '/chats'),
    staleTime: 10_000,
  })
}

export function useMessagesQuery(sessionId: string) {
  return useQuery<Message[]>({
    queryKey: chatQueryKeys.messages(sessionId),
    queryFn: () => api<Message[]>('GET', `/chats/${sessionId}/messages`),
    enabled: !!sessionId,
    staleTime: 5_000,
  })
}
