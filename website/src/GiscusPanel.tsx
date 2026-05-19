import { MessageCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

type GiscusPanelProps = {
  lang: 'en' | 'hr';
  theme: 'light' | 'dark';
};

const repo = import.meta.env.VITE_GISCUS_REPO || 'IvicaSkrobo/Bili-Mushroom';
const repoId = import.meta.env.VITE_GISCUS_REPO_ID;
const category = import.meta.env.VITE_GISCUS_CATEGORY || 'General';
const categoryId = import.meta.env.VITE_GISCUS_CATEGORY_ID;

export function GiscusPanel({ lang, theme }: GiscusPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const isConfigured = Boolean(repoId && categoryId);

  useEffect(() => {
    if (!isConfigured || !hostRef.current) return;

    hostRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-repo', repo);
    script.setAttribute('data-repo-id', repoId);
    script.setAttribute('data-category', category);
    script.setAttribute('data-category-id', categoryId);
    script.setAttribute('data-mapping', 'pathname');
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'bottom');
    script.setAttribute('data-theme', theme === 'dark' ? 'transparent_dark' : 'light');
    script.setAttribute('data-lang', lang === 'hr' ? 'hr' : 'en');
    hostRef.current.appendChild(script);
  }, [isConfigured, lang, theme]);

  return (
    <section className="giscus-panel" aria-label={lang === 'hr' ? 'Komentari zajednice' : 'Community comments'}>
      <div className="giscus-panel-heading">
        <MessageCircle size={18} />
        <h3>{lang === 'hr' ? 'Komentari uz release' : 'Release comments'}</h3>
      </div>
      {isConfigured ? (
        <div ref={hostRef} />
      ) : (
        <div className="giscus-placeholder">
          <p>
            {lang === 'hr'
              ? 'Komentari uz release dolaze uskoro. Dotad pitanja i prijedlozi mogu ici kroz GitHub Discussions.'
              : 'Release comments are coming soon. Until then, questions and ideas can live in GitHub Discussions.'}
          </p>
        </div>
      )}
    </section>
  );
}
