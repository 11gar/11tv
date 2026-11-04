import { useState } from 'preact/hooks';

interface Props {
  url: string | null;
  class?: string;
}

/** Pochette d'album, avec une note de musique si elle manque ou ne se charge pas. */
export function Artwork({ url, class: className = '' }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = url !== null && url !== failedUrl;
  return (
    <div class={`artwork ${className}`}>
      {showImage ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => {
            setFailedUrl(url);
          }}
        />
      ) : (
        <span aria-hidden="true">♪</span>
      )}
    </div>
  );
}
