import { useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import { Avatar, Button, EmptyState, ErrorState, Icon, Modal, Skeleton, StatusBadge } from '../../components/ui';
import { cn } from '../../lib/cn';
import { getErrorMessage } from '../../lib/format';
import IssueDrawer from './IssueDrawer';
import IssueFormModal from './IssueFormModal';
import { useGetIssuesQuery, useMoveIssueMutation } from './issuesApi';
import useIssueSocket from './useIssueSocket';

const COLUMNS = [
    { status: 'TODO', title: 'To do', dot: 'bg-outline' },
    { status: 'IN_PROGRESS', title: 'In progress', dot: 'bg-primary-container' },
    { status: 'DONE', title: 'Done', dot: 'bg-emerald-500' },
];

// Float position: iki qonşunun ortası. Sütun boşdursa 1000.
const computePosition = (prev, next) => {
    if (prev != null && next != null) return (prev + next) / 2;
    if (prev != null) return prev + 1000;
    if (next != null) return next / 2;
    return 1000;
};

const MOVE_OPTIONS = {
    TODO: ['IN_PROGRESS', 'DONE'],
    IN_PROGRESS: ['TODO', 'DONE'],
    DONE: ['TODO', 'IN_PROGRESS'],
};

const columnTitle = (status) => COLUMNS.find((c) => c.status === status)?.title || status;

const IssueCard = ({ issue, onOpen, onMove, readOnly, moving }) => (
    <div className="flex w-full flex-col gap-3">
        <button type="button" onClick={() => onOpen(issue.id)} className="flex w-full flex-col gap-3 text-left">
            <p className="break-words text-body-md-medium text-on-surface">{issue.title}</p>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <StatusBadge status={issue.priority} />
                    {(issue.comments?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-caption text-secondary">
                            <Icon name="chat_bubble_outline" className="text-[14px]" />
                            {issue.comments.length}
                        </span>
                    )}
                </div>
                {issue.assignee ? (
                    <Avatar name={issue.assignee.fullName} size="sm" />
                ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-line text-secondary">
                        <Icon name="person" className="text-[16px]" />
                    </span>
                )}
            </div>
        </button>
        {!readOnly && (
            <div className="flex justify-end md:hidden">
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMove(issue);
                    }}
                    disabled={moving}
                >
                    <Icon name="swap_horiz" className="text-[16px]" />
                    Move to…
                </Button>
            </div>
        )}
    </div>
);

// readOnly: contract ACTIVE deyilsə sürüşdürmə və yaratma söndürülür (backend də 400 qaytarır)
const KanbanBoard = ({ contract, readOnly }) => {
    const { data, isLoading, isError, refetch } = useGetIssuesQuery(contract.id);
    const [moveIssue, { isLoading: moving }] = useMoveIssueMutation();
    const live = useIssueSocket(contract.id);
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [moveTarget, setMoveTarget] = useState(null);

    const issues = useMemo(() => data?.issues ?? [], [data]);

    const byStatus = useMemo(() => {
        const map = { TODO: [], IN_PROGRESS: [], DONE: [] };
        issues.forEach((i) => map[i.status]?.push(i));
        Object.values(map).forEach((list) => list.sort((a, b) => a.position - b.position));
        return map;
    }, [issues]);

    const selected = issues.find((i) => i.id === selectedId) ?? null;

    const moveToStatus = async (issue, status) => {
        const target = byStatus[status] ?? [];
        const last = target[target.length - 1];
        const position = computePosition(last?.position, null);
        try {
            await moveIssue({ id: issue.id, contractId: contract.id, status, position }).unwrap();
            setMoveTarget(null);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not move the issue'));
        }
    };

    const onDragEnd = async ({ draggableId, source, destination }) => {
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        // Sürüşdürülən kartı çıxarıb hədəf sütunun siyahısına baxırıq
        const target = byStatus[destination.droppableId].filter((i) => i.id !== draggableId);
        const prev = target[destination.index - 1]?.position;
        const next = target[destination.index]?.position;
        const position = computePosition(prev, next);

        try {
            await moveIssue({
                id: draggableId,
                contractId: contract.id,
                status: destination.droppableId,
                position,
            }).unwrap();
        } catch (err) {
            // optimistic dəyişiklik avtomatik geri qaytarılır
            toast.error(getErrorMessage(err, 'Could not move the issue'));
        }
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-72 w-full" />
                ))}
            </div>
        );
    }

    if (isError) return <ErrorState title="Could not load the board" onRetry={refetch} />;

    return (
        <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-headline-sm text-on-surface">
                    <Icon name="view_kanban" className="text-[22px] text-primary-container" />
                    Project board
                    <span className="text-label-md font-normal text-secondary">
                        {issues.filter((i) => i.status === 'DONE').length} / {issues.length} done
                    </span>
                    <span
                        className={cn(
                            'flex items-center gap-1 text-caption font-medium',
                            live ? 'text-emerald-600' : 'text-secondary',
                        )}
                    >
                        <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-500' : 'bg-outline')} />
                        {live ? 'Live' : 'Offline'}
                    </span>
                </h2>
                {!readOnly && (
                    <Button onClick={() => setCreateOpen(true)}>
                        <Icon name="add" className="text-[18px]" />
                        Create issue
                    </Button>
                )}
            </div>

            {issues.length === 0 && (
                <div className="mb-4">
                    <EmptyState
                        icon="checklist"
                        title="No issues yet"
                        description={readOnly ? 'This contract is closed.' : 'Create the first issue to start planning the work.'}
                    />
                </div>
            )}

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex items-start gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:snap-none">
                    {COLUMNS.map((col) => (
                        <div
                            key={col.status}
                            className="min-w-[82vw] max-w-[82vw] shrink-0 snap-start rounded-xl bg-surface-container-low p-3 sm:min-w-[360px] sm:max-w-[360px] md:min-w-0 md:max-w-none"
                        >
                            <div className="mb-3 flex items-center gap-2 px-1">
                                <span className={cn('h-2 w-2 rounded-full', col.dot)} />
                                <h3 className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
                                    {col.title}
                                </h3>
                                <span className="tabular text-caption text-secondary">{byStatus[col.status].length}</span>
                            </div>

                            <Droppable droppableId={col.status}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={cn(
                                            'flex min-h-24 flex-col gap-2 rounded-lg transition-colors',
                                            snapshot.isDraggingOver && 'bg-primary-fixed/50',
                                        )}
                                    >
                                        {byStatus[col.status].map((issue, index) => (
                                            <Draggable
                                                key={issue.id}
                                                draggableId={issue.id}
                                                index={index}
                                                isDragDisabled={readOnly}
                                            >
                                                {(drag, dragSnapshot) => (
                                                    <div
                                                        ref={drag.innerRef}
                                                        {...drag.draggableProps}
                                                        {...drag.dragHandleProps}
                                                        style={{ ...drag.draggableProps.style, touchAction: 'manipulation' }}
                                                        className={cn(
                                                            'rounded-xl bg-surface-container-lowest p-3 shadow-sm transition-shadow hover:shadow-md select-none',
                                                            dragSnapshot.isDragging && 'shadow-lg ring-2 ring-primary-container',
                                                        )}
                                                    >
                                                        <IssueCard
                                                            issue={issue}
                                                            onOpen={setSelectedId}
                                                            onMove={setMoveTarget}
                                                            readOnly={readOnly}
                                                            moving={moving}
                                                        />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>

            <Modal
                open={!!moveTarget}
                onClose={() => setMoveTarget(null)}
                title={moveTarget ? `Move “${moveTarget.title}”` : 'Move issue'}
                footer={
                    <Button variant="secondary" onClick={() => setMoveTarget(null)} disabled={moving}>
                        Cancel
                    </Button>
                }
            >
                <p className="mb-3 text-body-md text-secondary">Choose a column for this card.</p>
                <div className="flex flex-col gap-2">
                    {(MOVE_OPTIONS[moveTarget?.status] || []).map((status) => (
                        <Button
                            key={status}
                            variant="secondary"
                            className="justify-start"
                            loading={moving}
                            onClick={() => moveToStatus(moveTarget, status)}
                        >
                            <Icon name="drive_file_move" className="text-[18px]" />
                            Move to {columnTitle(status)}
                        </Button>
                    ))}
                </div>
            </Modal>

            <IssueFormModal open={createOpen} onClose={() => setCreateOpen(false)} contract={contract} />
            <IssueDrawer
                issue={selected}
                contract={contract}
                readOnly={readOnly}
                onClose={() => setSelectedId(null)}
            />
        </>
    );
};

export default KanbanBoard;

