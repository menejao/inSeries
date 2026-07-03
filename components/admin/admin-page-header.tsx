export function AdminPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="section-title">{title}</h1>
      {description ? <p className="section-copy mt-1">{description}</p> : null}
    </div>
  );
}
