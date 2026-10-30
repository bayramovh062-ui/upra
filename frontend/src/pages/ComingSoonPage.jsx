import { EmptyState, PageHeader } from '../components/ui';

// Hələ yazılmamış səhifələr üçün müvəqqəti yer tutucu. Hər fazada real səhifə ilə əvəz olunur.
const ComingSoonPage = ({ title }) => (
    <>
        <PageHeader title={title} />
        <EmptyState
            title="Coming soon"
            description="This page is not built yet. It will be implemented in one of the next phases."
        />
    </>
);

export default ComingSoonPage;
