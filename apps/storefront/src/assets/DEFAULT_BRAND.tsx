import { createIcon } from "@chakra-ui/react";

export const DEFAULT_BRAND = createIcon({
  displayName: "ScaniaStorefrontMark",
  viewBox: "0 0 260 56",
  defaultProps: {
    width: "auto",
    padding: 1,
  },
  path: (
    <>
      <rect x="4" y="8" width="40" height="40" rx="10" fill="#102A43" />
      <path d="M13 35C17.5 29 21.5 26 24.5 26C27.5 26 31.5 29 36 35" stroke="#9FB3C8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M15 39.5H34" stroke="#D9E2EC" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 21.5L24.5 18L28 21.5" stroke="#D9E2EC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      <text x="56" y="30" fill="#102A43" fontFamily="Inter, system-ui, sans-serif" fontSize="22" fontWeight="700" letterSpacing="2.2">
        SCANIA
      </text>
      <text x="56" y="44" fill="#627D98" fontFamily="Inter, system-ui, sans-serif" fontSize="8" fontWeight="600" letterSpacing="1.6">
        CUSTOMER PORTAL
      </text>
    </>
  ),
});
