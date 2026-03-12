type Props = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: Props) {
  return (
    <section className="empty-state">
      <p className="eyebrow">Belum ada data</p>
      <h3 className="empty-title">{title}</h3>
      <p className="muted-copy">{description}</p>
    </section>
  );
}
