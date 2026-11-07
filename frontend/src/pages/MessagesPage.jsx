import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Avatar, Button, Card, EmptyState, ErrorState, Icon, PageHeader, Skeleton } from '../components/ui';
import {
    MAX_MESSAGE_LENGTH,
    useGetConversationQuery,
    useGetConversationsQuery,
    useGetMessagesQuery,
    useMarkConversationReadMutation,
    useSendMessageMutation,
} from '../features/chat/chatApi';
import { cn } from '../lib/cn';
import { getErrorMessage, timeAgo } from '../lib/format';

const badgeText = (count) => (count > 9 ? '9+' : String(count));

const ConversationRow = ({ conversation, active, onSelect }) => {
    const other = conversation.otherUser;
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left transition',
                active ? 'bg-surface-container-high' : 'hover:bg-surface-container-low'
            )}
        >
            <Avatar name={other?.fullName} src={other?.avatarUrl} />
            <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-body-md-medium text-on-surface">{other?.fullName}</span>
                    <span className="shrink-0 text-caption text-secondary">
                        {timeAgo(conversation.lastMessageAt)}
                    </span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-label-md text-secondary">
                        {conversation.lastMessage?.body ?? 'No messages yet'}
                    </span>
                    {conversation.unreadCount > 0 && (
                        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary-container px-1 text-[10px] font-bold leading-none text-on-primary">
                            {badgeText(conversation.unreadCount)}
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
};

const ConversationList = ({ conversations, selectedId, isLoading, isError, onRetry, onSelect }) => {
    if (isLoading) {
        return (
            <div className="divide-y divide-line">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="flex-1">
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="mt-2 h-3 w-3/4" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (isError) {
        return <div className="p-4"><ErrorState title="Could not load conversations" onRetry={onRetry} /></div>;
    }

    if (conversations.length === 0) {
        return (
            <div className="p-4">
                <EmptyState
                    icon="chat_bubble"
                    title="No conversations yet"
                    description="Open a contract and use Message to start talking with the other party."
                />
            </div>
        );
    }

    return (
        <div className="divide-y divide-line">
            {conversations.map((c) => (
                <ConversationRow
                    key={c.id}
                    conversation={c}
                    active={c.id === selectedId}
                    onSelect={() => onSelect(c.id)}
                />
            ))}
        </div>
    );
};

const MessageBubble = ({ message, mine }) => (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
        <div
            className={cn(
                'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-body-md sm:max-w-[70%]',
                mine ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface'
            )}
        >
            {message.body}
            <span className={cn('mt-1 block text-caption', mine ? 'text-on-primary/70' : 'text-secondary')}>
                {timeAgo(message.createdAt)}
            </span>
        </div>
    </div>
);

const ChatThread = ({ conversationId, onBack }) => {
    const user = useSelector((state) => state.auth.user);
    const [before, setBefore] = useState(undefined);
    const [body, setBody] = useState('');
    const listRef = useRef(null);
    const markedCountRef = useRef(0);

    const conversationQ = useGetConversationQuery(conversationId);
    const messagesQ = useGetMessagesQuery({ id: conversationId, before });
    const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
    const [markRead] = useMarkConversationReadMutation();

    const conversation = conversationQ.data?.conversation;
    const other = conversation?.otherUser;
    const messages = messagesQ.data?.messages ?? [];
    const hasMore = Boolean(messagesQ.data?.hasMore);
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

    // Sohbet achilanda ve yeni mesaj gelende oxunmush sayilir.
    useEffect(() => {
        if (messages.length === 0 || markedCountRef.current === messages.length) return;
        markedCountRef.current = messages.length;
        markRead(conversationId);
    }, [conversationId, messages.length, markRead]);

    // Yalniz yeni mesaj gelende ashaghi sürüshürük; kohne sehife yuklenende yer deyishmir.
    useEffect(() => {
        const el = listRef.current;
        if (el && lastMessageId) el.scrollTop = el.scrollHeight;
    }, [lastMessageId]);

    const submit = async (event) => {
        event?.preventDefault();
        const text = body.trim();
        if (!text || sending) return;
        try {
            await sendMessage({ id: conversationId, body: text }).unwrap();
            setBody('');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not send the message'));
        }
    };

    const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
        }
    };

    return (
        <div className="flex h-full min-h-[32rem] flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Back to conversations"
                    className="rounded-lg p-1.5 text-secondary hover:bg-surface-container-high hover:text-on-surface lg:hidden"
                >
                    <Icon name="arrow_back" />
                </button>
                {conversationQ.isLoading ? (
                    <Skeleton className="h-9 w-48" />
                ) : conversationQ.isError ? (
                    <span className="text-body-md text-secondary">Conversation unavailable</span>
                ) : (
                    <>
                        <Avatar name={other?.fullName} src={other?.avatarUrl} />
                        <div className="min-w-0">
                            <p className="truncate text-body-md-medium text-on-surface">{other?.fullName}</p>
                            <p className="text-caption text-secondary">
                                {other?.role === 'CLIENT' ? 'Client' : 'Freelancer'}
                                {other?.isDeleted ? ' - account deleted' : ''}
                            </p>
                        </div>
                    </>
                )}
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messagesQ.isLoading ? (
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-12 w-2/3" />
                        <Skeleton className="ml-auto h-12 w-1/2" />
                        <Skeleton className="h-12 w-3/5" />
                    </div>
                ) : messagesQ.isError ? (
                    <ErrorState title="Could not load messages" onRetry={messagesQ.refetch} />
                ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center">
                        <div>
                            <p className="text-body-md-medium text-on-surface">No messages yet</p>
                            <p className="mt-1 text-label-md text-secondary">
                                Say hello to {other?.fullName ?? 'the other party'}.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {hasMore && (
                            <div className="text-center">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setBefore(messages[0].id)}
                                    loading={messagesQ.isFetching}
                                >
                                    Load earlier messages
                                </Button>
                            </div>
                        )}
                        {messages.map((m) => (
                            <MessageBubble key={m.id} message={m} mine={m.senderId === user?.id} />
                        ))}
                    </>
                )}
            </div>

            <form onSubmit={submit} className="border-t border-line p-3">
                <div className="flex items-end gap-2">
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                        onKeyDown={onKeyDown}
                        rows={2}
                        maxLength={MAX_MESSAGE_LENGTH}
                        disabled={Boolean(other?.isDeleted)}
                        placeholder={other?.isDeleted ? 'This account was deleted.' : 'Write a message...'}
                        className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-body-md text-on-surface shadow-sm placeholder:text-secondary/60 focus:border-primary-container focus:outline-none focus:ring-2 focus:ring-primary-container disabled:cursor-not-allowed disabled:bg-surface-container-low"
                    />
                    <Button type="submit" loading={sending} disabled={!body.trim() || Boolean(other?.isDeleted)}>
                        <Icon name="send" className="text-[18px]" />
                        Send
                    </Button>
                </div>
                {body.length > MAX_MESSAGE_LENGTH - 200 && (
                    <p className="mt-1 text-right text-caption text-secondary">
                        {body.length}/{MAX_MESSAGE_LENGTH}
                    </p>
                )}
            </form>
        </div>
    );
};

const MessagesPage = () => {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const { data, isLoading, isError, refetch } = useGetConversationsQuery();
    const conversations = data?.conversations ?? [];

    return (
        <>
            <PageHeader
                title="Messages"
                description="One conversation per client and freelancer. History stays available after a contract ends."
            />

            <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
                <Card className={cn('overflow-hidden', conversationId && 'hidden lg:block')}>
                    <ConversationList
                        conversations={conversations}
                        selectedId={conversationId}
                        isLoading={isLoading}
                        isError={isError}
                        onRetry={refetch}
                        onSelect={(id) => navigate(`/messages/${id}`)}
                    />
                </Card>

                <Card className={cn('overflow-hidden', !conversationId && 'hidden lg:flex')}>
                    {conversationId ? (
                        <ChatThread
                            key={conversationId}
                            conversationId={conversationId}
                            onBack={() => navigate('/messages')}
                        />
                    ) : (
                        <div className="flex w-full items-center justify-center p-6">
                            <EmptyState
                                icon="forum"
                                title="Select a conversation"
                                description="Choose a conversation on the left, or open a contract and use Message."
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
};

export default MessagesPage;
