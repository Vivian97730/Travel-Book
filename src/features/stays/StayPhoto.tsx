import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { StayPhoto as Photo } from "@travel-book/contracts";
import type { StaysRepository } from "./staysRepository";

export function StayPhoto({ photo, repository, fallback, alt, online }: {
  photo: Photo | null; repository?: StaysRepository; fallback: ReactNode; alt: string; online: boolean;
}) {
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    setLoaded(null);
    if (!photo || !repository?.readPhoto || !online) return;
    let active = true;
    let objectUrl: string | undefined;
    void repository.readPhoto(photo.id).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ id: photo.id, url: objectUrl });
    }).catch(() => { /* The illustration remains visible on any read failure. */ });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo?.id, repository, online]);
  return online && loaded && loaded.id === photo?.id
    ? <img src={loaded.url} alt={alt} onError={() => setLoaded(null)} /> : fallback;
}
