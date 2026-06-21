"use client";

import React from "react";
import { createPortal } from "react-dom";
import { getImageUrls as resolveImageUrls } from "@/lib/client-api";

interface ItemImageGalleryProps {
  urls?: string[];
  paths?: string[];
  alt: string;
}

export function ItemImageGallery({ urls: urlsProp, paths, alt }: ItemImageGalleryProps) {
  const [urls, setUrls] = React.useState<string[]>(urlsProp ?? []);
  const [index, setIndex] = React.useState(0);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (urlsProp) {
      setUrls(urlsProp);
      return;
    }
    if (!paths?.length) {
      setUrls([]);
      return;
    }

    let cancelled = false;
    void resolveImageUrls(paths).then((resolved) => {
      if (!cancelled) setUrls(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [paths, urlsProp]);

  React.useEffect(() => {
    setIndex((current) => (current >= urls.length ? 0 : current));
  }, [urls.length]);

  React.useEffect(() => {
    if (!viewerOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowLeft") {
        setIndex((current) => (current - 1 + urls.length) % urls.length);
      }
      if (event.key === "ArrowRight") {
        setIndex((current) => (current + 1) % urls.length);
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [viewerOpen, urls.length]);

  if (!urls.length) return null;

  const hasMultiple = urls.length > 1;

  function showPrev(e?: React.SyntheticEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setIndex((current) => (current - 1 + urls.length) % urls.length);
  }

  function showNext(e?: React.SyntheticEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setIndex((current) => (current + 1) % urls.length);
  }

  function openViewer(e: React.SyntheticEvent) {
    e.stopPropagation();
    e.preventDefault();
    setViewerOpen(true);
  }

  function handleSwipeEnd(diff: number) {
    if (!hasMultiple || Math.abs(diff) < 24) return;
    if (diff < 0) showNext();
    else showPrev();
  }

  const lightbox =
    viewerOpen && mounted
      ? createPortal(
          <div
            className="image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`${alt} 照片檢視`}
            onClick={() => setViewerOpen(false)}
          >
            <div
              className="image-lightbox__panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="image-lightbox__header">
                <p className="image-lightbox__title">{alt}</p>
                {hasMultiple && (
                  <span className="image-lightbox__counter">
                    {index + 1} / {urls.length}
                  </span>
                )}
                <button
                  type="button"
                  className="image-lightbox__close"
                  onClick={() => setViewerOpen(false)}
                  aria-label="關閉"
                >
                  ✕
                </button>
              </div>

              <div
                className="image-lightbox__body"
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  if (touchStartX.current === null) return;
                  const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
                  handleSwipeEnd(endX - touchStartX.current);
                  touchStartX.current = null;
                }}
              >
                <img
                  src={urls[index]}
                  alt={`${alt} 照片 ${index + 1}`}
                  className="image-lightbox__img"
                />

                {hasMultiple && (
                  <>
                    <button
                      type="button"
                      className="image-lightbox__nav image-lightbox__nav--prev"
                      onClick={showPrev}
                      aria-label="上一張照片"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="image-lightbox__nav image-lightbox__nav--next"
                      onClick={showNext}
                      aria-label="下一張照片"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className="relative h-48 w-48 shrink-0 sm:h-56 sm:w-56"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
          handleSwipeEnd(endX - touchStartX.current);
          touchStartX.current = null;
        }}
      >
        <button
          type="button"
          className="block h-48 w-48 cursor-zoom-in overflow-hidden rounded-xl sm:h-56 sm:w-56"
          onClick={openViewer}
          aria-label={`查看${alt}照片`}
        >
          <img
            src={urls[index]}
            alt={`${alt} 照片 ${index + 1}`}
            className="h-full w-full object-contain"
            style={{ border: "1px solid var(--border)", background: "var(--accent-soft)" }}
          />
        </button>

        {hasMultiple && (
          <>
            <button
              type="button"
              className="gallery-nav gallery-nav--prev"
              onClick={showPrev}
              aria-label="上一張照片"
            >
              ‹
            </button>
            <button
              type="button"
              className="gallery-nav gallery-nav--next"
              onClick={showNext}
              aria-label="下一張照片"
            >
              ›
            </button>
            <span className="gallery-counter">
              {index + 1}/{urls.length}
            </span>
          </>
        )}
      </div>

      {lightbox}
    </>
  );
}
