import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { issuesApi } from './issuesApi';

// API ünvanı http://host:5000/api -> socket serveri http://host:5000
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

// Contract otağına qoşulur və backend hadisələrini RTK Query cache-nə yazır.
// Qaytarır: bağlantı statusu (true = canlı)
const useIssueSocket = (contractId) => {
    const dispatch = useDispatch();
    const token = useSelector((state) => state.auth.token);
    const [live, setLive] = useState(false);

    useEffect(() => {
        const authToken = token || localStorage.getItem('token');
        if (!contractId || !authToken) return undefined;

        const socket = io(SOCKET_URL, { auth: { token: authToken } });
        let firstConnect = true;

        const patch = (recipe) =>
            dispatch(issuesApi.util.updateQueryData('getIssues', contractId, recipe));

        socket.on('connect', () => {
            socket.emit('join_contract', contractId);
            setLive(true);
            // Yenidən qoşulmada qaçırılmış hadisələr üçün siyahını təzələ
            if (!firstConnect) {
                dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: `C-${contractId}` }]));
            }
            firstConnect = false;
        });
        socket.on('disconnect', () => setLive(false));
        socket.on('connect_error', () => setLive(false));

        // Öz əməliyyatımız da geri gəlir, ona görə id ilə təkrarın qarşısı alınır
        socket.on('issue:created', (issue) =>
            patch((draft) => {
                if (!draft.issues.some((i) => i.id === issue.id)) {
                    draft.issues.push({ comments: [], ...issue });
                }
            }),
        );

        const merge = (issue) =>
            patch((draft) => {
                const existing = draft.issues.find((i) => i.id === issue.id);
                if (existing) Object.assign(existing, issue);
            });
        socket.on('issue:updated', merge);
        socket.on('issue:moved', merge);

        socket.on('issue:deleted', ({ id }) =>
            patch((draft) => {
                draft.issues = draft.issues.filter((i) => i.id !== id);
            }),
        );

        socket.on('comment:created', (comment) =>
            patch((draft) => {
                const issue = draft.issues.find((i) => i.id === comment.issueId);
                if (issue) {
                    issue.comments = issue.comments ?? [];
                    if (!issue.comments.some((c) => c.id === comment.id)) issue.comments.push(comment);
                }
            }),
        );

        // Digər tərəf təhvil verdi, bitirdi, ləğv etdi və ya dəyişiklik istədi: müqavilə və siyahılar yenilənir.
        // Ləğv zamanı escrow geri qaytarılır, ona görə pul kisəsi də yenilənir
        socket.on('contract:updated', () =>
            dispatch(
                issuesApi.util.invalidateTags([
                    { type: 'Contract', id: contractId },
                    { type: 'Contract', id: 'LIST' },
                    'Job',
                    'Wallet',
                ]),
            ),
        );

        // Mərhələ maliyyələşdi, təhvil verildi, təsdiqləndi və ya dəyişiklik istəndi:
        // müqavilə (milestones daxil) və pul kisəsi yenilənir. Escrow tab-ı və Board eyni soketi bölüşür.
        socket.on('milestone:updated', () =>
            dispatch(
                issuesApi.util.invalidateTags([
                    { type: 'Contract', id: contractId },
                    { type: 'Contract', id: 'LIST' },
                    'Wallet',
                ]),
            ),
        );

        // Kart mövqeləri yenidən nömrələndi (backend rebalance etdi): siyahı təzələnir
        socket.on('board:reordered', () =>
            dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: `C-${contractId}` }])),
        );

        return () => {
            socket.emit('leave_contract', contractId);
            socket.disconnect();
            setLive(false);
        };
    }, [contractId, token, dispatch]);

    return live;
};

export default useIssueSocket;
