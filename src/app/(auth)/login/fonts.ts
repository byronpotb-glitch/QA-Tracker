import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
});
