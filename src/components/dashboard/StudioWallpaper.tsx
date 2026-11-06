import type { CSSProperties } from "react";

type StudioIcon =
  | "camera"
  | "instagram"
  | "youtube"
  | "aperture"
  | "film"
  | "sparkle"
  | "video";

type WallpaperMark = {
  icon: StudioIcon;
  top: number;
  size: number;
  rotation: number;
  opacity: number;
  color: string;
} & ({ left: number; right?: never } | { right: number; left?: never });

const marks: WallpaperMark[] = [
  { icon: "aperture", top: 4, left: 6, size: 96, rotation: -13, opacity: 0.055, color: "#d96d59" },
  { icon: "instagram", top: 16, right: 14, size: 62, rotation: 12, opacity: 0.045, color: "#615c59" },
  { icon: "camera", top: 7, left: 48, size: 48, rotation: 8, opacity: 0.06, color: "#df735e" },
  { icon: "film", top: 33, right: 6, size: 86, rotation: -8, opacity: 0.04, color: "#484441" },
  { icon: "youtube", top: 24, left: 20, size: 56, rotation: 14, opacity: 0.05, color: "#d76955" },
  { icon: "sparkle", top: 46, right: 27, size: 42, rotation: -17, opacity: 0.07, color: "#756d68" },
  { icon: "camera", top: 12, right: 38, size: 112, rotation: 10, opacity: 0.045, color: "#d96d59" },
  { icon: "instagram", top: 52, left: 4, size: 76, rotation: -10, opacity: 0.05, color: "#6b6360" },
  { icon: "aperture", top: 39, left: 31, size: 58, rotation: 20, opacity: 0.065, color: "#df735e" },
  { icon: "video", top: 69, right: 18, size: 48, rotation: -12, opacity: 0.06, color: "#756d68" },
  { icon: "film", top: 58, left: 13, size: 96, rotation: 7, opacity: 0.035, color: "#5b5551" },
  { icon: "youtube", top: 31, right: 17, size: 72, rotation: 16, opacity: 0.055, color: "#d96d59" },
  { icon: "sparkle", top: 83, left: 41, size: 54, rotation: 23, opacity: 0.05, color: "#756d68" },
  { icon: "instagram", top: 73, right: 33, size: 48, rotation: -14, opacity: 0.07, color: "#df735e" },
  { icon: "camera", top: 91, left: 8, size: 128, rotation: -7, opacity: 0.04, color: "#5b5551" },
  { icon: "aperture", top: 64, right: 8, size: 88, rotation: 15, opacity: 0.055, color: "#d96d59" },
  { icon: "video", top: 47, left: 22, size: 64, rotation: -19, opacity: 0.045, color: "#746a65" },
  { icon: "film", top: 88, right: 43, size: 44, rotation: 11, opacity: 0.065, color: "#df735e" },
  { icon: "youtube", top: 26, left: 9, size: 84, rotation: -9, opacity: 0.05, color: "#605955" },
  { icon: "instagram", top: 97, right: 4, size: 70, rotation: 18, opacity: 0.04, color: "#d96d59" },
  { icon: "sparkle", top: 20, left: 72, size: 36, rotation: -24, opacity: 0.08, color: "#806eaa" },
  { icon: "aperture", top: 57, left: 57, size: 138, rotation: 9, opacity: 0.03, color: "#70645e" },
];

function IconShape({ icon }: { icon: StudioIcon }) {
  switch (icon) {
    case "camera":
      return (
        <>
          <path d="M7 14.5h2.3l2-2.8h7.4l2 2.8H23a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
          <circle cx="15" cy="20.5" r="4" />
          <path d="M9 10.5h6M22 11h3M8 3.5h9v5H8z" />
        </>
      );
    case "instagram":
      return (
        <>
          <rect x="5" y="5" width="20" height="20" rx="6" />
          <circle cx="15" cy="15" r="4.5" />
          <circle cx="21" cy="9" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "youtube":
      return (
        <>
          <path d="M27.5 15.8a3.1 3.1 0 0 0-2.2-2.2C23.4 13 15 13 15 13s-8.4 0-10.3.6a3.1 3.1 0 0 0-2.2 2.2A32 32 0 0 0 2 22a32 32 0 0 0 .5 6.2 3.1 3.1 0 0 0 2.2 2.2C6.6 31 15 31 15 31s8.4 0 10.3-.6a3.1 3.1 0 0 0 2.2-2.2A32 32 0 0 0 28 22a32 32 0 0 0-.5-6.2Z" />
          <path d="m12 26 8-4-8-4v8Z" fill="currentColor" stroke="none" />
        </>
      );
    case "aperture":
      return (
        <>
          <circle cx="16" cy="16" r="12" />
          <circle cx="16" cy="16" r="3" />
          <path d="m16 4 5 9m7 3H17m-1 12-5-9m-7-3h11m1-12 5 9m-1 15-5-9" />
        </>
      );
    case "film":
      return (
        <>
          <rect x="5" y="4" width="22" height="24" rx="2" />
          <path d="M5 10h22M5 22h22M10 10v12m12-12v12" />
          <path d="M8 7h.01M14 7h.01M20 7h.01M8 25h.01M14 25h.01M20 25h.01" />
        </>
      );
    case "sparkle":
      return (
        <>
          <path d="m17 3 2.3 7.7L27 13l-7.7 2.3L17 23l-2.3-7.7L7 13l7.7-2.3L17 3Z" />
          <path d="m7 22 1.2 3.8L12 27l-3.8 1.2L7 32l-1.2-3.8L2 27l3.8-1.2L7 22Zm17-17 .8 2.2L27 8l-2.2.8L24 11l-.8-2.2L21 8l2.2-.8L24 5Z" />
        </>
      );
    case "video":
      return (
        <>
          <rect x="3" y="8" width="19" height="16" rx="3" />
          <path d="m22 13 7-4v14l-7-4zM8 13h.01M13 13h.01M8 19h.01M13 19h.01" />
        </>
      );
  }
}

export function StudioWallpaper() {
  return (
    <div className="studio-wallpaper" aria-hidden="true">
      {marks.map((mark, index) => {
        const { icon, top, size, rotation, opacity, color } = mark;
        const position =
          "left" in mark
            ? { left: `${mark.left}%` }
            : { right: `${mark.right}%` };
        const style: CSSProperties = {
          ...position,
          top: `${top}%`,
          width: `${size}px`,
          height: `${size}px`,
          color,
          opacity,
          transform: `rotate(${rotation}deg)`,
        };

        return (
          <svg
            className="studio-wallpaper-icon"
            key={`${icon}-${index}`}
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={style}
          >
            <IconShape icon={icon} />
          </svg>
        );
      })}
    </div>
  );
}
