/**
 * PlaceholderPage - Temporary placeholder for unimplemented views
 */

import styles from './PlaceholderPage.module.css';

interface PlaceholderPageProps {
  title: string;
  icon: string;
  description?: string;
}

export function PlaceholderPage({ title, icon, description }: PlaceholderPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.icon}>{icon}</div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>
        {description || 'This view is coming soon in a future phase.'}
      </p>
      <div className={styles.phase}>Phase 2-4</div>
    </div>
  );
}
