// Səhifə başlığı: sol tərəfdə ad və təsvir, sağda əməliyyat düyməsi
const PageHeader = ({ title, description, action }) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
            <h1 className="text-2xl font-bold text-ink">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {action}
    </div>
);

export default PageHeader;
