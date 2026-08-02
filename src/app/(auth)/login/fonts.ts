import { IBM_Plex_Sans, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
});
