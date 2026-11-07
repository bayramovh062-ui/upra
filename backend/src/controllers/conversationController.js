import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { emitToUser } from '../socket.js';

// =====================================================================================
// Çat. Bir client və bir frilanser arasında YALNIZ BİR daimi söhbət (Conversation).
//  - Söhbət yalnız aralarında təklif (Proposal) olan cüt üçün açıla bilər (təklif göndərilən an açılır).
//    Müqavilə bunun içindədir (müqavilə həmişə təklifdən yaranır), ona görə müqavilə bitsə də söhbət qalır.
//  - Oxunmamış mesaj: qarşı tərəfin yazdığı və mənim *LastReadAt vaxtımdan sonrakı mesajlar.
//  - Silinmiş (soft delete) hesabla söhbət oxunaqlıdır, amma ona yeni mesaj yazmaq olmur.
//  - Söhbətin varlığı üçüncü şəxsə sızmır: iştirakçı olmayan üçün 404.
// =====================================================================================

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const LIST_LIMIT = 100;

const partySelect = { id: true, fullName: true, role: true, avatarUrl: true, deletedAt: true };

const shapeUser = (user) => ({
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    avatarUrl: user.deletedAt ? null : user.avatarUrl,
    isDeleted: Boolean(user.deletedAt),
});

const shapeMessage = (message) => ({
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt,
});

const parseLimit = (value) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
};

const isClientOf = (conversation, userId) => conversation.clientId === userId;
const readField = (conversation, userId) => (isClientOf(conversation, userId) ? 'clientLastReadAt' : 'freelancerLastReadAt');

// Mənim oxunmamış mesajlarım: qarşı tərəfin yazdığı və mənim son oxuma vaxtımdan sonrakılar
const unreadWhere = (conversation, userId) => {
    const lastRead = conversation[readField(conversation, userId)];
    return {
        conversationId: conversation.id,
        senderId: { not: userId },
        ...(lastRead && { createdAt: { gt: lastRead } }),
    };
};

const countUnread = (conversation, userId) => prisma.message.count({ where: unreadWhere(conversation, userId) });

// Bütün söhbətlər üzrə oxunmamış mesajların cəmi (sidebar nişanı üçün) bir sorğu ilə
const totalUnread = async (userId) => {
    const conversations = await prisma.conversation.findMany({
        where: { OR: [{ clientId: userId }, { freelancerId: userId }], lastMessageAt: { not: null } },
        select: { id: true, clientId: true, clientLastReadAt: true, freelancerLastReadAt: true },
    });
    if (conversations.length === 0) return 0;

    return prisma.message.count({
        where: { OR: conversations.map((c) => unreadWhere(c, userId)) },
    });
};

const shapeConversation = (conversation, userId, { unreadCount, lastMessage }) => {
    const other = isClientOf(conversation, userId) ? conversation.freelancer : conversation.client;
    return {
        id: conversation.id,
        otherUser: shapeUser(other),
        lastMessageAt: conversation.lastMessageAt,
        lastMessage: lastMessage ? shapeMessage(lastMessage) : null,
        unreadCount,
        createdAt: conversation.createdAt,
    };
};

// Söhbəti yalnız iştirakçıya verir; olmayan və ya başqasının söhbəti eyni 404 qaytarır
const loadMine = async (conversationId, userId) => {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { client: { select: partySelect }, freelancer: { select: partySelect } },
    });

    if (!conversation || ![conversation.clientId, conversation.freelancerId].includes(userId)) {
        throw new AppError('Conversation not found', 404);
    }
    return conversation;
};

// @route   POST /api/conversations   body: { userId }
// @access  Private. Qarşı tərəflə söhbəti açır, artıq varsa eynisini qaytarır (200), yeni olarsa 201.
export const openConversation = asyncHandler(async (req, res) => {
    const otherId = req.body.userId;

    if (otherId === req.user.id) {
        throw new AppError('You cannot start a conversation with yourself', 400);
    }

    const other = await prisma.user.findUnique({ where: { id: otherId }, select: partySelect });
    if (!other || other.deletedAt) {
        throw new AppError('User not found', 404);
    }
    if (other.role === req.user.role) {
        throw new AppError('Conversations are only possible between a client and a freelancer', 400);
    }

    const clientId = req.user.role === 'CLIENT' ? req.user.id : other.id;
    const freelancerId = req.user.role === 'CLIENT' ? other.id : req.user.id;

    // Əlaqə qaydası: frilanser bu client-in işinə təklif göndərib (müqavilə də bundan yaranır)
    const related = await prisma.proposal.findFirst({
        where: { freelancerId, jobPost: { clientId } },
        select: { id: true },
    });
    if (!related) {
        throw new AppError('You can only message a person you have a proposal or contract with', 403);
    }

    const include = { client: { select: partySelect }, freelancer: { select: partySelect } };
    let conversation = await prisma.conversation.findUnique({
        where: { clientId_freelancerId: { clientId, freelancerId } },
        include,
    });
    let created = false;

    if (!conversation) {
        try {
            conversation = await prisma.conversation.create({ data: { clientId, freelancerId }, include });
            created = true;
        } catch (err) {
            // İki tərəf eyni anda açanda biri unikal pozuntusu alır: mövcud söhbəti oxuyuruq
            if (err?.code !== 'P2002') throw err;
            conversation = await prisma.conversation.findUniqueOrThrow({
                where: { clientId_freelancerId: { clientId, freelancerId } },
                include,
            });
        }
    }

    const unreadCount = await countUnread(conversation, req.user.id);
    res.status(created ? 201 : 200).json({
        success: true,
        conversation: shapeConversation(conversation, req.user.id, { unreadCount, lastMessage: null }),
    });
});

// @route   GET /api/conversations
// @access  Private. Yalnız ən azı bir mesajı olan söhbətlər, ən son aktiv əvvəldə
export const getConversations = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const conversations = await prisma.conversation.findMany({
        where: { OR: [{ clientId: userId }, { freelancerId: userId }], lastMessageAt: { not: null } },
        include: {
            client: { select: partySelect },
            freelancer: { select: partySelect },
            messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'asc' }],
        take: LIST_LIMIT,
    });

    const unreadCounts = await Promise.all(conversations.map((c) => countUnread(c, userId)));

    res.status(200).json({
        success: true,
        count: conversations.length,
        conversations: conversations.map((c, i) =>
            shapeConversation(c, userId, { unreadCount: unreadCounts[i], lastMessage: c.messages[0] })
        ),
    });
});

// @route   GET /api/conversations/unread-count
// @access  Private. Sidebar nişanı üçün yüngül sorğu
export const getUnreadCount = asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, unreadCount: await totalUnread(req.user.id) });
});

// @route   GET /api/conversations/:id
// @access  Private (iştirakçı)
export const getConversation = asyncHandler(async (req, res) => {
    const conversation = await loadMine(req.params.id, req.user.id);
    const unreadCount = await countUnread(conversation, req.user.id);

    res.status(200).json({
        success: true,
        conversation: shapeConversation(conversation, req.user.id, { unreadCount, lastMessage: null }),
    });
});

// @route   GET /api/conversations/:id/messages?limit=50&before=<messageId>
// @access  Private (iştirakçı). Cavab köhnədən yeniyə düzülür; hasMore true olanda before ilə daha köhnələri çək.
export const getMessages = asyncHandler(async (req, res) => {
    const conversation = await loadMine(req.params.id, req.user.id);
    const limit = parseLimit(req.query.limit);
    const before = typeof req.query.before === 'string' ? req.query.before : null;

    let cursorArgs = {};
    if (before) {
        const exists = await prisma.message.findFirst({
            where: { id: before, conversationId: conversation.id },
            select: { id: true },
        });
        if (!exists) throw new AppError('Invalid "before" cursor', 400);
        cursorArgs = { cursor: { id: before }, skip: 1 };
    }

    const rows = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...cursorArgs,
    });

    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse().map(shapeMessage);

    res.status(200).json({ success: true, count: messages.length, hasMore, messages });
});

// @route   POST /api/conversations/:id/messages   body: { body }
// @access  Private (iştirakçı). Mesaj yazılır, söhbət yenilənir və hər iki tərəfə socket ilə göndərilir.
export const sendMessage = asyncHandler(async (req, res) => {
    const conversation = await loadMine(req.params.id, req.user.id);
    const other = isClientOf(conversation, req.user.id) ? conversation.freelancer : conversation.client;

    if (other.deletedAt) {
        throw new AppError('This account was deleted. You can no longer send messages in this conversation.', 403);
    }

    const message = await prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
            data: { conversationId: conversation.id, senderId: req.user.id, body: req.body.body },
        });
        // Yazan öz mesajını oxumuş sayılır
        await tx.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: created.createdAt, [readField(conversation, req.user.id)]: created.createdAt },
        });
        return created;
    });

    const payload = { conversationId: conversation.id, message: shapeMessage(message) };
    emitToUser(req.user.id, 'message:new', payload);
    emitToUser(other.id, 'message:new', payload);

    res.status(201).json({ success: true, message: payload.message });
});

// @route   PATCH /api/conversations/:id/read
// @access  Private (iştirakçı). Söhbəti oxunmuş edir (təkrar çağırış zərərsizdir)
export const markConversationRead = asyncHandler(async (req, res) => {
    const conversation = await loadMine(req.params.id, req.user.id);

    await prisma.conversation.update({
        where: { id: conversation.id },
        data: { [readField(conversation, req.user.id)]: new Date() },
    });

    res.status(200).json({ success: true, unreadCount: await totalUnread(req.user.id) });
});
