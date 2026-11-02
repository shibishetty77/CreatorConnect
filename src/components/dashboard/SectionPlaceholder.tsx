import { PageHeader } from "@/components/dashboard/PageHeader";

type SectionPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
  note: string;
};

export function SectionPlaceholder({
  eyebrow,
  title,
  description,
  features,
  note,
}: SectionPlaceholderProps) {
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <section className="panel placeholder-panel">
        <span className="placeholder-kicker">Planned workspace</span>
        <h2>This module is ready for its next phase</h2>
        <p>
          Navigation, role protection, and the shared dashboard shell are
          active. The workflows below will be connected once their phase
          begins.
        </p>
        <ul className="placeholder-features">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        <p className="placeholder-note">{note}</p>
      </section>
    </>
  );
}
